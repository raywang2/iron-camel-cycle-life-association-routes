import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { mergeRouteSchedule, parseRouteScheduleCsv } from "./route-schedule.js";
import type {
  ConvenienceStore,
  LineStringGeometry,
  RouteGeometry,
  RouteCandidateReview,
  RouteDay,
  RouteReview,
  Waypoint,
} from "../types/routes.js";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "data", "route-waypoints.json");
const SCHEDULE_PATH = path.join(ROOT, "routes.csv");
const ROUTES_PATH = path.join(ROOT, "data", "routes.json");
const GPX_DIR = path.join(ROOT, "gpx");
const FAST_ROAD_CACHE_PATH = process.env.FAST_ROAD_CACHE_PATH || path.join(ROOT, "tmp", "fast-roads-overpass.json");
export const DEFAULT_ROUTER_ENGINE = "valhalla";
export const DEFAULT_ROUTER_PROFILE = "bicycle";
export const DEFAULT_BICYCLE_USE_ROADS = 0;
export const DEFAULT_BROUTER_PROFILE = "trekking";
export const DEFAULT_REST_WINDOW_KM = 15;
const ROUTER_ENGINE = process.env.ROUTER_ENGINE || DEFAULT_ROUTER_ENGINE;
const ROUTER_URL = process.env.ROUTER_URL || "https://router.project-osrm.org";
const VALHALLA_URL = process.env.VALHALLA_URL || "https://valhalla1.openstreetmap.de";
const ROUTER_PROFILE = process.env.ROUTER_PROFILE || DEFAULT_ROUTER_PROFILE;
const BROUTER_URL = process.env.BROUTER_URL || "https://brouter.m11n.de/brouter-engine/brouter";
const BROUTER_PROFILE = process.env.BROUTER_PROFILE || DEFAULT_BROUTER_PROFILE;
const BICYCLE_USE_ROADS = Number(process.env.BICYCLE_USE_ROADS ?? DEFAULT_BICYCLE_USE_ROADS);
const ALLOW_ROUTE_FALLBACK = process.env.ALLOW_ROUTE_FALLBACK === "1";
const OVERPASS_URLS = (
  process.env.OVERPASS_URLS ||
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter"
).split(",");
const OSM_API_URL = process.env.OSM_API_URL || "https://api.openstreetmap.org/api/0.6";
const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const FETCH_CONVENIENCE_STORES = process.env.FETCH_CONVENIENCE_STORES !== "0";
const USE_CACHED_CONVENIENCE_STORES = process.env.USE_CACHED_CONVENIENCE_STORES === "1";
const REFETCH_CONVENIENCE_STORES = process.env.REFETCH_CONVENIENCE_STORES === "1";
const POI_RADIUS_M = Number(process.env.POI_RADIUS_M || "1200");
const REST_INTERVAL_KM = Number(process.env.REST_INTERVAL_KM || "10");
const REST_WINDOW_KM = Number(process.env.REST_WINDOW_KM || String(DEFAULT_REST_WINDOW_KM));
const AVOID_FAST_ROADS = process.env.AVOID_FAST_ROADS !== "0";
const FAST_ROAD_MATCH_DISTANCE_M = Number(process.env.FAST_ROAD_MATCH_DISTANCE_M || "22");
const FAST_ROAD_MAX_HEADING_DIFF_DEG = Number(process.env.FAST_ROAD_MAX_HEADING_DIFF_DEG || "35");
const FAST_ROAD_MIN_AVOID_KM = Number(process.env.FAST_ROAD_MIN_AVOID_KM || "1");
const FAST_ROAD_REROUTE_ATTEMPTS = Number(process.env.FAST_ROAD_REROUTE_ATTEMPTS || "4");
const FAST_ROAD_GRID_SIZE_DEG = 0.01;
const MEANINGFUL_ROUTE_SAVING_KM = Number(process.env.MEANINGFUL_ROUTE_SAVING_KM || "8");
const COMPARABLE_DISTANCE_DELTA_KM = Number(process.env.COMPARABLE_DISTANCE_DELTA_KM || "2");
const OVERPASS_DELAY_MS = Number(process.env.OVERPASS_DELAY_MS || "3500");
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS || "45000");
const OSM_API_DELAY_MS = Number(process.env.OSM_API_DELAY_MS || "200");
const NOMINATIM_DELAY_MS = Number(process.env.NOMINATIM_DELAY_MS || "1100");
const EXCLUDED_STORE_NAME_PATTERNS = [/shopee/i, /蝦皮/i];
const STORE_METADATA_VERSION = 3;
const execFileAsync = promisify(execFile);
let lastOverpassRequestAt = 0;
let lastNominatimRequestAt = 0;

type BuildRouteEnv = Partial<Pick<NodeJS.ProcessEnv, "BUILD_ROUTE_DAYS" | "ROUTE_DAYS" | "DAY">>;

interface CoordinatePoint {
  lat: number;
  lon: number;
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    geometry?: LineStringGeometry;
  }>;
}

interface ValhallaRouteResponse {
  error?: string;
  trip?: {
    summary?: {
      has_highway?: boolean;
      length?: number;
    };
    legs?: Array<{
      shape?: string;
    }>;
  };
}

interface BrouterRouteResponse {
  features?: Array<{
    properties?: {
      messages?: string[][];
    };
    geometry?: {
      type?: string;
      coordinates?: number[][];
    };
  }>;
}

interface RouteCandidateDefinition {
  id: string;
  label: string;
  waypoints: Waypoint[];
}

interface BuiltRouteCandidate extends RouteCandidateReview {
  waypoints: Waypoint[];
  geometry: LineStringGeometry;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{
    lat: number;
    lon: number;
  }>;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface OsmApiResponse {
  elements?: OverpassElement[];
}

interface NominatimReverseResponse {
  display_name?: string;
  address?: Record<string, string>;
}

interface StoreWithSegment extends ConvenienceStore {
  segmentIndex: number;
  score: number;
  sourcePriority: number;
}

interface SegmentProjection {
  distanceM: number;
  t: number;
  sideOfRoute: ConvenienceStore["sideOfRoute"];
}

interface FastRoadSegment {
  id: string;
  label: string;
  start: CoordinatePoint;
  end: CoordinatePoint;
  heading: number;
}

interface FastRoadMatch {
  id: string;
  label: string;
  matchedKm: number;
  firstKm: number;
  lastKm: number;
}

type FastRoadIndex = Map<string, FastRoadSegment[]>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseDaySelector(values: string[]): Set<number> {
  const days = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const day = Number(value);
      if (!Number.isInteger(day) || day < 0) {
        throw new Error(`Invalid route day: ${value}`);
      }
      return day;
    });

  if (days.length === 0) {
    throw new Error("Route day selector cannot be empty");
  }

  return new Set([...days].sort((a, b) => a - b));
}

