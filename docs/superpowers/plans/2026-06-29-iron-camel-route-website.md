# Iron Camel Route Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static route website that displays the 2026 Iron Camel daily cycling routes and provides Garmin-importable GPX downloads.

**Architecture:** Route inputs are curated as static JSON waypoints, then a Node.js build script pre-generates road-following route geometry and GPX files. The browser reads only static files, renders a Leaflet map, and exposes daily route selection plus GPX download links.

**Tech Stack:** Static HTML/CSS/JavaScript, Leaflet from CDN, Node.js scripts, JSON data files, GPX XML output, configurable OSRM-compatible routing endpoint during build.

## Global Constraints

- Answer and user-facing project copy should use Traditional Chinese where practical.
- The website must show an overview of the full island route.
- The website must show each riding day separately.
- Preserve the PDF route text, date, distance, start, and end for each day.
- Download one GPX per riding day.
- Mark rest / lecture days clearly and avoid fake GPX downloads for non-riding days.
- Keep route-generation inputs editable so ambiguous geocoding or routing failures can be corrected manually.
- The website itself must not call routing APIs at page load.
- Do not implement turn-by-turn navigation, user accounts, backend storage, or hosted APIs.

---

## File Structure

- Create `package.json`: npm scripts for route generation, validation, and local serving.
- Create `.gitignore`: ignore temporary files and dependency folders while keeping generated site artifacts tracked.
- Create `data/route-waypoints.json`: canonical editable route source, including PDF route text and curated waypoints.
- Create `data/routes.json`: generated website data with GeoJSON route geometry and GPX paths.
- Create `gpx/day-XX.gpx`: generated Garmin-importable tracks for riding days.
- Create `scripts/build-routes.mjs`: generates `data/routes.json`, GPX files, and distance warnings.
- Create `scripts/validate-output.mjs`: validates route JSON and GPX files.
- Create `index.html`: static app shell and Leaflet CDN loading.
- Create `src/styles.css`: responsive app styling.
- Create `src/app.js`: map setup, data loading, route list rendering, day selection, and download link behavior.

---

### Task 1: Project Scaffold And Source Route Data

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `data/route-waypoints.json`

**Interfaces:**
- Produces: `data/route-waypoints.json` as an array of day objects consumed by `scripts/build-routes.mjs`.
- Object shape:

```json
{
  "day": 1,
  "date": "2026-07-05",
  "weekday": "日",
  "type": "ride",
  "title": "台中到苗栗",
  "start": "台中",
  "end": "苗栗",
  "distanceKm": 53.4,
  "description": "臺中→崇德路→豐原→豐原大道→豐科路→后里→后科路→台13→三義→銅鑼→山線鐵路自行車道→苗28→貓貍山公園→公園路→苗栗",
  "waypoints": [
    { "name": "國立臺灣體育運動大學", "lat": 24.1498, "lon": 120.6867 },
    { "name": "苗栗車站", "lat": 24.5700, "lon": 120.8227 }
  ]
}
```

- Non-riding days use `"type": "lecture"` or `"type": "rest"` and an empty `waypoints` array.

- [ ] **Step 1: Create package scripts**

Create `package.json`:

```json
{
  "name": "2026-iron-camel-routes",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build:routes": "node scripts/build-routes.mjs",
    "validate": "node scripts/validate-output.mjs",
    "serve": "python3 -m http.server 8080"
  }
}
```

