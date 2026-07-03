import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { RouteDay, RouteGeometry } from "../types/routes.js";

function routes(): RouteDay[] {
  return JSON.parse(fs.readFileSync("data/routes.json", "utf8")) as RouteDay[];
}

function kmlLineStrings(path: string): Array<Array<[number, number]>> {
  const kml = fs.readFileSync(path, "utf8");
  return [...kml.matchAll(/<LineString\b[^>]*>([\s\S]*?)<\/LineString>/g)]
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
}

function routeGeometryLineStrings(geometry: RouteGeometry | null | undefined): Array<Array<[number, number]>> {
  if (!geometry) {
    return [];
  }
  return geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
}

describe("generated route quality", () => {
  it("uses the external KML route for day 2", () => {
    const day2 = routes().find((route) => route.day === 2);

    expect(day2?.routeReview?.selectedCandidate).toBe("external-kml");
    expect(day2?.generatedDistanceKm).toBe(51.2);
    expect(day2?.routeReview?.candidates.find((candidate) => candidate.selected)?.waypointNames).toEqual(
      ["苗栗高中", "培英國中"],
    );
  });

  it("keeps every 10km convenience stop target for KML-generated days", () => {
    const day3 = routes().find((route) => route.day === 3);

    expect(day3?.convenienceStores?.map((store) => store.targetKm)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  });

  it("keeps the first D8 KML segment in the generated route", () => {
    const day8 = routes().find((route) => route.day === 8);

    expect(day8?.routeReview?.selectedCandidate).toBe("external-kml");
    expect(routeGeometryLineStrings(day8?.geojson)[0]?.[0]).toEqual([121.31836, 23.34648]);
  });

  it("uses every LineString segment from multi-part external KML routes", () => {
    const externalRoutes = routes().filter((route) => route.externalRoutePath);

    for (const route of externalRoutes) {
      const lineStrings = kmlLineStrings(route.externalRoutePath!);
      if (lineStrings.length <= 1) {
        continue;
      }

      const actualLineStrings = routeGeometryLineStrings(route.geojson);

      expect(route.geojson?.type).toBe("MultiLineString");
      expect(actualLineStrings).toEqual(lineStrings);
    }
  });
});