export function parseRequestedDays(
  args = process.argv.slice(2),
  env: BuildRouteEnv = process.env,
): Set<number> | null {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--day" || arg === "--days") {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a day value`);
      }
      values.push(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--day=")) {
      values.push(arg.slice("--day=".length));
      continue;
    }
    if (arg.startsWith("--days=")) {
      values.push(arg.slice("--days=".length));
      continue;
    }
    if (arg === "--") {
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown build route option: ${arg}`);
    }
    values.push(arg);
  }

  const envValue = env.BUILD_ROUTE_DAYS ?? env.ROUTE_DAYS ?? env.DAY;
  if (values.length === 0 && envValue) {
    values.push(envValue);
  }

  return values.length > 0 ? parseDaySelector(values) : null;
}

export function shouldBuildRouteDay(day: number, requestedDays: ReadonlySet<number> | null): boolean {
  return !requestedDays || requestedDays.has(day);
}

export function existingRouteOutputForSkippedDay(
  day: RouteDay,
  existingRoutes: ReadonlyMap<number, RouteDay>,
): RouteDay {
  const existingDay = existingRoutes.get(day.day);
  if (!existingDay) {
    throw new Error(`Cannot skip Day ${day.day} without existing generated route output`);
  }
  return existingDay;
}

function dayId(day: number): string {
  return String(day).padStart(2, "0");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function haversineKm(a: CoordinatePoint, b: CoordinatePoint): number {
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function localPoint(point: CoordinatePoint, origin: CoordinatePoint): { x: number; y: number } {
  return {
    x: (point.lon - origin.lon) * 111_320 * Math.cos((origin.lat * Math.PI) / 180),
    y: (point.lat - origin.lat) * 110_540,
  };
}

function headingDeg(start: CoordinatePoint, end: CoordinatePoint): number {
  const origin = {
    lat: (start.lat + end.lat) / 2,
    lon: (start.lon + end.lon) / 2,
  };
  const a = localPoint(start, origin);
  const b = localPoint(end, origin);
  return ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 360) % 360;
}

function headingDiffDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  const normalized = diff > 180 ? 360 - diff : diff;
  return Math.min(normalized, 180 - normalized);
}

function fallbackGeometry(waypoints: Waypoint[]): LineStringGeometry {
  return {
    type: "LineString",
    coordinates: waypoints.map((point) => [point.lon, point.lat]),
  };
}

function sameWaypoint(a: Waypoint, b: Waypoint): boolean {
  return a.name === b.name && a.lat === b.lat && a.lon === b.lon;
}

function uniqueCandidateWaypoints(waypoints: Waypoint[]): Waypoint[] {
  const unique: Waypoint[] = [];
  for (const waypoint of waypoints) {
    const previous = unique.at(-1);
    if (!previous || !sameWaypoint(previous, waypoint)) {
      unique.push(waypoint);
    }
  }
  return unique;
}

function routeCandidateDefinitions(day: RouteDay): RouteCandidateDefinition[] {
  const waypoints = uniqueCandidateWaypoints(day.waypoints);
  const first = waypoints[0];
  const last = waypoints.at(-1);
  if (!first || !last) {
    return [];
  }

  const reduced = waypoints.filter(
    (_waypoint, index) => index === 0 || index === waypoints.length - 1 || index % 2 === 0,
  );
  const definitions: RouteCandidateDefinition[] = [
    {
      id: "pdf-waypoints",
      label: "PDF 路點",
      waypoints,
    },
    {
      id: "reduced-waypoints",
      label: "簡化路點",
      waypoints: uniqueCandidateWaypoints(reduced),
    },
    {
      id: "direct-endpoints",
      label: "起終點",
      waypoints: [first, last],
    },
  ];

  const seen = new Set<string>();
  return definitions.filter((definition) => {
    const key = definition.waypoints.map((waypoint) => `${waypoint.lat},${waypoint.lon}`).join("|");
    if (seen.has(key) || definition.waypoints.length < 2) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function geometryLineStrings(geometry: RouteGeometry): [number, number][][] {
  return geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
}

function geometryCoordinates(geometry: RouteGeometry): [number, number][] {
  return geometryLineStrings(geometry).flat();
}

function lineStringDistanceKm(coordinates: [number, number][]): number {
  let total = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    if (!previous || !current) {
      continue;
    }
    const [prevLon, prevLat] = previous;
    const [lon, lat] = current;
    total += haversineKm({ lat: prevLat, lon: prevLon }, { lat, lon });
  }

  return total;
}

function geometryDistanceKm(geometry: RouteGeometry): number {
  const total = geometryLineStrings(geometry).reduce(
    (sum, coordinates) => sum + lineStringDistanceKm(coordinates),
    0,
  );

  return Math.round(total * 10) / 10;
}

function calculateDistanceDeltaKm(generatedDistanceKm: number, pdfDistanceKm: number | null): number | null {
  if (typeof pdfDistanceKm !== "number") {
    return null;
  }

  return Math.round((generatedDistanceKm - pdfDistanceKm) * 10) / 10;
}

function escapeXml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(7)).toString();
}

function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${formatCoordinate(lat)},${formatCoordinate(lon)}`)}`;
}

function fallbackAddress(lat: number, lon: number): string {
  return `地址暫無資料（座標 ${lat.toFixed(6)}, ${lon.toFixed(6)}）`;
}

function firstTag(tags: Record<string, string> | undefined, keys: string[]): string | null {
  for (const key of keys) {
    const value = tags?.[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function formatAddress(
  tags: Record<string, string> | undefined,
  lat: number,
  lon: number,
): Pick<ConvenienceStore, "address" | "addressSource"> {
  const fullAddress = firstTag(tags, ["addr:full", "address", "contact:address"]);
  if (fullAddress) {
    return { address: fullAddress, addressSource: "osm" };
  }

  const city = firstTag(tags, ["addr:city", "addr:county", "addr:province", "contact:city"]);
  const district = firstTag(tags, ["addr:district", "addr:suburb", "addr:town", "contact:district"]);
  const village = firstTag(tags, ["addr:village", "addr:quarter", "addr:hamlet"]);
  const street = firstTag(tags, ["addr:street", "contact:street"]);
  const lane = firstTag(tags, ["addr:lane"]);
  const alley = firstTag(tags, ["addr:alley"]);
  const houseNumber = firstTag(tags, ["addr:housenumber", "contact:housenumber"]);
  const place = firstTag(tags, ["addr:place"]);
  const composed = [city, district, village, street, lane, alley, houseNumber ?? place]
    .filter((part): part is string => Boolean(part))
    .join("");

  return composed
    ? { address: composed, addressSource: "osm" }
    : { address: fallbackAddress(lat, lon), addressSource: "coordinate-fallback" };
}

function withStoreDisplayFields(store: ConvenienceStore): ConvenienceStore {
  const fallback = !store.address?.trim();
  return {
    ...store,
    displayName: store.displayName?.trim() || store.name,
    metadataVersion: store.metadataVersion ?? 1,
    address: fallback ? fallbackAddress(store.lat, store.lon) : store.address.trim(),
    addressSource: store.addressSource ?? (fallback ? "coordinate-fallback" : "osm"),
    googleMapsUrl: store.googleMapsUrl?.trim() || googleMapsUrl(store.lat, store.lon),
  };
}

function hasStoreDisplayFields(store: ConvenienceStore): boolean {
  return (
    typeof store.address === "string" &&
    store.address.trim().length > 0 &&
    (
      store.addressSource === "osm" ||
      store.addressSource === "reverse-geocode"
    ) &&
    store.metadataVersion === STORE_METADATA_VERSION &&
    typeof store.googleMapsUrl === "string" &&
    store.googleMapsUrl.startsWith("https://www.google.com/maps/search/?api=1&query=")
  );
}

function uniqueParts(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function formatNominatimAddress(payload: NominatimReverseResponse): string | null {
  const address = payload.address;
  const composed = uniqueParts([
    address?.city ?? address?.county ?? address?.state,
    address?.city_district ?? address?.suburb ?? address?.town ?? address?.village,
    address?.neighbourhood,
    address?.road ?? address?.pedestrian,
    address?.house_number,
  ]).join("");

  return composed || payload.display_name?.trim() || null;
}

function geometryToGpx(day: RouteDay, geometry: RouteGeometry): string {
  const trackSegments = geometryLineStrings(geometry)
    .map((coordinates) => {
      const points = coordinates
        .map(
          ([lon, lat]) =>
            `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`,
        )
        .join("\n");
      return `    <trkseg>
${points}
    </trkseg>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="2026-routes" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(day.title)}</name>
    <desc>${escapeXml(day.description)}</desc>
  </metadata>
  <trk>
    <name>${escapeXml(`Day ${day.day} ${day.title}`)}</name>
${trackSegments}
  </trk>
</gpx>
`;
}

export function parseKmlLineStringGeometry(kml: string): RouteGeometry {
  const lineStrings = [...kml.matchAll(/<LineString\b[^>]*>([\s\S]*?)<\/LineString>/g)]
    .map((lineStringMatch) => {
      const coordinatesText = lineStringMatch[1]?.match(/<coordinates>([\s\S]*?)<\/coordinates>/)?.[1] ?? "";
      return coordinatesText
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((coordinate) => {
          const [lon, lat] = coordinate.split(",").map(Number);
          return typeof lon === "number" && Number.isFinite(lon) &&
            typeof lat === "number" && Number.isFinite(lat)
            ? [lon, lat] as [number, number]
            : null;
        })
        .filter((coordinate): coordinate is [number, number] => Boolean(coordinate));
    })
    .filter((coordinates) => coordinates.length >= 2);

  if (lineStrings.length === 0) {
    throw new Error("KML route does not include a LineString with at least two coordinates");
  }

  if (lineStrings.length === 1) {
    return {
      type: "LineString",
      coordinates: lineStrings[0]!,
    };
  }

  return {
    type: "MultiLineString",
    coordinates: lineStrings,
  };
}

async function readExternalRouteGeometry(externalRoutePath: string): Promise<RouteGeometry> {
  const routePath = path.isAbsolute(externalRoutePath)
    ? externalRoutePath
    : path.join(ROOT, externalRoutePath);
  return parseKmlLineStringGeometry(await fs.readFile(routePath, "utf8"));
}

async function routeWithOsrm(waypoints: Waypoint[]): Promise<LineStringGeometry> {
  const coordinates = waypoints
    .map((point) => `${point.lon},${point.lat}`)
    .join(";");
  const endpoint = `${ROUTER_URL.replace(/\/$/, "")}/route/v1/${ROUTER_PROFILE}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  let payload: OsrmRouteResponse;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Routing request failed: ${response.status} ${response.statusText}`);
    }
    payload = (await response.json()) as OsrmRouteResponse;
  } catch (error) {
    const { stdout } = await execFileAsync("curl", ["-fsSL", endpoint], {
      maxBuffer: 10 * 1024 * 1024,
    });
    payload = JSON.parse(stdout) as OsrmRouteResponse;
    if (!payload) {
      throw error;
    }
  }

  if (payload.code !== "Ok" || !payload.routes?.[0]?.geometry) {
    throw new Error(`Routing response did not include geometry: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  return payload.routes[0].geometry;
}

