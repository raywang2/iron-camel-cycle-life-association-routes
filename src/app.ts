import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { localizedRouteText, localizedWeekday, type RouteTextLanguage } from "./routeText.js";
import type { ConvenienceStore, RouteDay, Waypoint } from "../types/routes.js";

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

type Language = RouteTextLanguage;

interface Translation {
  htmlLang: string;
  documentTitle: string;
  brandEyebrow: string;
  appTitle: string;
  languageLabel: string;
  languageSwitchLabel: string;
  daySelectLabel: string;
  daySelectAria: string;
  previousDay: string;
  nextDay: string;
  showAllRoutes: string;
  collapseSidebar: string;
  expandSidebar: string;
  locateMe: string;
  locating: string;
  currentLocation: string;
  locationAccuracy: string;
  locationUnavailable: string;
  downloadGpx: string;
  legendLabel: string;
  legendRide: string;
  legendNonRide: string;
  legendStart: string;
  legendFinish: string;
  legendRest: string;
  changelogButton: string;
  changelogTitle: string;
  changelogIntro: string;
  changelogClose: string;
  mapLabel: string;
  lecture: string;
  restDay: string;
  startMarker: string;
  finishMarker: string;
  finishDistance: string;
  estimatedDistance: string;
  waypointMarker: string;
  rightSide: string;
  onRoute: string;
  oppositeSide: string;
  actual: string;
  store: string;
  address: string;
  lunchStop: string;
  lunchDistance: string;
  endAccommodation: string;
  routePoints: string;
  allRoutesBadge: string;
  allRoutesTitle: string;
  overviewNote: string;
  restStopsTitle: string;
  noRestStops: string;
  loadFailedSummary: string;
  loadFailedBadge: string;
  loadFailedTitle: string;
  pdfLabel: string;
  networkLabel: string;
}

