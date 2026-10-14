import { Document, isScalar, parseDocument, visit, type Scalar } from "yaml"
import type { JobView, ParseError, StepView, WorkflowView } from "./types"

export interface ParseResult {
    doc: Document | null
    view: WorkflowView | null
    error: ParseError | null
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v)

const str = (v: unknown): string | undefined =>
    v === undefined || v === null ? undefined : typeof v === "object" ? JSON.stringify(v) : String(v)

export const EMPTY_VIEW: WorkflowView = { triggers: [], on: {}, jobs: [], raw: {} }

export function parseWorkflow(text: string): ParseResult {
    const doc = parseDocument(text, { prettyErrors: true })
    if (doc.errors.length > 0) {
        const e = doc.errors[0]
        return {
            doc: null,
            view: null,
            error: { message: e.message.split("\n")[0], line: e.linePos?.[0].line, col: e.linePos?.[0].col },
        }
    }
    const js = doc.toJS() ?? {}
    if (!isRecord(js)) {
        return { doc: null, view: null, error: { message: "workflow must be a YAML mapping" } }
    }
    moveBlankLinesOffEmptyValues(doc)
    return { doc, view: toView(js), error: null }
}

/**
 * yaml attaches the blank line after an empty value (e.g. `workflow_dispatch:`)
 * to that value, so keys inserted after it end up on the wrong side of the
 * blank line. Move it to the next key; the output text is unchanged.
 */
function moveBlankLinesOffEmptyValues(doc: Document) {
    let pending: Scalar | null = null
    visit(doc, {
        Pair(_, pair) {
            if (pending && isScalar(pair.key)) {
                pair.key.spaceBefore = true
                pending.spaceBefore = false
                pending = null
            }
            if (isScalar(pair.value) && pair.value.value === null && pair.value.spaceBefore) pending = pair.value
        },
    })
}

export function normalizeOn(on: unknown): Record<string, unknown> {
    if (typeof on === "string") return { [on]: null }
    if (Array.isArray(on)) return Object.fromEntries(on.map(e => [String(e), null]))
    if (isRecord(on)) return on
    return {}
}

export function normalizeNeeds(needs: unknown): string[] {
    if (typeof needs === "string") return [needs]
    if (Array.isArray(needs)) return needs.map(String)
    return []
}

function toStep(s: unknown, index: number): StepView {
    if (!isRecord(s)) return { index, name: str(s) }
    return {
        index,
        id: str(s.id),
        name: str(s.name),
        uses: str(s.uses),
        run: str(s.run),
        if: str(s.if),
        with: isRecord(s.with) ? s.with : undefined,
        env: isRecord(s.env) ? s.env : undefined,
        shell: str(s.shell),
        workingDirectory: str(s["working-directory"]),
    }
}

function toView(js: Record<string, unknown>): WorkflowView {
    const on = normalizeOn(js.on)
    const jobsRaw = isRecord(js.jobs) ? js.jobs : {}
    const jobs: JobView[] = Object.entries(jobsRaw).map(([id, j]) => {
        const job = isRecord(j) ? j : {}
        const strategy = isRecord(job.strategy) ? job.strategy : undefined
        return {
            id,
            name: str(job.name),
            runsOn: str(job["runs-on"]),
            needs: normalizeNeeds(job.needs),
            if: str(job.if),
            uses: str(job.uses),
            steps: Array.isArray(job.steps) ? job.steps.map(toStep) : [],
            hasMatrix: !!strategy && strategy.matrix !== undefined,
            raw: job,
        }
    })
    return { name: str(js.name), triggers: Object.keys(on), on, jobs, raw: js }
}
