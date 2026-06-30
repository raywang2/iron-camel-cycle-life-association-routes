import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { RouteDay } from "../types/routes.js";

function sourceRoutes(): RouteDay[] {
  return JSON.parse(fs.readFileSync("data/route-waypoints.json", "utf8")) as RouteDay[];
}

describe("route waypoint source", () => {
  it("matches the updated CSV route text and lunch-stop fields", () => {
    const routes = sourceRoutes();
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
    expect(day14.lunchStop).toBeNull();
    expect(day14.lunchDistanceKm).toBeNull();
  });
});
