import type { Edge, Node } from "@xyflow/react"
import dagre from "@dagrejs/dagre"
import type { Issue, JobView, WorkflowView } from "../model/types"
import type { XY } from "../store"

export const TRIGGER_ID = "__trigger__"
export const NODE_WIDTH = 240
export const MAX_STEPS_SHOWN = 6

export type JobNodeData = { job: JobView; issues: Issue[] }
export type TriggerNodeData = { triggers: string[]; name?: string }
export type JobNodeType = Node<JobNodeData, "job">
export type TriggerNodeType = Node<TriggerNodeData, "trigger">
export type FlowNode = JobNodeType | TriggerNodeType

export const edgeId = (from: string, to: string) => `${from}->${to}`

function estimateHeight(job: JobView) {
    const lines = Math.min(job.steps.length, MAX_STEPS_SHOWN) + (job.steps.length > MAX_STEPS_SHOWN ? 1 : 0)
    return 84 + lines * 22
}

function rootJobs(view: WorkflowView) {
    const ids = new Set(view.jobs.map(j => j.id))
    return view.jobs.filter(j => !j.needs.some(n => ids.has(n)))
}

/** Left-to-right dagre layout; returns each node's top-left corner. */
export function autoLayout(view: WorkflowView): Record<string, XY> {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 70, marginx: 20, marginy: 20 })
    g.setDefaultEdgeLabel(() => ({}))
    g.setNode(TRIGGER_ID, { width: 200, height: 60 + view.triggers.length * 22 })
    const ids = new Set(view.jobs.map(j => j.id))
    for (const job of view.jobs) g.setNode(job.id, { width: NODE_WIDTH, height: estimateHeight(job) })
    for (const job of view.jobs) for (const n of job.needs) if (ids.has(n)) g.setEdge(n, job.id)
    for (const job of rootJobs(view)) g.setEdge(TRIGGER_ID, job.id)
    dagre.layout(g)
    const out: Record<string, XY> = {}
    for (const id of g.nodes()) {
        const n = g.node(id)
        out[id] = { x: n.x - n.width / 2, y: n.y - n.height / 2 }
    }
    return out
}

export function toFlow(view: WorkflowView, issues: Issue[], positions: Record<string, XY>): { nodes: FlowNode[]; edges: Edge[] } {
    const pos = (id: string) => positions[id] ?? { x: 0, y: 0 }
    const nodes: FlowNode[] = [
        {
            id: TRIGGER_ID,
            type: "trigger",
            position: pos(TRIGGER_ID),
            data: { triggers: view.triggers, name: view.name },
            deletable: false,
        },
        ...view.jobs.map<JobNodeType>(job => ({
            id: job.id,
            type: "job",
            position: pos(job.id),
            data: { job, issues: issues.filter(i => i.jobId === job.id) },
        })),
    ]

    const ids = new Set(view.jobs.map(j => j.id))
    const edges: Edge[] = []
    for (const job of view.jobs) {
        for (const n of job.needs) {
            if (!ids.has(n)) continue
            edges.push({ id: edgeId(n, job.id), source: n, target: job.id, type: "smoothstep" })
        }
    }
    for (const job of rootJobs(view)) {
        edges.push({
            id: edgeId(TRIGGER_ID, job.id),
            source: TRIGGER_ID,
            target: job.id,
            type: "smoothstep",
            animated: true,
            deletable: false,
            selectable: false,
            style: { strokeDasharray: "4 4", opacity: 0.6 },
        })
    }
    return { nodes, edges }
}