export function brouterFastRoadLabels(payload: BrouterRouteResponse): string[] {
  const messages = payload.features?.[0]?.properties?.messages ?? [];
  const header = messages[0] ?? [];
  const wayTagsIndex = header.indexOf("WayTags");
  const nodeTagsIndex = header.indexOf("NodeTags");
  const fastRoadPattern = /\b(?:highway=(?:motorway|motorway_link|trunk|trunk_link)|motorroad=yes)\b/;
  const labels = new Set<string>();

  for (const row of messages.slice(1)) {
    const wayTags = wayTagsIndex >= 0 ? row[wayTagsIndex] : "";
    const nodeTags = nodeTagsIndex >= 0 ? row[nodeTagsIndex] : "";
    const tags = [wayTags, nodeTags].filter(Boolean).join(" ");
    if (fastRoadPattern.test(tags)) {
      labels.add(tags);
    }
  }

  return [...labels];
}

async function routeWithBrouter(waypoints: Waypoint[]): Promise<LineStringGeometry> {
  const endpoint = new URL(BROUTER_URL);
  endpoint.searchParams.set("lonlats", waypoints.map((point) => `${point.lon},${point.lat}`).join("|"));
  endpoint.searchParams.set("profile", BROUTER_PROFILE);
  endpoint.searchParams.set("alternativeidx", "0");
  endpoint.searchParams.set("format", "geojson");
  let payload: BrouterRouteResponse;

  try {
    const response = await fetch(endpoint, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "2026-iron-camel-routes/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`BRouter request failed: ${response.status} ${response.statusText}`);
    }
    payload = (await response.json()) as BrouterRouteResponse;
  } catch (error) {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-fsSL",
        "-G",
        "-H",
        "Accept: application/json",
        "-H",
        "User-Agent: 2026-iron-camel-routes/1.0",
        "--data-urlencode",
        `lonlats=${waypoints.map((point) => `${point.lon},${point.lat}`).join("|")}`,
        "--data-urlencode",
        `profile=${BROUTER_PROFILE}`,
        "--data-urlencode",
        "alternativeidx=0",
        "--data-urlencode",
        "format=geojson",
        BROUTER_URL,
      ],
      {
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    payload = JSON.parse(stdout) as BrouterRouteResponse;
    if (!payload) {
      throw error;
    }
  }

  if (AVOID_FAST_ROADS) {
    const fastRoadLabels = brouterFastRoadLabels(payload);
    if (fastRoadLabels.length > 0) {
      throw new Error(`BRouter route uses fast-road tags: ${fastRoadLabels.slice(0, 5).join("; ")}`);
    }
  }

  const coordinates = payload.features?.[0]?.geometry?.coordinates
    ?.map((coordinate) => {
      const [lon, lat] = coordinate;
      return typeof lon === "number" && typeof lat === "number" ? [lon, lat] as [number, number] : null;
    })
    .filter((coordinate): coordinate is [number, number] => Boolean(coordinate)) ?? [];

  if (coordinates.length < 2) {
    throw new Error(`BRouter response did not include geometry: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  const geometry: LineStringGeometry = {
    type: "LineString",
    coordinates,
  };

  return geometry;
}

function decodeValhallaShape(shape: string, precision = 6): CoordinatePoint[] {
  const coordinates: CoordinatePoint[] = [];
  const factor = 10 ** precision;
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < shape.length) {
    let result = 1;
    let shift = 0;
    let byte = 0;
    do {
      byte = shape.charCodeAt(index) - 63 - 1;
      index += 1;
      result += byte << shift;
      shift += 5;
    } while (byte >= 0x1f);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      byte = shape.charCodeAt(index) - 63 - 1;
      index += 1;
      result += byte << shift;
      shift += 5;
    } while (byte >= 0x1f);
    lon += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      lat: lat / factor,
      lon: lon / factor,
    });
  }

  return coordinates;
}

function valhallaPayload(waypoints: Waypoint[], excludeLocations: CoordinatePoint[]): string {
  return JSON.stringify({
    locations: waypoints.map((point) => ({
      lat: point.lat,
      lon: point.lon,
      type: "break",
    })),
    costing: ROUTER_PROFILE,
    costing_options: ROUTER_PROFILE === "bicycle"
      ? {
          bicycle: {
            use_roads: BICYCLE_USE_ROADS,
          },
        }
      : undefined,
    exclude_locations: excludeLocations.length > 0
      ? excludeLocations.map((point) => ({
          lat: point.lat,
          lon: point.lon,
        }))
      : undefined,
    directions_options: {
      units: "kilometers",
    },
  });
}

async function requestValhallaGeometry(
  waypoints: Waypoint[],
  excludeLocations: CoordinatePoint[],
): Promise<LineStringGeometry> {
  const endpoint = `${VALHALLA_URL.replace(/\/$/, "")}/route`;
  const body = valhallaPayload(waypoints, excludeLocations);
  let payload: ValhallaRouteResponse;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "2026-routes",
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`Routing request failed: ${response.status} ${response.statusText}`);
    }
    payload = (await response.json()) as ValhallaRouteResponse;
  } catch (error) {
    const { stdout } = await execFileAsync(
      "curl",
      ["-fsSL", "-X", "POST", "-H", "content-type: application/json", "-H", "user-agent: 2026-routes", "-d", body, endpoint],
      {
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    payload = JSON.parse(stdout) as ValhallaRouteResponse;
    if (!payload) {
      throw error;
    }
  }

  if (payload.error) {
    throw new Error(`Routing response error: ${payload.error}`);
  }
  if (payload.trip?.summary?.has_highway) {
    throw new Error("Valhalla route summary indicates highway usage");
  }

  const points: CoordinatePoint[] = [];
  for (const leg of payload.trip?.legs ?? []) {
    if (!leg.shape) {
      continue;
    }
    const legPoints = decodeValhallaShape(leg.shape);
    if (points.length > 0) {
      legPoints.shift();
    }
    points.push(...legPoints);
  }

  if (points.length < 2) {
    throw new Error(`Routing response did not include geometry: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  return {
    type: "LineString",
    coordinates: points.map((point) => [point.lon, point.lat]),
  };
}

async function routeWithValhalla(waypoints: Waypoint[]): Promise<LineStringGeometry> {
  const excludeLocations: CoordinatePoint[] = [];

  for (let attempt = 0; attempt <= FAST_ROAD_REROUTE_ATTEMPTS; attempt += 1) {
    const geometry = await requestValhallaGeometry(waypoints, excludeLocations);
    if (!AVOID_FAST_ROADS) {
      return geometry;
    }

    const matches = await fastRoadMatches(geometry);
    if (matches.length === 0) {
      return geometry;
    }
    if (attempt >= FAST_ROAD_REROUTE_ATTEMPTS) {
      throw new Error(
        `Route still uses fast roads after ${FAST_ROAD_REROUTE_ATTEMPTS} reroutes: ${
          matches.map((match) => `${match.label} ${match.matchedKm.toFixed(1)}km`).join("; ")
        }`,
      );
    }

    for (const match of matches) {
      const avoidPoint = routePointAtKm(geometry, (match.firstKm + match.lastKm) / 2);
      if (
        !excludeLocations.some((point) => haversineKm(point, avoidPoint) < 0.2)
      ) {
        excludeLocations.push(avoidPoint);
      }
    }
  }

  throw new Error("Route fast-road avoidance failed unexpectedly");
}

async function routeWithRouter(waypoints: Waypoint[]): Promise<LineStringGeometry> {
  if (ROUTER_ENGINE === "valhalla") {
    return routeWithValhalla(waypoints);
  }
  if (ROUTER_ENGINE === "osrm") {
    return routeWithOsrm(waypoints);
  }
  if (ROUTER_ENGINE === "brouter") {
    return routeWithBrouter(waypoints);
  }
  throw new Error(`Unsupported router engine: ${ROUTER_ENGINE}`);
}

async function buildRouteCandidates(day: RouteDay): Promise<BuiltRouteCandidate[]> {
  const candidates: BuiltRouteCandidate[] = [];
  for (const definition of routeCandidateDefinitions(day)) {
    const geometry = await routeWithRouter(definition.waypoints);
    const generatedDistanceKm = geometryDistanceKm(geometry);
    candidates.push({
      id: definition.id,
      label: definition.label,
      waypoints: definition.waypoints,
      waypointNames: definition.waypoints.map((waypoint) => waypoint.name),
      generatedDistanceKm,
      distanceDeltaKm: calculateDistanceDeltaKm(generatedDistanceKm, day.distanceKm),
      selected: false,
      geometry,
    });
  }

  return candidates;
}

function selectRouteCandidate(day: RouteDay, candidates: BuiltRouteCandidate[]): BuiltRouteCandidate {
  if (candidates.length === 0) {
    throw new Error(`Day ${day.day} did not produce any route candidates`);
  }

  const pdfCandidate = candidates.find((candidate) => candidate.id === "pdf-waypoints") ?? candidates[0];
  if (!pdfCandidate) {
    throw new Error(`Day ${day.day} did not produce a PDF waypoint route`);
  }

  if (typeof day.distanceKm !== "number") {
    return pdfCandidate;
  }

  const minimumReasonableDistance = day.distanceKm * 0.75;
  const preferredMinimumDistance = day.distanceKm * 0.85;
  const reasonableCandidates = candidates.filter(
    (candidate) => candidate.generatedDistanceKm >= minimumReasonableDistance,
  );
  const pool = reasonableCandidates.length > 0 ? reasonableCandidates : candidates;
  const preferredPool = pool.filter((candidate) => candidate.generatedDistanceKm >= preferredMinimumDistance);
  const closestToPdf = (preferredPool.length > 0 ? preferredPool : pool)
    .reduce((best, candidate) =>
      Math.abs((candidate.distanceDeltaKm ?? 0)) < Math.abs((best.distanceDeltaKm ?? 0)) ? candidate : best,
    );
  const shorterComparableCandidate = pool
    .filter((candidate) => candidate.generatedDistanceKm < closestToPdf.generatedDistanceKm)
    .filter((candidate) => closestToPdf.generatedDistanceKm - candidate.generatedDistanceKm >= MEANINGFUL_ROUTE_SAVING_KM)
    .filter(
      (candidate) =>
        Math.abs(candidate.distanceDeltaKm ?? 0) <=
        Math.abs(closestToPdf.distanceDeltaKm ?? 0) + COMPARABLE_DISTANCE_DELTA_KM,
    )
    .sort((a, b) => a.generatedDistanceKm - b.generatedDistanceKm)[0];

  if (shorterComparableCandidate) {
    return shorterComparableCandidate;
  }

  const improvementKm = Math.round((pdfCandidate.generatedDistanceKm - closestToPdf.generatedDistanceKm) * 10) / 10;

  if (closestToPdf.id !== pdfCandidate.id && improvementKm >= 5) {
    return closestToPdf;
  }

  const pdfDelta = pdfCandidate.distanceDeltaKm ?? 0;
  if (Math.abs(pdfDelta) <= 15) {
    return pdfCandidate;
  }

  return pool.reduce((best, candidate) =>
    candidate.generatedDistanceKm < best.generatedDistanceKm ? candidate : best,
  );
}

function createRouteReview(day: RouteDay, selected: BuiltRouteCandidate, candidates: BuiltRouteCandidate[]): RouteReview {
  let reviewNote: string | null = null;
  const pdfCandidate = candidates.find((candidate) => candidate.id === "pdf-waypoints");

  if (pdfCandidate && selected.id !== pdfCandidate.id) {
    const savedKm = Math.round((pdfCandidate.generatedDistanceKm - selected.generatedDistanceKm) * 10) / 10;
    reviewNote = `已改用${selected.label}路線，比原 PDF 路點路線少 ${savedKm} km，避免中繼點造成繞路。`;
  } else if (typeof day.distanceKm === "number" && selected.generatedDistanceKm - day.distanceKm > 20) {
    const delta = Math.round((selected.generatedDistanceKm - day.distanceKm) * 10) / 10;
    reviewNote = `道路網仍比 PDF 多 ${delta} km，建議人工確認 PDF 是否含接駁、未騎乘段或更精確路點。`;
  }

  return {
    selectedCandidate: selected.id,
    reviewNote,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      waypointNames: candidate.waypointNames,
      generatedDistanceKm: candidate.generatedDistanceKm,
      distanceDeltaKm: candidate.distanceDeltaKm,
      selected: candidate.id === selected.id,
    })),
  };
}

