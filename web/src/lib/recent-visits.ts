const LAST_WORKSPACE_KEY = "notepia:lastWorkspaceId"

export const getLastWorkspaceId = (): string | null => {
    return localStorage.getItem(LAST_WORKSPACE_KEY)
}

export const setLastWorkspaceId = (workspaceId: string): void => {
    localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId)
}
