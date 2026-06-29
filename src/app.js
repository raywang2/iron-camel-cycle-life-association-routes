const colors = ["#1f7a5b", "#b84a32", "#315da8", "#a56b00", "#6b4ba8", "#277084"];

const state = {
  routes: [],
  map: null,
  overviewLayer: null,
  activeLayer: null,
  activeDay: null,
};

const elements = {
  summary: document.querySelector("#summary"),
  dayList: document.querySelector("#dayList"),
  overviewButton: document.querySelector("#overviewButton"),
  detailMeta: document.querySelector("#detailMeta"),
  detailTitle: document.querySelector("#detailTitle"),
  detailDistance: document.querySelector("#detailDistance"),
  detailEndpoints: document.querySelector("#detailEndpoints"),
  detailDescription: document.querySelector("#detailDescription"),
  downloadLink: document.querySelector("#downloadLink"),
  warningText: document.querySelector("#warningText"),
};

function getRideColorIndex(day) {
  const rideDays = state.routes.filter((route) => route.type === "ride");
  const index = rideDays.findIndex((route) => route.day === day.day);
  return index >= 0 ? index : 0;
}

function routeStyle(index, selected = false) {
  return {
    color: colors[index % colors.length],
    weight: selected ? 7 : 4,
    opacity: selected ? 0.98 : 0.7,
  };
}

function initMap() {
  state.map = L.map("map", {
    scrollWheelZoom: true,
    zoomControl: true,
  }).setView([23.8, 121], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);
}

function clearLayer(layerName) {
  if (state[layerName]) {
    state.map.removeLayer(state[layerName]);
    state[layerName] = null;
  }
}

function clearActiveButton() {
  document.querySelectorAll(".day-button").forEach((button) => {
    button.classList.remove("is-active");
  });
}

function renderDetail(day) {
  state.activeDay = day;

  if (!day) {
    const rideDays = state.routes.filter((route) => route.type === "ride");
    const totalDistance = rideDays.reduce((sum, route) => sum + route.distanceKm, 0);

    elements.detailMeta.textContent = "全程總覽";
    elements.detailTitle.textContent = "2026 鐵駱駝單車環島";
    elements.detailDistance.textContent = `共 ${state.routes.length} 天，${rideDays.length} 個騎乘日，總距離 ${totalDistance.toFixed(1)} km`;
    elements.detailEndpoints.textContent = "起終點依每日路線為準";
    elements.detailDescription.textContent = "點選左側任一天查看該日路線與 GPX。";
    elements.downloadLink.hidden = true;
    elements.warningText.textContent = "";
    return;
  }

  elements.detailMeta.textContent = `${day.date}（週${day.weekday}）`;
  elements.detailTitle.textContent = `${day.day === 0 ? "D0" : `D${day.day}`} ${day.title}`;
  elements.detailDistance.textContent =
    day.type === "ride"
      ? `騎乘距離 ${day.distanceKm} km，產生路線 ${day.generatedDistanceKm} km`
      : day.type === "rest"
        ? "休息日"
        : "行前講習";
  elements.detailEndpoints.textContent = `起點：${day.start}｜終點：${day.end}`;
  elements.detailDescription.textContent = day.description;
  elements.warningText.textContent = day.distanceWarning || "";

  if (day.type === "ride" && day.gpxPath) {
    elements.downloadLink.href = day.gpxPath;
    elements.downloadLink.download = `iron-camel-day-${String(day.day).padStart(2, "0")}.gpx`;
    elements.downloadLink.textContent = "下載本日 GPX";
    elements.downloadLink.hidden = false;
  } else {
    elements.downloadLink.hidden = true;
  }
}

function showOverview() {
  clearLayer("activeLayer");
  clearActiveButton();

  clearLayer("overviewLayer");
  const layers = state.routes
    .filter((day) => day.geojson)
    .map((day) => L.geoJSON(day.geojson, { style: routeStyle(getRideColorIndex(day)) }));

  state.overviewLayer = L.featureGroup(layers).addTo(state.map);
  state.map.fitBounds(state.overviewLayer.getBounds(), { padding: [24, 24] });
  renderDetail(null);
}

function selectDay(dayNumber) {
  const day = state.routes.find((route) => route.day === dayNumber);
  if (!day) {
    return;
  }

  state.activeDay = day;
  document.querySelectorAll(".day-button").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.day) === dayNumber);
  });

  clearLayer("activeLayer");
  clearLayer("overviewLayer");

  if (day.geojson) {
    state.activeLayer = L.geoJSON(day.geojson, { style: routeStyle(getRideColorIndex(day), true) }).addTo(state.map);
    state.map.fitBounds(state.activeLayer.getBounds(), { padding: [32, 32] });
  }

  renderDetail(day);
}

function renderDayList() {
  elements.dayList.innerHTML = "";

  for (const day of state.routes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-button";
    button.dataset.day = String(day.day);

    const label =
      day.type === "ride"
        ? `${day.distanceKm} km`
        : day.type === "rest"
          ? "休息日"
          : "行前講習";
    const gpxLabel = day.type === "ride" ? "可下載 GPX" : "無 GPX";

    button.innerHTML = `
      <span class="day-title">${day.day === 0 ? "D0" : `D${day.day}`} ${day.title}</span>
      <span class="day-meta">${day.date}（週${day.weekday}）· ${label} · ${gpxLabel}</span>
    `;
    button.addEventListener("click", () => selectDay(day.day));
    elements.dayList.append(button);
  }
}

async function loadRoutes() {
  const response = await fetch("data/routes.json");
  if (!response.ok) {
    throw new Error(`路線資料載入失敗：HTTP ${response.status}`);
  }

  state.routes = await response.json();
}

async function main() {
  initMap();

  try {
    await loadRoutes();

    const rideDays = state.routes.filter((day) => day.type === "ride");
    const totalDistance = rideDays.reduce((sum, day) => sum + day.distanceKm, 0);

    elements.summary.textContent = `共 ${state.routes.length} 天，${rideDays.length} 個騎乘日，總距離 ${totalDistance.toFixed(1)} km。`;
    renderDayList();
    elements.overviewButton.addEventListener("click", showOverview);
    showOverview();
  } catch (error) {
    elements.summary.textContent = "路線資料載入失敗。";
    elements.detailMeta.textContent = "載入失敗";
    elements.detailTitle.textContent = "無法載入路線資料";
    elements.detailDescription.textContent = error instanceof Error ? error.message : String(error);
    elements.detailEndpoints.textContent = "";
    elements.downloadLink.hidden = true;
  }
}

main();
