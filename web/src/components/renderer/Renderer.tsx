import React, { useState, useEffect, useRef } from 'react'
import { PhotoView, PhotoProvider } from 'react-photo-view'
import ShikiHighlighter from "react-shiki"
import { useTranslation } from 'react-i18next'
import { FileText, ChevronDown, LoaderCircle, CalendarDays, ExternalLink, Star, Map, Kanban, PenTool, Sheet } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { getNote, NoteData } from '@/api/note'
import { ViewType } from '@/types/view'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { Icon } from 'leaflet'
import SpreadsheetViewComponent from '@/components/views/spreadsheet/SpreadsheetViewComponent'

const rendererMarkerIcon = new Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
})
import WhiteboardViewComponent from '@/components/views/whiteboard/WhiteboardViewComponent'
import { MapInlinePreview, CalendarInlinePreview, KanbanInlinePreview } from '@/components/editor/extensions/viewnode/ViewNodeInlinePreview'

const InstagramRendererEmbed: React.FC<{ url: string }> = ({ url }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!url || !containerRef.current) return
        const match = (() => { try { return new URL(url).pathname.match(/\/(p|reel|tv)\/([^/?#]+)/) } catch { return null } })()
        const postId = match?.[2]
        if (!postId) return
        const container = containerRef.current
        container.innerHTML = ''
        const blockquote = document.createElement('blockquote')
        blockquote.className = 'instagram-media'
        blockquote.setAttribute('data-instgrm-captioned', '')
        blockquote.setAttribute('data-instgrm-permalink', url)
        blockquote.setAttribute('data-instgrm-version', '14')
        blockquote.style.cssText = 'background:#FFF;border:0;border-radius:3px;box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15);margin:1px;max-width:540px;min-width:326px;padding:0;width:99.375%'
        container.appendChild(blockquote)
        const existing = document.getElementById('instagram-embed-js')
        if (existing) existing.remove()
        const script = document.createElement('script')
        script.id = 'instagram-embed-js'
        script.src = 'https://www.instagram.com/embed.js'
        script.async = true
        container.appendChild(script)
        return () => { container.innerHTML = '' }
    }, [url])
    return <div ref={containerRef} />
}

const TiktokRendererEmbed: React.FC<{ url: string }> = ({ url }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!url || !containerRef.current) return
        const match = (() => { try { return new URL(url).pathname.match(/\/video\/(\d+)/) } catch { return null } })()
        const videoId = match?.[1]
        if (!videoId) return
        const container = containerRef.current
        container.innerHTML = ''
        const blockquote = document.createElement('blockquote')
        blockquote.className = 'tiktok-embed'
        blockquote.setAttribute('cite', url)
        blockquote.setAttribute('data-video-id', videoId)
        blockquote.style.cssText = 'max-width:605px;min-width:325px;'
        const section = document.createElement('section')
        blockquote.appendChild(section)
        container.appendChild(blockquote)
        const existing = document.getElementById('tiktok-embed-js')
        if (existing) existing.remove()
        const script = document.createElement('script')
        script.id = 'tiktok-embed-js'
        script.src = 'https://www.tiktok.com/embed.js'
        script.async = true
        container.appendChild(script)
        return () => { container.innerHTML = '' }
    }, [url])
    return <div ref={containerRef} />
}

