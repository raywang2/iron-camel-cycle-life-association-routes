import fs from "node:fs/promises";
import type { RouteDay } from "../types/routes.js";

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export interface GpxFile {
  path: string;
  content: string;
}

export function validateRouteOutput(routes: RouteDay[], gpxFiles: GpxFile[]): void {
  const actualGpxPaths: Set<string> = new Set(gpxFiles.map((file) => file.path));
  const gpxContentByPath = new Map(gpxFiles.map((file) => [file.path, file.content]));

  assert(routes.length === 15, `Expected 15 day entries, got ${routes.length}`);

  let rideCount = 0;
  const seenGpxPaths: Set<string> = new Set();
  const expectedGpxPaths: Set<string> = new Set();
  for (const day of routes) {
    assert(typeof day.day === "number", "Each day must have a numeric day");
    assert(typeof day.date === "string" && day.date.length > 0, `Day ${day.day} needs a date string`);
    assert(typeof day.start === "string" && day.start.length > 0, `Day ${day.day} needs a start string`);
    assert(typeof day.end === "string" && day.end.length > 0, `Day ${day.day} needs an end string`);
    assert(
      ["ride", "rest", "lecture"].includes(day.type),
      `Invalid type for day ${day.day}`,
    );
    assert(
      day.description && typeof day.description === "string",
      `Day ${day.day} needs description`,
    );

    if (day.type === "ride") {
      rideCount += 1;
      const expectedGpxPath = `gpx/day-${String(day.day).padStart(2, "0")}.gpx`;
      expectedGpxPaths.add(expectedGpxPath);
      assert(typeof day.distanceKm === "number" && day.distanceKm > 0, `Day ${day.day} needs a positive PDF distance`);
      assert(
        typeof day.generatedDistanceKm === "number" && day.generatedDistanceKm > 0,
        `Day ${day.day} needs a positive generated distance`,
      );
      assert(
        typeof day.distanceDeltaKm === "number",
        `Day ${day.day} needs a numeric distance delta`,
      );
      assert(day.routingStatus === "routed", `Day ${day.day} must be routed`);
      assert(day.gpxPath === expectedGpxPath, `Day ${day.day} must use ${expectedGpxPath}`);
      assert(!seenGpxPaths.has(day.gpxPath), `Duplicate GPX path for day ${day.day}`);
      seenGpxPaths.add(day.gpxPath);
      assert(day.geojson?.type === "LineString", `Day ${day.day} needs LineString geometry`);
      assert(Array.isArray(day.waypoints), `Day ${day.day} waypoints must be an array`);
      assert(Array.isArray(day.geojson.coordinates), `Day ${day.day} geometry coordinates must be an array`);
      assert(
        day.geojson.coordinates.length > day.waypoints.length,
        `Day ${day.day} geometry must have more points than waypoints`,
      );
      assert(
        day.geojson.coordinates.length >= 20,
        `Day ${day.day} geometry must contain at least 20 points`,
      );
      const gpx = gpxContentByPath.get(day.gpxPath);
      assert(typeof gpx === "string", `${day.gpxPath} is missing`);
      assert(gpx.includes("<gpx"), `${day.gpxPath} missing gpx element`);
      assert(gpx.includes("<trk>"), `${day.gpxPath} missing track`);
      assert(gpx.includes("<trkseg>"), `${day.gpxPath} missing track segment`);
      assert(gpx.includes("<trkpt "), `${day.gpxPath} missing track points`);
    } else {
      assert(day.distanceKm === null, `Day ${day.day} should not have a PDF distance`);
      assert(day.routingStatus === null, `Day ${day.day} should not have routing status`);
      assert(day.gpxPath === null, `Day ${day.day} should not have GPX`);
      assert(day.geojson === null, `Day ${day.day} should not have geometry`);
    }
  }

  assert(rideCount === 12, `Expected 12 riding days, got ${rideCount}`);
  assert(
    actualGpxPaths.size === expectedGpxPaths.size &&
      [...actualGpxPaths].every((path) => expectedGpxPaths.has(path)) &&
      [...expectedGpxPaths].every((path) => actualGpxPaths.has(path)),
    `GPX files must exactly match riding days`,
  );
}

async function readGpxFiles(): Promise<GpxFile[]> {
  const gpxFiles = await fs.readdir("gpx", { withFileTypes: true });
  return Promise.all(
    gpxFiles
      .filter((entry) => entry.isFile() && entry.name.endsWith(".gpx"))
      .map(async (entry) => {
        const path = `gpx/${entry.name}`;
        return {
          path,
          content: await fs.readFile(path, "utf8"),
        };
      }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const routes = JSON.parse(await fs.readFile("data/routes.json", "utf8")) as RouteDay[];
  validateRouteOutput(routes, await readGpxFiles());
  console.log("Validation passed");
}
