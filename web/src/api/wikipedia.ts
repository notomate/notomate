// Wikipedia is queried straight from the browser: its REST APIs allow CORS
// and need no key.

/** Wikipedia editions offered in the block, keyed by the value stored in notes. */
export const WIKIPEDIA_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh-tw", label: "中文（臺灣）" },
  { code: "zh-cn", label: "中文（中国大陆）" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
]

/** The edition matching the UI language, or English. */
export const defaultWikipediaLanguage = (uiLanguage: string): string => {
  const lang = uiLanguage.toLowerCase()
  if (lang.startsWith("zh")) return lang === "zh-cn" || lang === "zh-sg" ? "zh-cn" : "zh-tw"
  const base = lang.split("-")[0]
  return WIKIPEDIA_LANGUAGES.some(l => l.code === base) ? base : "en"
}

// "zh-tw" → zh.wikipedia.org, with the zh-tw script variant.
const edition = (code: string) => {
  const [lang, region] = code.split("-")
  return { host: `https://${lang}.wikipedia.org`, variant: region ? code : null }
}

const request = async <T>(code: string, path: string, signal?: AbortSignal): Promise<T> => {
  const { host, variant } = edition(code)
  const response = await fetch(host + path, {
    signal,
    headers: variant ? { "Accept-Language": variant } : undefined,
  })
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`)
  return response.json() as Promise<T>
}

export interface WikipediaSearchResult {
  key: string
  title: string
  description?: string
  excerpt: string
  thumbnail?: string
}

interface RawSearch {
  pages: {
    key: string
    title: string
    description?: string | null
    excerpt?: string | null
    thumbnail?: { url?: string } | null
  }[]
}

// Search excerpts are HTML with highlighted matches.
const stripTags = (html: string) =>
  new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""

const absolute = (url: string) => (url.startsWith("//") ? `https:${url}` : url)

export const searchWikipedia = async (code: string, query: string, signal?: AbortSignal): Promise<WikipediaSearchResult[]> => {
  const params = new URLSearchParams({ q: query, limit: "10" })
  const data = await request<RawSearch>(code, `/w/rest.php/v1/search/page?${params}`, signal)
  return data.pages.map(p => ({
    key: p.key,
    title: p.title,
    description: p.description ?? undefined,
    excerpt: stripTags(p.excerpt ?? ""),
    thumbnail: p.thumbnail?.url ? absolute(p.thumbnail.url) : undefined,
  }))
}

/** What a Wikipedia block stores about its article. */
export interface WikipediaArticle {
  lang: string
  pageId: number
  title: string
  description?: string
  extract: string
  thumbnail?: { source: string; width: number; height: number }
  url: string
}

interface RawSummary {
  pageid: number
  title: string
  titles?: { normalized?: string }
  description?: string
  extract?: string
  thumbnail?: { source: string; width: number; height: number }
  content_urls?: { desktop?: { page?: string } }
}

export const getWikipediaArticle = async (code: string, key: string): Promise<WikipediaArticle> => {
  const path = encodeURIComponent(key.replace(/ /g, "_"))
  const data = await request<RawSummary>(code, `/api/rest_v1/page/summary/${path}`)
  const { host, variant } = edition(code)
  return {
    lang: code,
    pageId: data.pageid,
    title: data.titles?.normalized ?? data.title,
    description: data.description,
    extract: data.extract ?? "",
    thumbnail: data.thumbnail,
    // Variant links open the article in the same script it was fetched in.
    url: variant ? `${host}/${variant}/${path}` : data.content_urls?.desktop?.page ?? `${host}/wiki/${path}`,
  }
}
