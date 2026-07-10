import { FC, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader, Play, X } from "lucide-react"

interface Props {
    definition: string
    isPending: boolean
    onDispatch: (inputs: Record<string, string>) => void
    onClose: () => void
}

// Pulls input names and defaults out of the workflow_dispatch block. A light
// line-based scan is enough here: the server re-validates and applies
// defaults authoritatively.
function extractInputs(definition: string): { name: string; defaultValue: string }[] {
    const lines = definition.split("\n")
    const inputs: { name: string; defaultValue: string }[] = []
    let inDispatch = false
    let inInputs = false
    let inputsIndent = 0
    let current: { name: string; defaultValue: string } | null = null
    let currentIndent = 0

    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith("#")) continue
        const indent = line.length - line.trimStart().length
        const trimmed = line.trim()

        if (/^workflow_dispatch:/.test(trimmed)) { inDispatch = true; inInputs = false; continue }
        if (inDispatch && !inInputs && /^inputs:/.test(trimmed)) { inInputs = true; inputsIndent = indent; continue }
        if (inInputs) {
            if (indent <= inputsIndent) { inDispatch = false; inInputs = false; current = null; continue }
            const keyMatch = trimmed.match(/^([A-Za-z0-9_-]+):\s*$/)
            if (keyMatch && (!current || indent <= currentIndent)) {
                current = { name: keyMatch[1], defaultValue: "" }
                currentIndent = indent
                inputs.push(current)
                continue
            }
            const defaultMatch = trimmed.match(/^default:\s*(.*)$/)
            if (defaultMatch && current && indent > currentIndent) {
                current.defaultValue = defaultMatch[1].replace(/^["']|["']$/g, "")
            }
        }
    }
    return inputs
}

const DispatchDialog: FC<Props> = ({ definition, isPending, onDispatch, onClose }) => {
    const { t } = useTranslation()
    const declaredInputs = useMemo(() => extractInputs(definition), [definition])
    const [values, setValues] = useState<Record<string, string>>(
        () => Object.fromEntries(declaredInputs.map(i => [i.name, i.defaultValue]))
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg w-full max-w-md mx-4 p-5 flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">{t("pages.workflows.dispatch")}</div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label="close">
                        <X size={16} />
                    </button>
                </div>

                {declaredInputs.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {declaredInputs.map(input => (
                            <div key={input.name} className="flex flex-col gap-1">
                                <label className="text-sm font-medium">{input.name}</label>
                                <input
                                    className="px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-700"
                                    value={values[input.name] ?? ""}
                                    onChange={e => setValues(v => ({ ...v, [input.name]: e.target.value }))}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                        {t("pages.workflows.noInputs")}
                    </div>
                )}

                <button
                    onClick={() => onDispatch(values)}
                    disabled={isPending}
                    className="px-4 py-2 flex gap-2 items-center justify-center bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                    {isPending ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
                    {t("pages.workflows.runWorkflow")}
                </button>
            </div>
        </div>
    )
}

export default DispatchDialog
