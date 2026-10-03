import axios from 'axios';

// Shapes mirror the Google Places API (New) and Routes API responses, which
// the backend proxies (and caches) as-is.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

export interface LocalizedText {
  text: string;
  languageCode?: string;
}

export interface AuthorAttribution {
  displayName?: string;
  uri?: string;
  photoUri?: string;
}

export interface PlacePhoto {
  name: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: AuthorAttribution[];
}

export interface PlaceSummary {
  id: string;
  displayName?: LocalizedText;
  formattedAddress?: string;
  location?: GoogleLatLng;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryTypeDisplayName?: LocalizedText;
  googleMapsUri?: string;
}

export interface PlaceDetails extends PlaceSummary {
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  priceLevel?: string;
  photos?: PlacePhoto[];
  editorialSummary?: LocalizedText;
  businessStatus?: string;
}

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'TWO_WHEELER' | 'TRANSIT';

export interface RouteWaypoint {
  placeId?: string;
  lat?: number;
  lng?: number;
}

export interface LocalizedValues {
  distance?: LocalizedText;
  duration?: LocalizedText;
  staticDuration?: LocalizedText;
}

export interface TransitStop {
  name?: string;
  location?: { latLng: GoogleLatLng };
}

export interface TransitLine {
  name?: string;
  nameShort?: string;
  color?: string;
  textColor?: string;
  iconUri?: string;
  agencies?: { name?: string; uri?: string }[];
  // type is e.g. BUS, SUBWAY, HEAVY_RAIL, HIGH_SPEED_TRAIN, TRAM, FERRY.
  vehicle?: { name?: LocalizedText; type?: string; iconUri?: string; localIconUri?: string };
}

export interface TransitDetails {
  stopDetails?: {
    departureStop?: TransitStop;
    arrivalStop?: TransitStop;
    departureTime?: string;
    arrivalTime?: string;
  };
  localizedValues?: {
    departureTime?: { time?: LocalizedText };
    arrivalTime?: { time?: LocalizedText };
  };
  headsign?: string;
  transitLine?: TransitLine;
  stopCount?: number;
  tripShortText?: string;
}

export interface RouteStep {
  distanceMeters?: number;
  staticDuration?: string;
  navigationInstruction?: { maneuver?: string; instructions?: string };
  localizedValues?: LocalizedValues;
  travelMode?: string;
  transitDetails?: TransitDetails;
}

export interface RouteLeg {
  distanceMeters?: number;
  duration?: string;
  localizedValues?: LocalizedValues;
  startLocation?: { latLng: GoogleLatLng };
  endLocation?: { latLng: GoogleLatLng };
  steps?: RouteStep[];
}

export interface Route {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline: string };
  localizedValues?: LocalizedValues;
  legs?: RouteLeg[];
  warnings?: string[];
  optimizedIntermediateWaypointIndex?: number[];
}

export interface GoogleMapsIntegration {
  configured: boolean;
  has_browser_key: boolean;
  map_id: string;
}

const base = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}`;

export const getGoogleMapsIntegration = async (workspaceId: string) => {
  const response = await axios.get(`${base(workspaceId)}/integrations/google-maps`, { withCredentials: true });
  return response.data as GoogleMapsIntegration;
};

export const updateGoogleMapsIntegration = async (
  workspaceId: string,
  data: { server_key?: string; browser_key?: string; clear_browser_key?: boolean; map_id?: string }
) => {
  const response = await axios.put(`${base(workspaceId)}/integrations/google-maps`, data, { withCredentials: true });
  return response.data as GoogleMapsIntegration;
};

export const deleteGoogleMapsIntegration = async (workspaceId: string) => {
  await axios.delete(`${base(workspaceId)}/integrations/google-maps`, { withCredentials: true });
};

export const getGoogleMapsBrowserKey = async (workspaceId: string) => {
  const response = await axios.get(`${base(workspaceId)}/google-maps/browser-key`, { withCredentials: true });
  return response.data as { key: string; map_id: string };
};

export const searchGooglePlaces = async (
  workspaceId: string,
  data: { query: string; languageCode?: string; bias?: LatLng }
) => {
  const response = await axios.post(`${base(workspaceId)}/google-maps/places/search`, data, { withCredentials: true });
  return ((response.data?.places ?? []) as PlaceSummary[]);
};

export const getGooglePlace = async (workspaceId: string, placeId: string, lang?: string) => {
  const response = await axios.get(`${base(workspaceId)}/google-maps/places/${encodeURIComponent(placeId)}`, {
    withCredentials: true,
    params: lang ? { lang } : undefined,
  });
  return response.data as PlaceDetails;
};

// Returns Google's routes best-first; transit requests may include
// alternatives.
export const computeGoogleRoutes = async (
  workspaceId: string,
  data: { waypoints: RouteWaypoint[]; travelMode: TravelMode; optimize: boolean; languageCode?: string }
) => {
  const response = await axios.post(`${base(workspaceId)}/google-maps/routes`, data, { withCredentials: true });
  const routes = (response.data?.routes ?? []) as Route[];
  if (!routes.length) throw new Error('No route found');
  return routes;
};

export const getGooglePhotoUrl = (workspaceId: string, photoName: string, width = 400) =>
  `${base(workspaceId)}/google-maps/photos?name=${encodeURIComponent(photoName)}&w=${width}`;

export const googleMapsErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
  }
  return error instanceof Error ? error.message : 'Request failed';
};

export const toLatLng = (l?: GoogleLatLng): LatLng | null =>
  l ? { lat: l.latitude, lng: l.longitude } : null;
