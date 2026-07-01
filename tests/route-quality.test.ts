import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { RouteDay } from "../types/routes.js";

function routes(): RouteDay[] {
  return JSON.parse(fs.readFileSync("data/routes.json", "utf8")) as RouteDay[];
}

describe("generated route quality", () => {
  it("uses the shorter non-looping candidate for day 2", () => {
    const day2 = routes().find((route) => route.day === 2);

    expect(day2?.routeReview?.selectedCandidate).toBe("reduced-waypoints");
    expect(day2?.generatedDistanceKm).toBeLessThan(60);
  });

  it("keeps a convenience stop after 70km for day 3", () => {
    const day3 = routes().find((route) => route.day === 3);

    expect(day3?.convenienceStores?.map((store) => store.targetKm)).toContain(80);
  });
});
