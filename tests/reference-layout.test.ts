import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("reference-style route UI", () => {
  it("renders the reference-style sidebar controls and a single map stage", () => {
    const html = fs.readFileSync("index.html", "utf8");

    expect(html).toContain('class="app"');
    expect(html).toContain('id="daySelect"');
    expect(html).toContain('id="prevBtn"');
    expect(html).toContain('id="nextBtn"');
    expect(html).toContain('id="allBtn"');
    expect(html).toContain('id="gpxLink"');
    expect(html).toContain('id="info"');
    expect(html).not.toContain('id="dayList"');
    expect(html).not.toContain('class="detail-panel"');
  });

  it("wires dropdown, previous, next, overview, markers, and GPX download in the app script", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain('daySelect: requiredElement("#daySelect"');
    expect(app).toContain('prevButton: requiredElement("#prevBtn"');
    expect(app).toContain('nextButton: requiredElement("#nextBtn"');
    expect(app).toContain('allButton: requiredElement("#allBtn"');
    expect(app).toContain('gpxLink: requiredElement("#gpxLink"');
    expect(app).toContain("drawDay(");
    expect(app).toContain("drawOverview(");
    expect(app).toContain("L.marker(");
  });

  it("uses the reference dark split layout styles", () => {
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(css).toContain("--bg: #07111f");
    expect(css).toContain("grid-template-columns: 430px 1fr");
    expect(css).toContain("#map");
    expect(css).toContain("height: 100vh");
    expect(css).toContain(".stat");
    expect(css).toContain(".legend");
    expect(css).toContain(".pill");
  });
});