- [ ] **Step 2: Create ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
tmp/
.DS_Store
```

- [ ] **Step 3: Create complete route source data**

Create `data/route-waypoints.json` with this complete JSON:

```json
[
  {
    "day": 0,
    "date": "2026-07-04",
    "weekday": "六",
    "type": "lecture",
    "title": "報到與行前安全講習",
    "start": "國立臺灣體育運動大學",
    "end": "國立臺灣體育運動大學",
    "distanceKm": null,
    "description": "報到！行前安全講習 車友相見大會師",
    "waypoints": []
  },
  {
    "day": 1,
    "date": "2026-07-05",
    "weekday": "日",
    "type": "ride",
    "title": "台中到苗栗",
    "start": "台中",
    "end": "苗栗",
    "distanceKm": 53.4,
    "description": "臺中→崇德路→豐原→豐原大道→豐科路→后里→后科路→台13→三義→銅鑼→山線鐵路自行車道→苗28→貓貍山公園→公園路→苗栗",
    "waypoints": [
      { "name": "國立臺灣體育運動大學", "lat": 24.1498, "lon": 120.6867 },
      { "name": "豐原車站", "lat": 24.2541, "lon": 120.7234 },
      { "name": "后里車站", "lat": 24.3094, "lon": 120.7329 },
      { "name": "三義車站", "lat": 24.4205, "lon": 120.7739 },
      { "name": "銅鑼車站", "lat": 24.4863, "lon": 120.7869 },
      { "name": "貓貍山公園", "lat": 24.5638, "lon": 120.8208 },
      { "name": "苗栗車站", "lat": 24.5700, "lon": 120.8227 }
    ]
  },
  {
    "day": 2,
    "date": "2026-07-06",
    "weekday": "一",
    "type": "ride",
    "title": "苗栗到新竹",
    "start": "苗栗",
    "end": "新竹",
    "distanceKm": 62.1,
    "description": "苗栗→台13→竹南→苗栗濱海自行車道→南寮→南寮-頭前溪自行車道→新竹",
    "waypoints": [
      { "name": "苗栗車站", "lat": 24.5700, "lon": 120.8227 },
      { "name": "竹南車站", "lat": 24.6866, "lon": 120.8806 },
      { "name": "苗栗濱海自行車道", "lat": 24.7083, "lon": 120.7801 },
      { "name": "南寮漁港", "lat": 24.8490, "lon": 120.9296 },
      { "name": "新竹車站", "lat": 24.8016, "lon": 120.9717 }
    ]
  },
  {
    "day": 3,
    "date": "2026-07-07",
    "weekday": "二",
    "type": "ride",
    "title": "新竹到新店",
    "start": "新竹",
    "end": "新店",
    "distanceKm": 94.6,
    "description": "新竹→台1→竹北→縣118→新埔→台3→龍潭→台3乙→石門水庫→台4→大溪→A4 大鶯綠野景觀自行車道→鶯歌→大漢溪左岸自行車道→新莊→新月橋→板橋→大漢溪左岸自行車道→華江橋自行車便道→萬華→新店溪右岸自行車道→景美→景美溪河濱自行車道→寶僑→新店",
    "waypoints": [
      { "name": "新竹車站", "lat": 24.8016, "lon": 120.9717 },
      { "name": "竹北車站", "lat": 24.8390, "lon": 121.0091 },
      { "name": "新埔老街", "lat": 24.8282, "lon": 121.0778 },
      { "name": "龍潭", "lat": 24.8644, "lon": 121.2163 },
      { "name": "石門水庫", "lat": 24.8138, "lon": 121.2446 },
      { "name": "大溪老街", "lat": 24.8848, "lon": 121.2889 },
      { "name": "鶯歌車站", "lat": 24.9545, "lon": 121.3551 },
      { "name": "新月橋", "lat": 25.0332, "lon": 121.4525 },
      { "name": "板橋車站", "lat": 25.0143, "lon": 121.4639 },
      { "name": "華江橋", "lat": 25.0334, "lon": 121.4896 },
      { "name": "景美", "lat": 24.9921, "lon": 121.5411 },
      { "name": "新店捷運站", "lat": 24.9675, "lon": 121.5417 }
    ]
  },
  {
    "day": 4,
    "date": "2026-07-08",
    "weekday": "三",
    "type": "ride",
    "title": "新店到羅東",
    "start": "新店",
    "end": "羅東",
    "distanceKm": 51.7,
    "description": "新店→台9→坪林→頭城→礁溪→台9→宜蘭→羅東",
    "waypoints": [
      { "name": "新店捷運站", "lat": 24.9675, "lon": 121.5417 },
      { "name": "坪林", "lat": 24.9360, "lon": 121.7110 },
      { "name": "頭城車站", "lat": 24.8580, "lon": 121.8230 },
      { "name": "礁溪車站", "lat": 24.8273, "lon": 121.7750 },
      { "name": "宜蘭車站", "lat": 24.7548, "lon": 121.7580 },
      { "name": "羅東車站", "lat": 24.6779, "lon": 121.7746 }
    ]
  },
  {
    "day": 5,
    "date": "2026-07-09",
    "weekday": "四",
    "type": "ride",
    "title": "新城到花蓮",
    "start": "新城",
    "end": "花蓮",
    "distanceKm": 33.7,
    "description": "羅東==== 新城車站→台8→太魯閣遊客中心→台8→新城→台9→縣道193→七星潭→台9→花蓮",
    "waypoints": [
      { "name": "新城車站", "lat": 24.1270, "lon": 121.6404 },
      { "name": "太魯閣遊客中心", "lat": 24.1588, "lon": 121.6211 },
      { "name": "新城", "lat": 24.1282, "lon": 121.6510 },
      { "name": "七星潭", "lat": 24.0285, "lon": 121.6276 },
      { "name": "花蓮車站", "lat": 23.9927, "lon": 121.6015 }
    ]
  },
  {
    "day": 6,
    "date": "2026-07-10",
    "weekday": "五",
    "type": "rest",
    "title": "花蓮休息日",
    "start": "花蓮",
    "end": "花蓮",
    "distanceKm": null,
    "description": "休息一天 自由行",
    "waypoints": []
  },
  {
    "day": 7,
    "date": "2026-07-11",
    "weekday": "六",
    "type": "ride",
    "title": "花蓮到玉里",
    "start": "花蓮",
    "end": "玉里",
    "distanceKm": 83.3,
    "description": "花蓮市→台9→吉安→壽豐→鳳林→萬榮→光復→瑞穗→台9→玉里",
    "waypoints": [
      { "name": "花蓮車站", "lat": 23.9927, "lon": 121.6015 },
      { "name": "吉安車站", "lat": 23.9701, "lon": 121.5823 },
      { "name": "壽豐車站", "lat": 23.8703, "lon": 121.5106 },
      { "name": "鳳林車站", "lat": 23.7475, "lon": 121.4489 },
      { "name": "光復車站", "lat": 23.6663, "lon": 121.4211 },
      { "name": "瑞穗車站", "lat": 23.4976, "lon": 121.3761 },
      { "name": "玉里車站", "lat": 23.3320, "lon": 121.3157 }
    ]
  },
  {
    "day": 8,
    "date": "2026-07-12",
    "weekday": "日",
    "type": "ride",
    "title": "玉里到台東",
    "start": "玉里",
    "end": "台東",
    "distanceKm": 81.5,
    "description": "玉里→台9→富里→池上→關山→鹿野→卑南→台9→台東",
    "waypoints": [
      { "name": "玉里車站", "lat": 23.3320, "lon": 121.3157 },
      { "name": "富里車站", "lat": 23.1790, "lon": 121.2490 },
      { "name": "池上車站", "lat": 23.1246, "lon": 121.2195 },
      { "name": "關山車站", "lat": 23.0476, "lon": 121.1646 },
      { "name": "鹿野車站", "lat": 22.9128, "lon": 121.1374 },
      { "name": "卑南", "lat": 22.7938, "lon": 121.0927 },
      { "name": "台東車站", "lat": 22.7939, "lon": 121.1233 }
    ]
  },
  {
    "day": 9,
    "date": "2026-07-13",
    "weekday": "一",
    "type": "ride",
    "title": "台東到恆春",
    "start": "台東",
    "end": "恆春",
    "distanceKm": 121,
    "description": "台東→台11→知本→美和→台9→太麻里→大武→南迴公路→壽卡→縣199→東源→牡丹→車城→統埔→山腳路→保力→台26→恆春",
    "waypoints": [
      { "name": "台東車站", "lat": 22.7939, "lon": 121.1233 },
      { "name": "知本車站", "lat": 22.7067, "lon": 121.0591 },
      { "name": "太麻里車站", "lat": 22.6104, "lon": 121.0059 },
      { "name": "大武車站", "lat": 22.3652, "lon": 120.9028 },
      { "name": "壽卡", "lat": 22.2537, "lon": 120.8177 },
      { "name": "東源", "lat": 22.1990, "lon": 120.8494 },
      { "name": "牡丹", "lat": 22.1268, "lon": 120.8586 },
      { "name": "車城", "lat": 22.0709, "lon": 120.7148 },
      { "name": "恆春轉運站", "lat": 22.0041, "lon": 120.7443 }
    ]
  },
  {
    "day": 10,
    "date": "2026-07-14",
    "weekday": "二",
    "type": "rest",
    "title": "恆春休息日",
    "start": "恆春",
    "end": "恆春",
    "distanceKm": null,
    "description": "休息一天 自由行",
    "waypoints": []
  },
  {
    "day": 11,
    "date": "2026-07-15",
    "weekday": "三",
    "type": "ride",
    "title": "恆春到高雄左營",
    "start": "恆春",
    "end": "高雄左營",
    "distanceKm": 103,
    "description": "恆春→台26→楓港→台1→枋寮→台17→東港→林園→小港→前鎮→台17→高雄左營",
    "waypoints": [
      { "name": "恆春轉運站", "lat": 22.0041, "lon": 120.7443 },
      { "name": "楓港", "lat": 22.1922, "lon": 120.6871 },
      { "name": "枋寮車站", "lat": 22.3671, "lon": 120.5946 },
      { "name": "東港", "lat": 22.4673, "lon": 120.4491 },
      { "name": "林園", "lat": 22.5043, "lon": 120.3947 },
      { "name": "小港", "lat": 22.5650, "lon": 120.3530 },
      { "name": "前鎮", "lat": 22.6070, "lon": 120.3142 },
      { "name": "左營車站", "lat": 22.6874, "lon": 120.3097 }
    ]
  },
  {
    "day": 12,
    "date": "2026-07-16",
    "weekday": "四",
    "type": "ride",
    "title": "高雄左營到嘉義",
    "start": "高雄左營",
    "end": "嘉義",
    "distanceKm": 121.6,
    "description": "高雄左營→台17→楠梓→梓官→永安→茄萣→台南市南區→台南中西區→安南→將軍→南18→苓子寮→南19→學甲→台19→鹽水→縣172→南80→菁寮→南84→後壁→台1→水上→嘉義",
    "waypoints": [
      { "name": "左營車站", "lat": 22.6874, "lon": 120.3097 },
      { "name": "楠梓", "lat": 22.7291, "lon": 120.3256 },
      { "name": "梓官", "lat": 22.7602, "lon": 120.2674 },
      { "name": "永安", "lat": 22.8186, "lon": 120.2250 },
      { "name": "茄萣", "lat": 22.9065, "lon": 120.1833 },
      { "name": "台南市南區", "lat": 22.9610, "lon": 120.1880 },
      { "name": "安南", "lat": 23.0480, "lon": 120.1850 },
      { "name": "將軍", "lat": 23.2012, "lon": 120.1564 },
      { "name": "學甲", "lat": 23.2321, "lon": 120.1817 },
      { "name": "鹽水", "lat": 23.3212, "lon": 120.2674 },
      { "name": "菁寮", "lat": 23.3804, "lon": 120.3378 },
      { "name": "後壁車站", "lat": 23.3663, "lon": 120.3607 },
      { "name": "水上", "lat": 23.4320, "lon": 120.3970 },
      { "name": "嘉義車站", "lat": 23.4794, "lon": 120.4417 }
    ]
  },
  {
    "day": 13,
    "date": "2026-07-17",
    "weekday": "五",
    "type": "ride",
    "title": "嘉義到埔里",
    "start": "嘉義",
    "end": "埔里",
    "distanceKm": 111.4,
    "description": "嘉義→台1→民雄→斗南→台1丁→斗六→台3→林內→南投竹山→社寮→台3丙→集集→台16→水里→台21→日月潭→魚池→埔里",
    "waypoints": [
      { "name": "嘉義車站", "lat": 23.4794, "lon": 120.4417 },
      { "name": "民雄車站", "lat": 23.5562, "lon": 120.4296 },
      { "name": "斗南車站", "lat": 23.6730, "lon": 120.4808 },
      { "name": "斗六車站", "lat": 23.7110, "lon": 120.5413 },
      { "name": "林內車站", "lat": 23.7597, "lon": 120.6145 },
      { "name": "竹山", "lat": 23.7575, "lon": 120.6829 },
      { "name": "集集車站", "lat": 23.8274, "lon": 120.7849 },
      { "name": "水里車站", "lat": 23.8174, "lon": 120.8532 },
      { "name": "日月潭", "lat": 23.8647, "lon": 120.9165 },
      { "name": "魚池", "lat": 23.8966, "lon": 120.9352 },
      { "name": "埔里轉運站", "lat": 23.9664, "lon": 120.9692 }
    ]
  },
  {
    "day": 14,
    "date": "2026-07-18",
    "weekday": "六",
    "type": "ride",
    "title": "埔里到台中",
    "start": "埔里",
    "end": "台中",
    "distanceKm": 59.4,
    "description": "埔里→台14→國姓→草屯→台3→霧峰→大里→台中市",
    "waypoints": [
      { "name": "埔里轉運站", "lat": 23.9664, "lon": 120.9692 },
      { "name": "國姓", "lat": 24.0422, "lon": 120.8585 },
      { "name": "草屯", "lat": 23.9833, "lon": 120.6852 },
      { "name": "霧峰", "lat": 24.0630, "lon": 120.6994 },
      { "name": "大里", "lat": 24.0994, "lon": 120.6776 },
      { "name": "台中車站", "lat": 24.1368, "lon": 120.6850 }
    ]
  }
]
```

- [ ] **Step 4: Validate JSON syntax**

Run:

```bash
node -e "const fs=require('node:fs'); const data=JSON.parse(fs.readFileSync('data/route-waypoints.json','utf8')); console.log(data.length)"
```

Expected: `15`

- [ ] **Step 5: Commit scaffold**

```bash
git add package.json .gitignore data/route-waypoints.json
git commit -m "Add route source data"
```

---

### Task 2: Route And GPX Build Script

**Files:**
- Create: `scripts/build-routes.mjs`
- Create generated: `data/routes.json`
- Create generated: `gpx/day-01.gpx`, `gpx/day-02.gpx`, `gpx/day-03.gpx`, `gpx/day-04.gpx`, `gpx/day-05.gpx`, `gpx/day-07.gpx`, `gpx/day-08.gpx`, `gpx/day-09.gpx`, `gpx/day-11.gpx`, `gpx/day-12.gpx`, `gpx/day-13.gpx`, `gpx/day-14.gpx`

**Interfaces:**
- Consumes: `data/route-waypoints.json`.
- Produces: `data/routes.json` with `geojson`, `generatedDistanceKm`, `distanceDeltaKm`, `distanceWarning`, and `gpxPath` added to each day.
- Produces: GPX track files with one `trkseg` and many `trkpt` entries.

- [ ] **Step 1: Write route helper functions**

Create `scripts/build-routes.mjs` with these functions:

```js
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "data", "route-waypoints.json");
const ROUTES_PATH = path.join(ROOT, "data", "routes.json");
const GPX_DIR = path.join(ROOT, "gpx");
const ROUTER_URL = process.env.ROUTER_URL || "";
const ROUTER_PROFILE = process.env.ROUTER_PROFILE || "driving";

