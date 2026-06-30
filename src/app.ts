import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import type { RouteDay, Waypoint } from "../types/routes.js";

const colors = [
  "#38bdf8",
  "#f97316",
  "#22c55e",
  "#a78bfa",
  "#f43f5e",
  "#06b6d4",
  "#eab308",
  "#10b981",
  "#fb7185",
  "#60a5fa",
  "#84cc16",
  "#f59e0b",
];

type Language = "zh" | "en" | "ja";

interface Translation {
  htmlLang: string;
  documentTitle: string;
  brandEyebrow: string;
  appTitle: string;
  loading: string;
  summary: string;
  routeStatsLabel: string;
  rideDays: string;
  pdfKm: string;
  networkKm: string;
  languageLabel: string;
  languageSwitchLabel: string;
  daySelectLabel: string;
  daySelectAria: string;
  previousDay: string;
  nextDay: string;
  showAllRoutes: string;
  hideRestStops: string;
  showRestStops: string;
  downloadGpx: string;
  legendLabel: string;
  legendRide: string;
  legendNonRide: string;
  legendStart: string;
  legendFinish: string;
  legendRest: string;
  mapLabel: string;
  lecture: string;
  restDay: string;
  startMarker: string;
  finishMarker: string;
  waypointMarker: string;
  rightSide: string;
  onRoute: string;
  oppositeSide: string;
  actual: string;
  store: string;
  address: string;
  lunchStop: string;
  lunchDistance: string;
  routePoints: string;
  allRoutesBadge: string;
  allRoutesTitle: string;
  overviewNote: string;
  restStopsTitle: string;
  noRestStops: string;
  loadFailedSummary: string;
  loadFailedBadge: string;
  loadFailedTitle: string;
  weekdayPrefix: string;
  pdfLabel: string;
  networkLabel: string;
}

