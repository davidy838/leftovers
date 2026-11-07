import { describe, expect, it } from "vitest";
import { mockFood, mockPoster } from "@/lib/ai/mock";
import { ExtractRejected, postprocessFood, postprocessPoster } from "@/lib/ai/postprocess";
import type { RawFood, RawPoster } from "@/lib/ai/schemas";
import { RawFoodSchema, RawPosterSchema } from "@/lib/ai/schemas";
import { toCampusLocalInput } from "@/lib/time";

const H = 3_600_000;
const local = (iso: string | null) => (iso ? toCampusLocalInput(iso) : null);
const hoursBetween = (a: string | null, b: string | null) => (Date.parse(b!) - Date.parse(a!)) / H;

const food = (over: Partial<RawFood> = {}): RawFood => ({
  is_food: true,
  title: "Cheese pizza",
  items: ["cheese pizza"],
  est_servings: 20,
  dietary_tags: ["vegetarian"],
  possible_allergens: ["dairy", "gluten"],
  confidence: 0.9,
  notes: null,
  ...over,
});

const poster = (over: Partial<RawPoster> = {}): RawPoster => ({
  is_event_with_food: true,
  title: "CS Club Social",
  date: "2026-11-12",
  start_time: "18:00",
  end_time: "20:00",
  location_text: "ICICS X836",
  room: "X836",
  food_mentioned: ["pizza"],
  dietary_tags: ["vegetarian"],
  confidence: 0.9,
  ...over,
});

describe("postprocessFood", () => {
  it("passes through a confident result", () => {
    const s = postprocessFood(food());
    expect(s).toMatchObject({ title: "Cheese pizza", estServings: 20, dietaryTags: ["vegetarian"], allergens: ["dairy", "gluten"], lowConfidence: false });
  });
  it("rejects non-food", () => {
    expect(() => postprocessFood(food({ is_food: false }))).toThrow(ExtractRejected);
  });
  it("drops servings and dietary tags when unsure, but keeps allergens", () => {
    const s = postprocessFood(food({ confidence: 0.3 }));
    expect(s.estServings).toBeNull();
    expect(s.dietaryTags).toEqual([]);
    expect(s.allergens).toEqual(["dairy", "gluten"]);
    expect(s.lowConfidence).toBe(true);
  });
  it("clamps and sanitises", () => {
    const s = postprocessFood(food({ est_servings: 9999, confidence: 7, title: "  ", dietary_tags: ["vegan", "vegan"] }));
    expect(s.estServings).toBeNull();
    expect(s.confidence).toBe(1);
    expect(s.title).toBe("Free food");
    expect(s.dietaryTags).toEqual(["vegan"]);
  });
  it("rounds servings and caps title length", () => {
    const s = postprocessFood(food({ est_servings: 12.6, title: "x".repeat(200) }));
    expect(s.estServings).toBe(13);
    expect(s.title.length).toBeLessThanOrEqual(80);
  });
  it("NaN confidence counts as low", () => {
    expect(postprocessFood(food({ confidence: Number.NaN })).lowConfidence).toBe(true);
  });
});

describe("postprocessPoster", () => {
  it("maps location to a known building and converts times to UTC", () => {
    const s = postprocessPoster(poster());
    expect(s.buildingId).toBe("ICCS");
    expect(local(s.availableFrom)).toBe("2026-11-12T18:00"); // Vancouver wall clock
    expect(hoursBetween(s.availableFrom, s.expiresAt)).toBe(2.5); // end (20:00) + 30 min
  });
  it("never invents a building", () => {
    const s = postprocessPoster(poster({ location_text: "Zoom" }));
    expect(s.buildingId).toBeNull();
    expect(s.locationText).toBe("Zoom");
  });
  it("defaults to start + 2h without an end time", () => {
    const s = postprocessPoster(poster({ end_time: null }));
    expect(hoursBetween(s.availableFrom, s.expiresAt)).toBe(2);
  });
  it("ignores an end before the start", () => {
    const s = postprocessPoster(poster({ end_time: "17:00" }));
    expect(hoursBetween(s.availableFrom, s.expiresAt)).toBe(2);
  });
  it("leaves times null when the date is missing or invalid", () => {
    expect(postprocessPoster(poster({ date: null })).availableFrom).toBeNull();
    expect(postprocessPoster(poster({ date: "Friday" })).availableFrom).toBeNull();
  });
  it("rejects posters without food", () => {
    expect(() => postprocessPoster(poster({ is_event_with_food: false }))).toThrow(ExtractRejected);
  });
});

describe("mocks", () => {
  it("satisfy the raw schemas and post-process cleanly", () => {
    expect(RawFoodSchema.safeParse(mockFood()).success).toBe(true);
    expect(RawPosterSchema.safeParse(mockPoster()).success).toBe(true);
    const p = postprocessPoster(mockPoster(new Date()));
    expect(p.buildingId).toBe("ICCS");
    expect(Date.parse(p.expiresAt!)).toBeGreaterThan(Date.now());
  });
});
