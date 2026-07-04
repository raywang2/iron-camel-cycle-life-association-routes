import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  DEFAULT_BICYCLE_USE_ROADS,
  DEFAULT_BROUTER_PROFILE,
  DEFAULT_REST_WINDOW_KM,
  DEFAULT_ROUTER_ENGINE,
  DEFAULT_ROUTER_PROFILE,
  brouterFastRoadLabels,
  existingRouteOutputForSkippedDay,
  geometryToGpx,
  parseKmlLineStringGeometry,
  parseRequestedDays,
  restStopTargets,
  shouldBuildRouteDay,
} from "../scripts/build-routes.js";
import type { RouteDay } from "../types/routes.js";

function routeDay(day: number, title: string): RouteDay {
  return {
    day,
    date: "2026-07-01",
    weekday: "三",
    type: "ride",
    title,
    start: "起點",
    end: "終點",
    distanceKm: 10,
    description: title,
    waypoints: [
      { name: "起點", lat: 24, lon: 120 },
      { name: "終點", lat: 24.1, lon: 120.1 },
    ],
  };
}

describe("build route options", () => {
  it("defaults generated routes to Valhalla bicycle routing", () => {
    expect(DEFAULT_ROUTER_ENGINE).toBe("valhalla");
    expect(DEFAULT_ROUTER_PROFILE).toBe("bicycle");
    expect(DEFAULT_BICYCLE_USE_ROADS).toBe(0);
  });

  it("allows wider progress windows so every 10km target can receive a rest stop", () => {
    expect(DEFAULT_REST_WINDOW_KM).toBe(15);
  });

  it("supports BRouter trekking as an alternate bicycle routing engine", () => {
    const buildScript = fs.readFileSync("scripts/build-routes.ts", "utf8");

    expect(DEFAULT_BROUTER_PROFILE).toBe("trekking");
    expect(buildScript).toContain('ROUTER_ENGINE === "brouter"');
  });

  it("detects fast-road way tags in BRouter responses", () => {
    expect(
      brouterFastRoadLabels({
        features: [
          {
            properties: {
              messages: [
                ["Longitude", "Latitude", "WayTags", "NodeTags"],
                ["120", "24", "highway=cycleway bicycle=designated", ""],
                ["120", "24", "highway=trunk motorroad=yes", ""],
              ],
            },
          },
        ],
      }),
    ).toEqual(["highway=trunk motorroad=yes"]);
  });

  it("parses a single LineString from exported KML routes", () => {
    const geometry = parseKmlLineStringGeometry(`
      <kml>
        <Document>
          <Placemark>
            <name>Short point</name>
            <Point><coordinates>120.1,24.1,0</coordinates></Point>
          </Placemark>
          <Placemark>
            <name>Route</name>
            <LineString>
              <coordinates>
                120.0,24.0,0
                120.1,24.1,0
                120.2,24.2,0
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `);

    expect(geometry).toEqual({
      type: "LineString",
      coordinates: [
        [120.0, 24.0],
        [120.1, 24.1],
        [120.2, 24.2],
      ],
    });
  });

  it("parses multiple LineStrings from exported KML routes as MultiLineString", () => {
    const geometry = parseKmlLineStringGeometry(`
      <kml>
        <Document>
          <Placemark>
            <name>Route part 1</name>
            <LineString>
              <coordinates>
                120.0,24.0,0
                120.1,24.1,0
              </coordinates>
            </LineString>
          </Placemark>
          <Placemark>
            <name>Route part 2</name>
            <LineString>
              <coordinates>
                120.1,24.1,0
                120.2,24.2,0
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `);

    expect(geometry).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [120.0, 24.0],
          [120.1, 24.1],
        ],
        [
          [120.1, 24.1],
          [120.2, 24.2],
        ],
      ],
    });
  });

  it("keeps distant disconnected KML LineStrings in document order", () => {
    const geometry = parseKmlLineStringGeometry(`
      <kml>
        <Document>
          <Placemark>
            <name>Station transfer</name>
            <LineString>
              <coordinates>
                121.7,24.6,0
                121.7,24.7,0
              </coordinates>
            </LineString>
          </Placemark>
          <Placemark>
            <name>Ride route</name>
            <LineString>
              <coordinates>
                121.0,24.0,0
                121.1,24.1,0
                121.2,24.2,0
              </coordinates>
            </LineString>
          </Placemark>
        </Document>
      </kml>
    `);

    expect(geometry).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [121.7, 24.6],
          [121.7, 24.7],
        ],
        [
          [121.0, 24.0],
          [121.1, 24.1],
          [121.2, 24.2],
        ],
      ],
    });
  });

  it("writes each MultiLineString segment as its own GPX track for import compatibility", () => {
    const gpx = geometryToGpx(routeDay(2, "多段路線"), {
      type: "MultiLineString",
      coordinates: [
        [
          [120.0, 24.0],
          [120.1, 24.1],
        ],
        [
          [121.0, 25.0],
          [121.1, 25.1],
        ],
      ],
    });

    expect(gpx.match(/<trk>/g)?.length).toBe(2);
    expect(gpx.match(/<trkseg>/g)?.length).toBe(2);
    expect(gpx).toContain("<name>Day 2 多段路線 - 1/2</name>");
    expect(gpx).toContain("<name>Day 2 多段路線 - 2/2</name>");
  });

  it("sends an explicit user agent to Overpass for POI lookups", () => {
    const buildScript = fs.readFileSync("scripts/build-routes.ts", "utf8");

    expect(buildScript).toContain('"User-Agent": "2026-iron-camel-routes/1.0"');
    expect(buildScript).toContain('"Accept": "application/json"');
  });

  it("supports forcing convenience-store lookup refresh", () => {
    const buildScript = fs.readFileSync("scripts/build-routes.ts", "utf8");

    expect(buildScript).toContain("REFETCH_CONVENIENCE_STORES");
    expect(buildScript).toContain("if (!REFETCH_CONVENIENCE_STORES)");
  });

  it("marks every 10km rest-stop target through the route distance", () => {
    expect(restStopTargets(56.1)).toEqual([10, 20, 30, 40, 50]);
    expect(restStopTargets(60)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("parses requested route days from CLI arguments", () => {
    expect(parseRequestedDays(["--day", "3"], {})).toEqual(new Set([3]));
    expect(parseRequestedDays(["--days=3,7"], {})).toEqual(new Set([3, 7]));
    expect(parseRequestedDays(["4"], {})).toEqual(new Set([4]));
  });

  it("parses requested route days from environment when CLI arguments are omitted", () => {
    expect(parseRequestedDays([], { BUILD_ROUTE_DAYS: "2,4" })).toEqual(new Set([2, 4]));
    expect(parseRequestedDays([], {})).toBeNull();
  });

  it("uses the requested day set to decide which days to rebuild", () => {
    const requestedDays = new Set([3]);

    expect(shouldBuildRouteDay(3, requestedDays)).toBe(true);
    expect(shouldBuildRouteDay(4, requestedDays)).toBe(false);
    expect(shouldBuildRouteDay(4, null)).toBe(true);
  });

  it("preserves existing generated output for skipped days", () => {
    const sourceDay = routeDay(1, "source");
    const existingDay = {
      ...routeDay(1, "existing"),
      generatedDistanceKm: 12.3,
      gpxPath: "gpx/day-01.gpx",
    };

    expect(existingRouteOutputForSkippedDay(sourceDay, new Map([[1, existingDay]]))).toBe(existingDay);
    expect(() => existingRouteOutputForSkippedDay(sourceDay, new Map())).toThrow(
      "Cannot skip Day 1 without existing generated route output",
    );
  });
});
