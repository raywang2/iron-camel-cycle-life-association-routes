import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeRouteSchedule, parseRouteScheduleCsv } from "../scripts/route-schedule.js";
import type { RouteDay } from "../types/routes.js";

function sourceRoutes(): RouteDay[] {
  return JSON.parse(fs.readFileSync("data/route-waypoints.json", "utf8")) as RouteDay[];
}

function routesCsv(): string {
  return fs.readFileSync("routes.csv", "utf8");
}

function externalRouteEndpointCoordinates(route: RouteDay): { start: [number, number]; finish: [number, number] } {
  const kml = fs.readFileSync(route.externalRoutePath!, "utf8");
  const lineStrings = [...kml.matchAll(/<LineString\b[^>]*>([\s\S]*?)<\/LineString>/g)]
    .map((match) => {
      const coordinatesText = match[1]?.match(/<coordinates>([\s\S]*?)<\/coordinates>/)?.[1] ?? "";
      return coordinatesText
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((coordinate) => {
          const [lon, lat] = coordinate.split(",").map(Number);
          return [lon, lat] as [number, number];
        });
    })
    .filter((coordinates) => coordinates.length >= 2);
  const start = lineStrings[0]?.[0];
  const finish = lineStrings.at(-1)?.at(-1);

  if (!start || !finish) {
    throw new Error(`Missing KML route endpoints for day ${route.day}`);
  }

  return { start, finish };
}

function expectWaypointNearCoordinate(
  waypoint: NonNullable<RouteDay["waypoints"][number]>,
  [lon, lat]: [number, number],
): void {
  const latDeltaKm = (waypoint.lat - lat) * 111.32;
  const lonDeltaKm = (waypoint.lon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180);
  const distanceKm = Math.hypot(latDeltaKm, lonDeltaKm);

  expect(distanceKm).toBeLessThanOrEqual(0.3);
}

