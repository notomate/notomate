import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronUp, ChevronDown, Trash2, Plus, X, Images } from "lucide-react"
import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import CarouselMediaPickerDialog from "./CarouselMediaPickerDialog"
import { CarouselItem } from "./CarouselNode"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"
import ProgressiveImage from "@/components/image/ProgressiveImage"
import { computeCarouselLayout } from "@/components/renderer/carouselLayout"

const CarouselComponent: React.FC<NodeViewProps> = ({ node, extension, updateAttributes, selected, editor, deleteNode, getPos }) => {
    const { t } = useTranslation()
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    // Keyed by src so known ratios survive removing or appending items.
    const [ratios, setRatios] = useState<Record<string, number>>({})
    const items: CarouselItem[] = node.attrs.items || []
    const isEditable = editor.isEditable
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches

    const handleAddItems = (newItems: CarouselItem[]) => {
        updateAttributes({ items: [...items, ...newItems] })
    }

    const handleRemoveItem = (index: number) => {
        updateAttributes({ items: items.filter((_, i) => i !== index) })
    }

    const setRatio = (src: string, width: number, height: number) => {
        if (!width || !height) return
        setRatios(prev => (prev[src] === width / height ? prev : { ...prev, [src]: width / height }))
    }

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
        { label: t('editor.carousel.moveUp'), icon: <ChevronUp size={14} />, onClick: handleMoveUp },
        { label: t('editor.carousel.moveDown'), icon: <ChevronDown size={14} />, onClick: handleMoveDown },
        { label: t('editor.carousel.addMedia'), icon: <Plus size={14} />, onClick: () => setIsPickerOpen(true) },
        { label: t('actions.delete'), icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
    ]

    useDragMenu(getPos, () => nodeActions)

    if (!isEditable && items.length === 0) return null

    if (items.length === 0) {
        return (
            <NodeViewWrapper className="carousel-node select-none border dark:border-neutral-700 rounded p-2 bg-gray-100 dark:bg-neutral-800">
                <div className="flex gap-2 w-full h-32">
                    <button
                        type="button"
                        className="flex-1 rounded flex flex-col gap-2 items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-700 dark:text-gray-300"
                        onClick={(e) => { e.stopPropagation(); setIsPickerOpen(true) }}
                    >
                        <Images size={20} />
                        <span className="text-sm">{t('editor.carousel.addMediaToCarousel')}</span>
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

    const layout = computeCarouselLayout(items.length, Object.fromEntries(items.map((item, i) => [i, ratios[item.src]])))
    const remaining = items.length - layout.visible
    // Expanding lists every item (so hidden ones can still be removed) in a wrapping grid.
    const showExpanded = isEditable && isExpanded && remaining > 0

    const renderMedia = (item: CarouselItem, variantWidth: number) =>
        item.type === 'image' ? (
            <ProgressiveImage
                cover
                variantWidth={variantWidth}
                src={item.src}
                alt={item.name}
                className="w-full h-full"
                draggable={false}
                onLoad={(w, h) => setRatio(item.src, w, h)}
            />
        ) : (
            <video
                src={item.src}
                className="w-full h-full object-cover"
                controls
                preload="metadata"
                onLoadedMetadata={e => setRatio(item.src, e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
            />
        )

    const renderRemoveButton = (index: number) => (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleRemoveItem(index) }}
            className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"
            title={t('editor.carousel.remove')}
        >
            <X size={12} className="text-white" />
        </button>
    )

    return (
        <NodeViewWrapper>
            <div className="carousel-node relative group select-none">
                {isTouchDevice && isEditable && (
                    <NodeTouchMenu visible={selected} actions={nodeActions} />
                )}

                {showExpanded ? (
                    <>
                        <div className="grid grid-cols-3 gap-1 w-full rounded-lg overflow-hidden">
                            {items.map((item, index) => (
                                <div
                                    key={`${item.src}-${index}`}
                                    className="relative min-w-0 aspect-square overflow-hidden bg-gray-100 dark:bg-neutral-800 group/item"
                                >
                                    {renderMedia(item, 640)}
                                    {renderRemoveButton(index)}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(false) }}
                            className="mt-1 w-full py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
                        >
                            {t('actions.collapse')}
                        </button>
                    </>
                ) : (
                    <div
                        className="grid gap-1 w-full max-h-[620px] rounded-lg overflow-hidden"
                        style={{
                            aspectRatio: layout.aspectRatio,
                            gridTemplateColumns: layout.templateColumns,
                            gridTemplateRows: layout.templateRows,
                            gridTemplateAreas: layout.templateAreas,
                        }}
                    >
                        {items.slice(0, layout.visible).map((item, index) => {
                            const isOverlay = index === layout.visible - 1 && remaining > 0
                            return (
                                <div
                                    key={`${item.src}-${index}`}
                                    className="relative min-w-0 min-h-0 overflow-hidden bg-gray-100 dark:bg-neutral-800 group/item"
                                    style={{ gridArea: layout.areas[index] }}
                                >
                                    {renderMedia(item, index === 0 ? 1280 : 640)}
                                    {isEditable && !isOverlay && renderRemoveButton(index)}
                                    {isOverlay && (
                                        <div
                                            className={`absolute inset-0 bg-black/50 flex items-center justify-center ${isEditable ? 'cursor-pointer' : 'pointer-events-none'}`}
                                            onClick={isEditable ? (e) => { e.stopPropagation(); setIsExpanded(true) } : undefined}
                                        >
                                            <span className="text-white text-2xl font-semibold">+{remaining}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {isEditable && extension.options?.workspaceId && (
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
