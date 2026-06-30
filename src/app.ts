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

interface AppState {
  routes: RouteDay[];
  map: Leaflet.Map | null;
  layer: Leaflet.LayerGroup | null;
  currentIndex: number;
  showConvenienceStores: boolean;
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
};

const elements = {
  summary: requiredElement("#summary", HTMLParagraphElement),
  routeStats: requiredElement("#routeStats", HTMLDivElement),
  daySelect: requiredElement("#daySelect", HTMLSelectElement),
  prevButton: requiredElement("#prevBtn", HTMLButtonElement),
  nextButton: requiredElement("#nextBtn", HTMLButtonElement),
  allButton: requiredElement("#allBtn", HTMLButtonElement),
  poiToggleButton: requiredElement("#poiToggleBtn", HTMLButtonElement),
  gpxLink: requiredElement("#gpxLink", HTMLAnchorElement),
  info: requiredElement("#info", HTMLElement),
};

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
    return "起點";
  }
  if (type === "finish") {
    return "終點";
  }
  return "路點";
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
    return day.type === "lecture" ? "行前講習" : "休息日";
  }

  return `${day.distanceKm.toFixed(1)} km`;
}

function formatStoreSide(side: NonNullable<RouteDay["convenienceStores"]>[number]["sideOfRoute"]): string {
  if (side === "right") {
    return "順向側";
  }
  if (side === "on-route") {
    return "路線旁";
  }
  return "對向側";
}

function renderStats(): void {
  const rideDays = state.routes.filter(isRideDay);
  const totalPdfDistance = rideDays.reduce((sum, day) => sum + day.distanceKm, 0);
  const totalGeneratedDistance = rideDays.reduce((sum, day) => sum + (day.generatedDistanceKm ?? 0), 0);

  elements.summary.textContent =
    "依 PDF 路線點位整理，每日可查看道路網線段與下載 GPX，方便匯入 Garmin。";
  elements.routeStats.innerHTML = `
    <div class="stat"><b>${rideDays.length}</b><span>騎乘日</span></div>
    <div class="stat"><b>${totalPdfDistance.toFixed(1)}</b><span>PDF km</span></div>
    <div class="stat"><b>${totalGeneratedDistance.toFixed(1)}</b><span>道路網 km</span></div>
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
          <span class="badge">全部｜2026/7/4-7/18</span>
          <h2>完整環島路線</h2>
        </div>
        <div class="km">PDF ${totalPdfDistance.toFixed(1)} km<br>道路網 ${totalGeneratedDistance.toFixed(1)} km</div>
      </div>
      <p class="note">彩色線條為各日可騎乘路線。選擇任一天可查看單日高亮路線與下載 GPX。</p>
    `;
    return;
  }

  const routeParts = day.description
    .split("→")
    .map((part) => part.trim())
    .filter(Boolean);
  const waypoints = day.waypoints.map((point) => `<span class="pill">${escapeHtml(point.name)}</span>`).join("");
  const distanceLine = isRideDay(day)
    ? `PDF ${day.distanceKm.toFixed(1)} km<br>道路網 ${(day.generatedDistanceKm ?? 0).toFixed(1)} km`
    : formatDistance(day);
  const reviewNote = day.routeReview?.reviewNote ? `<p class="note">${escapeHtml(day.routeReview.reviewNote)}</p>` : "";
  const restStops = day.convenienceStores ?? [];
  const storeItems = restStops
    .map(
      (store) => `<li>
          ${store.targetKm}km｜${escapeHtml(store.name)}
          <span class="store-distance">實際 ${store.routeProgressKm.toFixed(1)}km｜${Math.round(store.distanceFromRouteM)}m｜${formatStoreSide(store.sideOfRoute)}</span>
        </li>`,
    )
    .join("");
  const storeBlock = restStops.length > 0
    ? `<p class="note">每 10km 左右休息點：</p>
      <ul class="store-list">
        ${storeItems}
      </ul>`
    : `<p class="note">此日尚未找到符合每 10km、非終點附近的便利商店休息點。</p>`;

  elements.info.innerHTML = `
    <div class="top">
      <div>
        <span class="badge">${dayCode(day)}｜${escapeHtml(day.date)}（週${escapeHtml(day.weekday)}）</span>
        <h2>${escapeHtml(day.title)}</h2>
      </div>
      <div class="km">${distanceLine}</div>
    </div>
    <ul>${routeParts.map((part) => `<li>${escapeHtml(part)}</li>`).join("")}</ul>
    ${waypoints ? `<p class="note">路點：</p><div>${waypoints}</div>` : ""}
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
  elements.poiToggleButton.textContent = state.showConvenienceStores ? "隱藏休息點" : "顯示休息點";
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
        `<b>${store.targetKm}km｜${escapeHtml(store.name)}</b><br>實際 ${store.routeProgressKm.toFixed(1)}km｜${Math.round(store.distanceFromRouteM)}m｜${formatStoreSide(store.sideOfRoute)}`,
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

  try {
    await loadRoutes();
    renderStats();
    renderDayOptions();

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
    elements.summary.textContent = "路線資料載入失敗。";
    elements.info.innerHTML = `
      <div class="top">
        <div>
          <span class="badge">載入失敗</span>
          <h2>無法載入路線資料</h2>
        </div>
      </div>
      <p class="note">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
    `;
    updateGpxLink(null);
  }
}

main();
