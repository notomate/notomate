// Hallmark pre-emit critique: P4 H4 E4 S4 R5 V3. Existing app tokens; editor workbench.
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { WorkflowValidationError } from "@/api/workflow"

interface Props {
    value: string
    onChange: (value: string) => void
    errors: WorkflowValidationError[]
    disabled?: boolean
}

export default function WorkflowDefinitionEditor({ value, onChange, errors, disabled }: Props) {
    const { t } = useTranslation()
    const editor = useRef<HTMLTextAreaElement>(null)
    const gutter = useRef<HTMLDivElement>(null)
    const [wrap, setWrap] = useState(false)
    const [position, setPosition] = useState({ line: 1, column: 1 })
    const lines = value.split("\n")
    const updatePosition = () => {
        const before = value.slice(0, editor.current?.selectionStart ?? 0).split("\n")
        setPosition({ line: before.length, column: before[before.length - 1].length + 1 })
    }
    const goToLine = (line: number) => {
        const target = editor.current
        if (!target) return
        const index = Math.min(Math.max(line - 1, 0), lines.length - 1)
        const start = lines.slice(0, index).reduce((sum, text) => sum + text.length + 1, 0)
        setWrap(false)
        requestAnimationFrame(() => {
            target.focus()
            target.setSelectionRange(start, start + lines[index].length)
            target.scrollTop = Math.max(0, index * 24 - target.clientHeight / 2)
            if (gutter.current) gutter.current.scrollTop = target.scrollTop
            updatePosition()
        })
    }
    return <section className="min-w-0 overflow-hidden rounded-lg border dark:border-neutral-700">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b dark:border-neutral-700 px-4 py-3">
            <label htmlFor="workflow-definition" className="text-sm font-semibold">{t("pages.workflows.definition")}</label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                <input type="checkbox" checked={wrap} onChange={event => setWrap(event.target.checked)} />
                {t("pages.workflows.wrapLines")}
            </label>
        </div>
        <div className="flex min-w-0 bg-white dark:bg-neutral-900 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary">
            {!wrap && <div ref={gutter} aria-hidden="true" className="h-[55vh] min-h-[360px] overflow-hidden select-none border-r dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-4 text-right font-mono text-sm leading-6 text-muted-foreground">
                {lines.map((_, index) => <div key={index} className={errors.some(error => error.line === index + 1) ? "text-red-600 dark:text-red-400 font-bold" : ""}>{index + 1}</div>)}
            </div>}
            <textarea ref={editor} id="workflow-definition" value={value} disabled={disabled}
                aria-invalid={errors.length > 0} aria-describedby={errors.length ? "workflow-errors" : undefined}
                spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap={wrap ? "soft" : "off"}
                onChange={event => onChange(event.target.value)} onSelect={updatePosition}
                onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop }}
                className="block h-[55vh] min-h-[360px] w-full min-w-0 resize-none bg-transparent px-4 py-4 font-mono text-sm leading-6 outline-none disabled:opacity-50"
            />
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t dark:border-neutral-700 px-4 py-2 text-xs text-muted-foreground">
            <span>{t("pages.workflows.cursorPosition", position)}</span>
            <span>{t("pages.workflows.saveShortcut")}</span>
        </div>
        {errors.length > 0 && <div id="workflow-errors" role="alert" className="border-t dark:border-neutral-700 p-4 text-sm text-red-700 dark:text-red-300">
            <p className="mb-2 font-semibold">{t("pages.workflows.validationFailed")}</p>
            <ul className="space-y-1">{errors.map((error, index) => <li key={index}>
                {error.line > 0 ? <button type="button" onClick={() => goToLine(error.line)} className="text-left underline underline-offset-4 break-words">L{error.line}: {error.message}</button> : error.message}
            </li>)}</ul>
        </div>}
    </section>
}
