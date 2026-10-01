import { ReactNode } from "react"
import { APIProvider, ColorScheme } from "@vis.gl/react-google-maps"
import { useTranslation } from "react-i18next"
import { Loader2, MapPinOff } from "lucide-react"
import { useGoogleMapsBrowserKey } from "@/hooks/use-google-maps"
import { useTheme } from "@/providers/Theme"

// AdvancedMarker needs a map ID; Google's demo ID works when the workspace
// hasn't configured its own.
const FALLBACK_MAP_ID = "DEMO_MAP_ID"

export interface GoogleMapEnv {
  mapId: string
  colorScheme: ColorScheme
}

interface Props {
  workspaceId: string
  // Rendered instead of the live map when Google Maps can't be loaded.
  fallback?: ReactNode
  children: (env: GoogleMapEnv) => ReactNode
}

export const GoogleMapGate = ({ workspaceId, fallback, children }: Props) => {
  const { t, i18n } = useTranslation()
  const theme = useTheme()?.theme
  const { data, isLoading, isError } = useGoogleMapsBrowserKey(workspaceId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
      </div>
    )
  }
  if (isError || !data?.key) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded">
          <MapPinOff size={14} />
          {t("googleMaps.notConfigured")}
        </div>
        {fallback}
      </>
    )
  }

  return (
    <APIProvider apiKey={data.key} language={i18n.language} libraries={["geometry"]}>
      {children({
        mapId: data.map_id || FALLBACK_MAP_ID,
        colorScheme: theme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT,
      })}
    </APIProvider>
  )
}
