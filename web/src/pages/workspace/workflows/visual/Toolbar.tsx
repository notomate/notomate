import { useTranslation } from "react-i18next"
import { LayoutGrid, Plus, Redo2, Undo2 } from "lucide-react"
import { useEditor, useEditorStore } from "./store"
import * as m from "./model/mutate"

const buttonClass = "px-2.5 py-1.5 flex gap-1.5 items-center text-sm rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-transparent"

export default function Toolbar() {
    const { t } = useTranslation()
    const store = useEditorStore()
    const canUndo = useEditor(s => s.past.length > 0)
    const canRedo = useEditor(s => s.future.length > 0)
    const { apply, undo, redo, resetLayout } = store.getState()

    // New jobs go downstream of the selected job, if any.
    const addJob = () => {
        const { selection, positions } = store.getState()
        const from = selection?.kind === "job" ? selection.id : undefined
        let id = ""
        apply(
            doc => {
                id = m.uniqueJobId(doc, "job")
                m.addJob(doc, id, from ? [from] : [])
            },
            s => {
                const base = from ? positions[from] : undefined
                return {
                    selection: { kind: "job", id },
                    positions: base ? { ...s.positions, [id]: { x: base.x + 320, y: base.y } } : s.positions,
                }
            },
        )
    }

    return (
        <div className="flex items-center gap-1 flex-wrap border-b dark:border-neutral-700 px-2 py-1.5">
            <button type="button" onClick={addJob} className={buttonClass}>
                <Plus size={15} />{t("pages.workflows.visual.addJob")}
            </button>
            <button type="button" onClick={resetLayout} className={buttonClass}>
                <LayoutGrid size={15} />{t("pages.workflows.visual.autoLayout")}
            </button>
            <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
            <button type="button" onClick={undo} disabled={!canUndo} className={buttonClass}
                aria-label={t("pages.workflows.visual.undo")} title={`${t("pages.workflows.visual.undo")} (Ctrl+Z)`}>
                <Undo2 size={15} />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} className={buttonClass}
                aria-label={t("pages.workflows.visual.redo")} title={`${t("pages.workflows.visual.redo")} (Ctrl+Y)`}>
                <Redo2 size={15} />
            </button>
        </div>
    )
}