const translations: Record<Language, Translation> = {
  zh: {
    htmlLang: "zh-Hant",
    documentTitle: "2026 鐵駱駝環島路線｜道路網 GPX",
    brandEyebrow: "2026 鐵駱駝",
    appTitle: "環島路線地圖",
    loading: "載入路線資料中...",
    summary: "依 PDF 路線點位整理，每日可查看道路網線段與下載 GPX，方便匯入 Garmin。",
    routeStatsLabel: "路線統計",
    rideDays: "騎乘日",
    pdfKm: "PDF km",
    networkKm: "道路網 km",
    languageLabel: "語言",
    languageSwitchLabel: "語言切換",
    daySelectLabel: "每日路線",
    daySelectAria: "選擇每日路線",
    previousDay: "上一天",
    nextDay: "下一天",
    showAllRoutes: "顯示全路線",
    hideRestStops: "隱藏休息點",
    showRestStops: "顯示休息點",
    downloadGpx: "下載本日 GPX",
    legendLabel: "地圖圖例",
    legendRide: "單日路線",
    legendNonRide: "非騎乘日",
    legendStart: "起點",
    legendFinish: "終點",
    legendRest: "10km 休息點",
    mapLabel: "路線地圖",
    lecture: "行前講習",
    restDay: "休息日",
    startMarker: "起點",
    finishMarker: "終點",
    waypointMarker: "路點",
    rightSide: "順向側",
    onRoute: "路線旁",
    oppositeSide: "對向側",
    actual: "實際",
    store: "店名",
    address: "地址",
    lunchStop: "中午休息點",
    lunchDistance: "午休前里程",
    routePoints: "路點：",
    allRoutesBadge: "全部｜2026/7/4-7/18",
    allRoutesTitle: "完整環島路線",
    overviewNote: "彩色線條為各日可騎乘路線。選擇任一天可查看單日高亮路線與下載 GPX。",
    restStopsTitle: "每 10km 左右休息點：",
    noRestStops: "此日尚未找到符合每 10km、非終點附近的便利商店休息點。",
    loadFailedSummary: "路線資料載入失敗。",
    loadFailedBadge: "載入失敗",
    loadFailedTitle: "無法載入路線資料",
    weekdayPrefix: "週",
    pdfLabel: "PDF",
    networkLabel: "道路網",
  },
  en: {
    htmlLang: "en",
    documentTitle: "2026 Iron Camel Taiwan Route｜Network GPX",
    brandEyebrow: "2026 Iron Camel",
    appTitle: "Taiwan Route Map",
    loading: "Loading route data...",
    summary: "Built from the PDF waypoints. Review daily routed segments and download GPX files for Garmin.",
    routeStatsLabel: "Route statistics",
    rideDays: "Ride days",
    pdfKm: "PDF km",
    networkKm: "Network km",
    languageLabel: "Language",
    languageSwitchLabel: "Language switcher",
    daySelectLabel: "Daily route",
    daySelectAria: "Choose a daily route",
    previousDay: "Previous",
    nextDay: "Next",
    showAllRoutes: "Show all routes",
    hideRestStops: "Hide rest stops",
    showRestStops: "Show rest stops",
    downloadGpx: "Download GPX",
    legendLabel: "Map legend",
    legendRide: "Daily route",
    legendNonRide: "Non-riding day",
    legendStart: "Start",
    legendFinish: "Finish",
    legendRest: "10 km rest stop",
    mapLabel: "Route map",
    lecture: "Safety briefing",
    restDay: "Rest day",
    startMarker: "Start",
    finishMarker: "Finish",
    waypointMarker: "Waypoint",
    rightSide: "same side",
    onRoute: "on route",
    oppositeSide: "opposite side",
    actual: "Actual",
    store: "Store",
    address: "Address",
    lunchStop: "Lunch stop",
    lunchDistance: "Distance before lunch",
    routePoints: "Waypoints:",
    allRoutesBadge: "All｜2026/7/4-7/18",
    allRoutesTitle: "Full Taiwan Route",
    overviewNote: "Colored lines show each riding day. Select a day to highlight one route and download its GPX.",
    restStopsTitle: "Rest stops around every 10 km:",
    noRestStops: "No convenience-store rest stops were found for this day around every 10 km and away from the finish.",
    loadFailedSummary: "Route data failed to load.",
    loadFailedBadge: "Load failed",
    loadFailedTitle: "Unable to load route data",
    weekdayPrefix: "",
    pdfLabel: "PDF",
    networkLabel: "Network",
  },
  ja: {
    htmlLang: "ja",
    documentTitle: "2026 アイアンキャメル台湾一周ルート｜道路網 GPX",
    brandEyebrow: "2026 アイアンキャメル",
    appTitle: "台湾一周ルートマップ",
    loading: "ルートデータを読み込み中...",
    summary: "PDFの経由地をもとに整理しています。毎日の道路網ルートを確認し、Garmin用GPXをダウンロードできます。",
    routeStatsLabel: "ルート統計",
    rideDays: "走行日",
    pdfKm: "PDF km",
    networkKm: "道路網 km",
    languageLabel: "言語",
    languageSwitchLabel: "言語切替",
    daySelectLabel: "毎日のルート",
    daySelectAria: "毎日のルートを選択",
    previousDay: "前日",
    nextDay: "翌日",
    showAllRoutes: "全ルートを表示",
    hideRestStops: "休憩地点を非表示",
    showRestStops: "休憩地点を表示",
    downloadGpx: "GPXをダウンロード",
    legendLabel: "地図凡例",
    legendRide: "日別ルート",
    legendNonRide: "走行なし",
    legendStart: "出発地",
    legendFinish: "到着地",
    legendRest: "10km 休憩地点",
    mapLabel: "ルート地図",
    lecture: "安全講習",
    restDay: "休息日",
    startMarker: "出発地",
    finishMarker: "到着地",
    waypointMarker: "経由地",
    rightSide: "順方向側",
    onRoute: "ルート沿い",
    oppositeSide: "反対側",
    actual: "実際",
    store: "店舗名",
    address: "住所",
    lunchStop: "昼食休憩地点",
    lunchDistance: "昼食前の距離",
    routePoints: "経由地：",
    allRoutesBadge: "全体｜2026/7/4-7/18",
    allRoutesTitle: "台湾一周フルルート",
    overviewNote: "色付きの線は各走行日のルートです。日付を選ぶと単日のルートを強調表示し、GPXをダウンロードできます。",
    restStopsTitle: "約10kmごとの休憩地点：",
    noRestStops: "この日は約10kmごと、かつ終点付近を除いた条件に合うコンビニ休憩地点が見つかっていません。",
    loadFailedSummary: "ルートデータの読み込みに失敗しました。",
    loadFailedBadge: "読み込み失敗",
    loadFailedTitle: "ルートデータを読み込めません",
    weekdayPrefix: "",
    pdfLabel: "PDF",
    networkLabel: "道路網",
  },
};

