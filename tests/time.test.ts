import { describe, expect, it } from "vitest";
import { campusToday, formatDuration, fromCampusLocalInput, toCampusLocalInput, zonedToUtc } from "@/lib/time";

// NOTE: B.C. moved to permanent daylight time, and newer tz databases (e.g. CI's Node) give
// Vancouver UTC-7 in November 2026 while older ones give UTC-8. So these tests check the real
// property — the wall-clock time in Vancouver round-trips — instead of hard-coding an offset.
const HOUR = 3_600_000;
const offsetHours = (date: string, time: string) =>
  (Date.parse(`${date}T${time}:00Z`) - zonedToUtc(date, time)!.getTime()) / HOUR;

describe("zonedToUtc (America/Vancouver)", () => {
  it.each([
    ["2026-11-08", "18:30"],
    ["2026-07-01", "09:00"],
    ["2026-11-01", "12:00"],
    ["2026-01-15", "00:05"],
    ["2026-12-31", "23:59"],
  ])("%s %s round-trips through Vancouver wall-clock time", (date, time) => {
    const utc = zonedToUtc(date, time);
    expect(utc).not.toBeNull();
    expect(toCampusLocalInput(utc!.toISOString())).toBe(`${date}T${time}`);
    expect([-7, -8]).toContain(offsetHours(date, time));
  });
  it("summer is UTC-7", () => {
    expect(zonedToUtc("2026-07-01", "09:00")?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(zonedToUtc("2026-02-30", "10:00")).toBeNull();
    expect(zonedToUtc("2026-13-01", "10:00")).toBeNull();
    expect(zonedToUtc("tomorrow", "10:00")).toBeNull();
    expect(zonedToUtc("2026-11-08", "25:00")).toBeNull();
    expect(zonedToUtc("2026-11-08", "6pm")).toBeNull();
  });
});

describe("campus local input round-trip", () => {
  it("round-trips", () => {
    const local = "2026-11-08T18:30";
    const iso = fromCampusLocalInput(local);
    expect(iso).not.toBeNull();
    expect(toCampusLocalInput(iso!)).toBe(local);
  });
  it("rejects junk", () => expect(fromCampusLocalInput("nope")).toBeNull());
});

describe("campusToday", () => {
  it("uses the Vancouver date, not UTC", () => {
    // 2026-11-08 05:00 UTC is still Nov 7 in Vancouver
    expect(campusToday(new Date("2026-11-08T05:00:00Z"))).toEqual({ date: "2026-11-07", weekday: "Saturday" });
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [45_000, "45s"],
    [12 * 60_000, "12m"],
    [65 * 60_000, "1h 05m"],
    [-5, "0s"],
  ])("%d ms → %s", (ms, out) => expect(formatDuration(ms)).toBe(out));
});
