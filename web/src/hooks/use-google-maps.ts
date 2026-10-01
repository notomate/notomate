import { useQuery } from "@tanstack/react-query"
import { getGoogleMapsBrowserKey, getGoogleMapsIntegration } from "@/api/googleMaps"

export const googleMapsStatusKey = (workspaceId: string) => ['googleMapsIntegration', workspaceId]

export const useGoogleMapsStatus = (workspaceId?: string) =>
  useQuery({
    queryKey: googleMapsStatusKey(workspaceId ?? ''),
    queryFn: () => getGoogleMapsIntegration(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  })

export const useGoogleMapsBrowserKey = (workspaceId?: string, enabled = true) =>
  useQuery({
    queryKey: ['googleMapsBrowserKey', workspaceId],
    queryFn: () => getGoogleMapsBrowserKey(workspaceId!),
    enabled: !!workspaceId && enabled,
    staleTime: 30 * 60 * 1000,
    retry: false,
  })
