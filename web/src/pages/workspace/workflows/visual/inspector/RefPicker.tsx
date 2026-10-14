import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Braces, KeyRound, Variable } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { secretExpression, useWorkflowRefs, varExpression } from "../actions/refs"

const itemClass = "flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none font-mono data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-800"
const labelClass = "px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"

/** Picks a workflow variable or secret and hands back its `${{ }}` expression. */
export default function RefPicker({ onPick }: { onPick: (expression: string) => void }) {
    const { t } = useTranslation()
    const workspaceId = useCurrentWorkspaceId()
    const { vars, secrets, isLoading } = useWorkflowRefs()
    const empty = !isLoading && vars.length === 0 && secrets.length === 0

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button type="button" title={t("pages.workflows.visual.insertRef")} aria-label={t("pages.workflows.visual.insertRef")}
                    className="ml-auto p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-700">
                    <Braces size={13} />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4}
                    className="min-w-[200px] max-w-[320px] max-h-[320px] overflow-y-auto bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border dark:border-neutral-700 rounded-lg shadow-lg p-1 z-popover">
                    {vars.length > 0 && (
                        <DropdownMenu.Group>
                            <DropdownMenu.Label className={labelClass}>{t("pages.workflows.visual.refVars")}</DropdownMenu.Label>
                            {vars.map(key => (
                                <DropdownMenu.Item key={`v-${key}`} className={itemClass} onSelect={() => onPick(varExpression(key))}>
                                    <Variable size={13} className="shrink-0 opacity-60" /><span className="truncate">{key}</span>
                                </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Group>
                    )}
                    {secrets.length > 0 && (
                        <DropdownMenu.Group>
                            <DropdownMenu.Label className={labelClass}>{t("pages.workflows.visual.refSecrets")}</DropdownMenu.Label>
                            {secrets.map(key => (
                                <DropdownMenu.Item key={`s-${key}`} className={itemClass} onSelect={() => onPick(secretExpression(key))}>
                                    <KeyRound size={13} className="shrink-0 opacity-60" /><span className="truncate">{key}</span>
                                </DropdownMenu.Item>
                            ))}
                        </DropdownMenu.Group>
                    )}
                    {isLoading && <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("pages.workflows.marketplace.loading")}</div>}
                    {empty && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            {t("pages.workflows.visual.refEmpty")}{" "}
                            <Link to={`/workspaces/${workspaceId}/workflows/settings`} className="underline">{t("pages.workflows.settingsTitle")}</Link>
                        </div>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}
