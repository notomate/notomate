import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Search, Star } from "lucide-react"
import { LocateButton } from "./LocateButton"
import { LatLng, PlaceSummary, googleMapsErrorMessage, parseLatLng, searchGooglePlaces, searchNearbyGooglePlaces } from "@/api/googleMaps"

interface Props {
  workspaceId: string
  bias?: LatLng | null
  placeholder?: string
  autoFocus?: boolean
  onSelect: (place: PlaceSummary) => void
}

export const PlaceSearchBox = ({ workspaceId, bias, placeholder, autoFocus, onSelect }: Props) => {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlaceSummary[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Responses for older queries are ignored.
  const requestRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      requestRef.current += 1
    }
  }, [autoFocus])

  const search = useCallback(async (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const request = ++requestRef.current
    if (!q.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    setError("")
    try {
      // A coordinate looks up the places at that spot instead of matching text.
      const coords = parseLatLng(q)
      const places = coords
        ? await searchNearbyGooglePlaces(workspaceId, { ...coords, languageCode: i18n.language })
        : await searchGooglePlaces(workspaceId, {
          query: q,
          languageCode: i18n.language,
          bias: bias ?? undefined,
        })
      if (request !== requestRef.current) return
      setResults(places)
      if (coords && places.length === 0) setError(t("googleMaps.noNearbyPlaces"))
    } catch (e) {
      if (request !== requestRef.current) return
      setError(googleMapsErrorMessage(e))
    } finally {
      if (request === requestRef.current) setIsSearching(false)
    }
  }, [workspaceId, i18n.language, bias, t])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 400)
  }

  const handleLocate = (coords: string) => {
    setQuery(coords)
    search(coords)
  }

  const handleSelect = (place: PlaceSummary) => {
    requestRef.current += 1
    setQuery(place.displayName?.text ?? "")
    setResults([])
    onSelect(place)
  }

  const list = results.length > 0 && (
    <ul className="list-none absolute z-dropdown left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-600 rounded shadow-lg max-h-64 overflow-y-auto">
      {results.map(place => (
        <li key={place.id}>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 border-b last:border-b-0 border-gray-100 dark:border-neutral-700"
            onClick={() => handleSelect(place)}
          >
            <span className="flex items-center gap-2">
              <span className="font-medium truncate">{place.displayName?.text}</span>
              {place.rating != null && (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                  <Star size={11} className="text-yellow-500 fill-yellow-500" />
                  {place.rating.toFixed(1)}
                  {place.userRatingCount != null && ` (${place.userRatingCount})`}
                </span>
              )}
            </span>
            <span className="block text-xs text-muted-foreground truncate">
              {place.primaryTypeDisplayName?.text && `${place.primaryTypeDisplayName.text} · `}
              {place.formattedAddress}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2 pr-8 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={placeholder ?? t("googleMaps.searchPlaceholder")}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault()
                search(query)
              } else if (e.key === "Escape") {
                setResults([])
              }
            }}
          />
          {isSearching
            ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
            : <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        </div>
        <LocateButton onLocate={handleLocate} onError={setError} />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {list}
    </div>
  )
}