interface AppState {
  routes: RouteDay[];
  map: Leaflet.Map | null;
  layer: Leaflet.LayerGroup | null;
  currentIndex: number;
  showConvenienceStores: boolean;
  language: Language;
}

type WaypointMarkerType = "start" | "finish" | "mid";

function requiredElement<T extends Element>(selector: string, constructor: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const state: AppState = {
  routes: [],
  map: null,
  layer: null,
  currentIndex: 0,
  showConvenienceStores: true,
  language: "zh",
};

const elements = {
  brandEyebrow: requiredElement("#brandEyebrow", HTMLParagraphElement),
  appTitle: requiredElement("#appTitle", HTMLHeadingElement),
  summary: requiredElement("#summary", HTMLParagraphElement),
  routeStats: requiredElement("#routeStats", HTMLDivElement),
  languageLabel: requiredElement("#languageLabel", HTMLSpanElement),
  languageSwitch: requiredElement("#languageSwitch", HTMLDivElement),
  daySelectLabel: requiredElement("#daySelectLabel", HTMLLabelElement),
  daySelect: requiredElement("#daySelect", HTMLSelectElement),
  prevButton: requiredElement("#prevBtn", HTMLButtonElement),
  nextButton: requiredElement("#nextBtn", HTMLButtonElement),
  allButton: requiredElement("#allBtn", HTMLButtonElement),
  poiToggleButton: requiredElement("#poiToggleBtn", HTMLButtonElement),
  gpxLink: requiredElement("#gpxLink", HTMLAnchorElement),
  legend: requiredElement(".legend", HTMLDivElement),
  legendRide: requiredElement("#legendRide", HTMLSpanElement),
  legendNonRide: requiredElement("#legendNonRide", HTMLSpanElement),
  legendStart: requiredElement("#legendStart", HTMLSpanElement),
  legendFinish: requiredElement("#legendFinish", HTMLSpanElement),
  legendRest: requiredElement("#legendRest", HTMLSpanElement),
  mapStage: requiredElement(".map-stage", HTMLElement),
  info: requiredElement("#info", HTMLElement),
};

function t(key: keyof Translation): string {
  return translations[state.language][key];
}

function isLanguage(value: string | null): value is Language {
  return value === "zh" || value === "en" || value === "ja";
}

function initialLanguage(): Language {
  const langParam = new URL(window.location.href).searchParams.get("lang");
  if (isLanguage(langParam)) {
    return langParam;
  }

  const savedLanguage = window.localStorage.getItem("route-language");
  if (isLanguage(savedLanguage)) {
    return savedLanguage;
  }

  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith("ja")) {
    return "ja";
  }
  if (browserLanguage.startsWith("en")) {
    return "en";
  }
  return "zh";
}