const translations: Record<Language, Translation> = {
  zh: {
    htmlLang: "zh-Hant",
    documentTitle: "2026 鐵駱駝環島路線｜道路網 GPX",
    brandEyebrow: "2026 鐵駱駝",
    appTitle: "環島路線地圖",
    languageLabel: "語言",
    languageSwitchLabel: "語言切換",
    daySelectLabel: "每日路線",
    daySelectAria: "選擇每日路線",
    previousDay: "上一天",
    nextDay: "下一天",
    showAllRoutes: "顯示全路線",
    collapseSidebar: "收合側邊欄",
    expandSidebar: "展開側邊欄",
    locateMe: "顯示現在位置",
    locating: "定位中...",
    currentLocation: "現在位置",
    locationAccuracy: "定位精度",
    locationUnavailable: "無法取得現在位置，請確認瀏覽器定位權限。",
    downloadGpx: "下載本日 GPX",
    legendLabel: "地圖圖例",
    legendRide: "單日路線",
    legendNonRide: "非騎乘日",
    legendStart: "起點",
    legendFinish: "終點",
    legendRest: "10km 休息點",
    changelogButton: "更新紀錄",
    changelogTitle: "更新紀錄",
    changelogIntro: "最近調整重點：",
    changelogClose: "關閉",
    mapLabel: "路線地圖",
    lecture: "行前講習",
    restDay: "休息日",
    startMarker: "起點",
    finishMarker: "終點",
    finishDistance: "終點距離",
    estimatedDistance: "預估距離",
    waypointMarker: "路點",
    rightSide: "順向側",
    onRoute: "路線旁",
    oppositeSide: "對向側",
    actual: "實際",
    store: "店名",
    address: "地址",
    lunchStop: "中午休息點",
    lunchDistance: "午休前里程",
    endAccommodation: "終點住宿點",
    routePoints: "路點：",
    allRoutesBadge: "全部｜2026/7/4-7/18",
    allRoutesTitle: "完整環島路線",
    overviewNote: "彩色線條為各日可騎乘路線。選擇任一天可查看單日高亮路線與下載 GPX。",
    restStopsTitle: "每 10km 左右休息點：",
    noRestStops: "此日尚未找到符合每 10km 左右的便利商店休息點。",
    loadFailedSummary: "路線資料載入失敗。",
    loadFailedBadge: "載入失敗",
    loadFailedTitle: "無法載入路線資料",
    pdfLabel: "PDF",
    networkLabel: "道路網",
  },
  en: {
    htmlLang: "en",
    documentTitle: "2026 Iron Camel Taiwan Route｜Network GPX",
    brandEyebrow: "2026 Iron Camel",
    appTitle: "Taiwan Route Map",
    languageLabel: "Language",
    languageSwitchLabel: "Language switcher",
    daySelectLabel: "Daily route",
    daySelectAria: "Choose a daily route",
    previousDay: "Previous",
    nextDay: "Next",
    showAllRoutes: "Show all routes",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    locateMe: "Show current location",
    locating: "Locating...",
    currentLocation: "Current location",
    locationAccuracy: "Accuracy",
    locationUnavailable: "Unable to get your current location. Check browser location permission.",
    downloadGpx: "Download GPX",
    legendLabel: "Map legend",
    legendRide: "Daily route",
    legendNonRide: "Non-riding day",
    legendStart: "Start",
    legendFinish: "Finish",
    legendRest: "10 km rest stop",
    changelogButton: "Change Log",
    changelogTitle: "Change Log",
    changelogIntro: "Recent updates:",
    changelogClose: "Close",
    mapLabel: "Route map",
    lecture: "Safety briefing",
    restDay: "Rest day",
    startMarker: "Start",
    finishMarker: "Finish",
    finishDistance: "Finish distance",
    estimatedDistance: "Estimated distance",
    waypointMarker: "Waypoint",
    rightSide: "same side",
    onRoute: "on route",
    oppositeSide: "opposite side",
    actual: "Actual",
    store: "Store",
    address: "Address",
    lunchStop: "Lunch stop",
    lunchDistance: "Distance before lunch",
    endAccommodation: "Overnight stop",
    routePoints: "Waypoints:",
    allRoutesBadge: "All｜2026/7/4-7/18",
    allRoutesTitle: "Full Taiwan Route",
    overviewNote: "Colored lines show each riding day. Select a day to highlight one route and download its GPX.",
    restStopsTitle: "Rest stops around every 10 km:",
    noRestStops: "No convenience-store rest stops were found for this day around every 10 km.",
    loadFailedSummary: "Route data failed to load.",
    loadFailedBadge: "Load failed",
    loadFailedTitle: "Unable to load route data",
    pdfLabel: "PDF",
    networkLabel: "Network",
  },
  ja: {
    htmlLang: "ja",
    documentTitle: "2026 アイアンキャメル台湾一周ルート｜道路網 GPX",
    brandEyebrow: "2026 アイアンキャメル",
    appTitle: "台湾一周ルートマップ",
    languageLabel: "言語",
    languageSwitchLabel: "言語切替",
    daySelectLabel: "毎日のルート",
    daySelectAria: "毎日のルートを選択",
    previousDay: "前日",
    nextDay: "翌日",
    showAllRoutes: "全ルートを表示",
    collapseSidebar: "サイドバーを閉じる",
    expandSidebar: "サイドバーを開く",
    locateMe: "現在地を表示",
    locating: "測位中...",
    currentLocation: "現在地",
    locationAccuracy: "測位精度",
    locationUnavailable: "現在地を取得できません。ブラウザの位置情報権限を確認してください。",
    downloadGpx: "GPXをダウンロード",
    legendLabel: "地図凡例",
    legendRide: "日別ルート",
    legendNonRide: "走行なし",
    legendStart: "出発地",
    legendFinish: "到着地",
    legendRest: "10km 休憩地点",
    changelogButton: "更新履歴",
    changelogTitle: "更新履歴",
    changelogIntro: "最近の更新：",
    changelogClose: "閉じる",
    mapLabel: "ルート地図",
    lecture: "安全講習",
    restDay: "休息日",
    startMarker: "出発地",
    finishMarker: "到着地",
    finishDistance: "到着距離",
    estimatedDistance: "推定距離",
    waypointMarker: "経由地",
    rightSide: "順方向側",
    onRoute: "ルート沿い",
    oppositeSide: "反対側",
    actual: "実際",
    store: "店舗名",
    address: "住所",
    lunchStop: "昼食休憩地点",
    lunchDistance: "昼食前の距離",
    endAccommodation: "宿泊地",
    routePoints: "経由地：",
    allRoutesBadge: "全体｜2026/7/4-7/18",
    allRoutesTitle: "台湾一周フルルート",
    overviewNote: "色付きの線は各走行日のルートです。日付を選ぶと単日のルートを強調表示し、GPXをダウンロードできます。",
    restStopsTitle: "約10kmごとの休憩地点：",
    noRestStops: "この日は約10kmごとの条件に合うコンビニ休憩地点が見つかっていません。",
    loadFailedSummary: "ルートデータの読み込みに失敗しました。",
    loadFailedBadge: "読み込み失敗",
    loadFailedTitle: "ルートデータを読み込めません",
    pdfLabel: "PDF",
    networkLabel: "道路網",
  },
};

