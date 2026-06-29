# 2026 Iron Camel Route Website Design

## Goal

Build a static website for the 2026 Iron Camel cycling route PDF. The site lets riders inspect each activity day, view a reasonable road-following route on a map, and download GPX files for Garmin import.

## Selected Approach

Use pre-generated route data and GPX files.

The PDF provides route descriptions and distances, but not GPS tracks. A build script will turn curated daily waypoints into road-following routes through a routing service, then write static data files consumed by the website. The website itself will not call routing APIs at page load.

## Scope

- Show an overview of the full island route.
- Show each riding day separately.
- Preserve the PDF route text, date, distance, start, and end for each day.
- Download one GPX per riding day.
- Mark rest / lecture days clearly and avoid fake GPX downloads for non-riding days.
- Keep route-generation inputs editable so ambiguous geocoding or routing failures can be corrected manually.

## Out Of Scope

- Live route recalculation in the browser.
- Turn-by-turn navigation instructions.
- Guaranteed event-official GPS accuracy.
- User accounts, backend storage, or hosted APIs.

## Data Model

The generated route data will live under `data/routes.json`.

Each day entry includes:

- `day`: numeric day label from the PDF.
- `date`: activity date.
- `weekday`: weekday text.
- `type`: `ride`, `rest`, or `lecture`.
- `title`: short display title.
- `start` and `end`: human-readable endpoints.
- `distanceKm`: PDF distance when available.
- `description`: original PDF route text.
- `waypoints`: curated coordinates used for routing.
- `geojson`: generated road-following route geometry for riding days.
- `gpxPath`: static GPX path for riding days.

## Route Generation

Route input will live in a source file such as `data/route-waypoints.json`. It will contain manually curated waypoint names and coordinates extracted from the PDF route table.

The build script will:

1. Read `data/route-waypoints.json`.
2. For each riding day, call a routing service with ordered waypoint coordinates.
3. Request full route geometry suitable for map display and GPX conversion.
4. Write `data/routes.json`.
5. Write `gpx/day-XX.gpx` files.
6. Report days where routing fails or generated distance is suspiciously different from the PDF distance.

The first implementation will prefer OSRM-compatible routing because its Route service accepts coordinate sequences and returns route geometry. If a cycling profile is unavailable, the script will make the provider configurable so a bicycle-capable OSRM/GraphHopper/Valhalla endpoint can replace the default.

## Website UX

The first screen is the route tool itself, not a landing page.

Layout:

- Left / top panel: day list with date, type, distance, and download controls.
- Main panel: Leaflet map showing either the full route or selected day.
- Detail panel: selected day route text, distance comparison, endpoints, and GPX download.

Interactions:

- Selecting a day highlights its route and fits the map bounds.
- Overview mode shows all riding days with distinct colors.
- GPX download buttons are disabled or hidden for rest / lecture days.
- A "download all GPX" control will link to a zip only if the implementation creates one; otherwise the UI will provide clear per-day downloads.

## Error Handling

- If route data cannot load, the page shows a concise failure message.
- If one day has no generated geometry, the day remains visible with the PDF route text and no map track.
- If a GPX file is missing, its download button is disabled.
- Route-generation failures are printed by the build script with the day number and failed waypoint set.

## Verification

- Open the local static page in a browser and verify map tiles, route geometry, day switching, and GPX links.
- Validate GPX files are well-formed XML with `gpx`, `trk`, `trkseg`, and `trkpt` entries.
- Check generated route distances against the PDF distances and flag large discrepancies.
- Confirm mobile and desktop layouts do not overlap text or controls.

