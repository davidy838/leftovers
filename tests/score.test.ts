import { describe, expect, it } from "vitest";
import { LabelsFileSchema, scoreFood, scorePoster, summarizeFood, summarizePoster } from "@/lib/eval/score";

describe("eval scoring", () => {
  it("scores food tags and servings", () => {
    const s = scoreFood({ is_food: true, dietary_tags: ["vegetarian", "halal"], est_servings: 20 }, { is_food: true, dietary_tags: ["vegetarian", "vegan"], est_servings: 29 });
    expect(s).toEqual({ isFoodCorrect: true, tagTP: 1, tagFP: 1, tagFN: 1, servingsWithin50: true });
    const sum = summarizeFood([s]);
    expect(sum.tagPrecision).toBe(0.5);
    expect(sum.tagRecall).toBe(0.5);
    expect(sum.tagF1).toBe(0.5);
  });

  it("servings outside ±50% fail, N/A when unlabeled", () => {
    expect(scoreFood({ is_food: true, dietary_tags: [], est_servings: 20 }, { is_food: true, dietary_tags: [], est_servings: 31 }).servingsWithin50).toBe(false);
    expect(scoreFood({ is_food: true, dietary_tags: [], est_servings: null }, { is_food: true, dietary_tags: [], est_servings: 5 }).servingsWithin50).toBeNull();
  });

  it("flags invented locations", () => {
    const exp = { is_event_with_food: true, date: "2026-11-12", start_time: "18:00", building_id: null };
    const s = scorePoster(exp, { is_event_with_food: true, date: "2026-11-12", start_time: "18:00", building_id: "NEST" });
    expect(s.inventedLocation).toBe(true);
    expect(s.buildingCorrect).toBeNull();
    const ok = scorePoster({ ...exp, building_id: "NEST" }, { is_event_with_food: true, date: "2026-11-12", start_time: "18:30", building_id: "NEST" });
    expect(ok).toMatchObject({ inventedLocation: false, buildingCorrect: true, startCorrect: false, dateCorrect: true });
    expect(summarizePoster([s, ok]).inventedLocationRate).toBe(0.5);
  });

  it("parses the example labels file", async () => {
    const { default: labels } = await import("../evals/labels.example.json");
    expect(LabelsFileSchema.safeParse(labels).success).toBe(true);
  });
});
