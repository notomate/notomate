// Form fields that commit on blur or Enter, so typing doesn't rewrite the
// YAML (and push undo history) on every keystroke.
import { useEffect, useId, useState, type ReactNode } from "react"
import { parse, stringify } from "yaml"
import { cn } from "@/lib/utils"

export const inputClass = "w-full px-2.5 py-1.5 text-sm border dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 focus-visible:outline-primary aria-[invalid=true]:border-red-400"
export const labelClass = "text-xs font-medium text-neutral-600 dark:text-neutral-300"
export const hintClass = "text-xs text-muted-foreground"
export const errorClass = "text-xs text-red-500"

interface BaseProps {
    label: ReactNode
    hint?: ReactNode
    placeholder?: string
}

export function Field({ id, label, hint, error, children }: { id?: string; label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className={labelClass}>{label}</label>
            {children}
            {error ? <div className={errorClass}>{error}</div> : hint && <div className={hintClass}>{hint}</div>}
        </div>
    )
}

export function TextField({
    label, hint, placeholder, value, onCommit, mono, validate,
}: BaseProps & {
    value: string | undefined
    onCommit: (v: string) => void
    mono?: boolean
    validate?: (v: string) => string | null
}) {
    const id = useId()
    const [local, setLocal] = useState(value ?? "")
    useEffect(() => setLocal(value ?? ""), [value])
    const error = validate ? validate(local) : null
    const commit = () => {
        if (error) return
        if (local !== (value ?? "")) onCommit(local.trim() === "" ? "" : local)
    }
    return (
        <Field id={id} label={label} hint={hint} error={error}>
            <input
                id={id}
                className={cn(inputClass, mono && "font-mono")}
                value={local}
                placeholder={placeholder}
                aria-invalid={!!error}
                spellCheck={!mono}
                onChange={e => setLocal(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === "Enter") commit()
                    if (e.key === "Escape") setLocal(value ?? "")
                }}
            />
        </Field>
    )
}

export function TextAreaField({
    label, hint, placeholder, value, onCommit, rows = 3,
}: BaseProps & { value: string | undefined; onCommit: (v: string) => void; rows?: number }) {
    const id = useId()
    const [local, setLocal] = useState(value ?? "")
    useEffect(() => setLocal(value ?? ""), [value])
    return (
        <Field id={id} label={label} hint={hint}>
            <textarea
                id={id}
                className={cn(inputClass, "font-mono")}
                rows={Math.max(rows, Math.min(local.split("\n").length, 14))}
                value={local}
                placeholder={placeholder}
                spellCheck={false}
                onChange={e => setLocal(e.target.value)}
                onBlur={() => local !== (value ?? "") && onCommit(local)}
            />
        </Field>
    )
}

const toYaml = (v: unknown) => (v === undefined || v === null ? "" : stringify(v, { lineWidth: 0 }).trimEnd())

/** Edits a nested value (with, env, strategy…) as a YAML snippet. */
export function YamlField({
    label, hint, placeholder, value, onCommit,
}: BaseProps & { value: unknown; onCommit: (v: unknown) => void }) {
    const id = useId()
    const initial = toYaml(value)
    const [local, setLocal] = useState(initial)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        setLocal(initial)
        setError(null)
    }, [initial])
    const commit = () => {
        if (local === initial) return
        try {
            const parsed = local.trim() === "" ? undefined : parse(local)
            setError(null)
            onCommit(parsed)
        } catch (e) {
            setError((e as Error).message.split("\n")[0])
        }
    }
    return (
        <Field id={id} label={label} hint={hint} error={error}>
            <textarea
                id={id}
                className={cn(inputClass, "font-mono")}
                rows={Math.max(2, Math.min(local.split("\n").length + 1, 14))}
                value={local}
                placeholder={placeholder}
                spellCheck={false}
                aria-invalid={!!error}
                onChange={e => setLocal(e.target.value)}
                onBlur={commit}
            />
        </Field>
    )
}

/** A comma- or newline-separated list of strings. */
export function ListField({
    label, hint, placeholder, value, onCommit,
}: BaseProps & { value: string[] | undefined; onCommit: (v: string[]) => void }) {
    return (
        <TextField
            label={label}
            hint={hint}
            placeholder={placeholder}
            value={(value ?? []).join(", ")}
            mono
            onCommit={v => onCommit(v.split(/[,\n]/).map(x => x.trim()).filter(Boolean))}
        />
    )
}

export function Section({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={cn("flex flex-col gap-3 px-4 py-3 border-b dark:border-neutral-700", className)}>
            {title && <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>}
            {children}
        </section>
    )
}
