import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, Edit3, Loader2, RefreshCw, Search, Star, Store, Trash2 } from "lucide-react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"
import { PlaceDetails, PlaceSummary, getGooglePlace, googleMapsErrorMessage, searchGooglePlaces } from "@/api/googleMaps"
import { GoogleMapSnapshot } from "./shared/GoogleMapSnapshot"
import { useNodeMove } from "./shared/useNodeMove"
import { CompactBody, ExpandToggle, MarkersSummary } from "./shared/CompactSummary"
import { placesToMarkers, trimPlace } from "./shared/types"

const GooglePlacesNodeComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos, extension }) => {
  const { t, i18n } = useTranslation()
  const workspaceId: string = extension.options.workspaceId
  const places: PlaceDetails[] = node.attrs.places ?? []
  const editable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const { moveUp, moveDown } = useNodeMove({ editor, node, getPos })

  const [isEditing, setIsEditingState] = useState(places.length === 0)
  const [expanded, setExpanded] = useState(places.length === 0)
  // Editing always shows the full view, and leaves it open afterwards.
  const setIsEditing = (value: boolean) => {
    setIsEditingState(value)
    if (value) setExpanded(true)
  }
  const [query, setQuery] = useState<string>(node.attrs.query ?? "")
  const [results, setResults] = useState<PlaceSummary[]>([])
  const [checked, setChecked] = useState<Set<string>>(() => new Set(places.map(p => p.id)))
  const [busy, setBusy] = useState<"search" | "fetch" | null>(null)
  const [error, setError] = useState("")

  const fetchDetails = async (ids: string[]) => {
    const details = await Promise.all(ids.map(id => getGooglePlace(workspaceId, id, i18n.language)))
    return details.map(trimPlace)
  }

  const runSearch = async () => {
    if (!query.trim()) return
    setBusy("search")
    setError("")
    try {
      setResults(await searchGooglePlaces(workspaceId, { query, languageCode: i18n.language }))
    } catch (e) {
      setError(googleMapsErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    // Keep the order the user sees: existing places first, then new results.
    const ids = [
      ...places.map(p => p.id).filter(id => checked.has(id)),
      ...results.map(r => r.id).filter(id => checked.has(id) && !places.some(p => p.id === id)),
    ]
    setBusy("fetch")
    setError("")
    try {
      updateAttributes({ query, places: await fetchDetails(ids), fetchedAt: new Date().toISOString() })
      setIsEditing(false)
      setResults([])
    } catch (e) {
      setError(googleMapsErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const refresh = async () => {
    setBusy("fetch")
    setError("")
    try {
      updateAttributes({ places: await fetchDetails(places.map(p => p.id)), fetchedAt: new Date().toISOString() })
    } catch (e) {
      setError(googleMapsErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const nodeActions = [
    { label: t("editor.moveUp"), icon: <ChevronUp size={14} />, onClick: moveUp },
    { label: t("editor.moveDown"), icon: <ChevronDown size={14} />, onClick: moveDown },
    { label: t("googleMaps.editPlaces"), icon: <Edit3 size={14} />, onClick: () => setIsEditing(true) },
    { label: t("actions.delete"), icon: <Trash2 size={14} />, onClick: deleteNode, variant: "danger" as const },
  ]
  useDragMenu(getPos, () => nodeActions)

  const markers = placesToMarkers(places)

  // Candidates shown while editing: places already in the node plus new results.
  const candidates: PlaceSummary[] = [...places, ...results.filter(r => !places.some(p => p.id === r.id))]

  return (
    <NodeViewWrapper className="google-places-node my-2 border dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
        <Store size={15} className="text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">{node.attrs.query || t("editor.GooglePlacesNode")}</span>
        {node.attrs.fetchedAt && (
          <span className="text-[11px] text-muted-foreground shrink-0">
            {t("googleMaps.fetchedAt", { date: new Date(node.attrs.fetchedAt).toLocaleString() })}
          </span>
        )}
        {editable && !isEditing && (
          <>
            <button type="button" className="p-1 rounded text-muted-foreground hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50" disabled={!!busy} onClick={refresh} title={t("googleMaps.refresh")}>
              <RefreshCw size={13} className={busy === "fetch" ? "animate-spin" : ""} />
            </button>
            <button type="button" className="p-1 rounded text-muted-foreground hover:bg-gray-200 dark:hover:bg-neutral-700" onClick={() => setIsEditing(true)} title={t("googleMaps.editPlaces")}>
              <Edit3 size={13} />
            </button>
          </>
        )}
        {!isEditing && <ExpandToggle expanded={expanded} onToggle={() => setExpanded(v => !v)} />}
      </div>

      {editable && isEditing ? (
        <div className="p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t("googleMaps.placesQueryPlaceholder")}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); runSearch() } }}
            />
            <button type="button" className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" disabled={!!busy || !query.trim()} onClick={runSearch}>
              {busy === "search" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {t("googleMaps.search")}
            </button>
          </div>

          {candidates.length > 0 && (
            <ul className="list-none flex flex-col border dark:border-neutral-700 rounded max-h-80 overflow-y-auto">
              {candidates.map(p => (
                <li key={p.id} className="border-b last:border-b-0 dark:border-neutral-800">
                  <label className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <input type="checkbox" className="mt-1" checked={checked.has(p.id)} onChange={() => toggle(p.id)} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{p.displayName?.text}</span>
                        {p.rating != null && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground shrink-0">
                            <Star size={11} className="text-yellow-500 fill-yellow-500" />{p.rating.toFixed(1)}
                            {p.userRatingCount != null && ` (${p.userRatingCount})`}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">{p.formattedAddress}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            {places.length > 0 && (
              <button type="button" className="px-3 py-1.5 text-sm rounded border dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => { setIsEditing(false); setResults([]); setChecked(new Set(places.map(p => p.id))) }}>
                {t("actions.cancel")}
              </button>
            )}
            <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" disabled={!!busy || checked.size === 0} onClick={save}>
              {busy === "fetch" && <Loader2 size={14} className="animate-spin" />}
              {t("googleMaps.fetchPlaces", { count: checked.size })}
            </button>
          </div>
        </div>
      ) : !expanded ? (
        <CompactBody onExpand={() => setExpanded(true)}>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <MarkersSummary markers={markers} workspaceId={workspaceId} emptyText={t("googleMaps.noPlaces")} />
        </CompactBody>
      ) : (
        <>
          {error && <p className="px-3 pt-2 text-xs text-red-500">{error}</p>}
          {markers.length === 0
            ? <p className="p-3 text-xs text-muted-foreground">{t("googleMaps.noPlaces")}</p>
            : <GoogleMapSnapshot title={node.attrs.query} markers={markers} route={null} workspaceId={workspaceId} embedded hideList defaultOpen />}
        </>
      )}
      {isTouchDevice && editable && <NodeTouchMenu visible={selected} actions={nodeActions} />}
    </NodeViewWrapper>
  )
}

export default GooglePlacesNodeComponent