describe("route waypoint source", () => {
  it("keeps end accommodation in route-waypoints source data", () => {
    const routes = sourceRoutes();
    const schedule = parseRouteScheduleCsv(routesCsv());
    const scheduleByDay = new Map(schedule.map((route) => [route.day, route]));

    for (const route of routes) {
      expect(route.endAccommodation).toBe(scheduleByDay.get(route.day)?.endAccommodation);
    }
  });

  it("uses the accommodation as the daily endpoint in route-waypoints source data", () => {
    const routes = sourceRoutes();
    const routesWithAccommodation = routes.filter((route) => route.endAccommodation);

    expect(routesWithAccommodation).toHaveLength(15);
    for (const route of routesWithAccommodation) {
      expect(route.end).toBe(route.endAccommodation);
    }
  });

  it("routes ride-day map waypoints to the accommodation endpoint", () => {
    const routes = sourceRoutes().filter((route) => route.type === "ride");

    expect(routes).toHaveLength(12);
    for (const route of routes) {
      expect(route.waypoints.at(-1)?.name).toBe(route.endAccommodation);
    }
  });

  it("keeps the day 0 briefing venue as a map waypoint", () => {
    const day0 = sourceRoutes().find((route) => route.day === 0)!;

    expect(day0.type).toBe("lecture");
    expect(day0.waypoints).toEqual([
      {
        name: "臺體體育場",
        lat: 24.15239,
        lon: 120.6898,
      },
    ]);
  });

  it("uses accommodation endpoints in ride-day title and route text", () => {
    const routes = sourceRoutes().filter((route) => route.type === "ride");

    for (const route of routes) {
      expect(route.title.endsWith(route.endAccommodation ?? "")).toBe(true);
      expect(route.description.split("→").at(-1)?.trim()).toBe(route.endAccommodation);
    }
  });

  it("parses route metadata from the current routes.csv", () => {
    const schedule = parseRouteScheduleCsv(routesCsv());
    const day0 = schedule.find((route) => route.day === 0)!;
    const day1 = schedule.find((route) => route.day === 1)!;
    const day9 = schedule.find((route) => route.day === 9)!;
    const day14 = schedule.find((route) => route.day === 14)!;

    expect(schedule).toHaveLength(15);
    expect(day0.date).toBe("2026-07-04");
    expect(day0.weekday).toBe("六");
    expect(day0.distanceKm).toBeNull();
    expect(day0.endAccommodation).toBe("台體大國立臺灣體育運動大學");
    expect(day1.endAccommodation).toBe("苗栗高中");
    expect(day9.lunchStop).toBe("6點出發，不休息(達仁7-11南迴前最後補給)\n壽卡前最後補給點\n（不集結休息）");
    expect(day9.lunchDistanceKm).toBe(63.3);
    expect(day9.endAccommodation).toBe("恆春國小");
    expect(day14.lunchStop).toBeNull();
    expect(day14.lunchDistanceKm).toBeNull();
    expect(day14.endAccommodation).toBe("國立臺灣體育運動大學");
  });

  it("merges the updated CSV route text, lunch-stop fields, and lodging into route source", () => {
    const routes = mergeRouteSchedule(sourceRoutes(), parseRouteScheduleCsv(routesCsv()));
    const day0 = routes.find((route) => route.day === 0)!;
    const day1 = routes.find((route) => route.day === 1)!;
    const day3 = routes.find((route) => route.day === 3)!;
    const day9 = routes.find((route) => route.day === 9)!;
    const day14 = routes.find((route) => route.day === 14)!;

    expect(day0.description).toBe("報到！行前安全講習(物資發放)");
    expect(day1.lunchStop).toBe("三義");
    expect(day1.lunchDistanceKm).toBe(34.9);
    expect(day3.description).toContain("A4大鶯綠野景觀自行車道");
    expect(day9.description).toContain("大武→達仁→南迴公路");
    expect(day9.lunchStop).toContain("達仁7-11南迴前最後補給");
    expect(day9.lunchDistanceKm).toBe(63.3);
    expect(day9.end).toBe("恆春國小");
    expect(day9.endAccommodation).toBe("恆春國小");
    expect(day14.lunchStop).toBeNull();
    expect(day14.lunchDistanceKm).toBeNull();
    expect(day14.end).toBe("國立臺灣體育運動大學");
    expect(day14.endAccommodation).toBe("國立臺灣體育運動大學");
  });

  it("uses the external day 1 KML route with only start and finish markers", () => {
    const day1 = sourceRoutes().find((route) => route.day === 1)!;
    const waypointNames = day1.waypoints.map((waypoint) => waypoint.name);

    expect(day1.externalRoutePath).toBe("data/external-routes/day-01.kml");
    expect(waypointNames).toEqual(["國立臺灣體育運動大學", "苗栗高中"]);
  });

  it("uses external KML routes with only start and finish markers for manually confirmed days", () => {
    const routes = sourceRoutes();
    const externalRouteDays = [2, 3, 4, 5, 7, 8, 9, 11, 12, 13];

    for (const day of externalRouteDays) {
      const route = routes.find((candidate) => candidate.day === day)!;

      expect(route.externalRoutePath).toBe(`data/external-routes/day-${String(day).padStart(2, "0")}.kml`);
      expect(route.waypoints).toHaveLength(2);
      expect(route.waypoints[0]?.name).toBeTruthy();
      expect(route.waypoints.at(-1)?.name).toBe(route.endAccommodation);
    }
  });

  it("keeps external KML start markers on the route starts except day 5 transfer route", () => {
    const routes = sourceRoutes();
    const externalRouteDays = [1, 2, 3, 4, 7, 8, 9, 11, 12, 13];

    for (const day of externalRouteDays) {
      const route = routes.find((candidate) => candidate.day === day)!;
      const endpoints = externalRouteEndpointCoordinates(route);

      expectWaypointNearCoordinate(route.waypoints[0]!, endpoints.start);
    }
  });
});
