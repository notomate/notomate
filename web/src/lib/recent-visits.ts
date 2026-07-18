const LAST_WORKSPACE_KEY = "notepia:lastWorkspaceId"
const LAST_NOTE_KEY_PREFIX = "notepia:lastNoteId:"

export const getLastWorkspaceId = (): string | null => {
    return localStorage.getItem(LAST_WORKSPACE_KEY)
}

export const setLastWorkspaceId = (workspaceId: string): void => {
    localStorage.setItem(LAST_WORKSPACE_KEY, workspaceId)
}

export const getLastNoteId = (workspaceId: string): string | null => {
    return localStorage.getItem(`${LAST_NOTE_KEY_PREFIX}${workspaceId}`)
}

export const setLastNoteId = (workspaceId: string, noteId: string): void => {
    localStorage.setItem(`${LAST_NOTE_KEY_PREFIX}${workspaceId}`, noteId)
}

export const clearLastNoteId = (workspaceId: string): void => {
    localStorage.removeItem(`${LAST_NOTE_KEY_PREFIX}${workspaceId}`)
}
