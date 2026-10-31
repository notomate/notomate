import { NodeViewProps, NodeViewWrapper } from "@/components/noteeditor/nodeView"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Edit3, Loader2, RefreshCw, Search } from "lucide-react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"
import { WikipediaIcon } from "@/components/noteeditor/icons"
import {
  WIKIPEDIA_LANGUAGES,
  WikipediaArticle,
  WikipediaSearchResult,
  defaultWikipediaLanguage,
  getWikipediaArticle,
  searchWikipedia,
} from "@/api/wikipedia"
import { frameClass } from "@/components/editor/extensions/googlemaps/shared/CompactSummary"
import { WikipediaCard } from "./WikipediaCard"

const WikipediaNodeComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, getPos }) => {
  const { t, i18n } = useTranslation()
  const article: WikipediaArticle | null = node.attrs.article ?? null
  const editable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches

  const [isEditing, setIsEditing] = useState(!article)
  const [lang, setLang] = useState<string>(node.attrs.lang || article?.lang || defaultWikipediaLanguage(i18n.language))
  const [query, setQuery] = useState<string>(node.attrs.query ?? "")
  const [results, setResults] = useState<WikipediaSearchResult[] | null>(null)
  const [busy, setBusy] = useState<"search" | "fetch" | null>(null)
  const [error, setError] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Only the latest search may show its results.
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
  }, [])

  const search = async (q: string, code = lang) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    if (!q.trim()) {
      setResults(null)
      setBusy(null)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy("search")
    setError("")
    try {
      setResults(await searchWikipedia(code, q, controller.signal))
    } catch (e) {
      if (controller.signal.aborted) return
      console.error(e)
      setError(t("wikipedia.error"))
    } finally {
      if (abortRef.current === controller) setBusy(null)
    }
  }

  const handleQuery = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 400)
  }

  const handleLang = (code: string) => {
    setLang(code)
    search(query, code)
  }

  const fetchArticle = async (code: string, key: string) => {
    setBusy("fetch")
    setError("")
    try {
      return await getWikipediaArticle(code, key)
    } catch (e) {
      console.error(e)
      setError(t("wikipedia.error"))
      return null
    } finally {
      setBusy(null)
    }
  }

  const choose = async (result: WikipediaSearchResult) => {
    const fetched = await fetchArticle(lang, result.key)
    if (!fetched) return
    updateAttributes({ lang, query, article: fetched, fetchedAt: new Date().toISOString() })
    setIsEditing(false)
    setResults(null)
  }

  const refresh = async () => {
    if (!article) return
    const fetched = await fetchArticle(article.lang, article.title)
    if (fetched) updateAttributes({ article: fetched, fetchedAt: new Date().toISOString() })
  }

  const cancel = () => {
    setIsEditing(false)
    setResults(null)
    setError("")
  }

  const nodeActions = [
    { label: t("wikipedia.change"), icon: <Edit3 size={14} />, onClick: () => setIsEditing(true) },
  ]
  useDragMenu(getPos, () => nodeActions)

  return (
    <NodeViewWrapper className={`wikipedia-node my-2 ${frameClass(true)}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
        <span className="text-muted-foreground shrink-0"><WikipediaIcon size={15} /></span>
        <span className="flex-1 text-sm font-medium truncate">{article?.title || t("editor.WikipediaNode")}</span>
        {node.attrs.fetchedAt && !isEditing && (
          <span className="text-[11px] text-muted-foreground shrink-0">
            {t("wikipedia.fetchedAt", { date: new Date(node.attrs.fetchedAt).toLocaleString() })}
          </span>
        )}
        {editable && article && !isEditing && (
          <>
            <button type="button" className="p-1 rounded text-muted-foreground hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50" disabled={!!busy} onClick={refresh} title={t("wikipedia.refresh")}>
              <RefreshCw size={13} className={busy === "fetch" ? "animate-spin" : ""} />
            </button>
            <button type="button" className="p-1 rounded text-muted-foreground hover:bg-gray-200 dark:hover:bg-neutral-700" onClick={() => setIsEditing(true)} title={t("wikipedia.change")}>
              <Edit3 size={13} />
            </button>
          </>
        )}
      </div>

      {editable && isEditing ? (
        <div className="p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              className="px-2 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={lang}
              onChange={e => handleLang(e.target.value)}
              aria-label={t("wikipedia.language")}
            >
              {WIKIPEDIA_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <div className="relative flex-1">
              <input
                autoFocus
                className="w-full px-3 py-2 pr-8 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={t("wikipedia.searchPlaceholder")}
                value={query}
                onChange={e => handleQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search(query) } }}
              />
              {busy === "search"
                ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                : <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
            </div>
          </div>

          {results && results.length > 0 && (
            <ul className="list-none flex flex-col border dark:border-neutral-700 rounded max-h-80 overflow-y-auto">
              {results.map(r => (
                <li key={r.key} className="border-b last:border-b-0 dark:border-neutral-800">
                  <button
                    type="button"
                    className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                    disabled={!!busy}
                    onClick={() => choose(r)}
                  >
                    {r.thumbnail
                      ? <img src={r.thumbnail} alt="" loading="lazy" className="w-10 h-10 object-cover rounded shrink-0 bg-gray-100 dark:bg-neutral-800" />
                      : <span className="w-10 h-10 rounded shrink-0 flex items-center justify-center bg-gray-100 dark:bg-neutral-800 text-muted-foreground"><WikipediaIcon size={18} /></span>}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{r.title}</span>
                      {r.description && <span className="block text-xs text-muted-foreground truncate">{r.description}</span>}
                      <span className="block text-xs text-muted-foreground line-clamp-2">{r.excerpt}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {results?.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("wikipedia.noResults")}</p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          {(article || busy === "fetch") && (
            <div className="flex items-center justify-end gap-2">
              {busy === "fetch" && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              {article && (
                <button type="button" className="px-3 py-1.5 text-sm rounded border dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={cancel}>
                  {t("actions.cancel")}
                </button>
              )}
            </div>
          )}
        </div>
      ) : article ? (
        <>
          {error && <p className="px-3 pt-2 text-xs text-red-500">{error}</p>}
          <WikipediaCard article={article} />
        </>
      ) : (
        <p className="p-3 text-xs text-muted-foreground">{t("wikipedia.empty")}</p>
      )}
      {isTouchDevice && editable && <NodeTouchMenu visible={selected} actions={nodeActions} />}
    </NodeViewWrapper>
  )
}

export default WikipediaNodeComponent
