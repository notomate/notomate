// State of one visual editor. The YAML text is the source of truth: graph
// edits go through `apply`, which edits a copy of the parsed Document and
// writes it back as text. Node positions live here only, never in the YAML.
import { createContext, useContext } from "react"
import { createStore, useStore, type StoreApi } from "zustand"
import type { Document } from "yaml"
import { EMPTY_VIEW, parseWorkflow } from "./model/parse"
import { STRINGIFY_OPTS } from "./model/mutate"
import { validate } from "./model/validate"
import type { Issue, ParseError, WorkflowView } from "./model/types"
import { toast } from "@/stores/toast"

export interface XY {
    x: number
    y: number
}

export type Selection = { kind: "job"; id: string } | { kind: "trigger" } | null

/** Where to put an action chosen in the picker. */
export type PickerTarget = { jobId: string; stepIndex?: number } | null

type TextOrigin = "external" | "graph" | "history"

export interface WorkflowEditorState {
    /** Latest text, which may not parse. */
    text: string
    /** Latest text that parsed; undo history is made of these. */
    committed: string
    doc: Document | null
    view: WorkflowView
    parseError: ParseError | null
    issues: Issue[]
    positions: Record<string, XY>
    selection: Selection
    picker: PickerTarget
    past: string[]
    future: string[]

    /** Takes text edited outside the graph (the YAML tab). */
    sync: (text: string) => void
    /** Edits the workflow through its YAML Document; false when not applied. */
    apply: (fn: (doc: Document) => void, after?: (s: WorkflowEditorState) => Partial<WorkflowEditorState>) => boolean
    undo: () => void
    redo: () => void
    select: (sel: Selection) => void
    openPicker: (target: PickerTarget) => void
    setPosition: (id: string, pos: XY) => void
    /** Fills in positions for nodes that have none and drops stale ones. */
    mergePositions: (pos: Record<string, XY>, keep: string[]) => void
    resetLayout: () => void
}

export type WorkflowEditorStore = StoreApi<WorkflowEditorState>

const HISTORY_LIMIT = 200

export interface CreateOptions {
    /** Called with the new text after every graph edit, undo or redo. */
    onChange: (text: string) => void
    /** Error message shown when editing while the YAML does not parse. */
    parseErrorMessage: () => string
    initialPositions?: Record<string, XY>
}

export function createWorkflowEditorStore(text: string, options: CreateOptions): WorkflowEditorStore {
    const parsed = parseWorkflow(text)

    return createStore<WorkflowEditorState>((set, get) => {
        const commit = (next: string, origin: TextOrigin, extra: Partial<WorkflowEditorState> = {}) => {
            const s = get()
            const r = parseWorkflow(next)
            const changed = r.doc !== null && next !== s.committed
            set({
                text: next,
                parseError: r.error,
                ...(r.doc && r.view
                    ? {
                        committed: next,
                        doc: r.doc,
                        view: r.view,
                        issues: validate(r.view),
                        // Only graph edits are undoable here; the YAML tab has its own undo.
                        ...(changed && origin === "graph"
                            ? { past: [...s.past, s.committed].slice(-HISTORY_LIMIT), future: [] }
                            : {}),
                    }
                    : {}),
                ...extra,
            })
            if (origin !== "external") options.onChange(next)
        }

        return {
            text,
            committed: parsed.doc ? text : "",
            doc: parsed.doc,
            view: parsed.view ?? EMPTY_VIEW,
            parseError: parsed.error,
            issues: parsed.view ? validate(parsed.view) : [],
            positions: options.initialPositions ?? {},
            selection: null,
            picker: null,
            past: [],
            future: [],

            sync: next => {
                if (next === get().text) return
                commit(next, "external")
            },

            apply: (fn, after) => {
                const s = get()
                if (s.parseError || !s.doc) {
                    toast.error(options.parseErrorMessage())
                    return false
                }
                const doc = s.doc.clone()
                try {
                    fn(doc)
                } catch (e) {
                    toast.error((e as Error).message)
                    return false
                }
                commit(doc.toString(STRINGIFY_OPTS), "graph", after ? after(get()) : {})
                return true
            },

            undo: () => {
                const s = get()
                if (!s.past.length) return
                const prev = s.past[s.past.length - 1]
                set({ past: s.past.slice(0, -1), future: [s.committed, ...s.future] })
                commit(prev, "history")
            },

            redo: () => {
                const s = get()
                if (!s.future.length) return
                const [next, ...rest] = s.future
                set({ past: [...s.past, s.committed], future: rest })
                commit(next, "history")
            },

            select: selection => {
                if (JSON.stringify(get().selection) !== JSON.stringify(selection)) set({ selection })
            },
            openPicker: picker => set({ picker }),
            setPosition: (id, pos) => set(s => ({ positions: { ...s.positions, [id]: pos } })),
            mergePositions: (pos, keep) =>
                set(s => {
                    const merged = { ...pos, ...s.positions }
                    return { positions: Object.fromEntries(keep.filter(id => merged[id]).map(id => [id, merged[id]])) }
                }),
            resetLayout: () => set({ positions: {} }),
        }
    })
}

export const WorkflowEditorContext = createContext<WorkflowEditorStore | null>(null)

export function useEditorStore(): WorkflowEditorStore {
    const store = useContext(WorkflowEditorContext)
    if (!store) throw new Error("useEditorStore must be used inside WorkflowEditorContext")
    return store
}

export function useEditor<T>(selector: (s: WorkflowEditorState) => T): T {
    return useStore(useEditorStore(), selector)
}