function createExternalRouteReview(day: RouteDay, geometry: RouteGeometry): RouteReview {
  const generatedDistanceKm = geometryDistanceKm(geometry);

  return {
    selectedCandidate: "external-kml",
    reviewNote: "已使用人工確認的 Google My Maps KML 路線。",
    candidates: [
      {
        id: "external-kml",
        label: "Google My Maps KML",
        waypointNames: day.waypoints.map((waypoint) => waypoint.name),
        generatedDistanceKm,
        distanceDeltaKm: calculateDistanceDeltaKm(generatedDistanceKm, day.distanceKm),
        selected: true,
      },
    ],
  };
}

function geometryBounds(geometry: RouteGeometry): [number, number, number, number] {
  return coordinateBounds(geometryCoordinates(geometry));
}

function coordinateBounds(coordinates: [number, number][]): [number, number, number, number] {
  const lats = coordinates.map(([, lat]) => lat);
  const lons = coordinates.map(([lon]) => lon);
  const south = Math.min(...lats) - 0.015;
  const west = Math.min(...lons) - 0.015;
  const north = Math.max(...lats) + 0.015;
  const east = Math.max(...lons) + 0.015;
  return [south, west, north, east];
}

function convenienceStoreQuery(bounds: [number, number, number, number]): string {
  const [south, west, north, east] = bounds;
  return `
[out:json][timeout:35];
(
  node["shop"="convenience"](${south},${west},${north},${east});
  way["shop"="convenience"](${south},${west},${north},${east});
  node["amenity"="fuel"](${south},${west},${north},${east});
  way["amenity"="fuel"](${south},${west},${north},${east});
);
out center tags;
`;
}

function routePointAtKm(geometry: RouteGeometry, targetKm: number): CoordinatePoint {
  let cumulativeKm = 0;

  for (const coordinates of geometryLineStrings(geometry)) {
    for (let index = 1; index < coordinates.length; index += 1) {
      const previous = coordinates[index - 1];
      const current = coordinates[index];
      if (!previous || !current) {
        continue;
      }

      const start = { lat: previous[1], lon: previous[0] };
      const end = { lat: current[1], lon: current[0] };
      const segmentKm = haversineKm(start, end);
      if (cumulativeKm + segmentKm >= targetKm) {
        const t = segmentKm === 0 ? 0 : (targetKm - cumulativeKm) / segmentKm;
        return {
          lat: start.lat + (end.lat - start.lat) * t,
          lon: start.lon + (end.lon - start.lon) * t,
        };
      }

      cumulativeKm += segmentKm;
    }
  }

  const coordinates = geometryCoordinates(geometry);
  const [lon, lat] = coordinates.at(-1) ?? coordinates[0] ?? [0, 0];
  return { lat, lon };
}

function fastRoadQuery(): string {
  return `
[out:json][timeout:180];
(
  way["highway"~"^(motorway|motorway_link|trunk|trunk_link)$"](21.8,119.2,25.5,122.2);
  way["motorroad"="yes"](21.8,119.2,25.5,122.2);
);
out geom tags;
`;
}

