import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ConvenienceStore,
  LineStringGeometry,
  RouteCandidateReview,
  RouteDay,
  RouteReview,
  Waypoint,
} from "../types/routes.js";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "data", "route-waypoints.json");
const ROUTES_PATH = path.join(ROOT, "data", "routes.json");
const GPX_DIR = path.join(ROOT, "gpx");
const ROUTER_URL = process.env.ROUTER_URL || "https://router.project-osrm.org";
const ROUTER_PROFILE = process.env.ROUTER_PROFILE || "driving";
const ALLOW_ROUTE_FALLBACK = process.env.ALLOW_ROUTE_FALLBACK === "1";
const OVERPASS_URLS = (
  process.env.OVERPASS_URLS ||
  "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter"
).split(",");
const FETCH_CONVENIENCE_STORES = process.env.FETCH_CONVENIENCE_STORES !== "0";
const POI_RADIUS_M = Number(process.env.POI_RADIUS_M || "1200");
const REST_INTERVAL_KM = Number(process.env.REST_INTERVAL_KM || "10");
const REST_WINDOW_KM = Number(process.env.REST_WINDOW_KM || "6");
const FINISH_EXCLUSION_KM = Number(process.env.FINISH_EXCLUSION_KM || "15");
const MEANINGFUL_ROUTE_SAVING_KM = Number(process.env.MEANINGFUL_ROUTE_SAVING_KM || "8");
const COMPARABLE_DISTANCE_DELTA_KM = Number(process.env.COMPARABLE_DISTANCE_DELTA_KM || "2");
const OVERPASS_DELAY_MS = Number(process.env.OVERPASS_DELAY_MS || "3500");
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS || "45000");
const EXCLUDED_STORE_NAME_PATTERNS = [/shopee/i, /蝦皮/i];
const execFileAsync = promisify(execFile);
let lastOverpassRequestAt = 0;

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
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function geometryDistanceKm(geometry: LineStringGeometry): number {
  const { coordinates } = geometry;
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

function geometryToGpx(day: RouteDay, geometry: LineStringGeometry): string {
  const points = geometry.coordinates
    .map(
      ([lon, lat]) =>
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="2026-routes" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(day.title)}</name>
    <desc>${escapeXml(day.description)}</desc>
  </metadata>
  <trk>
    <name>${escapeXml(`Day ${day.day} ${day.title}`)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
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

async function buildRouteCandidates(day: RouteDay): Promise<BuiltRouteCandidate[]> {
  const candidates: BuiltRouteCandidate[] = [];
  for (const definition of routeCandidateDefinitions(day)) {
    const geometry = await routeWithOsrm(definition.waypoints);
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

function geometryBounds(geometry: LineStringGeometry): [number, number, number, number] {
  return coordinateBounds(geometry.coordinates);
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

function routePointAtKm(geometry: LineStringGeometry, targetKm: number): CoordinatePoint {
  let cumulativeKm = 0;

  for (let index = 1; index < geometry.coordinates.length; index += 1) {
    const previous = geometry.coordinates[index - 1];
    const current = geometry.coordinates[index];
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

  const [lon, lat] = geometry.coordinates.at(-1) ?? geometry.coordinates[0] ?? [0, 0];
  return { lat, lon };
}

function targetedConvenienceStoreQuery(geometry: LineStringGeometry): string {
  const aroundRadiusM = Math.ceil(REST_WINDOW_KM * 1000 + POI_RADIUS_M);
  const clauses = restStopTargets(geometryDistanceKm(geometry))
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
        headers: { "content-type": "application/x-www-form-urlencoded" },
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
          ["--max-time", String(Math.ceil(OVERPASS_TIMEOUT_MS / 1000)), "-fsSL", "--data-urlencode", `data=${query}`, url],
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

function chunkGeometryBounds(geometry: LineStringGeometry): [number, number, number, number][] {
  const coordinates = geometry.coordinates;
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

async function fetchOverpassElements(geometry: LineStringGeometry): Promise<OverpassElement[]> {
  try {
    return await queryOverpass(targetedConvenienceStoreQuery(geometry));
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
  geometry: LineStringGeometry,
): { distanceM: number; segmentIndex: number; routeProgressKm: number; sideOfRoute: ConvenienceStore["sideOfRoute"] } {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestSegmentIndex = 0;
  let bestRouteProgressKm = 0;
  let bestSideOfRoute: ConvenienceStore["sideOfRoute"] = "on-route";
  let cumulativeKm = 0;

  for (let index = 1; index < geometry.coordinates.length; index += 1) {
    const previous = geometry.coordinates[index - 1];
    const current = geometry.coordinates[index];
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
      bestSegmentIndex = index;
      bestRouteProgressKm = Math.round((cumulativeKm + segmentKm * projection.t) * 10) / 10;
      bestSideOfRoute = projection.sideOfRoute;
    }
    cumulativeKm += segmentKm;
  }

  return {
    distanceM: bestDistance,
    segmentIndex: bestSegmentIndex,
    routeProgressKm: bestRouteProgressKm,
    sideOfRoute: bestSideOfRoute,
  };
}

function restStopTargets(generatedDistanceKm: number): number[] {
  const finishExclusionKm = Math.min(FINISH_EXCLUSION_KM, generatedDistanceKm * 0.25);
  const targets = [];
  for (let target = REST_INTERVAL_KM; target <= generatedDistanceKm - finishExclusionKm; target += REST_INTERVAL_KM) {
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

function selectRestStops(stores: StoreWithSegment[], generatedDistanceKm: number): ConvenienceStore[] {
  const finishExclusionKm = Math.min(FINISH_EXCLUSION_KM, generatedDistanceKm * 0.25);
  const notNearFinish = stores.filter((store) => store.routeProgressKm <= generatedDistanceKm - finishExclusionKm);
  const selectedStops: ConvenienceStore[] = [];
  const usedStoreIds = new Set<string>();

  for (const targetKm of restStopTargets(generatedDistanceKm)) {
    const availableStores = notNearFinish.filter((store) => !usedStoreIds.has(store.id));
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

function convenienceStoresNearRoute(elements: OverpassElement[], geometry: LineStringGeometry): ConvenienceStore[] {
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

    const store: ConvenienceStore = {
      id: `${element.type}/${element.id}`,
      name,
      brand,
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
  return selectRestStops(candidates, generatedDistanceKm);
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

  const expectedTargets = restStopTargets(generatedDistanceKm);
  if (cachedDay.convenienceStores.length !== expectedTargets.length) {
    return null;
  }

  const matchesTargets = cachedDay.convenienceStores.every(
    (store, index) => store.targetKm === expectedTargets[index],
  );
  return matchesTargets ? cachedDay.convenienceStores : null;
}

async function fetchConvenienceStores(
  day: RouteDay,
  geometry: LineStringGeometry,
  cachedDay: RouteDay | undefined,
  selectedCandidate: string,
): Promise<ConvenienceStore[]> {
  if (!FETCH_CONVENIENCE_STORES) {
    return [];
  }

  const generatedDistanceKm = geometryDistanceKm(geometry);
  const expectedCount = expectedRestStopCount(generatedDistanceKm);
  const cachedStores = cachedConvenienceStores(cachedDay, selectedCandidate, generatedDistanceKm);
  if (cachedStores) {
    console.log(`Day ${day.day}: using cached convenience store rest stops`);
    return cachedStores;
  }

  try {
    const elements = await fetchOverpassElements(geometry);
    const stores = convenienceStoresNearRoute(elements, geometry);
    if (stores.length < expectedCount) {
      console.warn(`Day ${day.day}: Overpass returned ${stores.length}/${expectedCount} convenience store rest stops`);
    }
    console.log(
      `Day ${day.day}: selected ${stores.length} convenience store rest stops every ${REST_INTERVAL_KM}km`,
    );
    return stores;
  } catch (error) {
    console.warn(`Day ${day.day}: convenience store lookup failed: ${errorMessage(error)}`);
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

async function build() {
  const source = JSON.parse(await fs.readFile(SOURCE_PATH, "utf8")) as RouteDay[];
  const existingRoutes = await readExistingRoutes();
  await fs.mkdir(GPX_DIR, { recursive: true });

  const output = [];
  const warnings = [];

  for (const day of source) {
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

    let geometry;
    let routingStatus = "routed";
    let routeReview: RouteReview | undefined;
    let convenienceStores: ConvenienceStore[] = [];
    let selectedWaypoints = day.waypoints;
    try {
      const candidates = await buildRouteCandidates(day);
      const selectedCandidate = selectRouteCandidate(day, candidates);
      selectedCandidate.selected = true;
      geometry = selectedCandidate.geometry;
      selectedWaypoints = selectedCandidate.waypoints;
      routeReview = createRouteReview(day, selectedCandidate, candidates);
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

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
