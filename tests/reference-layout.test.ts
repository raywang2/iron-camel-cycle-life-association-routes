import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("reference-style route UI", () => {
  it("renders the reference-style sidebar controls and a single map stage", () => {
    const html = fs.readFileSync("index.html", "utf8");

    expect(html).toContain('class="app"');
    expect(html).toContain('class="brand-row"');
    expect(html).toContain('class="language-row compact"');
    expect(html).toContain('id="sidebarToggleBtn"');
    expect(html).toContain('id="mapSidebarToggleBtn"');
    expect(html).toContain('id="daySelect"');
    expect(html).toContain('id="prevBtn"');
    expect(html).toContain('id="nextBtn"');
    expect(html).toContain('id="allBtn"');
    expect(html).toContain('id="locationBtn"');
    expect(html).toContain('id="gpxLink"');
    expect(html).toContain('id="languageSwitch"');
    expect(html).toContain("<select");
    expect(html).toContain('value="zh">繁體中文');
    expect(html).toContain('value="en">English');
    expect(html).toContain('value="ja">日本語');
    expect(html).toContain('id="info"');
    expect(html).not.toContain('id="summary"');
    expect(html).not.toContain('id="routeStats"');
    expect(html).not.toContain('id="poiToggleBtn"');
    expect(html).not.toContain("依 PDF 路線點位整理");
    expect(html).not.toContain("12 騎乘日");
    expect(html).not.toContain('id="dayList"');
    expect(html).not.toContain('class="detail-panel"');
  });

  it("places the language switcher as a compact globe control in the title row", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(html).toContain('<div class="brand-row">');
    expect(html).toContain('<div class="language-row compact">');
    expect(css).toContain(".brand-row");
    expect(css).toContain(".language-row.compact");
    expect(css).toContain("#languageSwitch");
    expect(css).toContain("background-image:");
    expect(html).toContain('aria-label="語言切換"');
    expect(css).not.toContain(".language-row {\n  display: grid;\n  gap: 5px;\n  margin: 12px 0 10px;");
  });

  it("supports a responsive collapsible sidebar", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const app = fs.readFileSync("src/app.ts", "utf8");
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(html).toContain('class="sidebar-content"');
    expect(html).toContain('id="sidebarToggleBtn"');
    expect(html).toContain('id="mapSidebarToggleBtn"');
    expect(app).toContain('app: requiredElement(".app"');
    expect(app).toContain('sidebarToggleButton: requiredElement("#sidebarToggleBtn"');
    expect(app).toContain('mapSidebarToggleButton: requiredElement("#mapSidebarToggleBtn"');
    expect(app).toContain('window.localStorage.getItem("route-sidebar-collapsed")');
    expect(app).toContain('window.localStorage.setItem("route-sidebar-collapsed"');
    expect(app).toContain('classList.toggle("sidebar-collapsed"');
    expect(app).toContain("invalidateSize()");
    expect(css).toContain(".app.sidebar-collapsed");
    expect(css).toContain("grid-template-columns: 58px 1fr");
    expect(css).toContain(".app.sidebar-collapsed .sidebar-content");
    expect(css).toContain(".map-sidebar-toggle");
    expect(css).toContain("@media (max-width: 860px)");
    expect(css).toContain(".app.sidebar-collapsed .sidebar");
    expect(css).toContain("top: 72px");
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
    expect(app).not.toContain("poiToggleButton");
    expect(app).not.toContain("showConvenienceStores");
  });

  it("uses the browser language as the initial fallback without persisting automatic detection", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("navigator.language.toLowerCase()");
    expect(app).toContain('browserLanguage.startsWith("ja")');
    expect(app).toContain('browserLanguage.startsWith("en")');
    expect(app).toContain("setLanguage(initialLanguage(), { persist: false })");
    expect(app).toContain("if (options.persist)");
  });

  it("persists only user-selected language changes to localStorage", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain('window.localStorage.getItem("route-language")');
    expect(app).toContain('window.localStorage.setItem("route-language", language)');
    expect(app).toContain('elements.languageSwitch.addEventListener("change"');
    expect(app).toContain("setLanguage(nextLanguage)");
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

  it("shows route distance in the finish marker popup", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("finishDistance");
    expect(app).toContain("finishDistanceMarkup(");
    expect(app).toContain('type === "finish"');
    expect(app).toContain("day.generatedDistanceKm");
    expect(app).toContain("finishDistanceMarkup(day)");
  });

  it("detects external KML routes for custom distance display", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("isExternalRoute(");
    expect(app).toContain('day.routeReview?.selectedCandidate === "external-kml"');
    expect(app).toContain("isExternalRoute(day)");
  });

  it("labels external KML route distance as estimated distance", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("estimatedDistance");
    expect(app).toContain("預估距離");
    expect(app).toContain("Estimated distance");
    expect(app).toContain("推定距離");
    expect(app).toContain("externalRouteDistance(");
  });

  it("keeps daily route options to day code and title only", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("option.textContent = [dayCode(day), routeText(day.title)]");
    expect(app).not.toContain("option.textContent = [dayCode(day), day.title, formatDistance(day)]");
  });

  it("uses route and place translations in non-Chinese languages", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("localizedRouteText(");
    expect(app).toContain("routeText(day.title)");
    expect(app).toContain("routeText(waypoint.name)");
    expect(app).toContain("routeText(point.name)");
    expect(app).toContain("routeText(part)");
    expect(app).toContain("routeText(day.lunchStop)");
    expect(app).toContain("routeText(day.endAccommodation)");
  });

  it("uses localized weekday labels in the day badge", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("localizedWeekday(");
    expect(app).toContain("weekdayText(day.weekday)");
    expect(app).not.toContain('t("weekdayPrefix"))}${escapeHtml(day.weekday)');
  });

  it("does not display generated review notes or distance warnings", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).not.toContain("day.routeReview?.reviewNote");
    expect(app).not.toContain("day.distanceWarning || day.description");
    expect(app).not.toContain("已使用人工確認的 Google My Maps KML 路線。");
    expect(app).not.toContain("產生路線與 PDF 距離相差");
  });

  it("highlights map markers when hovering sidebar waypoints and convenience stores", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(app).toContain("markerIdForWaypoint(");
    expect(app).toContain("markerIdForStore(");
    expect(app).toContain("highlightMarker(");
    expect(app).toContain('data-marker-id="');
    expect(app).toContain('elements.info.addEventListener("pointerover"');
    expect(app).toContain('elements.info.addEventListener("pointerout"');
    expect(css).toContain(".route-marker.is-highlighted span");
    expect(css).toContain(".store-marker.is-highlighted span");
  });

  it("opens the map popup when interacting with sidebar marker labels", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("markerInstances");
    expect(app).toContain("openMarkerPopup(");
    expect(app).toContain("closeMarkerPopup(");
    expect(app).toContain("marker.openPopup()");
    expect(app).toContain("requireMap().closePopup()");
    expect(app).toContain("openMarkerPopup(target.dataset.markerId");
  });

  it("supports tapping sidebar marker labels on touch devices", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(app).toContain("togglePinnedMarker(");
    expect(app).toContain('elements.info.addEventListener("click"');
    expect(app).toContain('elements.info.addEventListener("keydown"');
    expect(app).toContain('tabindex="0"');
    expect(app).toContain('aria-pressed="false"');
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain(".landmark-item.is-active");
    expect(css).toContain(".store-list .store-item.is-active");
  });

  it("can place the user's current location on the map", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(app).toContain('locationButton: requiredElement("#locationBtn"');
    expect(app).toContain("showCurrentLocation(");
    expect(app).toContain("navigator.geolocation.getCurrentPosition");
    expect(app).toContain("currentLocationIcon(");
    expect(app).toContain("locationLayer");
    expect(css).toContain(".current-location-marker span");
  });

  it("selects and updates the visible route from the current date", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("localDateString(");
    expect(app).toContain("routeIndexForDate(");
    expect(app).toContain("startDateRouteWatcher(");
    expect(app).toContain("window.setInterval");
    expect(app).toContain("searchParams.get(\"day\")");
  });

  it("keeps the day query in sync after manual route changes", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("updateRouteDayQuery(");
    expect(app).toContain("clearRouteDayQuery(");
    expect(app).toContain("window.history.replaceState");
    expect(app).toContain("url.searchParams.set(\"day\"");
    expect(app).toContain("url.searchParams.delete(\"day\")");
  });

  it("uses the reference dark split layout styles", () => {
    const css = fs.readFileSync("src/styles.css", "utf8");

    expect(css).toContain("--bg: #07111f");
    expect(css).toContain("grid-template-columns: 430px 1fr");
    expect(css).toContain("#map");
    expect(css).toContain("height: 100vh");
    expect(css).toContain(".legend");
    expect(css).toContain(".pill");
    expect(css).toContain(".store-list");
    expect(css).toContain(".store-marker");
    expect(css).toContain(".leaflet-popup-content-wrapper");
    expect(css).toContain(".store-name");
    expect(css).not.toContain(".stat");
    expect(css).not.toContain(".segmented");
  });
});