function fastRoadLabel(tags: Record<string, string> | undefined): string {
  return [tags?.ref, tags?.name, tags?.highway, tags?.motorroad === "yes" ? "motorroad=yes" : null]
    .filter((part): part is string => Boolean(part))
    .join(" / ");
}

function buildFastRoadSegments(elements: OverpassElement[]): FastRoadSegment[] {
  const segments: FastRoadSegment[] = [];
  for (const element of elements) {
    if (element.type !== "way" || !Array.isArray(element.geometry)) {
      continue;
    }
    for (let index = 1; index < element.geometry.length; index += 1) {
      const previous = element.geometry[index - 1];
      const current = element.geometry[index];
      if (!previous || !current) {
        continue;
      }
      const start = { lat: previous.lat, lon: previous.lon };
      const end = { lat: current.lat, lon: current.lon };
      segments.push({
        id: `${element.type}/${element.id}`,
        label: fastRoadLabel(element.tags),
        start,
        end,
        heading: headingDeg(start, end),
      });
    }
  }
  return segments;
}

function gridRange(min: number, max: number): number[] {
  const values = [];
  for (
    let value = Math.floor(min / FAST_ROAD_GRID_SIZE_DEG);
    value <= Math.floor(max / FAST_ROAD_GRID_SIZE_DEG);
    value += 1
  ) {
    values.push(value);
  }
  return values;
}

function buildFastRoadIndex(segments: FastRoadSegment[]): FastRoadIndex {
  const index: FastRoadIndex = new Map();
  for (const segment of segments) {
    for (
      const latCell of gridRange(
        Math.min(segment.start.lat, segment.end.lat) - 0.002,
        Math.max(segment.start.lat, segment.end.lat) + 0.002,
      )
    ) {
      for (
        const lonCell of gridRange(
          Math.min(segment.start.lon, segment.end.lon) - 0.002,
          Math.max(segment.start.lon, segment.end.lon) + 0.002,
        )
      ) {
        const key = `${latCell},${lonCell}`;
        const bucket = index.get(key) ?? [];
        bucket.push(segment);
        index.set(key, bucket);
      }
    }
  }
  return index;
}

function nearbyFastRoadSegments(index: FastRoadIndex, point: CoordinatePoint): FastRoadSegment[] {
  const latCell = Math.floor(point.lat / FAST_ROAD_GRID_SIZE_DEG);
  const lonCell = Math.floor(point.lon / FAST_ROAD_GRID_SIZE_DEG);
  const result: FastRoadSegment[] = [];
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLon = -1; dLon <= 1; dLon += 1) {
      result.push(...(index.get(`${latCell + dLat},${lonCell + dLon}`) ?? []));
    }
  }
  return result;
}

let fastRoadIndexPromise: Promise<FastRoadIndex> | null = null;

async function fastRoadElements(): Promise<OverpassElement[]> {
  try {
    const payload = JSON.parse(await fs.readFile(FAST_ROAD_CACHE_PATH, "utf8")) as OverpassResponse;
    if (Array.isArray(payload.elements)) {
      return payload.elements;
    }
  } catch {
    // Cache miss; query Overpass below.
  }

  const elements = await queryOverpass(fastRoadQuery());
  await fs.mkdir(path.dirname(FAST_ROAD_CACHE_PATH), { recursive: true });
  await fs.writeFile(FAST_ROAD_CACHE_PATH, JSON.stringify({ elements }), "utf8");
  return elements;
}

async function fastRoadIndex(): Promise<FastRoadIndex> {
  fastRoadIndexPromise ??= fastRoadElements().then(buildFastRoadSegments).then(buildFastRoadIndex);
  return fastRoadIndexPromise;
}

async function fastRoadMatches(geometry: RouteGeometry): Promise<FastRoadMatch[]> {
  const roads = await fastRoadIndex();
  const groups = new Map<string, FastRoadMatch>();
  let routeProgressKm = 0;

  for (const coordinates of geometryLineStrings(geometry)) {
    for (let routeIndex = 1; routeIndex < coordinates.length; routeIndex += 1) {
      const previous = coordinates[routeIndex - 1];
      const current = coordinates[routeIndex];
      if (!previous || !current) {
        continue;
      }
      const start = { lat: previous[1], lon: previous[0] };
      const end = { lat: current[1], lon: current[0] };
      const segmentKm = haversineKm(start, end);
      const midpoint = {
        lat: (start.lat + end.lat) / 2,
        lon: (start.lon + end.lon) / 2,
      };
      const routeHeading = headingDeg(start, end);
      let best: { road: FastRoadSegment; distanceM: number } | null = null;

      for (const road of nearbyFastRoadSegments(roads, midpoint)) {
        const distanceM = pointToSegmentDistanceM(midpoint, road.start, road.end).distanceM;
        if (distanceM > FAST_ROAD_MATCH_DISTANCE_M) {
          continue;
        }
        if (headingDiffDeg(routeHeading, road.heading) > FAST_ROAD_MAX_HEADING_DIFF_DEG) {
          continue;
        }
        if (!best || distanceM < best.distanceM) {
          best = { road, distanceM };
        }
      }

      if (best) {
        const group = groups.get(best.road.id) ?? {
          id: best.road.id,
          label: best.road.label,
          matchedKm: 0,
          firstKm: routeProgressKm,
          lastKm: routeProgressKm,
        };
        group.matchedKm += segmentKm;
        group.firstKm = Math.min(group.firstKm, routeProgressKm);
        group.lastKm = Math.max(group.lastKm, routeProgressKm + segmentKm);
        groups.set(best.road.id, group);
      }

      routeProgressKm += segmentKm;
    }
  }

  return [...groups.values()]
    .filter((match) => match.matchedKm >= FAST_ROAD_MIN_AVOID_KM)
    .sort((a, b) => b.matchedKm - a.matchedKm);
}

function targetedConvenienceStoreQuery(geometry: RouteGeometry, targetKms = restStopTargets(geometryDistanceKm(geometry))): string {
  const aroundRadiusM = Math.ceil(REST_WINDOW_KM * 1000 + POI_RADIUS_M);
  const clauses = targetKms
    .map((targetKm) => {
      const point = routePointAtKm(geometry, targetKm);
      return `  node["shop"="convenience"](around:${aroundRadiusM},${point.lat},${point.lon});
  way["shop"="convenience"](around:${aroundRadiusM},${point.lat},${point.lon});
  node["amenity"="fuel"](around:${aroundRadiusM},${point.lat},${point.lon});
  way["amenity"="fuel"](around:${aroundRadiusM},${point.lat},${point.lon});`;
    })
    .join("\n");

  return `
[out:json][timeout:35];
(
${clauses}
);
out center tags;
`;
}

async function queryOverpass(query: string): Promise<OverpassElement[]> {
  const body = new URLSearchParams({ data: query });
  let lastError: unknown = null;

  for (const url of OVERPASS_URLS.map((value) => value.trim()).filter(Boolean)) {
    const elapsed = Date.now() - lastOverpassRequestAt;
    if (elapsed < OVERPASS_DELAY_MS) {
      await sleep(OVERPASS_DELAY_MS - elapsed);
    }
    lastOverpassRequestAt = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "content-type": "application/x-www-form-urlencoded",
          "User-Agent": "2026-iron-camel-routes/1.0",
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`);
      }
      const payload = (await response.json()) as OverpassResponse;
      return payload.elements ?? [];
    } catch (error) {
      lastError = error;
      try {
        const { stdout } = await execFileAsync(
          "curl",
          [
            "--max-time",
            String(Math.ceil(OVERPASS_TIMEOUT_MS / 1000)),
            "-fsSL",
            "-H",
            "Accept: application/json",
            "-H",
            "User-Agent: 2026-iron-camel-routes/1.0",
            "--data-urlencode",
            `data=${query}`,
            url,
          ],
          {
            maxBuffer: 20 * 1024 * 1024,
          },
        );
        const payload = JSON.parse(stdout) as OverpassResponse;
        return payload.elements ?? [];
      } catch (curlError) {
        lastError = curlError;
        console.warn(`Overpass query failed at ${url}: ${errorMessage(curlError)}`);
      }
    }
  }

  throw new Error(`All Overpass endpoints failed: ${errorMessage(lastError)}`);
}

async function fetchOsmApiElement(store: ConvenienceStore): Promise<OverpassElement | null> {
  const [type, id] = store.id.split("/");
  if (!type || !id) {
    return null;
  }

  const endpoint = `${OSM_API_URL.replace(/\/$/, "")}/${type}/${id}.json`;
  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "2026-iron-camel-routes/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`OSM API request failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as OsmApiResponse;
  return payload.elements?.[0] ?? null;
}

async function fetchOsmApiElements(stores: ConvenienceStore[]): Promise<OverpassElement[]> {
  const elements: OverpassElement[] = [];
  for (const store of stores) {
    try {
      const element = await fetchOsmApiElement(store);
      if (element) {
        elements.push(element);
      }
    } catch (error) {
      console.warn(`Store ${store.id}: OSM API metadata lookup failed: ${errorMessage(error)}`);
    }
    await sleep(OSM_API_DELAY_MS);
  }
  return elements;
}

async function reverseGeocodeAddress(lat: number, lon: number): Promise<string | null> {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_DELAY_MS) {
    await sleep(NOMINATIM_DELAY_MS - elapsed);
  }
  lastNominatimRequestAt = Date.now();

  const url = new URL("/reverse", NOMINATIM_URL.replace(/\/$/, ""));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "zh-TW");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "2026-iron-camel-routes/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim reverse geocode failed: ${response.status} ${response.statusText}`);
  }
  return formatNominatimAddress((await response.json()) as NominatimReverseResponse);
}