interface ChangelogEntry {
  date: string;
  title: string;
  detail: string;
}

const changelogEntries: Record<Language, ChangelogEntry[]> = {
  zh: [
    {
      date: "2026-07-03",
      title: "手機側邊欄操作",
      detail: "新增側邊欄收合，手機折疊狀態可從地圖右上角按鈕展開。",
    },
    {
      date: "2026-07-03",
      title: "路線與休息點資料",
      detail: "更新人工確認路線、每日住宿終點與每 10km 左右便利商店資訊。",
    },
    {
      date: "2026-07-03",
      title: "定位與日期切換",
      detail: "支援顯示目前位置，並可依騎乘日期自動切換當日路線。",
    },
  ],
  en: [
    {
      date: "2026-07-03",
      title: "Mobile sidebar controls",
      detail: "Added collapsible sidebar support with a map button in the upper-right corner on mobile.",
    },
    {
      date: "2026-07-03",
      title: "Route and rest-stop data",
      detail: "Updated reviewed routes, overnight finishes, and convenience-store stops around every 10 km.",
    },
    {
      date: "2026-07-03",
      title: "Location and date switching",
      detail: "Added current-location display and automatic route switching by riding date.",
    },
  ],
  ja: [
    {
      date: "2026-07-03",
      title: "モバイルのサイドバー操作",
      detail: "サイドバーの折りたたみに対応し、モバイルでは地図右上のボタンから開けるようにしました。",
    },
    {
      date: "2026-07-03",
      title: "ルートと休憩地点データ",
      detail: "確認済みルート、宿泊地の到着地点、約10kmごとのコンビニ休憩地点を更新しました。",
    },
    {
      date: "2026-07-03",
      title: "現在地と日付切替",
      detail: "現在地表示と、走行日に応じたルート自動切替に対応しました。",
    },
  ],
};

interface AppState {
  routes: RouteDay[];
  map: Leaflet.Map | null;
  layer: Leaflet.LayerGroup | null;
  locationLayer: Leaflet.LayerGroup | null;
  markerElements: Map<string, HTMLElement>;
  markerInstances: Map<string, Leaflet.Marker>;
  pinnedMarkerId: string | null;
  followDateRoute: boolean;
  sidebarCollapsed: boolean;
  currentIndex: number;
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
  locationLayer: null,
  markerElements: new Map(),
  markerInstances: new Map(),
  pinnedMarkerId: null,
  followDateRoute: false,
  sidebarCollapsed: false,
  currentIndex: 0,
  language: "zh",
};

