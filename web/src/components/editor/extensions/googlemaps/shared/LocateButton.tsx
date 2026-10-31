import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, MapPin } from "lucide-react"

interface Props {
  disabled?: boolean
  // Receives the device position as "lat, lng" text, ready for a search box.
  onLocate: (coords: string) => void
  onError: (message: string) => void
}

export const LocateButton = ({ disabled, onLocate, onError }: Props) => {
  const { t } = useTranslation()
  const [locating, setLocating] = useState(false)

  const locate = () => {
    // Geolocation is only exposed in secure contexts (HTTPS or localhost).
    if (!navigator.geolocation) {
      onError(t("googleMaps.locationUnsupported"))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        onLocate(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`)
      },
      err => {
        setLocating(false)
        onError(err.code === err.PERMISSION_DENIED ? t("googleMaps.locationDenied") : t("googleMaps.locationUnavailable"))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <button
      type="button"
      className="inline-flex items-center px-2.5 py-2 rounded border border-gray-300 dark:border-neutral-600 text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50"
      disabled={disabled || locating}
      onClick={locate}
      title={t("googleMaps.useMyLocation")}
      aria-label={t("googleMaps.useMyLocation")}
    >
      {locating ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
    </button>
  )
}