function chunkGeometryBounds(geometry: RouteGeometry): [number, number, number, number][] {
  const coordinates = geometryCoordinates(geometry);
  const chunkCount = Math.min(8, Math.max(2, Math.ceil(coordinates.length / 220)));
  const chunkSize = Math.ceil(coordinates.length / chunkCount);
  const chunks: [number, number, number, number][] = [];

  for (let start = 0; start < coordinates.length; start += chunkSize) {
    const chunk = coordinates.slice(start, start + chunkSize);
    if (chunk.length > 1) {
      chunks.push(coordinateBounds(chunk));
    }
  }

  return chunks;
}

async function fetchOverpassElements(geometry: RouteGeometry, targetKms?: number[]): Promise<OverpassElement[]> {
  try {
    return await queryOverpass(targetedConvenienceStoreQuery(geometry, targetKms));
  } catch (error) {
    console.warn(`Targeted Overpass query failed, retrying by route bounds: ${errorMessage(error)}`);
  }

  try {
    return await queryOverpass(convenienceStoreQuery(geometryBounds(geometry)));
  } catch (error) {
    console.warn(`Full-route Overpass query failed, retrying in chunks: ${errorMessage(error)}`);
  }

  const elements = new Map<string, OverpassElement>();
  for (const bounds of chunkGeometryBounds(geometry)) {
    try {
      const chunkElements = await queryOverpass(convenienceStoreQuery(bounds));
      for (const element of chunkElements) {
        elements.set(`${element.type}/${element.id}`, element);
      }
    } catch (error) {
      console.warn(`Chunked Overpass query failed: ${errorMessage(error)}`);
    }
  }

  return [...elements.values()];
}

function normalizeStoreBrand(tags: Record<string, string> | undefined): string | null {
  const value = `${tags?.brand ?? ""} ${tags?.name ?? ""}`.toLowerCase();
  if (value.includes("7-eleven") || value.includes("7 eleven") || value.includes("統一超商")) {
    return "7-ELEVEN";
  }
  if (value.includes("familymart") || value.includes("全家")) {
    return "FamilyMart";
  }
  if (value.includes("hi-life") || value.includes("hilife") || value.includes("萊爾富")) {
    return "Hi-Life";
  }
  if (value.includes("ok mart") || value.includes("ok便利") || value.includes("ok超商")) {
    return "OK Mart";
  }
  return tags?.brand ?? null;
}

function storeName(tags: Record<string, string> | undefined, brand: string | null): string {
  return tags?.name || brand || "便利商店";
}

function storeDisplayName(tags: Record<string, string> | undefined, name: string, brand: string | null): string {
  const baseName = firstTag(tags, ["name", "name:zh", "brand"]) || brand || name;
  const branch = firstTag(tags, ["branch", "branch:zh", "ref"]);
  const parts = uniqueParts([baseName, branch]);
  return parts.join(" ") || name;
}

function isExcludedRestStop(tags: Record<string, string> | undefined, displayName: string): boolean {
  const searchableText = [displayName, tags?.name, tags?.brand, tags?.operator]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return EXCLUDED_STORE_NAME_PATTERNS.some((pattern) => pattern.test(searchableText));
}

function pointToSegmentDistanceM(
  point: CoordinatePoint,
  segmentStart: CoordinatePoint,
  segmentEnd: CoordinatePoint,
): SegmentProjection {
  const meanLat = ((point.lat + segmentStart.lat + segmentEnd.lat) / 3) * (Math.PI / 180);
  const metersPerLat = 111_320;
  const metersPerLon = Math.cos(meanLat) * 111_320;
  const px = point.lon * metersPerLon;
  const py = point.lat * metersPerLat;
  const ax = segmentStart.lon * metersPerLon;
  const ay = segmentStart.lat * metersPerLat;
  const bx = segmentEnd.lon * metersPerLon;
  const by = segmentEnd.lat * metersPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const cross = dx * (py - ay) - dy * (px - ax);
  const sideOfRoute = Math.abs(cross) < 20 ? "on-route" : cross < 0 ? "right" : "left";

  return {
    distanceM: Math.hypot(px - closestX, py - closestY),
    t,
    sideOfRoute,
  };
}

function nearestRouteDistance(
  store: CoordinatePoint,
  geometry: RouteGeometry,
): { distanceM: number; segmentIndex: number; routeProgressKm: number; sideOfRoute: ConvenienceStore["sideOfRoute"] } {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestSegmentIndex = 0;
  let bestRouteProgressKm = 0;
  let bestSideOfRoute: ConvenienceStore["sideOfRoute"] = "on-route";
  let cumulativeKm = 0;

  let segmentIndex = 0;
  for (const coordinates of geometryLineStrings(geometry)) {
    for (let index = 1; index < coordinates.length; index += 1) {
      segmentIndex += 1;
      const previous = coordinates[index - 1];
      const current = coordinates[index];
      if (!previous || !current) {
        continue;
      }
      const segmentStart = { lat: previous[1], lon: previous[0] };
      const segmentEnd = { lat: current[1], lon: current[0] };
      const segmentKm = haversineKm(segmentStart, segmentEnd);
      const projection = pointToSegmentDistanceM(
        store,
        segmentStart,
        segmentEnd,
      );
      if (projection.distanceM < bestDistance) {
        bestDistance = projection.distanceM;
        bestSegmentIndex = segmentIndex;
        bestRouteProgressKm = Math.round((cumulativeKm + segmentKm * projection.t) * 10) / 10;
        bestSideOfRoute = projection.sideOfRoute;
      }
      cumulativeKm += segmentKm;
    }
  }

  return {
    distanceM: bestDistance,
    segmentIndex: bestSegmentIndex,
    routeProgressKm: bestRouteProgressKm,
    sideOfRoute: bestSideOfRoute,
  };
}

export function restStopTargets(generatedDistanceKm: number): number[] {
  const targets = [];
  for (let target = REST_INTERVAL_KM; target <= generatedDistanceKm + Number.EPSILON; target += REST_INTERVAL_KM) {
    targets.push(target);
  }
  return targets;
}

function expectedRestStopCount(generatedDistanceKm: number): number {
  return restStopTargets(generatedDistanceKm).length;
}

function storeScore(store: ConvenienceStore, targetKm: number): number {
  const progressPenalty = Math.abs(store.routeProgressKm - targetKm) * 100;
  const distancePenalty = store.distanceFromRouteM;
  const sidePenalty = store.sideOfRoute === "right" || store.sideOfRoute === "on-route" ? 0 : 300;
  return progressPenalty + distancePenalty + sidePenalty;
}

function selectRestStops(
  stores: StoreWithSegment[],
  generatedDistanceKm: number,
  targetKms = restStopTargets(generatedDistanceKm),
): ConvenienceStore[] {
  const selectedStops: ConvenienceStore[] = [];
  const usedStoreIds = new Set<string>();

  for (const targetKm of targetKms) {
    const availableStores = stores.filter((store) => !usedStoreIds.has(store.id));
    const aroundTarget = availableStores.filter(
      (store) => Math.abs(store.routeProgressKm - targetKm) <= REST_WINDOW_KM,
    );
    const selected = aroundTarget.sort(
      (a, b) => a.sourcePriority - b.sourcePriority || storeScore(a, targetKm) - storeScore(b, targetKm),
    )[0];
    if (!selected) {
      continue;
    }

    usedStoreIds.add(selected.id);
    const { segmentIndex: _segmentIndex, score: _score, sourcePriority: _sourcePriority, ...store } = selected;
    selectedStops.push({
      ...store,
      targetKm,
    });
  }

  return selectedStops;
}

