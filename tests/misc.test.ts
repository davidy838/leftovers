import { describe, expect, it } from "vitest";
import { diffSuggestion } from "@/lib/edits";
import { foodEmoji } from "@/lib/emoji";
import { haversineMeters, walkMinutes } from "@/lib/geo";
import { getClientId, isUuid } from "@/lib/http";
import { decodeImage, ImageError, sniffMediaType } from "@/lib/image.server";
import { RateLimiter } from "@/lib/rateLimit";
import type { PosterSuggestion } from "@/lib/types";

describe("RateLimiter", () => {
  it("allows up to the limit then rejects with retry-after", () => {
    const rl = new RateLimiter(2, 60_000);
    expect(rl.check("ip", 0).ok).toBe(true);
    expect(rl.check("ip", 1000).ok).toBe(true);
    const r = rl.check("ip", 2000);
    expect(r).toEqual({ ok: false, retryAfterSec: 58 });
    expect(rl.check("other", 2000).ok).toBe(true);
    expect(rl.check("ip", 60_001).ok).toBe(true); // first hit expired
  });
});

describe("image validation", () => {
  const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");
  it("sniffs formats", () => {
    expect(sniffMediaType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(sniffMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMediaType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(sniffMediaType(new Uint8Array([0x47, 0x49, 0x46]))).toBeNull();
  });
  it("trusts bytes over the declared type", () => {
    const png = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    expect(decodeImage({ mediaType: "image/jpeg", data: png }).mediaType).toBe("image/png");
  });
  it("accepts data: URL prefixes", () => {
    expect(decodeImage({ mediaType: "image/jpeg", data: `data:image/jpeg;base64,${b64([0xff, 0xd8, 0xff, 1])}` }).bytes.length).toBe(4);
  });
  it("rejects non-images, bad base64 and oversize", () => {
    expect(() => decodeImage({ mediaType: "image/jpeg", data: b64([1, 2, 3, 4]) })).toThrow(ImageError);
    expect(() => decodeImage({ mediaType: "image/jpeg", data: "!!!" })).toThrow(ImageError);
    const big = Buffer.alloc(3 * 1024 * 1024 + 10);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    expect(() => decodeImage({ mediaType: "image/jpeg", data: big.toString("base64") })).toThrow(/3 MB/);
  });
});

describe("http helpers", () => {
  it("validates client ids", () => {
    const id = crypto.randomUUID();
    expect(isUuid(id)).toBe(true);
    expect(isUuid("../../etc")).toBe(false);
    expect(getClientId(new Request("http://x", { headers: { "x-client-id": id.toUpperCase() } }))).toBe(id);
    expect(getClientId(new Request("http://x", { headers: { "x-client-id": "nope" } }))).toBeNull();
  });
});

describe("diffSuggestion (poster)", () => {
  const s: PosterSuggestion = {
    title: "Social", description: "", buildingId: "ICCS", locationText: "ICICS", room: "X836",
    availableFrom: "2026-11-13T02:00:00.000Z", expiresAt: "2026-11-13T04:30:00.000Z", dietaryTags: [], confidence: 0.9, lowConfidence: false,
  };
  const sub = { title: "Social", dietaryTags: [], buildingId: "ICCS", room: "X836", estServings: null, allergens: [],
    availableFrom: "2026-11-13T02:00:30.000Z", expiresAt: "2026-11-13T04:30:00.000Z" };
  it("no edits when the user keeps everything (seconds ignored)", () => expect(diffSuggestion(s, sub)).toEqual([]));
  it("detects changed building, room and end", () =>
    expect(diffSuggestion(s, { ...sub, buildingId: "NEST", room: null, expiresAt: "2026-11-13T05:00:00.000Z" })).toEqual(["buildingId", "room", "expiresAt"]));
  it("doesn't count filling in a time the AI left blank", () =>
    expect(diffSuggestion({ ...s, availableFrom: null, expiresAt: null }, sub)).toEqual([]));
});

describe("geo + emoji", () => {
  it("measures ~111 km per degree of latitude", () => {
    expect(Math.round(haversineMeters({ lat: 49, lng: -123 }, { lat: 50, lng: -123 }) / 1000)).toBe(111);
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(800)).toBe(10);
  });
  it("picks emoji", () => {
    expect(foodEmoji("Leftover PIZZA")).toBe("🍕");
    expect(foodEmoji("mystery")).toBe("🍱");
  });
});
