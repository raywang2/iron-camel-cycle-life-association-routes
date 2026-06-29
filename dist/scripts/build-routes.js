import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "data", "route-waypoints.json");
const ROUTES_PATH = path.join(ROOT, "data", "routes.json");
const GPX_DIR = path.join(ROOT, "gpx");
const ROUTER_URL = process.env.ROUTER_URL || "https://router.project-osrm.org";
const ROUTER_PROFILE = process.env.ROUTER_PROFILE || "driving";
const ALLOW_ROUTE_FALLBACK = process.env.ALLOW_ROUTE_FALLBACK === "1";
const execFileAsync = promisify(execFile);
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function dayId(day) {
    return String(day).padStart(2, "0");
}
function haversineKm(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;
    const radiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * radiusKm * Math.asin(Math.sqrt(h));
}
function fallbackGeometry(waypoints) {
    return {
        type: "LineString",
        coordinates: waypoints.map((point) => [point.lon, point.lat]),
    };
}
function geometryDistanceKm(geometry) {
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
function escapeXml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}
function geometryToGpx(day, geometry) {
    const points = geometry.coordinates
        .map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`)
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
async function routeWithOsrm(waypoints) {
    const coordinates = waypoints
        .map((point) => `${point.lon},${point.lat}`)
        .join(";");
    const endpoint = `${ROUTER_URL.replace(/\/$/, "")}/route/v1/${ROUTER_PROFILE}/${coordinates}?overview=full&geometries=geojson&steps=false`;
    let payload;
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Routing request failed: ${response.status} ${response.statusText}`);
        }
        payload = (await response.json());
    }
    catch (error) {
        const { stdout } = await execFileAsync("curl", ["-fsSL", endpoint], {
            maxBuffer: 10 * 1024 * 1024,
        });
        payload = JSON.parse(stdout);
        if (!payload) {
            throw error;
        }
    }
    if (payload.code !== "Ok" || !payload.routes?.[0]?.geometry) {
        throw new Error(`Routing response did not include geometry: ${JSON.stringify(payload).slice(0, 300)}`);
    }
    return payload.routes[0].geometry;
}
async function build() {
    const source = JSON.parse(await fs.readFile(SOURCE_PATH, "utf8"));
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
        try {
            geometry = await routeWithOsrm(day.waypoints);
        }
        catch (error) {
            if (!ALLOW_ROUTE_FALLBACK) {
                throw new Error(`Day ${day.day} routing failed: ${errorMessage(error)}`);
            }
            warnings.push(`Day ${day.day}: routing failed, using waypoint fallback: ${errorMessage(error)}`);
            geometry = fallbackGeometry(day.waypoints);
            routingStatus = "fallback";
        }
        const generatedDistanceKm = geometryDistanceKm(geometry);
        const distanceDeltaKm = typeof day.distanceKm === "number"
            ? Math.round((generatedDistanceKm - day.distanceKm) * 10) / 10
            : null;
        const distanceWarning = typeof distanceDeltaKm === "number" && Math.abs(distanceDeltaKm) > 25
            ? `產生路線與 PDF 距離相差 ${distanceDeltaKm} km`
            : null;
        if (distanceWarning) {
            warnings.push(`Day ${day.day}: ${distanceWarning}`);
        }
        const gpxPath = `gpx/day-${dayId(day.day)}.gpx`;
        await fs.writeFile(path.join(ROOT, gpxPath), geometryToGpx(day, geometry), "utf8");
        output.push({
            ...day,
            generatedDistanceKm,
            distanceDeltaKm,
            distanceWarning,
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