function convenienceStoresNearRoute(
  elements: OverpassElement[],
  geometry: RouteGeometry,
  targetKms?: number[],
): ConvenienceStore[] {
  const stores: StoreWithSegment[] = [];
  const generatedDistanceKm = geometryDistanceKm(geometry);

  for (const element of elements) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") {
      continue;
    }

    const { distanceM, segmentIndex, routeProgressKm, sideOfRoute } = nearestRouteDistance({ lat, lon }, geometry);
    if (distanceM > POI_RADIUS_M) {
      continue;
    }

    const isConvenienceStore = element.tags?.shop === "convenience";
    const isFuelStation = element.tags?.amenity === "fuel";
    if (!isConvenienceStore && !isFuelStation) {
      continue;
    }

    const brand = normalizeStoreBrand(element.tags);
    const name = storeName(element.tags, brand);
    if (isExcludedRestStop(element.tags, name)) {
      continue;
    }

    const address = formatAddress(element.tags, lat, lon);
    const store: ConvenienceStore = {
      id: `${element.type}/${element.id}`,
      name,
      displayName: storeDisplayName(element.tags, name, brand),
      metadataVersion: STORE_METADATA_VERSION,
      brand,
      ...address,
      googleMapsUrl: googleMapsUrl(lat, lon),
      lat,
      lon,
      distanceFromRouteM: Math.round(distanceM),
      targetKm: 0,
      routeProgressKm,
      sideOfRoute,
    };
    stores.push({
      ...store,
      segmentIndex,
      score: 0,
      sourcePriority: isConvenienceStore ? 0 : 10_000,
    });
  }

  const candidates = stores
    .sort((a, b) => a.segmentIndex - b.segmentIndex || a.distanceFromRouteM - b.distanceFromRouteM);
  return selectRestStops(candidates, generatedDistanceKm, targetKms);
}

function cachedConvenienceStores(
  cachedDay: RouteDay | undefined,
  selectedCandidate: string,
  generatedDistanceKm: number,
): ConvenienceStore[] | null {
  if (
    !cachedDay ||
    cachedDay.routeReview?.selectedCandidate !== selectedCandidate ||
    typeof cachedDay.generatedDistanceKm !== "number" ||
    Math.abs(cachedDay.generatedDistanceKm - generatedDistanceKm) > 0.2 ||
    !Array.isArray(cachedDay.convenienceStores)
  ) {
    return null;
  }

  const cachedStores = targetMatchingCachedConvenienceStores(cachedDay, generatedDistanceKm);
  if (!cachedStores) {
    return null;
  }

  return cachedStores.every(hasStoreDisplayFields) ? cachedStores.map(withStoreDisplayFields) : null;
}

function targetMatchingCachedConvenienceStores(
  cachedDay: RouteDay | undefined,
  generatedDistanceKm: number,
): ConvenienceStore[] | null {
  if (!Array.isArray(cachedDay?.convenienceStores)) {
    return null;
  }

  const expectedTargets = restStopTargets(generatedDistanceKm);
  if (cachedDay.convenienceStores.length !== expectedTargets.length) {
    return null;
  }

  const matchesTargets = cachedDay.convenienceStores.every(
    (store, index) => store.targetKm === expectedTargets[index],
  );
  return matchesTargets ? cachedDay.convenienceStores : null;
}

function partiallyMatchingCachedConvenienceStores(
  cachedDay: RouteDay | undefined,
  selectedCandidate: string,
  generatedDistanceKm: number,
): ConvenienceStore[] {
  if (
    !cachedDay ||
    cachedDay.routeReview?.selectedCandidate !== selectedCandidate ||
    typeof cachedDay.generatedDistanceKm !== "number" ||
    Math.abs(cachedDay.generatedDistanceKm - generatedDistanceKm) > 0.2 ||
    !Array.isArray(cachedDay.convenienceStores)
  ) {
    return [];
  }

  const expectedTargets = restStopTargets(generatedDistanceKm);
  const expectedTargetSet = new Set(expectedTargets);
  const storesByTarget = new Map(
    cachedDay.convenienceStores
      .filter((store) => expectedTargetSet.has(store.targetKm) && hasStoreDisplayFields(store))
      .map((store) => [store.targetKm, withStoreDisplayFields(store)]),
  );
  return expectedTargets
    .map((targetKm) => storesByTarget.get(targetKm))
    .filter((store): store is ConvenienceStore => Boolean(store));
}

function fallbackCachedConvenienceStores(
  cachedDay: RouteDay | undefined,
  generatedDistanceKm: number,
): ConvenienceStore[] | null {
  return targetMatchingCachedConvenienceStores(cachedDay, generatedDistanceKm)?.map(withStoreDisplayFields) ?? null;
}

async function enrichCachedConvenienceStores(stores: ConvenienceStore[]): Promise<ConvenienceStore[]> {
  const elements = await fetchOsmApiElements(stores);
  const elementById = new Map(elements.map((element) => [`${element.type}/${element.id}`, element]));
  const enrichedStores: ConvenienceStore[] = [];

  for (const store of stores) {
    const element = elementById.get(store.id);
    const lat = element?.lat ?? element?.center?.lat ?? store.lat;
    const lon = element?.lon ?? element?.center?.lon ?? store.lon;
    const brand = normalizeStoreBrand(element?.tags) ?? store.brand;
    const name = storeName(element?.tags, brand) || store.name;
    let address = formatAddress(element?.tags, lat, lon);
    if (address.addressSource === "coordinate-fallback") {
      try {
        const reverseAddress = await reverseGeocodeAddress(lat, lon);
        if (reverseAddress) {
          address = { address: reverseAddress, addressSource: "reverse-geocode" };
        }
      } catch (error) {
        console.warn(`Store ${store.id}: reverse geocode failed: ${errorMessage(error)}`);
      }
    }

    enrichedStores.push({
      ...store,
      name,
      displayName: storeDisplayName(element?.tags, name, brand),
      metadataVersion: STORE_METADATA_VERSION,
      brand,
      ...address,
      googleMapsUrl: googleMapsUrl(lat, lon),
    });
  }

  return enrichedStores;
}

async function enrichSelectedConvenienceStores(stores: ConvenienceStore[]): Promise<ConvenienceStore[]> {
  const enrichedStores: ConvenienceStore[] = [];

  for (const store of stores) {
    let address = {
      address: store.address,
      addressSource: store.addressSource,
    } satisfies Pick<ConvenienceStore, "address" | "addressSource">;

    if (address.addressSource === "coordinate-fallback") {
      try {
        const reverseAddress = await reverseGeocodeAddress(store.lat, store.lon);
        if (reverseAddress) {
          address = { address: reverseAddress, addressSource: "reverse-geocode" };
        }
      } catch (error) {
        console.warn(`Store ${store.id}: reverse geocode failed: ${errorMessage(error)}`);
      }
    }

    enrichedStores.push({
      ...withStoreDisplayFields(store),
      metadataVersion: STORE_METADATA_VERSION,
      ...address,
    });
  }

  return enrichedStores;
}

