import type { RouteDay } from "../types/routes.js";

const DEFAULT_YEAR = 2026;

export interface RouteScheduleEntry {
  day: number;
  date: string;
  weekday: string;
  description: string;
  lunchStop: string | null;
  lunchDistanceKm: number | null;
  endAccommodation: string | null;
  distanceKm: number | null;
}

interface DistanceCell {
  distanceKm: number | null;
  notes: string[];
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (quoted) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeMultiline(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function parseNullableDistance(value: string): number | null {
  const normalized = normalizeMultiline(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return parsed > 0 ? parsed : null;
}

function parseDistanceCell(value: string): DistanceCell {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const match = firstLine.match(/^(-?\d+(?:\.\d+)?)(.*)$/);

  if (!match) {
    return {
      distanceKm: null,
      notes: lines,
    };
  }

  const parsed = Number(match[1]);
  const trailingNote = match[2]?.trim();
  return {
    distanceKm: parsed > 0 ? parsed : null,
    notes: [trailingNote, ...lines.slice(1)].filter((note): note is string => Boolean(note)),
  };
}

function parseDateCell(value: string): Pick<RouteScheduleEntry, "date" | "weekday"> {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})週(.+)$/);
  if (!match) {
    throw new Error(`Unsupported route date format: ${value}`);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const weekday = match[3]?.trim() ?? "";

  return {
    date: `${DEFAULT_YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    weekday,
  };
}

function requiredColumn(headers: string[], name: string): number {
  const index = headers.indexOf(name);
  if (index < 0) {
    throw new Error(`routes.csv missing required column: ${name}`);
  }
  return index;
}

export function parseRouteScheduleCsv(content: string): RouteScheduleEntry[] {
  const rows = parseCsvRows(content);
  const header = rows[0]?.map((column) => column.replace(/^\uFEFF/, "").trim());
  if (!header) {
    throw new Error("routes.csv is empty");
  }

  const dayIndex = requiredColumn(header, "天數");
  const dateIndex = requiredColumn(header, "日期");
  const descriptionIndex = requiredColumn(header, "路線(文字版本)");
  const lunchStopIndex = requiredColumn(header, "中午休息點(暫定)");
  const lunchDistanceIndex = requiredColumn(header, "中午休息點公里數");
  const accommodationIndex = requiredColumn(header, "終點住宿點");
  const totalDistanceIndex = requiredColumn(header, "當日總公里數");

  return rows.slice(1).flatMap((row): RouteScheduleEntry[] => {
    const dayValue = row[dayIndex]?.trim() ?? "";
    if (!dayValue) {
      return [];
    }

    const day = Number(dayValue);
    if (!Number.isInteger(day)) {
      throw new Error(`Invalid route day: ${dayValue}`);
    }

    const lunchDistance = parseDistanceCell(row[lunchDistanceIndex] ?? "");
    const lunchStop = normalizeMultiline(
      [row[lunchStopIndex] ?? "", ...lunchDistance.notes].filter(Boolean).join("\n"),
    );
    const { date, weekday } = parseDateCell(row[dateIndex] ?? "");

    return [
      {
        day,
        date,
        weekday,
        description: normalizeMultiline(row[descriptionIndex] ?? ""),
        lunchStop: lunchStop || null,
        lunchDistanceKm: lunchDistance.distanceKm,
        endAccommodation: normalizeMultiline(row[accommodationIndex] ?? "") || null,
        distanceKm: parseNullableDistance(row[totalDistanceIndex] ?? ""),
      },
    ];
  });
}

export function mergeRouteSchedule(routes: RouteDay[], schedule: RouteScheduleEntry[]): RouteDay[] {
  const scheduleByDay = new Map(schedule.map((entry) => [entry.day, entry]));

  return routes.map((route) => {
    const scheduleEntry = scheduleByDay.get(route.day);
    if (!scheduleEntry) {
      return route;
    }

    return {
      ...route,
      date: scheduleEntry.date,
      weekday: scheduleEntry.weekday,
      distanceKm: scheduleEntry.distanceKm,
      description: scheduleEntry.description,
      lunchStop: scheduleEntry.lunchStop,
      lunchDistanceKm: scheduleEntry.lunchDistanceKm,
      endAccommodation: scheduleEntry.endAccommodation,
    };
  });
}