function updateStaticText(): void {
  const copy = translations[state.language];
  document.documentElement.lang = copy.htmlLang;
  document.title = copy.documentTitle;
  elements.brandEyebrow.textContent = copy.brandEyebrow;
  elements.appTitle.textContent = copy.appTitle;
  elements.routeStats.setAttribute("aria-label", copy.routeStatsLabel);
  elements.languageLabel.textContent = copy.languageLabel;
  elements.languageSwitch.setAttribute("aria-label", copy.languageSwitchLabel);
  elements.daySelectLabel.textContent = copy.daySelectLabel;
  elements.daySelect.setAttribute("aria-label", copy.daySelectAria);
  elements.prevButton.textContent = copy.previousDay;
  elements.nextButton.textContent = copy.nextDay;
  elements.allButton.textContent = copy.showAllRoutes;
  elements.gpxLink.textContent = copy.downloadGpx;
  elements.legend.setAttribute("aria-label", copy.legendLabel);
  elements.legendRide.textContent = copy.legendRide;
  elements.legendNonRide.textContent = copy.legendNonRide;
  elements.legendStart.textContent = copy.legendStart;
  elements.legendFinish.textContent = copy.legendFinish;
  elements.legendRest.textContent = copy.legendRest;
  elements.mapStage.setAttribute("aria-label", copy.mapLabel);

  for (const button of elements.languageSwitch.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === state.language));
  }
}

function setLanguage(language: Language): void {
  state.language = language;
  window.localStorage.setItem("route-language", language);
  updateStaticText();
  updateNavigation();

  if (state.routes.length === 0) {
    elements.summary.textContent = t("loading");
    return;
  }

  renderStats();
  renderDayOptions();
  drawDay(state.currentIndex);
}

function requireMap(): Leaflet.Map {
  if (!state.map) {
    throw new Error("Map is not initialized");
  }

  return state.map;
}

function requireLayer(): Leaflet.LayerGroup {
  if (!state.layer) {
    throw new Error("Route layer is not initialized");
  }

  return state.layer;
}

