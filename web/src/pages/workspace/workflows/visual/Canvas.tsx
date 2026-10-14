import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    applyEdgeChanges,
    applyNodeChanges,
    useNodesInitialized,
    useReactFlow,
    type Connection,
    type Edge,
    type EdgeChange,
    type FinalConnectionState,
    type NodeChange,
    type OnSelectionChangeParams,
} from "@xyflow/react"
import { AlertTriangle } from "lucide-react"
import { useTheme } from "@/providers/Theme"
import { toast } from "@/stores/toast"
import { useEditor, useEditorStore } from "./store"
import { useIssues } from "./actions/issues"
import { TRIGGER_ID, autoLayout, toFlow, type FlowNode } from "./graph/toFlow"
import { wouldCreateCycle } from "./model/validate"
import * as m from "./model/mutate"
import { JobNode, TriggerNode } from "./nodes"

const nodeTypes = { job: JobNode, trigger: TriggerNode }

export default function Canvas() {
    const { t } = useTranslation()
    const store = useEditorStore()
    const view = useEditor(s => s.view)
    const positions = useEditor(s => s.positions)
    const selection = useEditor(s => s.selection)
    const parseError = useEditor(s => s.parseError)
    const issues = useIssues()
    const colorMode = useTheme()?.theme === "dark" ? "dark" : "light"
    const { apply, select, setPosition, mergePositions } = store.getState()
    const { screenToFlowPosition, fitView } = useReactFlow()
    const needsFit = useRef(true)

    // Nodes without a position get one from dagre; placed nodes stay put.
    useEffect(() => {
        const ids = [TRIGGER_ID, ...view.jobs.map(j => j.id)]
        if (!ids.some(id => !positions[id])) return
        if (Object.keys(positions).length === 0) needsFit.current = true
        mergePositions(autoLayout(view), ids)
    }, [view, positions, mergePositions])

    // After a relayout, wait for nodes to be measured before fitting the view.
    const initialized = useNodesInitialized()
    useEffect(() => {
        if (!initialized || !needsFit.current) return
        needsFit.current = false
        requestAnimationFrame(() => fitView({ padding: 0.15, maxZoom: 1.1, duration: 200 }))
    }, [initialized, positions, fitView])

    const derived = useMemo(() => toFlow(view, issues, positions), [view, issues, positions])
    const [nodes, setNodes] = useState<FlowNode[]>(derived.nodes)
    const [edges, setEdges] = useState<Edge[]>(derived.edges)

    // Keep the sizes React Flow measured; selection comes from the store.
    useEffect(() => {
        setNodes(prev => {
            const prevMap = new Map(prev.map(n => [n.id, n]))
            return derived.nodes.map(n => {
                const isSel = (selection?.kind === "job" && selection.id === n.id) || (selection?.kind === "trigger" && n.id === TRIGGER_ID)
                return { ...n, measured: prevMap.get(n.id)?.measured, selected: isSel } as FlowNode
            })
        })
        setEdges(derived.edges)
    }, [derived, selection])

    const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
        const removed = changes.filter(c => c.type === "remove").map(c => c.id)
        const rest = changes.filter(c => c.type !== "remove")
        setNodes(ns => applyNodeChanges(rest, ns))
        if (removed.length) {
            apply(
                doc => removed.forEach(id => m.removeJob(doc, id)),
                s => ({ selection: s.selection?.kind === "job" && removed.includes(s.selection.id) ? null : s.selection }),
            )
        }
    }, [apply])

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        const removed = changes.filter(c => c.type === "remove").map(c => c.id)
        setEdges(es => applyEdgeChanges(changes.filter(c => c.type !== "remove"), es))
        if (!removed.length) return
        const pairs = edges.filter(e => removed.includes(e.id) && e.source !== TRIGGER_ID)
        if (pairs.length) apply(doc => pairs.forEach(e => m.removeNeed(doc, e.target, e.source)))
    }, [apply, edges])

    const onNodeDragStop = useCallback((_: unknown, node: FlowNode, dragged: FlowNode[]) => {
        for (const n of dragged.length ? dragged : [node]) setPosition(n.id, n.position)
    }, [setPosition])

    const isValidConnection = useCallback((c: Connection | Edge) =>
        c.source !== TRIGGER_ID &&
        c.target !== TRIGGER_ID &&
        !view.jobs.find(j => j.id === c.target)?.needs.includes(c.source) &&
        !wouldCreateCycle(view, c.source, c.target),
    [view])

    const onConnect = useCallback((c: Connection) => {
        if (wouldCreateCycle(view, c.source, c.target)) {
            toast.error(t("pages.workflows.visual.cycleBlocked"))
            return
        }
        apply(doc => m.addNeed(doc, c.target, c.source))
    }, [apply, view, t])

    // Dropping a connection on empty space creates a job that needs the source.
    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
        if (state.isValid || !state.fromNode || state.toNode) return
        if (state.fromNode.id === TRIGGER_ID || state.fromHandle?.type !== "source") return
        const { clientX, clientY } = "changedTouches" in event ? event.changedTouches[0] : event
        const position = screenToFlowPosition({ x: clientX, y: clientY - 20 })
        const from = state.fromNode.id
        let id = ""
        apply(
            doc => {
                id = m.uniqueJobId(doc, "job")
                m.addJob(doc, id, [from])
            },
            s => ({ positions: { ...s.positions, [id]: position }, selection: { kind: "job", id } }),
        )
    }, [apply, screenToFlowPosition])

    const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
        if (sel.length !== 1) {
            if (sel.length === 0) select(null)
            return
        }
        select(sel[0].id === TRIGGER_ID ? { kind: "trigger" } : { kind: "job", id: sel[0].id })
    }, [select])

    return (
        <div className="relative h-full w-full isolate">
            <ReactFlow<FlowNode>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                colorMode={colorMode}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={onNodeDragStop}
                onConnect={onConnect}
                onConnectEnd={onConnectEnd}
                isValidConnection={isValidConnection}
                onSelectionChange={onSelectionChange}
                deleteKeyCode={["Delete", "Backspace"]}
                defaultEdgeOptions={{ type: "smoothstep" }}
                minZoom={0.2}
                proOptions={{ hideAttribution: true }}
            >
                <Background gap={20} size={1} />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable nodeStrokeWidth={3} className="hidden md:block" />
            </ReactFlow>
            {parseError && (
                <div role="status" className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700 shadow">
                    <AlertTriangle size={15} />
                    {t("pages.workflows.visual.staleGraph")}
                </div>
            )}
        </div>
    )
}
