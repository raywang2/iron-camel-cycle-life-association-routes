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
  it("parses route metadata from the current routes.csv", () => {
    const schedule = parseRouteScheduleCsv(routesCsv());
    const day0 = schedule.find((route) => route.day === 0)!;
    const day9 = schedule.find((route) => route.day === 9)!;
    const day14 = schedule.find((route) => route.day === 14)!;

    expect(schedule).toHaveLength(15);
    expect(day0.date).toBe("2026-07-04");
    expect(day0.weekday).toBe("六");
    expect(day0.distanceKm).toBeNull();
    expect(day0.endAccommodation).toBe("台體大");
    expect(day9.lunchStop).toBe("6點出發，不休息(達仁7-11南迴前最後補給)\n壽卡前最後補給點\n（不集結休息）");
    expect(day9.lunchDistanceKm).toBe(63.3);
    expect(day9.endAccommodation).toBe("恆春國小");
    expect(day14.lunchStop).toBeNull();
    expect(day14.lunchDistanceKm).toBeNull();
    expect(day14.endAccommodation).toBe("賦歸");
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
    expect(day9.endAccommodation).toBe("恆春國小");
    expect(day14.lunchStop).toBeNull();
    expect(day14.lunchDistanceKm).toBeNull();
    expect(day14.endAccommodation).toBe("賦歸");
  });
});
