import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Map as MapIcon } from "lucide-react"
import { PlaceDetails } from "@/api/googleMaps"
import { PlaceDetailView } from "./PlaceDetailView"
import { StaticRouteMap } from "./MapParts"
import { placeThumbnailUrl } from "./types"

interface Props {
  places: PlaceDetails[]
  workspaceId?: string
  // One full-width card per place with everything expanded (read-only pages).
  detailed?: boolean
}

export const PlacesList = ({ places, workspaceId, detailed }: Props) => {
  const { t } = useTranslation()
  const [showMap, setShowMap] = useState(false)
  const points = places
    .filter(p => p.location)
    .map((p, i) => ({
      lat: p.location!.latitude, lng: p.location!.longitude, label: String(i + 1), title: p.displayName?.text,
      imageUrl: placeThumbnailUrl(workspaceId, p),
    }))

  return (
    <div className="flex flex-col gap-3">
      {points.length > 0 && (
        <button type="button" className="self-start inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" onClick={() => setShowMap(s => !s)}>
          <MapIcon size={12} />{showMap ? t("googleMaps.hideMap") : t("googleMaps.showMap")}
        </button>
      )}
      {showMap && <StaticRouteMap points={points} height={240} />}
      <div className={detailed ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-2 gap-3"}>
        {places.map((place, i) => (
          <div key={place.id} className="relative p-3 rounded-lg border dark:border-neutral-700 min-w-0">
            <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">{i + 1}</span>
            <PlaceDetailView
              place={place}
              workspaceId={workspaceId}
              compact={!detailed}
              openHours={detailed}
              photoHeight={detailed ? 140 : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