async function fetchConvenienceStores(
  day: RouteDay,
  geometry: RouteGeometry,
  cachedDay: RouteDay | undefined,
  selectedCandidate: string,
): Promise<ConvenienceStore[]> {
  if (!FETCH_CONVENIENCE_STORES) {
    return [];
  }

  const generatedDistanceKm = geometryDistanceKm(geometry);
  const expectedCount = expectedRestStopCount(generatedDistanceKm);
  if (!REFETCH_CONVENIENCE_STORES) {
    if (USE_CACHED_CONVENIENCE_STORES) {
      const fallbackCachedStores = fallbackCachedConvenienceStores(cachedDay, generatedDistanceKm);
      if (fallbackCachedStores) {
        console.log(`Day ${day.day}: using cached convenience store rest stops by request`);
        return fallbackCachedStores;
      }
    }
    const cachedStores = cachedConvenienceStores(cachedDay, selectedCandidate, generatedDistanceKm);
    if (cachedStores) {
      console.log(`Day ${day.day}: using cached convenience store rest stops`);
      return cachedStores;
    }

    const metadataOnlyCachedStores = targetMatchingCachedConvenienceStores(cachedDay, generatedDistanceKm);
    if (
      metadataOnlyCachedStores &&
      cachedDay?.routeReview?.selectedCandidate === selectedCandidate &&
      typeof cachedDay.generatedDistanceKm === "number" &&
      Math.abs(cachedDay.generatedDistanceKm - generatedDistanceKm) <= 0.2
    ) {
      try {
        const stores = await enrichCachedConvenienceStores(metadataOnlyCachedStores);
        console.log(`Day ${day.day}: refreshed cached convenience store metadata`);
        return stores;
      } catch (error) {
        console.warn(`Day ${day.day}: convenience store metadata refresh failed: ${errorMessage(error)}`);
        return metadataOnlyCachedStores.map(withStoreDisplayFields);
      }
    }

    const partialCachedStores = partiallyMatchingCachedConvenienceStores(
      cachedDay,
      selectedCandidate,
      generatedDistanceKm,
    );
    const partialCachedTargets = new Set(partialCachedStores.map((store) => store.targetKm));
    const missingTargets = restStopTargets(generatedDistanceKm).filter((targetKm) => !partialCachedTargets.has(targetKm));
    if (partialCachedStores.length > 0 && missingTargets.length > 0) {
      try {
        const elements = await fetchOverpassElements(geometry, missingTargets);
        const fetchedStores = convenienceStoresNearRoute(elements, geometry, missingTargets);
        const stores = [...partialCachedStores, ...fetchedStores].sort((a, b) => a.targetKm - b.targetKm);
        if (stores.length === expectedCount) {
          console.log(
            `Day ${day.day}: reused ${partialCachedStores.length} cached convenience store rest stops and fetched ${fetchedStores.length}`,
          );
          return enrichSelectedConvenienceStores(stores);
        }
        console.warn(`Day ${day.day}: Overpass returned ${stores.length}/${expectedCount} convenience store rest stops`);
      } catch (error) {
        console.warn(`Day ${day.day}: missing convenience store lookup failed: ${errorMessage(error)}`);
      }
    }
  }

  try {
    const elements = await fetchOverpassElements(geometry);
    const stores = convenienceStoresNearRoute(elements, geometry);
    if (stores.length < expectedCount) {
      console.warn(`Day ${day.day}: Overpass returned ${stores.length}/${expectedCount} convenience store rest stops`);
      if (!REFETCH_CONVENIENCE_STORES) {
        const fallbackCachedStores = fallbackCachedConvenienceStores(cachedDay, generatedDistanceKm);
        if (fallbackCachedStores) {
          console.warn(`Day ${day.day}: using cached convenience store rest stops after incomplete Overpass result`);
          return fallbackCachedStores;
        }
      }
    }
    console.log(
      `Day ${day.day}: selected ${stores.length} convenience store rest stops every ${REST_INTERVAL_KM}km`,
    );
    return enrichSelectedConvenienceStores(stores);
  } catch (error) {
    console.warn(`Day ${day.day}: convenience store lookup failed: ${errorMessage(error)}`);
    if (!REFETCH_CONVENIENCE_STORES) {
      const fallbackCachedStores = fallbackCachedConvenienceStores(cachedDay, generatedDistanceKm);
      if (fallbackCachedStores) {
        console.warn(`Day ${day.day}: using cached convenience store rest stops with coordinate fallback`);
        return fallbackCachedStores;
      }
    }
    return [];
  }
}

async function readExistingRoutes(): Promise<Map<number, RouteDay>> {
  try {
    const routes = JSON.parse(await fs.readFile(ROUTES_PATH, "utf8")) as RouteDay[];
    return new Map(routes.map((route) => [route.day, route]));
  } catch {
    return new Map();
  }
}

async function readSourceRoutes(): Promise<RouteDay[]> {
  const source = JSON.parse(await fs.readFile(SOURCE_PATH, "utf8")) as RouteDay[];
  try {
    const scheduleCsv = await fs.readFile(SCHEDULE_PATH, "utf8");
    return mergeRouteSchedule(source, parseRouteScheduleCsv(scheduleCsv));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return source;
    }
    throw error;
  }
}

async function build() {
  const source = await readSourceRoutes();
  const existingRoutes = await readExistingRoutes();
  const requestedDays = parseRequestedDays();
  if (requestedDays) {
    const sourceDays = new Set(source.map((day) => day.day));
    const unknownDays = [...requestedDays].filter((day) => !sourceDays.has(day));
    if (unknownDays.length > 0) {
      throw new Error(`Requested route day(s) not found: ${unknownDays.join(", ")}`);
    }
    console.log(`Building route day(s): ${[...requestedDays].join(", ")}`);
  }
  await fs.mkdir(GPX_DIR, { recursive: true });

  const output = [];
  const warnings = [];

  for (const day of source) {
    if (!shouldBuildRouteDay(day.day, requestedDays)) {
      output.push(existingRouteOutputForSkippedDay(day, existingRoutes));
      continue;
    }

    if (day.type !== "ride") {
      output.push({
        ...day,
        generatedDistanceKm: null,
        distanceDeltaKm: null,
        distanceWarning: null,
        routingStatus: null,
        geojson: null,
        gpxPath: null,
      });
      continue;
    }

    if (!Array.isArray(day.waypoints) || day.waypoints.length < 2) {
      throw new Error(`Day ${day.day} needs at least two waypoints`);
    }

    let geometry: RouteGeometry;
    let routingStatus: RouteDay["routingStatus"] = "routed";
    let routeReview: RouteReview | undefined;
    let convenienceStores: ConvenienceStore[] = [];
    let selectedWaypoints = day.waypoints;
    try {
      if (day.externalRoutePath) {
        geometry = await readExternalRouteGeometry(day.externalRoutePath);
        routeReview = createExternalRouteReview(day, geometry);
      } else {
        const candidates = await buildRouteCandidates(day);
        const selectedCandidate = selectRouteCandidate(day, candidates);
        selectedCandidate.selected = true;
        geometry = selectedCandidate.geometry;
        selectedWaypoints = selectedCandidate.waypoints;
        routeReview = createRouteReview(day, selectedCandidate, candidates);
      }
      convenienceStores = await fetchConvenienceStores(
        day,
        geometry,
        existingRoutes.get(day.day),
        routeReview?.selectedCandidate ?? "fallback-waypoints",
      );
    } catch (error) {
      if (!ALLOW_ROUTE_FALLBACK) {
        throw new Error(`Day ${day.day} routing failed: ${errorMessage(error)}`);
      }
      warnings.push(`Day ${day.day}: routing failed, using waypoint fallback: ${errorMessage(error)}`);
      geometry = fallbackGeometry(day.waypoints);
      routingStatus = "fallback";
      routeReview = {
        selectedCandidate: "fallback-waypoints",
        reviewNote: `路由服務失敗，暫以直線路點輸出：${errorMessage(error)}`,
        candidates: [
          {
            id: "fallback-waypoints",
            label: "直線路點",
            waypointNames: day.waypoints.map((waypoint) => waypoint.name),
            generatedDistanceKm: geometryDistanceKm(geometry),
            distanceDeltaKm: null,
            selected: true,
          },
        ],
      };
      convenienceStores = [];
    }

    const generatedDistanceKm = geometryDistanceKm(geometry);
    const distanceDeltaKm = calculateDistanceDeltaKm(generatedDistanceKm, day.distanceKm);
    const distanceWarning =
      typeof distanceDeltaKm === "number" && Math.abs(distanceDeltaKm) > 25
        ? `產生路線與 PDF 距離相差 ${distanceDeltaKm} km`
        : null;

    if (distanceWarning) {
      warnings.push(`Day ${day.day}: ${distanceWarning}`);
    }

    const gpxPath = `gpx/day-${dayId(day.day)}.gpx`;
    await fs.writeFile(path.join(ROOT, gpxPath), geometryToGpx(day, geometry), "utf8");

    output.push({
      ...day,
      waypoints: selectedWaypoints,
      generatedDistanceKm,
      distanceDeltaKm,
      distanceWarning,
      routeReview,
      convenienceStores,
      routingStatus,
      geojson: geometry,
      gpxPath,
    });
  }

  await fs.writeFile(ROUTES_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  for (const warning of warnings) {
    console.warn(warning);
  }

  console.log(`Wrote ${ROUTES_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  build().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
