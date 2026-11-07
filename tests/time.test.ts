import { describe, expect, it } from "vitest";
import { campusToday, formatDuration, fromCampusLocalInput, toCampusLocalInput, zonedToUtc } from "@/lib/time";

describe("zonedToUtc (America/Vancouver)", () => {
  it("handles PST (UTC-8) after the November DST change", () => {
    expect(zonedToUtc("2026-11-08", "18:30")?.toISOString()).toBe("2026-11-09T02:30:00.000Z");
  });
  it("handles PDT (UTC-7) in summer", () => {
    expect(zonedToUtc("2026-07-01", "09:00")?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });
  it("handles the day of the fall-back change", () => {
    // 2026-11-01 01:30 is ambiguous; 12:00 is unambiguous PST
    expect(zonedToUtc("2026-11-01", "12:00")?.toISOString()).toBe("2026-11-01T20:00:00.000Z");
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
    const iso = "2026-11-09T02:30:00.000Z";
    const local = toCampusLocalInput(iso);
    expect(local).toBe("2026-11-08T18:30");
    expect(fromCampusLocalInput(local)).toBe(iso);
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