const elements = {
  app: requiredElement(".app", HTMLElement),
  brandEyebrow: requiredElement("#brandEyebrow", HTMLParagraphElement),
  appTitle: requiredElement("#appTitle", HTMLHeadingElement),
  languageLabel: requiredElement("#languageLabel", HTMLLabelElement),
  languageSwitch: requiredElement("#languageSwitch", HTMLSelectElement),
  daySelectLabel: requiredElement("#daySelectLabel", HTMLLabelElement),
  daySelect: requiredElement("#daySelect", HTMLSelectElement),
  prevButton: requiredElement("#prevBtn", HTMLButtonElement),
  nextButton: requiredElement("#nextBtn", HTMLButtonElement),
  allButton: requiredElement("#allBtn", HTMLButtonElement),
  sidebarToggleButton: requiredElement("#sidebarToggleBtn", HTMLButtonElement),
  mapSidebarToggleButton: requiredElement("#mapSidebarToggleBtn", HTMLButtonElement),
  locationButton: requiredElement("#locationBtn", HTMLButtonElement),
  gpxLink: requiredElement("#gpxLink", HTMLAnchorElement),
  legend: requiredElement(".legend", HTMLDivElement),
  legendRide: requiredElement("#legendRide", HTMLSpanElement),
  legendNonRide: requiredElement("#legendNonRide", HTMLSpanElement),
  legendStart: requiredElement("#legendStart", HTMLSpanElement),
  legendFinish: requiredElement("#legendFinish", HTMLSpanElement),
  legendRest: requiredElement("#legendRest", HTMLSpanElement),
  changelogButton: requiredElement("#changelogBtn", HTMLButtonElement),
  changelogDialog: requiredElement("#changelogDialog", HTMLDialogElement),
  changelogTitle: requiredElement("#changelogTitle", HTMLHeadingElement),
  changelogIntro: requiredElement("#changelogIntro", HTMLParagraphElement),
  changelogList: requiredElement("#changelogList", HTMLOListElement),
  changelogCloseButton: requiredElement("#changelogCloseBtn", HTMLButtonElement),
  mapStage: requiredElement(".map-stage", HTMLElement),
  info: requiredElement("#info", HTMLElement),
};

function t(key: keyof Translation): string {
  return translations[state.language][key];
}

function routeText(value: string): string {
  return localizedRouteText(value, state.language);
}

