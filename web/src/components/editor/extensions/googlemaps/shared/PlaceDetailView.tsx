import { ReactNode, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { PhotoProvider, PhotoView } from "react-photo-view"
import { ChevronDown, ChevronRight, Clock, ExternalLink, Globe, Loader2, MapPin, Phone, Star, X } from "lucide-react"
import { PlaceDetails, getGooglePhotoUrl, getGooglePlace, googleMapsErrorMessage } from "@/api/googleMaps"

export const RatingStars = ({ rating, count }: { rating?: number; count?: number }) => {
  if (rating == null) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="font-medium text-gray-800 dark:text-gray-200">{rating.toFixed(1)}</span>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            size={11}
            className={i <= Math.round(rating) ? "text-yellow-500 fill-yellow-500" : "text-gray-300 dark:text-neutral-600"}
          />
        ))}
      </span>
      {count != null && <span>({count.toLocaleString()})</span>}
    </span>
  )
}

export const PhotoStrip = ({ place, workspaceId, height = 96 }: { place: PlaceDetails; workspaceId?: string; height?: number }) => {
  if (!workspaceId || !place.photos?.length) return null
  return (
    <PhotoProvider>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {place.photos.map(photo => {
          const author = photo.authorAttributions?.[0]
          return (
            <PhotoView key={photo.name} src={getGooglePhotoUrl(workspaceId, photo.name, 1600)}>
              <img
                src={getGooglePhotoUrl(workspaceId, photo.name, 400)}
                alt={author?.displayName ? `© ${author.displayName}` : place.displayName?.text}
                title={author?.displayName ? `© ${author.displayName}` : undefined}
                loading="lazy"
                onError={e => { e.currentTarget.style.display = "none" }}
                className="rounded object-cover shrink-0 cursor-zoom-in bg-gray-100 dark:bg-neutral-800"
                style={{ height, width: Math.round(height * 1.4) }}
              />
            </PhotoView>
          )
        })}
      </div>
    </PhotoProvider>
  )
}

const Reviews = ({ place }: { place: PlaceDetails }) => {
  if (!place.reviews?.length) return null
  return (
    <div className="flex flex-col gap-3">
      {place.reviews.map((review, i) => (
        <div key={review.name ?? i} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {review.authorAttribution?.photoUri && (
              <img src={review.authorAttribution.photoUri} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
            )}
            {review.authorAttribution?.uri ? (
              <a href={review.authorAttribution.uri} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:underline">
                {review.authorAttribution.displayName}
              </a>
            ) : (
              <span className="text-xs font-medium">{review.authorAttribution?.displayName}</span>
            )}
            <span className="text-xs text-muted-foreground">{review.relativePublishTimeDescription}</span>
          </div>
          <RatingStars rating={review.rating} />
          {review.text?.text && (
            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-6">{review.text.text}</p>
          )}
        </div>
      ))}
    </div>
  )
}

interface ViewProps {
  place: PlaceDetails
  workspaceId?: string
  compact?: boolean
  // Initial state of the collapsible opening hours and reviews.
  openHours?: boolean
  openReviews?: boolean
  photoHeight?: number
}

// Renders a place snapshot. Used live in the editor and from stored node
// attrs on read-only pages.
export const PlaceDetailView = ({ place, workspaceId, compact, openHours = false, openReviews = !compact, photoHeight }: ViewProps) => {
  const { t } = useTranslation()
  const [showHours, setShowHours] = useState(openHours)
  const [showReviews, setShowReviews] = useState(openReviews)
  const hours = place.regularOpeningHours

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <PhotoStrip place={place} workspaceId={workspaceId} height={photoHeight ?? (compact ? 72 : 96)} />
      <div>
        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{place.displayName?.text}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <RatingStars rating={place.rating} count={place.userRatingCount} />
          {place.primaryTypeDisplayName?.text && (
            <span className="text-xs text-muted-foreground">{place.primaryTypeDisplayName.text}</span>
          )}
        </div>
      </div>
      {place.editorialSummary?.text && !compact && (
        <p className="text-xs text-gray-700 dark:text-gray-300">{place.editorialSummary.text}</p>
      )}
      <div className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
        {place.formattedAddress && (
          <span className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0" />{place.formattedAddress}</span>
        )}
        {place.nationalPhoneNumber && (
          <a href={`tel:${place.internationalPhoneNumber ?? place.nationalPhoneNumber}`} className="flex items-center gap-1.5 hover:underline">
            <Phone size={12} className="shrink-0" />{place.nationalPhoneNumber}
          </a>
        )}
        {place.websiteUri && (
          <a href={place.websiteUri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline min-w-0">
            <Globe size={12} className="shrink-0" /><span className="truncate">{place.websiteUri.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        {hours?.weekdayDescriptions?.length ? (
          <div>
            <button type="button" className="flex items-center gap-1.5 hover:underline" onClick={() => setShowHours(s => !s)} aria-expanded={showHours}>
              <Clock size={12} className="shrink-0" />
              {hours.openNow != null && (
                <span className={hours.openNow ? "text-green-600" : "text-red-500"}>
                  {hours.openNow ? t("googleMaps.openNow") : t("googleMaps.closedNow")}
                </span>
              )}
              <span className="text-muted-foreground">{t("googleMaps.openingHours")}</span>
              {showHours ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
            </button>
            {showHours && (
              <ul className="list-none mt-1 ml-5 flex flex-col gap-0.5 text-muted-foreground">
                {hours.weekdayDescriptions.map(d => <li key={d}>{d}</li>)}
              </ul>
            )}
          </div>
        ) : null}
        {place.googleMapsUri && (
          <a href={place.googleMapsUri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
            <ExternalLink size={12} className="shrink-0" />{t("googleMaps.openInGoogleMaps")}
          </a>
        )}
      </div>
      {place.reviews?.length ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="self-start flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline"
            onClick={() => setShowReviews(s => !s)}
            aria-expanded={showReviews}
          >
            {showReviews ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {t("googleMaps.reviewsCount", { count: place.reviews.length })}
          </button>
          {showReviews && <Reviews place={place} />}
        </div>
      ) : null}
      <div className="text-[10px] text-muted-foreground">{t("googleMaps.attribution")}</div>
    </div>
  )
}

interface PanelProps {
  workspaceId: string
  placeId: string
  onClose?: () => void
  actions?: (place: PlaceDetails) => ReactNode
  onLoad?: (place: PlaceDetails) => void
}

export const PlaceDetailPanel = ({ workspaceId, placeId, onClose, actions, onLoad }: PanelProps) => {
  const { i18n } = useTranslation()
  const { data: place, isLoading, error } = useQuery({
    queryKey: ["googlePlace", workspaceId, placeId, i18n.language],
    queryFn: () => getGooglePlace(workspaceId, placeId, i18n.language),
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (place) onLoad?.(place)
    // Only when a newly fetched place arrives, not when the callback changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place])

  return (
    <div className="relative flex flex-col gap-2 p-3">
      {onClose && (
        <button type="button" className="absolute right-2 top-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-muted-foreground z-10" onClick={onClose} aria-label="close">
          <X size={14} />
        </button>
      )}
      {isLoading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
      {error && <p className="text-xs text-red-500">{googleMapsErrorMessage(error)}</p>}
      {place && (
        <>
          {actions && <div className="flex flex-wrap gap-2 pr-6">{actions(place)}</div>}
          <PlaceDetailView place={place} workspaceId={workspaceId} />
        </>
      )}
    </div>
  )
}
