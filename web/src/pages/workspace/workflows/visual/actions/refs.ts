import { useQuery } from "@tanstack/react-query"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { getWorkflowSecrets, getWorkflowVars } from "@/api/workflow"

export const varExpression = (key: string) => `\${{ vars.${key} }}`
export const secretExpression = (key: string) => `\${{ secrets.${key} }}`

/**
 * Keys of the workspace's workflow variables and secrets. Listing them needs
 * owner/admin; for other members the lists are simply empty.
 */
export function useWorkflowRefs() {
    const workspaceId = useCurrentWorkspaceId()
    // Same keys as the settings page so both share the cache.
    const vars = useQuery({
        queryKey: ['workflowVars', workspaceId],
        queryFn: () => getWorkflowVars(workspaceId),
        enabled: !!workspaceId,
        retry: false,
        staleTime: 60_000,
    })
    const secrets = useQuery({
        queryKey: ['workflowSecrets', workspaceId],
        queryFn: () => getWorkflowSecrets(workspaceId),
        enabled: !!workspaceId,
        retry: false,
        staleTime: 60_000,
    })
    return {
        vars: (vars.data ?? []).map(v => v.key),
        secrets: (secrets.data ?? []).map(s => s.key),
        isLoading: vars.isLoading || secrets.isLoading,
    }
}
