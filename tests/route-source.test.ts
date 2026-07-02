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

  it("keeps road-level shaping waypoints for day 1 PDF route text", () => {
    const day1 = sourceRoutes().find((route) => route.day === 1)!;
    const waypointNames = day1.waypoints.map((waypoint) => waypoint.name);

    expect(waypointNames).toEqual(expect.arrayContaining([
      "崇德路一段",
      "崇德路二段",
      "崇德路三段",
      "崇德路四段",
      "崇德路五段",
      "豐原大道",
      "豐科路",
      "后科路",
      "台13三義段",
      "山線鐵路自行車道",
      "苗28",
      "貓貍山公園",
      "公園路",
    ]));
  });

  it("keeps day 2 on land and follows the 17km coast into Nanliao", () => {
    const day2 = sourceRoutes().find((route) => route.day === 2)!;
    const waypointNames = day2.waypoints.map((waypoint) => waypoint.name);
    const coastalWaypoint = day2.waypoints.find((waypoint) => waypoint.name === "苗栗濱海自行車道")!;

    expect(coastalWaypoint.lon).toBeGreaterThan(120.85);
    expect(waypointNames).toEqual(expect.arrayContaining([
      "苗栗濱海自行車道",
      "海山漁港",
      "香山濕地",
      "港南濱海風景區",
      "南寮漁港",
    ]));
  });
});
