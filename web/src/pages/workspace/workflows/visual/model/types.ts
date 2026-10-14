export interface StepView {
    index: number
    id?: string
    name?: string
    uses?: string
    run?: string
    if?: string
    with?: Record<string, unknown>
    env?: Record<string, unknown>
    shell?: string
    workingDirectory?: string
}

export interface JobView {
    id: string
    name?: string
    runsOn?: string
    needs: string[]
    if?: string
    uses?: string
    steps: StepView[]
    hasMatrix: boolean
    raw: Record<string, unknown>
}

export interface WorkflowView {
    name?: string
    triggers: string[]
    on: Record<string, unknown>
    jobs: JobView[]
    raw: Record<string, unknown>
}

/**
 * A validation finding. `key` is looked up under
 * pages.workflows.visual.issues and interpolated with `params`.
 */
export interface Issue {
    level: "error" | "warning"
    key: string
    params?: Record<string, string | number>
    jobId?: string
}

export interface ParseError {
    message: string
    line?: number
    col?: number
}
