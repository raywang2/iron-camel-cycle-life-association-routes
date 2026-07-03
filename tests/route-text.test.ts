import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { localizedRouteText, localizedWeekday, routeTextTranslations } from "../src/routeText.js";
import type { RouteDay } from "../types/routes.js";

function routes(): RouteDay[] {
  return JSON.parse(fs.readFileSync("data/routes.json", "utf8")) as RouteDay[];
}

function routeTextValues(): string[] {
  const values = new Set<string>();
  for (const route of routes()) {
    values.add(route.title);
    values.add(route.start);
    values.add(route.end);
    if (route.lunchStop) {
      values.add(route.lunchStop);
    }
    if (route.endAccommodation) {
      values.add(route.endAccommodation);
    }
    for (const waypoint of route.waypoints) {
      values.add(waypoint.name);
    }
    for (const part of route.description.split("→")) {
      const value = part.trim();
      if (value) {
        values.add(value);
      }
    }
  }
  return [...values].sort();
}

describe("route text translations", () => {
  it("keeps Chinese route text unchanged", () => {
    expect(localizedRouteText("苗栗高中", "zh")).toBe("苗栗高中");
  });

  it("uses only translated route text for English and Japanese", () => {
    expect(localizedRouteText("苗栗高中", "en")).toBe("Miaoli Senior High School");
    expect(localizedRouteText("苗栗高中", "ja")).toBe("苗栗高校");
  });

  it("translates weekday labels for English and Japanese", () => {
    expect(localizedWeekday("六", "zh")).toBe("週六");
    expect(localizedWeekday("日", "en")).toBe("Sun");
    expect(localizedWeekday("一", "ja")).toBe("月");
  });

  it("covers every route title, route segment, waypoint, lunch stop, and accommodation", () => {
    const missing = routeTextValues().filter((value) => {
      const translation = routeTextTranslations[value];
      return !translation?.en || !translation?.ja;
    });

    expect(missing).toEqual([]);
  });
});
