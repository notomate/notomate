import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Plus, X, Images } from "lucide-react"
import { useRef, useState, useCallback } from "react"
import CarouselMediaPickerDialog from "./CarouselMediaPickerDialog"
import { CarouselItem } from "./CarouselNode"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

const CarouselComponent: React.FC<NodeViewProps> = ({ node, extension, updateAttributes, selected, editor, deleteNode, getPos }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)
    const items: CarouselItem[] = node.attrs.items || []
    const isEditable = editor.isEditable
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches

    const handleAddItems = (newItems: CarouselItem[]) => {
        updateAttributes({ items: [...items, ...newItems] })
    }

    const handleRemoveItem = (index: number) => {
        updateAttributes({ items: items.filter((_, i) => i !== index) })
    }

    const scrollLeft = () => scrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' })
    const scrollRight = () => scrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })

    const handleMoveUp = useCallback(() => {
        const pos = getPos()
        if (pos === undefined) return
        const { state } = editor
        const $pos = state.doc.resolve(pos)
        if ($pos.index() === 0) return
        const nodeBefore = $pos.nodeBefore
        if (!nodeBefore) return
        editor.view.dispatch(state.tr.replaceWith(pos - nodeBefore.nodeSize, pos + node.nodeSize, [node, nodeBefore]))
    }, [editor, node, getPos])

    const handleMoveDown = useCallback(() => {
        const pos = getPos()
        if (pos === undefined) return
        const { state } = editor
        const $pos = state.doc.resolve(pos)
        if ($pos.index() >= $pos.parent.childCount - 1) return
        const nodeAfterPos = pos + node.nodeSize
        const nodeAfter = state.doc.resolve(nodeAfterPos).nodeAfter
        if (!nodeAfter) return
        editor.view.dispatch(state.tr.replaceWith(pos, nodeAfterPos + nodeAfter.nodeSize, [nodeAfter, node]))
    }, [editor, node, getPos])

    const nodeActions = [
        { label: 'Move up', icon: <ChevronUp size={14} />, onClick: handleMoveUp },
        { label: 'Move down', icon: <ChevronDown size={14} />, onClick: handleMoveDown },
        { label: 'Add media', icon: <Plus size={14} />, onClick: () => setIsPickerOpen(true) },
        { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
    ]

    useDragMenu(getPos, () => nodeActions)

    if (!isEditable && items.length === 0) return null

    if (!isEditable) {
        const visibleItems = items.slice(0, 3)
        const remaining = items.length - 3

        return (
            <NodeViewWrapper>
                <div className="carousel-node select-none">
                    <div className="flex gap-2">
                        {visibleItems.map((item, index) => (
                            <div
                                key={`${item.src}-${index}`}
                                className="relative flex-shrink-0 w-48 h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800"
                            >
                                {item.type === 'image' ? (
                                    <img src={item.src} alt={item.name} className="w-full h-full object-cover" draggable={false} />
                                ) : (
                                    <video src={item.src} className="w-full h-full object-cover" controls preload="metadata" />
                                )}
                                {index === 2 && remaining > 0 && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <span className="text-white text-2xl font-semibold">+{remaining}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </NodeViewWrapper>
        )
    }

    if (items.length === 0) {
        return (
            <NodeViewWrapper className="carousel-node select-none border dark:border-neutral-700 rounded p-2 bg-gray-100 dark:bg-neutral-800">
                <div className="flex gap-2 w-full h-32">
                    <button
                        type="button"
                        className="flex-1 rounded flex flex-col gap-2 items-center justify-center hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-700 dark:text-gray-300"
                        onClick={(e) => { e.stopPropagation(); setIsPickerOpen(true) }}
                    >
                        <Images size={20} />
                        <span className="text-sm">Add Media to Carousel</span>
                    </button>
                </div>
                {extension.options?.workspaceId && (
                    <CarouselMediaPickerDialog
                        open={isPickerOpen}
                        onOpenChange={setIsPickerOpen}
                        workspaceId={extension.options.workspaceId}
                        listFiles={extension.options.listFiles}
                        onAdd={handleAddItems}
                        onUpload={extension.options.upload}
                    />
                )}
            </NodeViewWrapper>
        )
    }

    const showCompact = !isExpanded && items.length > 3
    const remaining = items.length - 3

    return (
        <NodeViewWrapper>
            <div className="carousel-node relative group select-none">
                {isTouchDevice && isEditable && (
                    <NodeTouchMenu visible={selected} actions={nodeActions} />
                )}

                {showCompact ? (
                    <div className="flex gap-2">
                        {items.slice(0, 3).map((item, index) => {
                            const isOverlay = index === 2
                            return (
                                <div
                                    key={`${item.src}-${index}`}
                                    className="relative flex-shrink-0 w-48 h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 group/item"
                                    onClick={isOverlay ? (e) => { e.stopPropagation(); setIsExpanded(true) } : undefined}
                                    style={isOverlay ? { cursor: 'pointer' } : undefined}
                                >
                                    {item.type === 'image' ? (
                                        <img src={item.src} alt={item.name} className="w-full h-full object-cover" draggable={false} />
                                    ) : (
                                        <video src={item.src} className="w-full h-full object-cover" preload="metadata" />
                                    )}
                                    {!isOverlay && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                            title="Remove"
                                        >
                                            <X size={12} className="text-white" />
                                        </button>
                                    )}
                                    {isOverlay && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="text-white text-2xl font-semibold">+{remaining}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <>
                        {items.length > 2 && (
                            <>
                                <button
                                    type="button"
                                    onClick={scrollLeft}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-800 rounded-full shadow-lg border border-gray-200 dark:border-neutral-600 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <ChevronLeft size={16} className="text-gray-700 dark:text-gray-300" />
                                </button>
                                <button
                                    type="button"
                                    onClick={scrollRight}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-800 rounded-full shadow-lg border border-gray-200 dark:border-neutral-600 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <ChevronRight size={16} className="text-gray-700 dark:text-gray-300" />
                                </button>
                            </>
                        )}
                        <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                            {items.map((item, index) => (
                                <div
                                    key={`${item.src}-${index}`}
                                    className="relative flex-shrink-0 w-48 h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 group/item"
                                >
                                    {item.type === 'image' ? (
                                        <img src={item.src} alt={item.name} className="w-full h-full object-cover" draggable={false} />
                                    ) : (
                                        <video src={item.src} className="w-full h-full object-cover" controls preload="metadata" />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(index)}
                                        className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
                                        title="Remove"
                                    >
                                        <X size={12} className="text-white" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {extension.options?.workspaceId && (
                    <CarouselMediaPickerDialog
                        open={isPickerOpen}
                        onOpenChange={setIsPickerOpen}
                        workspaceId={extension.options.workspaceId}
                        listFiles={extension.options.listFiles}
                        onAdd={handleAddItems}
                        onUpload={extension.options.upload}
                    />
                )}
            </div>
        </NodeViewWrapper>
    )
}

export default CarouselComponent
