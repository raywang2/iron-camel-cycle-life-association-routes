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

export interface RouteDay {
  day: number;
  date: string;
  weekday: string;
  type: RouteType;
  title: string;
  start: string;
  end: string;
  distanceKm: number | null;
  description: string;
  waypoints: Waypoint[];
  generatedDistanceKm?: number | null;
  distanceDeltaKm?: number | null;
  distanceWarning?: string | null;
  routingStatus?: "routed" | "fallback" | null;
  geojson?: LineStringGeometry | null;
  gpxPath?: string | null;
}
