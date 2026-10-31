import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ExternalLink } from "lucide-react"
import type { WikipediaArticle } from "@/api/wikipedia"

// The stored article summary, shared by the editor block and read-only pages.
export const WikipediaCard = ({ article }: { article: WikipediaArticle }) => {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)
  const long = article.extract.length > 280

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-base font-semibold font-serif hover:underline"
          >
            {article.title}
            <ExternalLink size={12} className="text-muted-foreground shrink-0" />
          </a>
          {article.description && <p className="text-xs text-muted-foreground">{article.description}</p>}
          <p className={`mt-1.5 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line ${long && !showAll ? "line-clamp-4" : ""}`}>
            {article.extract}
          </p>
          {long && (
            <button type="button" className="mt-0.5 text-xs text-blue-600 hover:underline" onClick={() => setShowAll(v => !v)}>
              {showAll ? t("wikipedia.showLess") : t("wikipedia.showMore")}
            </button>
          )}
        </div>
        {article.thumbnail && (
          <img
            src={article.thumbnail.source}
            alt=""
            loading="lazy"
            className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded border dark:border-neutral-700 shrink-0 bg-gray-50 dark:bg-neutral-800"
          />
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("wikipedia.attribution")}{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="hover:underline">CC BY-SA 4.0</a>
      </p>
    </div>
  )
}