function isRideDay(day: RouteDay): day is RouteDay & { distanceKm: number } {
  return day.type === "ride" && typeof day.distanceKm === "number";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function dayCode(day: RouteDay): string {
  return day.day === 0 ? "D0" : `D${day.day}`;
}

function routeStyle(index: number, selected = false): Leaflet.PathOptions {
  return {
    color: selected ? "#38bdf8" : colors[index % colors.length],
    weight: selected ? 6 : 4,
    opacity: selected ? 0.92 : 0.82,
  };
}

function routeCoordinates(day: RouteDay): Leaflet.LatLngExpression[] {
  if (!day.geojson) {
    return [];
  }

  return day.geojson.coordinates.map(([lon, lat]) => [lat, lon]);
}

function waypointPosition(waypoint: Waypoint): Leaflet.LatLngExpression {
  return [waypoint.lat, waypoint.lon];
}

function markerTypeForWaypoint(index: number, total: number): WaypointMarkerType {
  if (index === 0) {
    return "start";
  }
  if (index === total - 1) {
    return "finish";
  }
  return "mid";
}

function markerLabel(type: WaypointMarkerType): string {
  if (type === "start") {
    return t("startMarker");
  }
  if (type === "finish") {
    return t("finishMarker");
  }
  return t("waypointMarker");
}

function markerGlyph(type: WaypointMarkerType): string {
  if (type === "start") {
    return "起";
  }
  if (type === "finish") {
    return "✓";
  }
  return "";
}

function pointIcon(type: WaypointMarkerType): Leaflet.DivIcon {
  const isMidPoint = type === "mid";
  return L.divIcon({
    className: `route-marker ${type}`,
    html: `<span>${isMidPoint ? "" : `<b>${markerGlyph(type)}</b>`}</span>`,
    iconSize: isMidPoint ? [18, 18] : [32, 32],
    iconAnchor: isMidPoint ? [9, 9] : [16, 16],
  });
}

function storeIcon(): Leaflet.DivIcon {
  return L.divIcon({
    className: "store-marker",
    html: "<span></span>",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function initMap(): void {
  state.map = L.map("map", {
    scrollWheelZoom: true,
    zoomControl: true,
  }).setView([23.8, 121], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);

  state.layer = L.layerGroup().addTo(state.map);
}

function clearMap(): void {
  requireLayer().clearLayers();
}

function fitPositions(positions: Leaflet.LatLngExpression[]): void {
  if (positions.length > 1) {
    requireMap().fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
  } else if (positions.length === 1) {
    const [position] = positions;
    if (position) {
      requireMap().setView(position, 12);
    }
  }
}

function formatDistance(day: RouteDay): string {
  if (!isRideDay(day)) {
    return day.type === "lecture" ? t("lecture") : t("restDay");
  }

  return `${day.distanceKm.toFixed(1)} km`;
}

function formatStoreSide(side: NonNullable<RouteDay["convenienceStores"]>[number]["sideOfRoute"]): string {
  if (side === "right") {
    return t("rightSide");
  }
  if (side === "on-route") {
    return t("onRoute");
  }
  return t("oppositeSide");
}

function storeMapLink(store: NonNullable<RouteDay["convenienceStores"]>[number]): string {
  return `<a class="store-map-link" href="${escapeHtml(store.googleMapsUrl)}" target="_blank" rel="noreferrer">${escapeHtml(store.googleMapsUrl)}</a>`;
}

function storeDetailMarkup(store: NonNullable<RouteDay["convenienceStores"]>[number]): string {
  return `
    <div class="store-heading">
      <b class="store-name">${store.targetKm}km｜${escapeHtml(store.displayName)}</b>
      <span class="store-distance">${escapeHtml(t("actual"))} ${store.routeProgressKm.toFixed(1)}km｜${Math.round(store.distanceFromRouteM)}m｜${formatStoreSide(store.sideOfRoute)}</span>
    </div>
    <div class="store-name-row">${escapeHtml(t("store"))}：${escapeHtml(store.displayName)}</div>
    <div class="store-address">${escapeHtml(t("address"))}：${escapeHtml(store.address)}</div>
    <div class="store-map">Google Maps：${storeMapLink(store)}</div>
  `;
}

function renderStats(): void {
  const rideDays = state.routes.filter(isRideDay);
  const totalPdfDistance = rideDays.reduce((sum, day) => sum + day.distanceKm, 0);
  const totalGeneratedDistance = rideDays.reduce((sum, day) => sum + (day.generatedDistanceKm ?? 0), 0);

  elements.summary.textContent = t("summary");
  elements.routeStats.innerHTML = `
    <div class="stat"><b>${rideDays.length}</b><span>${escapeHtml(t("rideDays"))}</span></div>
    <div class="stat"><b>${totalPdfDistance.toFixed(1)}</b><span>${escapeHtml(t("pdfKm"))}</span></div>
    <div class="stat"><b>${totalGeneratedDistance.toFixed(1)}</b><span>${escapeHtml(t("networkKm"))}</span></div>
  `;
}

function renderDayOptions(): void {
  elements.daySelect.innerHTML = "";

  state.routes.forEach((day, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${dayCode(day)}｜${day.title}｜${formatDistance(day)}`;
    elements.daySelect.append(option);
  });
}

function renderInfo(day: RouteDay | null): void {
  if (!day) {
    const rideDays = state.routes.filter(isRideDay);
    const totalPdfDistance = rideDays.reduce((sum, route) => sum + route.distanceKm, 0);
    const totalGeneratedDistance = rideDays.reduce((sum, route) => sum + (route.generatedDistanceKm ?? 0), 0);

    elements.info.innerHTML = `
      <div class="top">
        <div>
          <span class="badge">${escapeHtml(t("allRoutesBadge"))}</span>
          <h2>${escapeHtml(t("allRoutesTitle"))}</h2>
        </div>
        <div class="km">${escapeHtml(t("pdfLabel"))} ${totalPdfDistance.toFixed(1)} km<br>${escapeHtml(t("networkLabel"))} ${totalGeneratedDistance.toFixed(1)} km</div>
      </div>
      <p class="note">${escapeHtml(t("overviewNote"))}</p>
    `;
    return;
  }

  const routeParts = day.description
    .split("→")
    .map((part) => part.trim())
    .filter(Boolean);
  const waypoints = day.waypoints.map((point) => `<span class="pill">${escapeHtml(point.name)}</span>`).join("");
  const distanceLine = isRideDay(day)
    ? `${escapeHtml(t("pdfLabel"))} ${day.distanceKm.toFixed(1)} km<br>${escapeHtml(t("networkLabel"))} ${(day.generatedDistanceKm ?? 0).toFixed(1)} km`
    : formatDistance(day);
  const reviewNote = day.routeReview?.reviewNote ? `<p class="note">${escapeHtml(day.routeReview.reviewNote)}</p>` : "";
  const lunchParts = [
    day.lunchStop ? `${t("lunchStop")}：${day.lunchStop}` : null,
    typeof day.lunchDistanceKm === "number" ? `${t("lunchDistance")}：${day.lunchDistanceKm.toFixed(1)} km` : null,
  ].filter((part): part is string => Boolean(part));
  const lunchBlock = lunchParts.length > 0
    ? `<p class="note">${lunchParts.map(escapeHtml).join("<br>")}</p>`
    : "";
  const restStops = day.convenienceStores ?? [];
  const storeItems = restStops
    .map(
      (store) => `<li class="store-item">${storeDetailMarkup(store)}</li>`,
    )
    .join("");
  const storeBlock = restStops.length > 0
    ? `<p class="note">${escapeHtml(t("restStopsTitle"))}</p>
      <ul class="store-list">
        ${storeItems}
      </ul>`
    : `<p class="note">${escapeHtml(t("noRestStops"))}</p>`;

  elements.info.innerHTML = `
    <div class="top">
      <div>
        <span class="badge">${dayCode(day)}｜${escapeHtml(day.date)}（${escapeHtml(t("weekdayPrefix"))}${escapeHtml(day.weekday)}）</span>
        <h2>${escapeHtml(day.title)}</h2>
      </div>
      <div class="km">${distanceLine}</div>
    </div>
    <ul>${routeParts.map((part) => `<li>${escapeHtml(part)}</li>`).join("")}</ul>
    ${lunchBlock}
    ${waypoints ? `<p class="note">${escapeHtml(t("routePoints"))}</p><div>${waypoints}</div>` : ""}
    ${reviewNote}
    ${storeBlock}
    <p class="note">${escapeHtml(day.distanceWarning || day.description)}</p>
  `;
}

function updateGpxLink(day: RouteDay | null): void {
  if (day?.type === "ride" && day.gpxPath) {
    elements.gpxLink.href = day.gpxPath;
    elements.gpxLink.download = `iron-camel-day-${String(day.day).padStart(2, "0")}.gpx`;
    elements.gpxLink.hidden = false;
    return;
  }

  elements.gpxLink.hidden = true;
}

function updateNavigation(): void {
  elements.daySelect.value = String(state.currentIndex);
  elements.prevButton.disabled = state.currentIndex <= 0;
  elements.nextButton.disabled = state.currentIndex >= state.routes.length - 1;
  elements.poiToggleButton.textContent = state.showConvenienceStores ? t("hideRestStops") : t("showRestStops");
  elements.poiToggleButton.setAttribute("aria-pressed", String(state.showConvenienceStores));
}

function drawMarkers(day: RouteDay, positions: Leaflet.LatLngExpression[]): void {
  day.waypoints.forEach((waypoint, index) => {
    const type = markerTypeForWaypoint(index, day.waypoints.length);
    const position = waypointPosition(waypoint);
    positions.push(position);
    L.marker(position, { icon: pointIcon(type) })
      .addTo(requireLayer())
      .bindPopup(`<b>${markerLabel(type)}｜${escapeHtml(waypoint.name)}</b><br>${dayCode(day)}｜${escapeHtml(day.title)}`);
  });
}

function drawConvenienceStores(day: RouteDay, positions: Leaflet.LatLngExpression[]): void {
  if (!state.showConvenienceStores) {
    return;
  }

  for (const store of day.convenienceStores ?? []) {
    const position: Leaflet.LatLngExpression = [store.lat, store.lon];
    positions.push(position);
    L.marker(position, { icon: storeIcon() })
      .addTo(requireLayer())
      .bindPopup(
        `<div class="store-popup">${storeDetailMarkup(store)}</div>`,
      );
  }
}

function drawDay(index: number): void {
  state.currentIndex = Math.max(0, Math.min(index, state.routes.length - 1));
  const day = state.routes[state.currentIndex];
  if (!day) {
    return;
  }

  clearMap();
  updateNavigation();
  renderInfo(day);
  updateGpxLink(day);

  const bounds: Leaflet.LatLngExpression[] = [];
  const coordinates = routeCoordinates(day);
  if (coordinates.length > 1) {
    L.polyline(coordinates, routeStyle(state.currentIndex, true))
      .addTo(requireLayer())
      .bindPopup(`${dayCode(day)}｜${escapeHtml(day.title)}｜${formatDistance(day)}`);
    bounds.push(...coordinates);
  }

  drawMarkers(day, bounds);
  drawConvenienceStores(day, bounds);
  fitPositions(bounds);
}

function drawOverview(): void {
  clearMap();
  renderInfo(null);
  updateGpxLink(null);
  updateNavigation();

  const bounds: Leaflet.LatLngExpression[] = [];
  state.routes.forEach((day, index) => {
    const coordinates = routeCoordinates(day);
    if (coordinates.length <= 1) {
      return;
    }

    L.polyline(coordinates, routeStyle(index))
      .addTo(requireLayer())
      .bindPopup(`${dayCode(day)}｜${escapeHtml(day.title)}｜${formatDistance(day)}`);
    bounds.push(...coordinates);
  });

  fitPositions(bounds);
}

async function loadRoutes(): Promise<void> {
  const response = await fetch("data/routes.json");
  if (!response.ok) {
    throw new Error(`路線資料載入失敗：HTTP ${response.status}`);
  }

  state.routes = (await response.json()) as RouteDay[];
}

function initialRouteIndex(): number {
  const dayParam = new URL(window.location.href).searchParams.get("day");
  const requestedDay = dayParam ? Number(dayParam) : Number.NaN;
  if (Number.isInteger(requestedDay)) {
    const requestedIndex = state.routes.findIndex((route) => route.day === requestedDay);
    if (requestedIndex >= 0) {
      return requestedIndex;
    }
  }

  const firstRideIndex = state.routes.findIndex(isRideDay);
  return firstRideIndex >= 0 ? firstRideIndex : 0;
}

async function main(): Promise<void> {
  initMap();
  setLanguage(initialLanguage());

  try {
    await loadRoutes();
    renderStats();
    renderDayOptions();

    elements.languageSwitch.addEventListener("click", (event) => {
      const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>("[data-lang]") : null;
      const nextLanguage = button?.dataset.lang ?? null;
      if (isLanguage(nextLanguage)) {
        setLanguage(nextLanguage);
      }
    });
    elements.daySelect.addEventListener("change", () => drawDay(Number(elements.daySelect.value)));
    elements.prevButton.addEventListener("click", () => drawDay(state.currentIndex - 1));
    elements.nextButton.addEventListener("click", () => drawDay(state.currentIndex + 1));
    elements.allButton.addEventListener("click", drawOverview);
    elements.poiToggleButton.addEventListener("click", () => {
      state.showConvenienceStores = !state.showConvenienceStores;
      drawDay(state.currentIndex);
    });

    drawDay(initialRouteIndex());
  } catch (error) {
    elements.summary.textContent = t("loadFailedSummary");
    elements.info.innerHTML = `
      <div class="top">
        <div>
          <span class="badge">${escapeHtml(t("loadFailedBadge"))}</span>
          <h2>${escapeHtml(t("loadFailedTitle"))}</h2>
        </div>
      </div>
      <p class="note">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
    `;
    updateGpxLink(null);
  }
}

main();