function dayId(day) {
  return String(day).padStart(2, "0");
}

function haversineKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

function fallbackGeometry(waypoints) {
  return {
    type: "LineString",
    coordinates: waypoints.map((point) => [point.lon, point.lat])
  };
}

function geometryDistanceKm(geometry) {
  const coordinates = geometry.coordinates;
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [prevLon, prevLat] = coordinates[index - 1];
    const [lon, lat] = coordinates[index];
    total += haversineKm({ lat: prevLat, lon: prevLon }, { lat, lon });
  }
  return Math.round(total * 10) / 10;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function geometryToGpx(day, geometry) {
  const points = geometry.coordinates
    .map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="2026-routes" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(day.title)}</name>
    <desc>${escapeXml(day.description)}</desc>
  </metadata>
  <trk>
    <name>${escapeXml(`Day ${day.day} ${day.title}`)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}
```

- [ ] **Step 2: Write routing provider function**

Append:

```js
async function routeWithOsrm(waypoints) {
  if (!ROUTER_URL) {
    return fallbackGeometry(waypoints);
  }

  const coordinates = waypoints
    .map((point) => `${point.lon},${point.lat}`)
    .join(";");
  const endpoint = `${ROUTER_URL.replace(/\/$/, "")}/route/v1/${ROUTER_PROFILE}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Routing request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload.code !== "Ok" || !payload.routes?.[0]?.geometry) {
    throw new Error(`Routing response did not include geometry: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  return payload.routes[0].geometry;
}
```

- [ ] **Step 3: Write build flow**

Append:

```js
async function build() {
  const source = JSON.parse(await fs.readFile(SOURCE_PATH, "utf8"));
  await fs.mkdir(GPX_DIR, { recursive: true });

  const output = [];
  const warnings = [];

  for (const day of source) {
    if (day.type !== "ride") {
      output.push({
        ...day,
        generatedDistanceKm: null,
        distanceDeltaKm: null,
        distanceWarning: null,
        geojson: null,
        gpxPath: null
      });
      continue;
    }

    if (!Array.isArray(day.waypoints) || day.waypoints.length < 2) {
      throw new Error(`Day ${day.day} needs at least two waypoints`);
    }

    let geometry;
    try {
      geometry = await routeWithOsrm(day.waypoints);
    } catch (error) {
      warnings.push(`Day ${day.day}: routing failed, using waypoint fallback: ${error.message}`);
      geometry = fallbackGeometry(day.waypoints);
    }

    const generatedDistanceKm = geometryDistanceKm(geometry);
    const distanceDeltaKm =
      typeof day.distanceKm === "number"
        ? Math.round((generatedDistanceKm - day.distanceKm) * 10) / 10
        : null;
    const distanceWarning =
      typeof distanceDeltaKm === "number" && Math.abs(distanceDeltaKm) > 25
        ? `Generated distance differs from PDF by ${distanceDeltaKm} km`
        : null;

    if (distanceWarning) {
      warnings.push(`Day ${day.day}: ${distanceWarning}`);
    }

    const gpxPath = `gpx/day-${dayId(day.day)}.gpx`;
    await fs.writeFile(path.join(ROOT, gpxPath), geometryToGpx(day, geometry), "utf8");

    output.push({
      ...day,
      generatedDistanceKm,
      distanceDeltaKm,
      distanceWarning,
      geojson: geometry,
      gpxPath
    });
  }

  await fs.writeFile(ROUTES_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  for (const warning of warnings) {
    console.warn(warning);
  }
  console.log(`Wrote ${ROUTES_PATH}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 4: Run fallback generation**

Run:

```bash
npm run build:routes
```

Expected: command exits `0`, writes `data/routes.json`, and writes 12 GPX files. Distance warnings are acceptable for fallback geometry.

- [ ] **Step 5: Run routed generation if endpoint is available**

Run this only if a routing endpoint is available:

```bash
ROUTER_URL=https://router.project-osrm.org npm run build:routes
```

Expected: command exits `0`; generated route geometry has more coordinates than the input waypoint count for most riding days. If the public endpoint rejects a route, keep fallback output and record the failed day in the final report.

- [ ] **Step 6: Commit generated route assets**

```bash
git add scripts/build-routes.mjs data/routes.json gpx
git commit -m "Generate route GPX assets"
```

---

### Task 3: Validation Script

**Files:**
- Create: `scripts/validate-output.mjs`

**Interfaces:**
- Consumes: `data/routes.json` and `gpx/*.gpx`.
- Produces: process exit `0` when all generated artifacts satisfy minimum correctness.

- [ ] **Step 1: Create validator**

Create `scripts/validate-output.mjs`:

```js
import fs from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const routes = JSON.parse(await fs.readFile("data/routes.json", "utf8"));

assert(routes.length === 15, `Expected 15 day entries, got ${routes.length}`);

let rideCount = 0;
for (const day of routes) {
  assert(typeof day.day === "number", "Each day must have a numeric day");
  assert(["ride", "rest", "lecture"].includes(day.type), `Invalid type for day ${day.day}`);
  assert(day.description && typeof day.description === "string", `Day ${day.day} needs description`);

  if (day.type === "ride") {
    rideCount += 1;
    assert(day.gpxPath, `Day ${day.day} needs gpxPath`);
    assert(day.geojson?.type === "LineString", `Day ${day.day} needs LineString geometry`);
    assert(day.geojson.coordinates.length >= day.waypoints.length, `Day ${day.day} geometry is shorter than waypoints`);
    const gpx = await fs.readFile(day.gpxPath, "utf8");
    assert(gpx.includes("<gpx"), `${day.gpxPath} missing gpx element`);
    assert(gpx.includes("<trk>"), `${day.gpxPath} missing track`);
    assert(gpx.includes("<trkseg>"), `${day.gpxPath} missing track segment`);
    assert(gpx.includes("<trkpt "), `${day.gpxPath} missing track points`);
  } else {
    assert(day.gpxPath === null, `Day ${day.day} should not have GPX`);
    assert(day.geojson === null, `Day ${day.day} should not have geometry`);
  }
}

assert(rideCount === 12, `Expected 12 riding days, got ${rideCount}`);
console.log("Validation passed");
```

- [ ] **Step 2: Run validator**

Run:

```bash
npm run validate
```

Expected: `Validation passed`

- [ ] **Step 3: Commit validator**

```bash
git add scripts/validate-output.mjs
git commit -m "Add route output validation"
```

---

### Task 4: Static Website

**Files:**
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/app.js`

**Interfaces:**
- Consumes: `data/routes.json`.
- Produces: A static web app that can be served by `npm run serve`.

- [ ] **Step 1: Create HTML shell**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>2026 鐵駱駝環島路線</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <link rel="stylesheet" href="src/styles.css">
  </head>
  <body>
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <p class="eyebrow">2026 鐵駱駝</p>
          <h1>單車環島路線</h1>
          <p id="summary" class="summary">載入路線資料中...</p>
        </div>
        <button id="overviewButton" class="overview-button" type="button">查看全程</button>
        <div id="dayList" class="day-list" aria-label="每日路線"></div>
      </aside>

      <section class="map-area" aria-label="路線地圖">
        <div id="map"></div>
      </section>

      <aside class="detail-panel" aria-live="polite">
        <p id="detailMeta" class="detail-meta"></p>
        <h2 id="detailTitle">選擇一天查看路線</h2>
        <p id="detailDistance" class="distance"></p>
        <p id="detailDescription" class="route-description"></p>
        <a id="downloadLink" class="download-link" href="#" download hidden>下載 GPX</a>
        <p id="warningText" class="warning-text"></p>
      </aside>
    </main>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script type="module" src="src/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create responsive styles**

Create `src/styles.css`:

```css
:root {
  color-scheme: light;
  --ink: #17211b;
  --muted: #5d6a62;
  --line: #d9ded6;
  --panel: #f7f8f3;
  --accent: #1f7a5b;
  --accent-strong: #0f5c42;
  --warn: #9a4b00;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--ink);
  background: #eef1ec;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr minmax(280px, 360px);
}

.sidebar,
.detail-panel {
  min-width: 0;
  overflow: auto;
  background: var(--panel);
  border-color: var(--line);
}

.sidebar {
  border-right: 1px solid var(--line);
  padding: 20px;
}

.detail-panel {
  border-left: 1px solid var(--line);
  padding: 20px;
}

.eyebrow,
.detail-meta {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

h1,
h2 {
  margin: 0;
  line-height: 1.2;
  letter-spacing: 0;
}

h1 {
  font-size: 28px;
}

h2 {
  font-size: 22px;
}

.summary,
.route-description,
.distance,
.warning-text {
  line-height: 1.6;
}

.overview-button,
.day-button,
.download-link {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.overview-button {
  margin: 18px 0;
  padding: 12px 14px;
  font-weight: 800;
}

.day-list {
  display: grid;
  gap: 8px;
}

.day-button {
  padding: 12px;
}

.day-button.is-active {
  border-color: var(--accent);
  box-shadow: inset 4px 0 0 var(--accent);
}

.day-title {
  display: block;
  font-weight: 800;
}

.day-meta {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 13px;
}

.map-area {
  min-width: 0;
  min-height: 420px;
}

#map {
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

.download-link {
  display: inline-block;
  margin-top: 14px;
  padding: 12px 14px;
  color: #fff;
  background: var(--accent);
  border-color: var(--accent-strong);
  font-weight: 800;
  text-decoration: none;
  text-align: center;
}

.warning-text {
  color: var(--warn);
  font-weight: 700;
}

@media (max-width: 980px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar,
  .detail-panel {
    border: 0;
  }

  #map {
    min-height: 58vh;
  }
}
```

- [ ] **Step 3: Create app logic**

Create `src/app.js`:

```js
const colors = ["#1f7a5b", "#b84a32", "#315da8", "#a56b00", "#6b4ba8", "#277084"];

const state = {
  routes: [],
  map: null,
  overviewLayer: null,
  activeLayer: null,
  activeDay: null
};

const elements = {
  summary: document.querySelector("#summary"),
  dayList: document.querySelector("#dayList"),
  overviewButton: document.querySelector("#overviewButton"),
  detailMeta: document.querySelector("#detailMeta"),
  detailTitle: document.querySelector("#detailTitle"),
  detailDistance: document.querySelector("#detailDistance"),
  detailDescription: document.querySelector("#detailDescription"),
  downloadLink: document.querySelector("#downloadLink"),
  warningText: document.querySelector("#warningText")
};

function initMap() {
  state.map = L.map("map", { scrollWheelZoom: true }).setView([23.8, 121.0], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(state.map);
}

function routeStyle(index, selected = false) {
  return {
    color: colors[index % colors.length],
    weight: selected ? 7 : 4,
    opacity: selected ? 0.95 : 0.65
  };
}

function clearActiveLayer() {
  if (state.activeLayer) {
    state.map.removeLayer(state.activeLayer);
    state.activeLayer = null;
  }
}

function showOverview() {
  clearActiveLayer();
  document.querySelectorAll(".day-button").forEach((button) => button.classList.remove("is-active"));

  if (state.overviewLayer) {
    state.map.removeLayer(state.overviewLayer);
  }

  const layers = state.routes
    .filter((day) => day.geojson)
    .map((day, index) => L.geoJSON(day.geojson, { style: routeStyle(index) }));

  state.overviewLayer = L.featureGroup(layers).addTo(state.map);
  state.map.fitBounds(state.overviewLayer.getBounds(), { padding: [24, 24] });
  renderDetail(null);
}

function renderDayList() {
  elements.dayList.innerHTML = "";
  for (const day of state.routes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-button";
    button.dataset.day = String(day.day);
    button.innerHTML = `
      <span class="day-title">${day.day === 0 ? "D0" : `D${day.day}`} ${day.title}</span>
      <span class="day-meta">${day.date} (${day.weekday}) · ${day.type === "ride" ? `${day.distanceKm} km` : day.type === "rest" ? "休息日" : "行前講習"}</span>
    `;
    button.addEventListener("click", () => selectDay(day.day));
    elements.dayList.append(button);
  }
}

function renderDetail(day) {
  if (!day) {
    const rides = state.routes.filter((route) => route.type === "ride");
    const total = rides.reduce((sum, route) => sum + route.distanceKm, 0).toFixed(1);
    elements.detailMeta.textContent = "全程總覽";
    elements.detailTitle.textContent = "2026 鐵駱駝單車環島";
    elements.detailDistance.textContent = `PDF 總距離 ${total} km，共 ${rides.length} 個騎乘日`;
    elements.detailDescription.textContent = "點選左側每日路線查看細節，或使用各日 GPX 匯入 Garmin。";
    elements.downloadLink.hidden = true;
    elements.warningText.textContent = "";
    return;
  }

  elements.detailMeta.textContent = `${day.date} (${day.weekday})`;
  elements.detailTitle.textContent = `${day.day === 0 ? "D0" : `D${day.day}`} ${day.title}`;
  elements.detailDistance.textContent =
    day.type === "ride"
      ? `PDF ${day.distanceKm} km · 產生路線 ${day.generatedDistanceKm} km`
      : day.type === "rest"
        ? "休息日"
        : "行前講習";
  elements.detailDescription.textContent = day.description;
  elements.warningText.textContent = day.distanceWarning || "";

  if (day.gpxPath) {
    elements.downloadLink.href = day.gpxPath;
    elements.downloadLink.download = `iron-camel-day-${String(day.day).padStart(2, "0")}.gpx`;
    elements.downloadLink.textContent = "下載本日 GPX";
    elements.downloadLink.hidden = false;
  } else {
    elements.downloadLink.hidden = true;
  }
}

function selectDay(dayNumber) {
  const day = state.routes.find((route) => route.day === dayNumber);
  if (!day) return;

  document.querySelectorAll(".day-button").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.day) === dayNumber);
  });

  clearActiveLayer();
  if (state.overviewLayer) {
    state.map.removeLayer(state.overviewLayer);
    state.overviewLayer = null;
  }

  if (day.geojson) {
    state.activeLayer = L.geoJSON(day.geojson, { style: routeStyle(day.day, true) }).addTo(state.map);
    state.map.fitBounds(state.activeLayer.getBounds(), { padding: [32, 32] });
  }

  renderDetail(day);
}

async function loadRoutes() {
  const response = await fetch("data/routes.json");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  state.routes = await response.json();
}

async function main() {
  initMap();
  try {
    await loadRoutes();
    const rideTotal = state.routes
      .filter((day) => day.type === "ride")
      .reduce((sum, day) => sum + day.distanceKm, 0);
    elements.summary.textContent = `14 天活動，12 個騎乘日，PDF 總距離 ${rideTotal.toFixed(1)} km`;
    renderDayList();
    elements.overviewButton.addEventListener("click", showOverview);
    showOverview();
  } catch (error) {
    elements.summary.textContent = "路線資料載入失敗";
    elements.detailTitle.textContent = "無法載入路線資料";
    elements.detailDescription.textContent = error.message;
  }
}

main();
```

- [ ] **Step 4: Start local server**

Run:

```bash
npm run serve
```

Expected: server listens on `http://localhost:8080`.

- [ ] **Step 5: Manually verify app**

Open `http://localhost:8080` and verify:

- The overview route appears on the map.
- Clicking D1 changes the detail panel and map route.
- Clicking a rest day hides the GPX download.
- Clicking a riding day shows a GPX download link.
- Mobile width keeps the map, list, and detail panel stacked without overlapping.

- [ ] **Step 6: Commit website**

```bash
git add index.html src/styles.css src/app.js
git commit -m "Add static route website"
```

---

### Task 5: Final Verification And Route Quality Pass

**Files:**
- Inspect: `data/route-waypoints.json`
- Inspect: `data/routes.json`
- Inspect: `gpx/*.gpx`
- Modify: `data/route-waypoints.json` when Step 2 reports a route with fewer than 20 coordinates after routed generation.
- Modify generated: `data/routes.json` by rerunning `npm run build:routes` after waypoint edits.
- Modify generated: `gpx/*.gpx` by rerunning `npm run build:routes` after waypoint edits.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: verified route site and final notes about route precision limits.

- [ ] **Step 1: Run data validation**

Run:

```bash
npm run validate
```

Expected: `Validation passed`

- [ ] **Step 2: Check generated route sizes**

Run:

```bash
node -e "const r=require('./data/routes.json'); for (const d of r.filter(x=>x.type==='ride')) console.log(d.day, d.geojson.coordinates.length, d.generatedDistanceKm, d.distanceKm, d.distanceDeltaKm)"
```

Expected: every riding day has at least as many geometry coordinates as source waypoints. If routed generation was used, most days should have more than 20 coordinates.

- [ ] **Step 3: Check GPX count**

Run:

```bash
find gpx -name '*.gpx' | wc -l
```

Expected: `12`

- [ ] **Step 4: Check local page fetches data**

Run:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` and use the browser console to confirm there are no JavaScript errors.

- [ ] **Step 5: Commit route quality corrections after waypoint edits**

Run this command after any waypoint edit and rebuild from Step 2:

```bash
git add data/route-waypoints.json data/routes.json gpx
git commit -m "Refine generated route data"
```

---

## Self-Review

- Spec coverage: Tasks cover static website, overview map, per-day route selection, PDF route metadata, riding-day GPX downloads, non-riding-day handling, editable route inputs, pre-generated route data, route-generation failure handling, and validation.
- Placeholder scan: No unfinished markers or unspecified implementation steps remain. Conditional branches are limited to explicit verification steps for configurable routing endpoint availability and route corrections.
- Type consistency: `route-waypoints.json`, `routes.json`, `geojson`, `gpxPath`, `generatedDistanceKm`, `distanceDeltaKm`, and `distanceWarning` are used consistently across build, validation, and browser code.
