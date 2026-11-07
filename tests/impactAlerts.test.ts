import { describe, expect, it } from "vitest";
import { newMatchingPosts, titleWithCount } from "../src/lib/alerts";
import { formatKg, impactFromServings } from "../src/lib/impact";
import type { PublicPost } from "../src/lib/types";

const post = (over: Partial<PublicPost>): PublicPost => ({
  id: "00000000-0000-4000-8000-000000000001",
  title: "Pizza",
  description: "",
  buildingId: "NEST",
  room: null,
  photoUrl: null,
  estServings: null,
  dietaryTags: [],
  allergens: [],
  source: "manual",
  availableFrom: "2026-11-07T18:00:00.000Z",
  expiresAt: "2026-11-07T19:00:00.000Z",
  status: "active",
  headingCount: 0,
  goneCount: 0,
  aiRunId: null,
  createdAt: "2026-11-07T18:00:00.000Z",
  displayStatus: "live",
  isMine: false,
  ...over,
});

describe("impactFromServings", () => {
  it("converts servings to kg food and CO2e", () => {
    const i = impactFromServings(10);
    expect(i.kgFood).toBeCloseTo(4);
    expect(i.kgCo2e).toBeCloseTo(10);
  });
  it("treats junk as zero", () => {
    expect(impactFromServings(-5).kgFood).toBe(0);
    expect(impactFromServings(Number.NaN).kgCo2e).toBe(0);
  });
});

describe("formatKg", () => {
  it("formats small, medium and large weights", () => {
    expect(formatKg(0)).toBe("0 kg");
    expect(formatKg(0.44)).toBe("0.4 kg");
    expect(formatKg(9.96)).toBe("10 kg");
    expect(formatKg(123.4)).toBe("123 kg");
    expect(formatKg(2500)).toBe("2.5 t");
  });
});

describe("newMatchingPosts", () => {
  const a = post({ id: "a", dietaryTags: ["vegan", "halal"] });
  const b = post({ id: "b", dietaryTags: ["vegetarian"] });
  const mine = post({ id: "m", isMine: true });
  const gone = post({ id: "g", displayStatus: "gone" });
  const soon = post({ id: "u", displayStatus: "upcoming" });

  it("returns only unseen posts", () => {
    expect(newMatchingPosts([a, b], new Set(["a"]), []).map((p) => p.id)).toEqual(["b"]);
  });
  it("skips the viewer's own and ended posts, keeps upcoming", () => {
    expect(newMatchingPosts([mine, gone, soon], new Set(), []).map((p) => p.id)).toEqual(["u"]);
  });
  it("requires every selected dietary tag", () => {
    expect(newMatchingPosts([a, b], new Set(), ["vegan"]).map((p) => p.id)).toEqual(["a"]);
    expect(newMatchingPosts([a, b], new Set(), ["vegan", "vegetarian"])).toEqual([]);
  });
});

describe("titleWithCount", () => {
  it("adds, replaces and removes the count", () => {
    expect(titleWithCount("Leftovers", 2)).toBe("(2) Leftovers");
    expect(titleWithCount("(2) Leftovers", 3)).toBe("(3) Leftovers");
    expect(titleWithCount("(3) Leftovers", 0)).toBe("Leftovers");
  });
});
