// Action metadata for the visual editor: the workspace's marketplace
// actions plus a built-in snapshot of common GitHub actions.
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { getMarketplaceActions, marketplaceActionsKey, type MarketplaceActionData } from "@/api/actionMarketplace"
import builtinActions from "./builtin-actions.json"

export interface InputDef {
    name: string
    description?: string
    required: boolean
    default?: string
    deprecationMessage?: string
}

export interface ActionEntry {
    /** Value for `uses:`, including the ref. */
    uses: string
    name: string
    description?: string
    /** runs.using, e.g. node20, docker, composite. */
    using?: string
    inputs: InputDef[]
    icon?: string
    color?: string
    /** "builtin", or the marketplace source as owner/repo[@ref]. */
    source: string
    sourceId?: string
}

/** Inputs every docker action accepts besides its own. */
export const DOCKER_EXTRA_INPUTS = ["args", "entrypoint"]

type BuiltinMeta = { name?: string; description?: string; using?: string; inputs: InputDef[] }

export const BUILTIN_ACTIONS: ActionEntry[] = Object.entries(builtinActions as Record<string, BuiltinMeta>).map(([uses, meta]) => ({
    uses,
    name: meta.name ?? uses,
    description: meta.description,
    using: meta.using,
    inputs: meta.inputs,
    source: "builtin",
}))

/** owner/repo[/path] in lower case: the part of `uses` that names the action. */
export function actionKey(uses: string): string {
    const u = uses.trim()
    const at = u.lastIndexOf("@")
    return (at > 0 ? u.slice(0, at) : u).toLowerCase()
}

export function usesRef(uses: string): string | undefined {
    const at = uses.lastIndexOf("@")
    return at > 0 ? uses.slice(at + 1) : undefined
}

/** Whether `uses` points at a remote action we could have metadata for. */
export function isRemoteUses(uses: string): boolean {
    const u = uses.trim()
    return !!u && !u.startsWith("./") && !u.startsWith("../") && !u.startsWith("docker://") && !u.includes("${{") && u.includes("/")
}

export function fromMarketplace(a: MarketplaceActionData, sourceLabel: string): ActionEntry {
    return {
        uses: a.uses,
        name: a.name,
        description: a.description || undefined,
        using: a.runs_using || undefined,
        inputs: a.inputs.map(i => ({
            name: i.name,
            description: i.description,
            required: i.required,
            default: i.default,
            deprecationMessage: i.deprecation_message,
        })),
        icon: a.icon || undefined,
        color: a.color || undefined,
        source: sourceLabel,
        sourceId: a.source_id,
    }
}

function sourceLabel(uses: string): string {
    const key = actionKey(uses).split("/").slice(0, 2).join("/")
    const ref = usesRef(uses)
    return ref ? `${key}@${ref}` : key
}

export interface ActionCatalog {
    marketplace: ActionEntry[]
    builtin: ActionEntry[]
    isLoading: boolean
    /** Metadata for a `uses` value: exact match first, then any ref of the same action. */
    lookup: (uses: string) => ActionEntry | undefined
}

export function useActionCatalog(): ActionCatalog {
    const workspaceId = useCurrentWorkspaceId()
    const { data, isLoading } = useQuery({
        queryKey: marketplaceActionsKey(workspaceId),
        queryFn: () => getMarketplaceActions(workspaceId),
        enabled: !!workspaceId,
        staleTime: 60_000,
    })

    return useMemo(() => {
        const marketplace = (data ?? []).map(a => fromMarketplace(a, sourceLabel(a.uses)))
        const all = [...marketplace, ...BUILTIN_ACTIONS]
        const exact = new Map<string, ActionEntry>()
        const byKey = new Map<string, ActionEntry>()
        for (const e of all) {
            const u = e.uses.trim().toLowerCase()
            if (!exact.has(u)) exact.set(u, e)
            const k = actionKey(e.uses)
            if (!byKey.has(k)) byKey.set(k, e)
        }
        const lookup = (uses: string) => {
            if (!isRemoteUses(uses)) return undefined
            return exact.get(uses.trim().toLowerCase()) ?? byKey.get(actionKey(uses))
        }
        return { marketplace, builtin: BUILTIN_ACTIONS, isLoading, lookup }
    }, [data, isLoading])
}

/** Compares action inputs with a step's `with`. */
export function checkInputs(entry: ActionEntry, given: Record<string, unknown> | undefined) {
    const keys = Object.keys(given ?? {})
    const known = new Set(entry.inputs.map(i => i.name))
    if (entry.using === "docker") DOCKER_EXTRA_INPUTS.forEach(k => known.add(k))
    return {
        missing: entry.inputs.filter(i => i.required && i.default === undefined && !keys.includes(i.name)).map(i => i.name),
        unknown: keys.filter(k => !known.has(k)),
        deprecated: entry.inputs.filter(i => i.deprecationMessage && keys.includes(i.name)).map(i => i.name),
    }
}