const ThreadsRendererEmbed: React.FC<{ url: string }> = ({ url }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [mountKey, setMountKey] = useState(Date.now)

    useEffect(() => {
        setMountKey(Date.now())
    }, [url])

    useEffect(() => {
        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) setMountKey(Date.now())
        }
        window.addEventListener('pageshow', handlePageShow)
        return () => window.removeEventListener('pageshow', handlePageShow)
    }, [])

    useEffect(() => {
        if (!url || !containerRef.current) return
        const match = (() => { try { return new URL(url).pathname.match(/\/post\/([^/?#]+)/) } catch { return null } })()
        const postId = match?.[1]
        if (!postId) return
        const container = containerRef.current
        container.innerHTML = ''
        const blockquote = document.createElement('blockquote')
        blockquote.className = 'text-post-media'
        blockquote.setAttribute('data-text-post-permalink', url)
        blockquote.setAttribute('data-text-post-version', '0')
        blockquote.id = `ig-tp-${postId}`
        blockquote.style.cssText = 'background:#FFF;border-width:1px;border-style:solid;border-color:#00000026;border-radius:16px;max-width:650px;margin:1px;min-width:270px;padding:0;width:99.375%'
        container.appendChild(blockquote)
        const existing = document.getElementById('threads-embed-js')
        if (existing) existing.remove()
        const script = document.createElement('script')
        script.id = 'threads-embed-js'
        script.src = `https://www.threads.com/embed.js?_=${Date.now()}`
        script.async = true
        container.appendChild(script)
        return () => { container.innerHTML = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mountKey])

    return <div key={mountKey} ref={containerRef} />
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const CalendarEventRenderer: React.FC<{ date?: string; title?: string; description?: string }> = ({ date, title, description }) => {
    const formatted = (() => {
        if (!date) return null
        try {
            const d = new Date(date)
            if (isNaN(d.getTime())) return null
            return {
                day: String(d.getDate()).padStart(2, '0'),
                month: MONTH_NAMES[d.getMonth()],
                year: String(d.getFullYear()),
                weekday: WEEKDAYS[d.getDay()],
            }
        } catch { return null }
    })()

    return (
        <div className="flex flex-wrap items-center gap-1.5 py-1">
            {title && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 select-none">
                    {title}
                </span>
            )}
            {formatted && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {formatted.month} {formatted.day}, {formatted.year}
                </span>
            )}
            {description && <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</span>}
        </div>
    )
}

const LocationRenderer: React.FC<{ lat: number; lng: number; name?: string; address?: string; zoom?: number }> = ({
    lat, lng, name, address, zoom = 15,
}) => {
    const [showMap, setShowMap] = useState(false)
    return (
        <div className="">
            <div
                className="flex flex-wrap items-center gap-1.5 py-1 cursor-pointer"
                onClick={() => setShowMap(s => !s)}
            >
                {name && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 select-none">
                        {name}
                    </span>
                )}
                {address && address !== name && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{address}</span>
                )}
                <a
                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Open in OpenStreetMap"
                    onClick={e => e.stopPropagation()}
                >
                    <ExternalLink size={12} />
                </a>
            </div>
            {showMap && (
                <div style={{ height: 200 }} className="w-full rounded-md overflow-hidden border dark:border-neutral-700">
                    <MapContainer
                        center={[lat, lng]}
                        zoom={zoom}
                        className="h-full w-full"
                        zoomControl={false}
                        scrollWheelZoom={false}
                        dragging={false}
                        doubleClickZoom={false}
                        attributionControl={false}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[lat, lng]} icon={rendererMarkerIcon} />
                    </MapContainer>
                </div>
            )}
        </div>
    )
}

// ── Rating renderer ───────────────────────────────────────────────────────────
function RendererPartialStar({ fill, size }: { fill: number; size: number }) {
    return (
        <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
            <Star size={size} className="text-gray-300 dark:text-neutral-600" />
            {fill > 0 && (
                <span className="absolute inset-0 overflow-hidden inline-flex" style={{ width: `${fill * 100}%` }}>
                    <Star size={size} className="text-yellow-400 fill-yellow-400 shrink-0" />
                </span>
            )}
        </span>
    )
}

const getStarFill = (i: number, val: number) => Math.min(1, Math.max(0, val - (i - 1)))
const formatRating = (r: number) => parseFloat(r.toFixed(1)).toString()

const RatingRenderer: React.FC<{ rating: number; maxRating: number; label?: string }> = ({ rating, maxRating, label }) => (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
        {label && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 select-none">
                {label}
            </span>
        )}
        <div className="flex items-center gap-0.5">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map(i => (
                <RendererPartialStar key={i} size={14} fill={getStarFill(i, rating)} />
            ))}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{formatRating(rating)}/{maxRating}</span>
    </div>
)

// ── Tags renderer ─────────────────────────────────────────────────────────────
const TagsRenderer: React.FC<{ tags: string[] }> = ({ tags }) => {
    if (!tags.length) return null
    return (
        <div className="flex flex-wrap items-center gap-1.5 my-1">
            {tags.map(t => (
                <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300">
                    <span className="opacity-50">#</span>{t}
                </span>
            ))}
        </div>
    )
}

