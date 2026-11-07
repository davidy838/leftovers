// Time-zone helpers. The campus runs on America/Vancouver; servers may run in UTC.
import { CAMPUS_TIMEZONE } from "./constants";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Offset (minutes, local − UTC) of `timeZone` at the given instant. */
export function tzOffsetMinutes(instant: Date, timeZone: string = CAMPUS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * Convert a wall-clock date ("2026-11-08") + time ("18:30") in `timeZone` to a UTC Date.
 * Returns null for malformed or impossible input. DST-correct (two-pass offset).
 */
export function zonedToUtc(date: string, time: string, timeZone: string = CAMPUS_TIMEZONE): Date | null {
  const d = DATE_RE.exec(date);
  const t = TIME_RE.exec(time);
  if (!d || !t) return null;
  const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, mm] = [Number(t[1]), Number(t[2])];
  const naive = Date.UTC(y, m - 1, day, hh, mm);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== day) {
    return null; // e.g. 2026-02-30
  }
  let guess = naive - tzOffsetMinutes(new Date(naive), timeZone) * 60000;
  guess = naive - tzOffsetMinutes(new Date(guess), timeZone) * 60000;
  return new Date(guess);
}

/** Today's date in the campus zone as YYYY-MM-DD plus weekday, for prompts. */
export function campusToday(now: Date = new Date(), timeZone: string = CAMPUS_TIMEZONE): { date: string; weekday: string } {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(now);
  return { date, weekday };
}

/** "2026-11-08T18:30" style value for <input type="datetime-local"> in the campus zone. */
export function toCampusLocalInput(iso: string, timeZone: string = CAMPUS_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Inverse of toCampusLocalInput. Returns ISO string or null. */
export function fromCampusLocalInput(value: string, timeZone: string = CAMPUS_TIMEZONE): string | null {
  const [date, time] = value.split("T");
  if (!date || !time) return null;
  const d = zonedToUtc(date, time.slice(0, 5), timeZone);
  return d ? d.toISOString() : null;
}

export function formatCampusTime(iso: string, timeZone: string = CAMPUS_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Human countdown: "12m", "1h 05m", "45s". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
