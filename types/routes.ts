export type RouteType = "ride" | "rest" | "lecture";

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RouteCandidateReview {
  id: string;
  label: string;
  waypointNames: string[];
  generatedDistanceKm: number;
  distanceDeltaKm: number | null;
  selected: boolean;
  error?: string;
}

export interface RouteReview {
  selectedCandidate: string;
  reviewNote: string | null;
  candidates: RouteCandidateReview[];
}

export interface ConvenienceStore {
  id: string;
  name: string;
  displayName: string;
  metadataVersion?: number;
  brand: string | null;
  address: string;
  addressSource: "osm" | "reverse-geocode" | "coordinate-fallback";
  googleMapsUrl: string;
  lat: number;
  lon: number;
  distanceFromRouteM: number;
  targetKm: number;
  routeProgressKm: number;
  sideOfRoute: "right" | "left" | "on-route";
}

export interface RouteDay {
  day: number;
  date: string;
  weekday: string;
  type: RouteType;
  title: string;
  start: string;
  end: string;
  distanceKm: number | null;
  lunchStop?: string | null;
  lunchDistanceKm?: number | null;
  endAccommodation?: string | null;
  description: string;
  waypoints: Waypoint[];
  generatedDistanceKm?: number | null;
  distanceDeltaKm?: number | null;
  distanceWarning?: string | null;
  routeReview?: RouteReview;
  convenienceStores?: ConvenienceStore[];
  routingStatus?: "routed" | "fallback" | null;
  geojson?: LineStringGeometry | null;
  gpxPath?: string | null;
}