function weekdayText(value: string): string {
  return localizedWeekday(value, state.language);
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

function initialSidebarCollapsed(): boolean {
  return window.localStorage.getItem("route-sidebar-collapsed") === "true";
}

function scheduleMapResize(): void {
  window.setTimeout(() => {
    state.map?.invalidateSize();
  }, 240);
}

function setSidebarCollapsed(collapsed: boolean, options = { persist: true }): void {
  state.sidebarCollapsed = collapsed;
  elements.app.classList.toggle("sidebar-collapsed", collapsed);
  elements.sidebarToggleButton.setAttribute("aria-expanded", String(!collapsed));
  elements.mapSidebarToggleButton.setAttribute("aria-expanded", String(!collapsed));
  if (options.persist) {
    window.localStorage.setItem("route-sidebar-collapsed", String(collapsed));
  }
  updateStaticText();
  scheduleMapResize();
}

function updateStaticText(): void {
  const copy = translations[state.language];
  document.documentElement.lang = copy.htmlLang;
  document.title = copy.documentTitle;
  elements.brandEyebrow.textContent = copy.brandEyebrow;
  elements.appTitle.textContent = copy.appTitle;
  elements.languageLabel.textContent = copy.languageLabel;
  elements.languageSwitch.setAttribute("aria-label", copy.languageSwitchLabel);
  elements.languageSwitch.value = state.language;
  elements.daySelectLabel.textContent = copy.daySelectLabel;
  elements.daySelect.setAttribute("aria-label", copy.daySelectAria);
  elements.prevButton.textContent = copy.previousDay;
  elements.nextButton.textContent = copy.nextDay;
  elements.allButton.textContent = copy.showAllRoutes;
  const sidebarToggleLabel = state.sidebarCollapsed ? copy.expandSidebar : copy.collapseSidebar;
  elements.sidebarToggleButton.setAttribute("aria-label", sidebarToggleLabel);
  elements.mapSidebarToggleButton.setAttribute("aria-label", sidebarToggleLabel);
  elements.locationButton.textContent = copy.locateMe;
  elements.gpxLink.textContent = copy.downloadGpx;
  elements.legend.setAttribute("aria-label", copy.legendLabel);
  elements.legendRide.textContent = copy.legendRide;
  elements.legendNonRide.textContent = copy.legendNonRide;
  elements.legendStart.textContent = copy.legendStart;
  elements.legendFinish.textContent = copy.legendFinish;
  elements.legendRest.textContent = copy.legendRest;
  elements.changelogButton.textContent = copy.changelogButton;
  elements.changelogTitle.textContent = copy.changelogTitle;
  elements.changelogIntro.textContent = copy.changelogIntro;
  elements.changelogCloseButton.textContent = copy.changelogClose;
  elements.changelogCloseButton.setAttribute("aria-label", copy.changelogClose);
  elements.mapStage.setAttribute("aria-label", copy.mapLabel);
  renderChangelog();
}

function setLanguage(language: Language, options = { persist: true }): void {
  state.language = language;
  if (options.persist) {
    window.localStorage.setItem("route-language", language);
  }
  updateStaticText();
  updateNavigation();

  if (state.routes.length === 0) {
    return;
  }

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

function requireLocationLayer(): Leaflet.LayerGroup {
  if (!state.locationLayer) {
    throw new Error("Location layer is not initialized");
  }

  return state.locationLayer;
}

function isRideDay(day: RouteDay): day is RouteDay & { distanceKm: number } {
  return day.type === "ride" && typeof day.distanceKm === "number";
}

function isExternalRoute(day: RouteDay): boolean {
  return day.routeReview?.selectedCandidate === "external-kml";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderChangelog(): void {
  const entries = changelogEntries[state.language];
  elements.changelogList.innerHTML = entries
    .map(
      (entry) => `
        <li>
          <time datetime="${escapeHtml(entry.date)}">${escapeHtml(entry.date)}</time>
          <strong>${escapeHtml(entry.title)}</strong>
          <span>${escapeHtml(entry.detail)}</span>
        </li>
      `,
    )
    .join("");
}

function openChangelog(): void {
  if (elements.changelogDialog.open) {
    return;
  }
  elements.changelogDialog.showModal();
}

function closeChangelog(): void {
  elements.changelogDialog.close();
}

function dayCode(day: RouteDay): string {
  return day.day === 0 ? "D0" : `D${day.day}`;
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function routeIndexForDate(date: string): number {
  return state.routes.findIndex((route) => route.date === date);
}

function replaceUrl(url: URL): void {
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function updateRouteDayQuery(day: RouteDay): void {
  const url = new URL(window.location.href);
  url.searchParams.set("day", String(day.day));
  replaceUrl(url);
}

function clearRouteDayQuery(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("day");
  replaceUrl(url);
}

function routeStyle(index: number, selected = false): Leaflet.PathOptions {
  return {
    color: selected ? "#38bdf8" : colors[index % colors.length],
    weight: selected ? 6 : 4,
    opacity: selected ? 0.92 : 0.82,
  };
}

function routeCoordinateSegments(day: RouteDay): Leaflet.LatLngExpression[][] {
  if (!day.geojson) {
    return [];
  }

  const lineStrings = day.geojson.type === "LineString" ? [day.geojson.coordinates] : day.geojson.coordinates;
  return lineStrings.map((coordinates) => coordinates.map(([lon, lat]) => [lat, lon]));
}

function routeCoordinates(day: RouteDay): Leaflet.LatLngExpression[] {
  return routeCoordinateSegments(day).flat();
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

function markerIdForWaypoint(index: number): string {
  return `waypoint:${index}`;
}

function markerIdForStore(store: ConvenienceStore): string {
  return `store:${store.targetKm}:${store.id}`;
}

function registerMarker(markerId: string, marker: Leaflet.Marker): void {
  state.markerInstances.set(markerId, marker);
  const element = marker.getElement();
  if (element) {
    state.markerElements.set(markerId, element);
  }
}

function highlightMarker(markerId: string | null): void {
  for (const [id, element] of state.markerElements) {
    element.classList.toggle("is-highlighted", Boolean(markerId) && id === markerId);
  }
  for (const element of elements.info.querySelectorAll<HTMLElement>("[data-marker-id]")) {
    const isActive = Boolean(markerId) && element.dataset.markerId === markerId;
    element.classList.toggle("is-active", isActive);
    element.setAttribute("aria-pressed", String(isActive));
  }
}

function openMarkerPopup(markerId: string | null): void {
  if (!markerId) {
    return;
  }

  const marker = state.markerInstances.get(markerId);
  if (marker) {
    marker.openPopup();
  }
}

function closeMarkerPopup(): void {
  requireMap().closePopup();
}

function togglePinnedMarker(markerId: string | null): void {
  state.pinnedMarkerId = state.pinnedMarkerId === markerId ? null : markerId;
  highlightMarker(state.pinnedMarkerId);
  if (state.pinnedMarkerId) {
    openMarkerPopup(state.pinnedMarkerId);
    return;
  }

  closeMarkerPopup();
}

function sidebarMarkerTarget(eventTarget: EventTarget | null): HTMLElement | null {
  const target = eventTarget instanceof HTMLElement ? eventTarget.closest<HTMLElement>("[data-marker-id]") : null;
  return target && elements.info.contains(target) ? target : null;
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

function currentLocationIcon(): Leaflet.DivIcon {
  return L.divIcon({
    className: "current-location-marker",
    html: "<span></span>",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
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
  state.locationLayer = L.layerGroup().addTo(state.map);
}

function clearMap(): void {
  requireLayer().clearLayers();
  state.markerElements.clear();
  state.markerInstances.clear();
  state.pinnedMarkerId = null;
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
  if (isExternalRoute(day)) {
    return externalRouteDistance(day);
  }

  return `${day.distanceKm.toFixed(1)} km`;
}

function externalRouteDistance(day: RouteDay): string {
  return typeof day.generatedDistanceKm === "number"
    ? `${t("estimatedDistance")} ${day.generatedDistanceKm.toFixed(1)} km`
    : "";
}

function finishDistanceMarkup(day: RouteDay): string | null {
  if (!isRideDay(day)) {
    return null;
  }

  if (isExternalRoute(day)) {
    const distance = externalRouteDistance(day);
    return distance ? escapeHtml(distance) : null;
  }

  const distanceParts = [
    `${t("pdfLabel")} ${day.distanceKm.toFixed(1)} km`,
    typeof day.generatedDistanceKm === "number" ? `${t("networkLabel")} ${day.generatedDistanceKm.toFixed(1)} km` : null,
  ].filter((part): part is string => Boolean(part));

  return `${escapeHtml(t("finishDistance"))}：${distanceParts.map(escapeHtml).join(" / ")}`;
}

function waypointPopupMarkup(day: RouteDay, waypoint: Waypoint, type: WaypointMarkerType): string {
  const distanceLine = type === "finish" ? finishDistanceMarkup(day) : null;
  return [
    `<b>${markerLabel(type)}｜${escapeHtml(routeText(waypoint.name))}</b>`,
    `${dayCode(day)}｜${escapeHtml(routeText(day.title))}`,
    distanceLine,
  ].filter((line): line is string => Boolean(line)).join("<br>");
}

function routePopupText(day: RouteDay): string {
  return [dayCode(day), escapeHtml(routeText(day.title)), formatDistance(day)].filter(Boolean).join("｜");
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

function renderDayOptions(): void {
  elements.daySelect.innerHTML = "";

  state.routes.forEach((day, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = [dayCode(day), routeText(day.title)].filter(Boolean).join("｜");
    elements.daySelect.append(option);
  });
}

function renderInfo(day: RouteDay | null): void {
  if (!day) {
    elements.info.innerHTML = `
      <div class="top">
        <div>
          <span class="badge">${escapeHtml(t("allRoutesBadge"))}</span>
          <h2>${escapeHtml(t("allRoutesTitle"))}</h2>
        </div>
      </div>
      <p class="note">${escapeHtml(t("overviewNote"))}</p>
    `;
    return;
  }

  const routeParts = day.description
    .split("→")
    .map((part) => part.trim())
    .filter(Boolean);
  const waypoints = day.waypoints
    .map(
      (point, index) =>
        `<span class="pill landmark-item" data-marker-id="${escapeHtml(markerIdForWaypoint(index))}" role="button" tabindex="0" aria-pressed="false">${escapeHtml(routeText(point.name))}</span>`,
    )
    .join("");
  const distanceLine = isRideDay(day)
    ? isExternalRoute(day)
      ? escapeHtml(externalRouteDistance(day))
      : `${escapeHtml(t("pdfLabel"))} ${day.distanceKm.toFixed(1)} km<br>${escapeHtml(t("networkLabel"))} ${(day.generatedDistanceKm ?? 0).toFixed(1)} km`
    : formatDistance(day);
  const distanceBlock = distanceLine ? `<div class="km">${distanceLine}</div>` : "";
  const lunchParts = [
    day.lunchStop ? `${t("lunchStop")}：${routeText(day.lunchStop)}` : null,
    typeof day.lunchDistanceKm === "number" ? `${t("lunchDistance")}：${day.lunchDistanceKm.toFixed(1)} km` : null,
    day.endAccommodation ? `${t("endAccommodation")}：${routeText(day.endAccommodation)}` : null,
  ].filter((part): part is string => Boolean(part));
  const lunchBlock = lunchParts.length > 0
    ? `<p class="note">${lunchParts.map(escapeHtml).join("<br>")}</p>`
    : "";
  const restStops = day.convenienceStores ?? [];
  const storeItems = restStops
    .map(
      (store) =>
        `<li class="store-item" data-marker-id="${escapeHtml(markerIdForStore(store))}" tabindex="0" aria-pressed="false">${storeDetailMarkup(store)}</li>`,
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
        <span class="badge">${dayCode(day)}｜${escapeHtml(day.date)}（${escapeHtml(weekdayText(day.weekday))}）</span>
        <h2>${escapeHtml(routeText(day.title))}</h2>
      </div>
      ${distanceBlock}
    </div>
    <ul>${routeParts.map((part) => `<li>${escapeHtml(routeText(part))}</li>`).join("")}</ul>
    ${lunchBlock}
    ${waypoints ? `<p class="note">${escapeHtml(t("routePoints"))}</p><div>${waypoints}</div>` : ""}
    ${storeBlock}
    <p class="note">${escapeHtml(routeParts.map(routeText).join("→"))}</p>
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
}

function drawCurrentLocation(position: GeolocationPosition): void {
  const location: Leaflet.LatLngExpression = [
    position.coords.latitude,
    position.coords.longitude,
  ];
  const accuracy = Math.max(0, Math.round(position.coords.accuracy));
  const locationLayer = requireLocationLayer();
  locationLayer.clearLayers();

  L.circle(location, {
    radius: accuracy,
    color: "#2563eb",
    fillColor: "#60a5fa",
    fillOpacity: 0.14,
    weight: 2,
  }).addTo(locationLayer);

  L.marker(location, { icon: currentLocationIcon() })
    .addTo(locationLayer)
    .bindPopup(`<b>${escapeHtml(t("currentLocation"))}</b><br>${escapeHtml(t("locationAccuracy"))} ${accuracy}m`)
    .openPopup();

  requireMap().setView(location, Math.max(requireMap().getZoom(), 15));
}

function showCurrentLocation(): void {
  if (!navigator.geolocation) {
    window.alert(t("locationUnavailable"));
    return;
  }

  elements.locationButton.disabled = true;
  elements.locationButton.textContent = t("locating");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      drawCurrentLocation(position);
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = t("locateMe");
    },
    () => {
      window.alert(t("locationUnavailable"));
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = t("locateMe");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 10_000,
    },
  );
}

function drawMarkers(day: RouteDay, positions: Leaflet.LatLngExpression[]): void {
  day.waypoints.forEach((waypoint, index) => {
    const type = markerTypeForWaypoint(index, day.waypoints.length);
    const position = waypointPosition(waypoint);
    positions.push(position);
    const marker = L.marker(position, { icon: pointIcon(type) })
      .addTo(requireLayer())
      .bindPopup(waypointPopupMarkup(day, waypoint, type));
    registerMarker(markerIdForWaypoint(index), marker);
  });
}

function drawConvenienceStores(day: RouteDay, positions: Leaflet.LatLngExpression[]): void {
  for (const store of day.convenienceStores ?? []) {
    const position: Leaflet.LatLngExpression = [store.lat, store.lon];
    positions.push(position);
    const marker = L.marker(position, { icon: storeIcon() })
      .addTo(requireLayer())
      .bindPopup(
        `<div class="store-popup">${storeDetailMarkup(store)}</div>`,
      );
    registerMarker(markerIdForStore(store), marker);
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
  const routeSegments = routeCoordinateSegments(day);
  for (const coordinates of routeSegments) {
    if (coordinates.length > 1) {
      L.polyline(coordinates, routeStyle(state.currentIndex, true))
        .addTo(requireLayer())
        .bindPopup(routePopupText(day));
      bounds.push(...coordinates);
    }
  }

  drawMarkers(day, bounds);
  drawConvenienceStores(day, bounds);
  fitPositions(bounds);
}

function drawManualDay(index: number): void {
  state.followDateRoute = false;
  drawDay(index);
  const day = state.routes[state.currentIndex];
  if (day) {
    updateRouteDayQuery(day);
  }
}

function drawOverview(): void {
  clearMap();
  renderInfo(null);
  updateGpxLink(null);
  updateNavigation();

  const bounds: Leaflet.LatLngExpression[] = [];
  state.routes.forEach((day, index) => {
    const routeSegments = routeCoordinateSegments(day);
    for (const coordinates of routeSegments) {
      if (coordinates.length <= 1) {
        continue;
      }

      L.polyline(coordinates, routeStyle(index))
        .addTo(requireLayer())
        .bindPopup(routePopupText(day));
      bounds.push(...coordinates);
    }
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

  state.followDateRoute = true;
  const currentDateIndex = routeIndexForDate(localDateString());
  if (currentDateIndex >= 0) {
    return currentDateIndex;
  }

  const firstRideIndex = state.routes.findIndex(isRideDay);
  return firstRideIndex >= 0 ? firstRideIndex : 0;
}

function startDateRouteWatcher(): void {
  let lastDate = localDateString();
  window.setInterval(() => {
    const currentDate = localDateString();
    if (currentDate === lastDate) {
      return;
    }

    lastDate = currentDate;
    if (!state.followDateRoute) {
      return;
    }

    const currentDateIndex = routeIndexForDate(currentDate);
    if (currentDateIndex >= 0) {
      drawDay(currentDateIndex);
    }
  }, 60_000);
}

async function main(): Promise<void> {
  initMap();
  setLanguage(initialLanguage(), { persist: false });
  setSidebarCollapsed(initialSidebarCollapsed(), { persist: false });

  try {
    await loadRoutes();
    renderDayOptions();

    elements.languageSwitch.addEventListener("change", () => {
      const nextLanguage = elements.languageSwitch.value;
      if (isLanguage(nextLanguage)) {
        setLanguage(nextLanguage);
      }
    });
    elements.daySelect.addEventListener("change", () => drawManualDay(Number(elements.daySelect.value)));
    elements.prevButton.addEventListener("click", () => drawManualDay(state.currentIndex - 1));
    elements.nextButton.addEventListener("click", () => drawManualDay(state.currentIndex + 1));
    elements.sidebarToggleButton.addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));
    elements.mapSidebarToggleButton.addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));
    elements.changelogButton.addEventListener("click", openChangelog);
    elements.changelogCloseButton.addEventListener("click", closeChangelog);
    elements.changelogDialog.addEventListener("click", (event) => {
      if (event.target === elements.changelogDialog) {
        closeChangelog();
      }
    });
    elements.allButton.addEventListener("click", () => {
      state.followDateRoute = false;
      clearRouteDayQuery();
      drawOverview();
    });
    elements.locationButton.addEventListener("click", showCurrentLocation);
    elements.info.addEventListener("pointerover", (event) => {
      const target = sidebarMarkerTarget(event.target);
      if (target) {
        highlightMarker(target.dataset.markerId ?? null);
        openMarkerPopup(target.dataset.markerId ?? null);
      }
    });
    elements.info.addEventListener("pointerout", (event) => {
      const target = sidebarMarkerTarget(event.target);
      const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (target && (!relatedTarget || !target.contains(relatedTarget))) {
        highlightMarker(state.pinnedMarkerId);
        if (state.pinnedMarkerId) {
          openMarkerPopup(state.pinnedMarkerId);
        } else {
          closeMarkerPopup();
        }
      }
    });
    elements.info.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("a")) {
        return;
      }
      const target = sidebarMarkerTarget(event.target);
      if (target) {
        togglePinnedMarker(target.dataset.markerId ?? null);
      }
    });
    elements.info.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const target = sidebarMarkerTarget(event.target);
      if (target) {
        event.preventDefault();
        togglePinnedMarker(target.dataset.markerId ?? null);
      }
    });
    drawDay(initialRouteIndex());
    startDateRouteWatcher();
  } catch (error) {
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

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error: unknown) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

main();
registerServiceWorker();
