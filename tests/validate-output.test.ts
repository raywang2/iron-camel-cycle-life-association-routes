import { describe, expect, it } from "vitest";
import type { GpxFile } from "../scripts/validate-output.js";
import { validateRouteOutput } from "../scripts/validate-output.js";
import type { LineStringGeometry, RouteDay } from "../types/routes.js";

function geometry(pointCount: number): LineStringGeometry {
  return {
    type: "LineString",
    coordinates: Array.from({ length: pointCount }, (_, index) => [120 + index * 0.001, 24 + index * 0.001]),
  };
}

function rideDay(day: number): RouteDay {
  return {
    day,
    date: `2026-07-${String(day).padStart(2, "0")}`,
    weekday: "日",
    type: "ride",
    title: `D${day}`,
    start: "起點",
    end: "終點",
    distanceKm: 10,
    description: "測試路線",
    waypoints: [
      { name: "A", lat: 24, lon: 120 },
      { name: "B", lat: 24.1, lon: 120.1 },
    ],
    generatedDistanceKm: 11,
    distanceDeltaKm: 1,
    distanceWarning: null,
    routingStatus: "routed",
    routeReview: {
      selectedCandidate: "pdf-waypoints",
      reviewNote: null,
      candidates: [
        {
          id: "pdf-waypoints",
          label: "PDF 路點",
          waypointNames: ["A", "B"],
          generatedDistanceKm: 11,
          distanceDeltaKm: 1,
          selected: true,
        },
      ],
    },
    convenienceStores: [
      {
        id: "node/1",
        name: "7-ELEVEN",
        brand: "7-ELEVEN",
        lat: 24,
        lon: 120,
        distanceFromRouteM: 30,
      },
    ],
    geojson: geometry(20),
    gpxPath: `gpx/day-${String(day).padStart(2, "0")}.gpx`,
  };
}

function nonRideDay(day: number, type: "rest" | "lecture"): RouteDay {
  return {
    day,
    date: `2026-07-${String(day).padStart(2, "0")}`,
    weekday: "日",
    type,
    title: type === "rest" ? "休息日" : "行前講習",
    start: "同地",
    end: "同地",
    distanceKm: null,
    description: "非騎乘日",
    waypoints: [],
    generatedDistanceKm: null,
    distanceDeltaKm: null,
    distanceWarning: null,
    routingStatus: null,
    geojson: null,
    gpxPath: null,
  };
}

function validRoutes(): RouteDay[] {
  return [
    nonRideDay(0, "lecture"),
    ...[1, 2, 3, 4, 5].map(rideDay),
    nonRideDay(6, "rest"),
    ...[7, 8, 9].map(rideDay),
    nonRideDay(10, "rest"),
    ...[11, 12, 13, 14].map(rideDay),
  ];
}

function gpxFor(routes: RouteDay[]): GpxFile[] {
  return routes
    .filter((day): day is RouteDay & { gpxPath: string } => day.type === "ride" && typeof day.gpxPath === "string")
    .map((day) => ({
      path: day.gpxPath,
      content: "<gpx><trk><trkseg><trkpt lat=\"24\" lon=\"120\"></trkpt></trkseg></trk></gpx>",
    }));
}

describe("validateRouteOutput", () => {
  it("accepts a complete route set", () => {
    const routes = validRoutes();

    expect(() => validateRouteOutput(routes, gpxFor(routes))).not.toThrow();
  });

  it("rejects fallback routing status", () => {
    const routes = validRoutes();
    routes[1] = { ...routes[1]!, routingStatus: "fallback" };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow("Day 1 must be routed");
  });

  it("rejects missing start fields", () => {
    const routes = validRoutes();
    routes[1] = { ...routes[1]!, start: "" };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow("Day 1 needs a start string");
  });

  it("rejects waypoint-only geometry", () => {
    const routes = validRoutes();
    routes[1] = { ...routes[1]!, geojson: geometry(2) };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow(
      "Day 1 geometry must have more points than waypoints",
    );
  });

  it("rejects extra GPX files for non-riding days", () => {
    const routes = validRoutes();
    const gpxFiles = [...gpxFor(routes), { path: "gpx/day-06.gpx", content: "<gpx></gpx>" }];

    expect(() => validateRouteOutput(routes, gpxFiles)).toThrow("GPX files must exactly match riding days");
  });

  it("rejects ride days without route review output", () => {
    const routes = validRoutes();
    const route = { ...routes[1]! };
    delete route.routeReview;
    routes[1] = route;

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow("Day 1 needs route review output");
  });

  it("rejects ride days without convenience store output", () => {
    const routes = validRoutes();
    const route = { ...routes[1]! };
    delete route.convenienceStores;
    routes[1] = route;

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow("Day 1 needs convenience store output");
  });

  it("rejects ride days without nearby convenience stores", () => {
    const routes = validRoutes();
    routes[1] = { ...routes[1]!, convenienceStores: [] };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow("Day 1 needs at least one convenience store");
  });
});
