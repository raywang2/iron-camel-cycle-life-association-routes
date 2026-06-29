import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Leaflet bundling", () => {
  it("loads Leaflet from the Vite bundle instead of CDN scripts", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(html).not.toContain("unpkg.com/leaflet");
    expect(html).not.toContain("leaflet.css");
    expect(html).not.toContain("leaflet.js");
    expect(app).toContain('import L from "leaflet";');
    expect(app).toContain('import "leaflet/dist/leaflet.css";');
  });
});
