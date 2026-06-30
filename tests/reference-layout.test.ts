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
    expect(html).toContain('id="poiToggleBtn"');
    expect(html).toContain('id="gpxLink"');
    expect(html).toContain('id="languageSwitch"');
    expect(html).toContain('data-lang="zh"');
    expect(html).toContain('data-lang="en"');
    expect(html).toContain('data-lang="ja"');
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
    expect(app).toContain('poiToggleButton: requiredElement("#poiToggleBtn"');
    expect(app).toContain('gpxLink: requiredElement("#gpxLink"');
    expect(app).toContain("drawDay(");
    expect(app).toContain("drawOverview(");
    expect(app).toContain("drawConvenienceStores(");
    expect(app).toContain("translations");
    expect(app).toContain("setLanguage(");
    expect(app).toContain('searchParams.get("lang")');
    expect(app).toContain("localStorage");
    expect(app).toContain("store.displayName");
    expect(app).toContain("store.address");
    expect(app).toContain("store.googleMapsUrl");
    expect(app).toContain("L.marker(");
    expect(app).toContain("initialRouteIndex(");
    expect(app).toContain('searchParams.get("day")');
  });

  it("translates static route UI labels across Chinese, English, and Japanese", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("每日路線");
    expect(app).toContain("Daily route");
    expect(app).toContain("毎日のルート");
    expect(app).toContain("下載本日 GPX");
    expect(app).toContain("Download GPX");
    expect(app).toContain("GPXをダウンロード");
    expect(app).toContain("店名");
    expect(app).toContain("中午休息點");
    expect(app).toContain("終點住宿點");
    expect(app).toContain("Store");
    expect(app).toContain("Lunch stop");
    expect(app).toContain("Overnight stop");
    expect(app).toContain("店舗名");
    expect(app).toContain("昼食休憩地点");
    expect(app).toContain("宿泊地");
  });

  it("uses distinct map markers for route start and finish", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const app = fs.readFileSync("src/app.ts", "utf8");
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(html).toContain("起點");
    expect(html).toContain("終點");
    expect(app).toContain("markerTypeForWaypoint(");
    expect(app).toContain('className: `route-marker ${type}`');
    expect(css).toContain(".route-marker.start span");
    expect(css).toContain(".route-marker.finish span");
    expect(css).toContain(".route-marker.mid span");
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
    expect(css).toContain(".store-list");
    expect(css).toContain(".store-marker");
    expect(css).toContain(".leaflet-popup-content-wrapper");
    expect(css).toContain(".store-name");
  });
});
