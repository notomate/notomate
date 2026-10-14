import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ReactFlowProvider } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { WorkflowValidationError } from "@/api/workflow"
import { WorkflowEditorContext, createWorkflowEditorStore, type XY } from "./store"
import Canvas from "./Canvas"
import Toolbar from "./Toolbar"
import Inspector from "./inspector/Inspector"
import ActionPickerDialog from "./ActionPickerDialog"

interface Props {
    value: string
    onChange: (value: string) => void
    errors: WorkflowValidationError[]
    /** Node positions are remembered per key (the workflow id). */
    layoutKey: string
    /** Jumps to a line in the YAML tab. */
    onShowLine: (line: number) => void
}

const layoutStorageKey = (key: string) => `notomate:workflow-layout:${key}`

function loadPositions(key: string): Record<string, XY> | undefined {
    try {
        const raw = localStorage.getItem(layoutStorageKey(key))
        return raw ? JSON.parse(raw) as Record<string, XY> : undefined
    } catch {
        return undefined
    }
}

const isEditable = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))

export default function VisualWorkflowEditor({ value, onChange, errors, layoutKey, onShowLine }: Props) {
    const { t } = useTranslation()
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const [store] = useState(() => createWorkflowEditorStore(value, {
        onChange: text => onChangeRef.current(text),
        parseErrorMessage: () => t("pages.workflows.visual.fixYamlFirst"),
        initialPositions: layoutKey === "new" ? undefined : loadPositions(layoutKey),
    }))

    // Text edited in the YAML tab, or reloaded after saving.
    useEffect(() => store.getState().sync(value), [store, value])

    useEffect(() => {
        if (layoutKey === "new") return
        let timer: ReturnType<typeof setTimeout> | undefined
        const unsubscribe = store.subscribe((s, prev) => {
            if (s.positions === prev.positions) return
            clearTimeout(timer)
            timer = setTimeout(() => {
                try {
                    localStorage.setItem(layoutStorageKey(layoutKey), JSON.stringify(s.positions))
                } catch {
                    // Layout is a convenience; ignore storage failures.
                }
            }, 500)
        })
        return () => { clearTimeout(timer); unsubscribe() }
    }, [store, layoutKey])

    // Undo / redo graph edits; text fields keep their own undo.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || isEditable(e.target) || store.getState().picker) return
            const key = e.key.toLowerCase()
            if (key === "z" && !e.shiftKey) {
                e.preventDefault()
                store.getState().undo()
            } else if (key === "y" || (key === "z" && e.shiftKey)) {
                e.preventDefault()
                store.getState().redo()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [store])

    return (
        <WorkflowEditorContext.Provider value={store}>
            <div className="flex flex-col-reverse lg:flex-row min-w-0 overflow-hidden rounded-lg border dark:border-neutral-700 lg:h-[calc(100vh-15rem)] lg:min-h-[560px]">
                <aside className="lg:w-[360px] lg:shrink-0 border-t lg:border-t-0 lg:border-r dark:border-neutral-700 overflow-y-auto bg-white dark:bg-neutral-800">
                    <Inspector serverErrors={errors} onShowLine={onShowLine} />
                </aside>
                <div className="flex-1 min-w-0 flex flex-col h-[60vh] lg:h-auto bg-white dark:bg-neutral-800">
                    <Toolbar />
                    <div className="flex-1 min-h-0">
                        <ReactFlowProvider>
                            <Canvas />
                        </ReactFlowProvider>
                    </div>
                </div>
            </div>
            <ActionPickerDialog />
        </WorkflowEditorContext.Provider>
    )
}