const VIEW_TYPE_META: Record<ViewType, { icon: React.ReactNode; label: string }> = {
    map: { icon: <Map size={16} />, label: 'Map' },
    calendar: { icon: <CalendarDays size={16} />, label: 'Calendar' },
    kanban: { icon: <Kanban size={16} />, label: 'Kanban' },
    whiteboard: { icon: <PenTool size={16} />, label: 'Whiteboard' },
    spreadsheet: { icon: <Sheet size={16} />, label: 'Spreadsheet' },
}

const INLINE_VIEW_TYPES = new Set(['spreadsheet', 'whiteboard', 'map', 'calendar', 'kanban'])

const ViewNodeRenderer: React.FC<{ viewId: string; viewType: string; name?: string; workspaceId?: string }> = ({
    viewId, viewType, name, workspaceId,
}) => {
    const meta = VIEW_TYPE_META[viewType as ViewType] ?? { icon: <Sheet size={16} />, label: viewType }

    if (!workspaceId || !INLINE_VIEW_TYPES.has(viewType)) {
        return (
            <div className="flex items-center gap-2 border dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800/50 my-1">
                <span className="text-blue-500 dark:text-blue-400 flex-shrink-0">{meta.icon}</span>
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{name || meta.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700">{meta.label}</span>
            </div>
        )
    }

    return (
        <div className="my-1 border dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 border-b dark:border-neutral-700">
                <span className="text-blue-500 dark:text-blue-400 flex-shrink-0">{meta.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{name || meta.label}</span>
            </div>
            <div className="h-80 w-full">
                {viewType === 'spreadsheet' && <SpreadsheetViewComponent viewId={viewId} workspaceId={workspaceId} readOnly={true} />}
                {viewType === 'whiteboard' && <WhiteboardViewComponent viewId={viewId} workspaceId={workspaceId} readOnly={true} />}
                {viewType === 'map' && <MapInlinePreview viewId={viewId} workspaceId={workspaceId} />}
                {viewType === 'calendar' && <CalendarInlinePreview viewId={viewId} workspaceId={workspaceId} />}
                {viewType === 'kanban' && <KanbanInlinePreview viewId={viewId} workspaceId={workspaceId} />}
            </div>
        </div>
    )
}

const SubPageRendererBlock: React.FC<{ noteId: string; title: string; workspaceId?: string }> = ({ noteId, title, workspaceId: workspaceIdProp }) => {
    const { t } = useTranslation()
    const { workspaceId: workspaceIdParam } = useParams<{ workspaceId?: string }>()
    const workspaceId = workspaceIdProp || workspaceIdParam
    const [isExpanded, setIsExpanded] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [subNote, setSubNote] = useState<NoteData | null>(null)

    const handleClick = async () => {
        if (!workspaceId) return
        const expanding = !isExpanded
        setIsExpanded(expanding)
        if (expanding && !subNote && !isLoading) {
            setIsLoading(true)
            try {
                const note = await getNote(workspaceId, noteId)
                setSubNote(note)
            } catch (e) {
                console.error('Failed to fetch sub note', e)
            } finally {
                setIsLoading(false)
            }
        }
    }

    return (
        <div className="border dark:border-neutral-700 rounded-lg my-1 overflow-hidden">
            <div
                className={`flex items-center gap-2 p-3 bg-gray-50 dark:bg-neutral-800/50 transition-colors ${workspaceId ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700/50' : 'cursor-default'}`}
                onClick={handleClick}
            >
                <FileText size={16} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {title || t("notes.untitled")}
                </span>
                {workspaceId && (
                    <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
            </div>
            {isExpanded && (
                <div className="p-3 border-t dark:border-neutral-700">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-3">
                            <LoaderCircle size={16} className="text-gray-400 animate-spin" />
                        </div>
                    ) : subNote ? (
                        <>
                            {subNote.title && (
                                <div className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
                                    {subNote.title}
                                </div>
                            )}
                            <Renderer content={subNote.content} workspaceId={workspaceId} />
                        </>
                    ) : null}
                </div>
            )}
        </div>
    )
}

interface Node {
    type: string
    content?: Node[]
    text?: string
    marks?: { type: string; attrs?: any }[]
    attrs?: any
}

interface RendererProps {
    content: string
    maxNodes?: number
    workspaceId?: string
}

const Renderer: React.FC<RendererProps> = ({ content, maxNodes, workspaceId: workspaceIdProp }) => {
    const { t } = useTranslation()
    const [isExpanded, setIsExpanded] = useState(false)

    let json: Node
    try {
        json = JSON.parse(content)
    } catch (error) {
        return <div className='text-red-500'>Error parsing content</div>
    }

    const renderNode = (node: Node, key?: React.Key): React.ReactNode => {
        if (!node) return null

        const renderContent = () =>
            node.content?.map((child, idx) => renderNode(child, idx))

        switch (node.type) {
            case 'paragraph':
                return node.content ? <p className='leading-6' key={key}>{renderContent()}</p> : <div className='h-6' key={key}></div>
            case 'heading':
                const level = node.attrs?.level || 1
                const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
                return <HeadingTag key={key} className='py-2'>{renderContent()}</HeadingTag>
            case 'bulletList':
                return <ul key={key} className="">{renderContent()}</ul>
            case 'orderedList':
                return <ol key={key} className="">{renderContent()}</ol>
            case 'taskList':
                return <div key={key} className="list-none">{renderContent()}</div>
            case 'taskItem':
                return <div key={key} className='flex gap-1 items-start'>
                     <input
                            type='checkbox'
                            className="size-4 rounded bg-white mt-1 shrink-0"
                            checked={node.attrs?.checked}
                            disabled={true}
                            aria-label='checkbox'
                        />
                    {renderContent()}
                </div>
            case 'listItem':
                return <li key={key} className="">{renderContent()}</li>
            case 'codeBlock':
                return <div className='py-1' key={key}>
                    <ShikiHighlighter language={node.attrs?.language || 'text'} showLineNumbers={true} theme="ayu-dark">
                        {node.content?.map(d => d.text).join('') ?? ""}
                    </ShikiHighlighter>
                </div>
            case 'blockquote':
                return <div className='py-1' key={key}>
                    <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600">{renderContent()}</blockquote>
                </div>
            case 'horizontalRule':
                return <div className='' key={key}>
                    <hr />
                </div>
            case 'image':
                return <div className="" key={key}>
                    <PhotoView src={node.attrs?.src}>
                        <img className="rounded overflow-hidden max-w-full max-h-[620px]" alt={node.attrs?.alt || ''} src={node.attrs?.src} />
                    </PhotoView>
                </div>
            case 'attachment':
                return <a key={key} href={node.attrs?.src} className="text-blue-600">{node.attrs?.name}</a>
            case 'youtubeEmbed': {
                const url = node.attrs?.url
                let videoId: string | null = null
                try {
                    const parsed = new URL(url)
                    if (parsed.hostname === 'youtu.be') {
                        videoId = parsed.pathname.slice(1).split('?')[0] || null
                    } else if (parsed.hostname.includes('youtube.com')) {
                        if (parsed.pathname === '/watch') videoId = parsed.searchParams.get('v')
                        else if (parsed.pathname.startsWith('/embed/')) videoId = parsed.pathname.split('/embed/')[1].split('?')[0] || null
                        else if (parsed.pathname.startsWith('/shorts/')) videoId = parsed.pathname.split('/shorts/')[1].split('?')[0] || null
                    }
                } catch { /* ignore */ }
                if (!videoId) return null
                return <div key={key} className="w-full aspect-video rounded overflow-hidden">
                    <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="YouTube video" />
                </div>
            }
            case 'threadsEmbed':
                return <ThreadsRendererEmbed key={key} url={node.attrs?.url} />
            case 'instagramEmbed':
                return <InstagramRendererEmbed key={key} url={node.attrs?.url} />
            case 'tiktokEmbed':
                return <TiktokRendererEmbed key={key} url={node.attrs?.url} />
            case 'tagsNode': {
                const tags: string[] = node.attrs?.tags ?? []
                return <TagsRenderer key={key} tags={tags} />
            }
            case 'calendarNode':
                return <CalendarEventRenderer key={key} date={node.attrs?.date} title={node.attrs?.title} description={node.attrs?.description} />
            case 'locationNode': {
                const { lat, lng } = node.attrs ?? {}
                if (lat == null || lng == null) return null
                return <LocationRenderer key={key} lat={lat} lng={lng} name={node.attrs?.name} address={node.attrs?.address} zoom={node.attrs?.zoom ?? 15} />
            }
            case 'ratingNode': {
                const { rating = 0, maxRating = 5, label } = node.attrs ?? {}
                return <RatingRenderer key={key} rating={rating} maxRating={maxRating} label={label} />
            }
            case 'viewNode': {
                const { viewId, viewType, name } = node.attrs ?? {}
                if (!viewId) return null
                return <ViewNodeRenderer key={key} viewId={viewId} viewType={viewType} name={name} workspaceId={workspaceIdProp} />
            }
            case 'subPage':
                if (!node.attrs?.noteId) return null
                return <SubPageRendererBlock key={key} noteId={node.attrs.noteId} title={node.attrs?.title || ''} workspaceId={workspaceIdProp} />
            case 'video':
                return <div key={key} className="w-full rounded overflow-hidden">
                    <video className="w-full max-h-[620px]" src={node.attrs?.src} controls />
                </div>
            case 'carouselNode': {
                const items: Array<{ src: string; name: string; type: 'image' | 'video' }> = node.attrs?.items || []
                if (!items.length) return null
                return (
                    <div key={key} className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                        {items.map((item, idx) => (
                            <div key={`${item.src}-${idx}`} className="relative flex-shrink-0 w-48 h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800">
                                {item.type === 'image' ? (
                                    <PhotoView src={item.src}>
                                        <img src={item.src} alt={item.name} className="w-full h-full object-cover cursor-zoom-in" />
                                    </PhotoView>
                                ) : (
                                    <video src={item.src} className="w-full h-full object-cover" controls preload="metadata" />
                                )}
                            </div>
                        ))}
                    </div>
                )
            }
            case 'table':
                return <div className='max-w-full overflow-x-auto' key={key}>
                    <table className='w-full table-fixed'>{renderContent()}</table>
                </div>
            case 'tableRow':
                return <tr key={key}>{renderContent()}</tr>
            case 'tableHeader':
                return <th key={key} className='border bg-gray-200 dark:bg-gray-900'>{renderContent()}</th>
            case 'tableCell':
                return <td key={key} className='border'>{renderContent()}</td>
            case 'hardBreak':
                return <br key={key} />
            case 'text':
                let text: React.ReactNode = node.text
                if (node.marks) {
                    node.marks.forEach(mark => {
                        switch (mark.type) {
                            case 'bold':
                                text = <strong className='font-bold'>{text}</strong>
                                break
                            case 'italic':
                                text = <em className='italic'>{text}</em>
                                break
                            case 'strike':
                                text = <s className="line-through">{text}</s>
                                break
                            case 'code':
                                text = <code className='rounded text-sm bg-gray-300 text-gray-600 px-1 py-0.5'>{text}</code>
                                break
                            case 'link':
                                text = (
                                    <a
                                        href={mark.attrs?.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {text}
                                    </a>
                                )
                                break
                            default:
                                break
                        }
                    })
                }
                return text
            case 'doc':
                return <>{renderContent()}</>
            default:
                return null
        }
    }

    const allNodes = json.content || []
    const trimTrailingEmptyParagraphs = (nodes: Node[]) => {
        let end = nodes.length
        while (end > 0 && nodes[end - 1].type === 'paragraph' && !nodes[end - 1].content) end--
        return nodes.slice(0, end)
    }
    const hasLimit = maxNodes && maxNodes > 0
    const shouldLimit = hasLimit && !isExpanded
    const nodesToRender = trimTrailingEmptyParagraphs(shouldLimit ? allNodes.slice(0, maxNodes) : allNodes)
    const hasHiddenNodes = shouldLimit && allNodes.length > maxNodes
    const showCollapseButton = isExpanded && hasLimit

    return (
        <PhotoProvider>
            <div className='prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl max-w-full overflow-x-auto text-neutral-800 dark:text-gray-400'>
                {nodesToRender.map((node, idx) => renderNode(node, idx))}
                {hasHiddenNodes && (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    >
                        {t('actions.showMore')}
                    </button>
                )}
                {showCollapseButton && (
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    >
                        {t('actions.showLess')}
                    </button>
                )}
            </div>
        </PhotoProvider>
    )
}

export default Renderer