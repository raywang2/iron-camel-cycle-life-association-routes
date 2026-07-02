import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { RouteDay } from "../types/routes.js";

function routes(): RouteDay[] {
  return JSON.parse(fs.readFileSync("data/routes.json", "utf8")) as RouteDay[];
}

describe("generated route quality", () => {
  it("keeps day 2 on the full coastal waypoint route", () => {
    const day2 = routes().find((route) => route.day === 2);

    expect(day2?.routeReview?.selectedCandidate).toBe("pdf-waypoints");
    expect(day2?.generatedDistanceKm).toBeLessThan(60);
    expect(day2?.routeReview?.candidates.find((candidate) => candidate.selected)?.waypointNames).toEqual(
      expect.arrayContaining(["苗栗濱海自行車道", "海山漁港", "香山濕地", "港南濱海風景區", "南寮漁港"]),
    );
  });

  it("keeps a convenience stop after 70km for day 3", () => {
    const day3 = routes().find((route) => route.day === 3);

    expect(day3?.convenienceStores?.map((store) => store.targetKm)).toContain(80);
  });
});
