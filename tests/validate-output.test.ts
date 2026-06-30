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
    distanceKm: 40,
    description: "測試路線",
    waypoints: [
      { name: "A", lat: 24, lon: 120 },
      { name: "B", lat: 24.1, lon: 120.1 },
    ],
    generatedDistanceKm: 42,
    distanceDeltaKm: 2,
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
          generatedDistanceKm: 42,
          distanceDeltaKm: 2,
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
        targetKm: 10,
        routeProgressKm: 10,
        sideOfRoute: "right",
      },
      {
        id: "node/2",
        name: "FamilyMart",
        brand: "FamilyMart",
        lat: 24,
        lon: 120,
        distanceFromRouteM: 30,
        targetKm: 20,
        routeProgressKm: 20,
        sideOfRoute: "right",
      },
      {
        id: "node/3",
        name: "Hi-Life",
        brand: "Hi-Life",
        lat: 24,
        lon: 120,
        distanceFromRouteM: 30,
        targetKm: 30,
        routeProgressKm: 30,
        sideOfRoute: "right",
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

  it("accepts long ride days with rest stops every 10km before the finish", () => {
    const routes = validRoutes();
    routes[1] = {
      ...routes[1]!,
      generatedDistanceKm: 65,
      convenienceStores: [
        {
          id: "node/1",
          name: "7-ELEVEN",
          brand: "7-ELEVEN",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 30,
          targetKm: 10,
          routeProgressKm: 10,
          sideOfRoute: "right",
        },
        {
          id: "node/2",
          name: "FamilyMart",
          brand: "FamilyMart",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 40,
          targetKm: 20,
          routeProgressKm: 21,
          sideOfRoute: "right",
        },
        {
          id: "node/3",
          name: "Hi-Life",
          brand: "Hi-Life",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 40,
          targetKm: 30,
          routeProgressKm: 30,
          sideOfRoute: "right",
        },
        {
          id: "node/4",
          name: "OK Mart",
          brand: "OK Mart",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 40,
          targetKm: 40,
          routeProgressKm: 41,
          sideOfRoute: "right",
        },
        {
          id: "node/5",
          name: "7-ELEVEN",
          brand: "7-ELEVEN",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 40,
          targetKm: 50,
          routeProgressKm: 50,
          sideOfRoute: "right",
        },
      ],
    };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).not.toThrow();
  });

  it("rejects ride days without the expected 10km rest-stop count", () => {
    const routes = validRoutes();
    routes[1] = {
      ...routes[1]!,
      generatedDistanceKm: 65,
      convenienceStores: [
        {
          id: "node/1",
          name: "7-ELEVEN",
          brand: "7-ELEVEN",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 30,
          targetKm: 10,
          routeProgressKm: 10,
          sideOfRoute: "right",
        },
        {
          id: "node/2",
          name: "FamilyMart",
          brand: "FamilyMart",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 40,
          targetKm: 20,
          routeProgressKm: 20,
          sideOfRoute: "right",
        },
        {
          id: "node/3",
          name: "Hi-Life",
          brand: "Hi-Life",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 40,
          targetKm: 30,
          routeProgressKm: 30,
          sideOfRoute: "right",
        },
      ],
    };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow(
      "Day 1 needs 5 convenience store rest stops",
    );
  });

  it("rejects convenience stores outside their 10km rest window", () => {
    const routes = validRoutes();
    routes[1] = {
      ...routes[1]!,
      generatedDistanceKm: 22,
      convenienceStores: [
        {
          id: "node/1",
          name: "7-ELEVEN",
          brand: "7-ELEVEN",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 30,
          targetKm: 10,
          routeProgressKm: 17,
          sideOfRoute: "right",
        },
      ],
    };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow(
      "Day 1 convenience store should be around 10km from start",
    );
  });

  it("rejects pickup-only shops misclassified as convenience stores", () => {
    const routes = validRoutes();
    routes[1] = {
      ...routes[1]!,
      convenienceStores: [
        {
          id: "node/1",
          name: "蝦皮店到店",
          brand: null,
          lat: 24,
          lon: 120,
          distanceFromRouteM: 30,
          targetKm: 10,
          routeProgressKm: 10,
          sideOfRoute: "right",
        },
        {
          id: "node/2",
          name: "7-ELEVEN",
          brand: "7-ELEVEN",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 30,
          targetKm: 20,
          routeProgressKm: 20,
          sideOfRoute: "right",
        },
        {
          id: "node/3",
          name: "FamilyMart",
          brand: "FamilyMart",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 30,
          targetKm: 30,
          routeProgressKm: 30,
          sideOfRoute: "right",
        },
      ],
    };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow(
      "Day 1 convenience store must be a rest-stop convenience store",
    );
  });

  it("rejects convenience stores whose target would be near the finish", () => {
    const routes = validRoutes();
    routes[1] = {
      ...routes[1]!,
      generatedDistanceKm: 42,
      convenienceStores: [
        {
          id: "node/1",
          name: "7-ELEVEN",
          brand: "7-ELEVEN",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 30,
          targetKm: 10,
          routeProgressKm: 10,
          sideOfRoute: "right",
        },
        {
          id: "node/2",
          name: "FamilyMart",
          brand: "FamilyMart",
          lat: 24,
          lon: 120,
          distanceFromRouteM: 40,
          targetKm: 20,
          routeProgressKm: 20,
          sideOfRoute: "right",
        },
      ],
    };

    expect(() => validateRouteOutput(routes, gpxFor(routes))).toThrow(
      "Day 1 needs 3 convenience store rest stops",
    );
  });
});
