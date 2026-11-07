// Pure scoring functions for the offline eval (docs/LLD.md §7.6).
import { z } from "zod";
import { DietaryTagSchema } from "../types";

export const FoodExpectedSchema = z.object({
  is_food: z.boolean(),
  dietary_tags: z.array(DietaryTagSchema).default([]),
  est_servings: z.number().int().positive().nullable().default(null),
});
export const PosterExpectedSchema = z.object({
  is_event_with_food: z.boolean(),
  date: z.string().nullable().default(null),
  start_time: z.string().nullable().default(null),
  building_id: z.string().nullable().default(null),
});

export const LabelSchema = z.discriminatedUnion("mode", [
  z.object({ file: z.string(), mode: z.literal("food"), expected: FoodExpectedSchema }),
  z.object({ file: z.string(), mode: z.literal("poster"), expected: PosterExpectedSchema }),
]);
export const LabelsFileSchema = z.array(LabelSchema);
export type Label = z.infer<typeof LabelSchema>;
export type FoodExpected = z.infer<typeof FoodExpectedSchema>;
export type PosterExpected = z.infer<typeof PosterExpectedSchema>;

/** What the pipeline produced for one image (after post-processing). */
export type FoodPrediction = { is_food: boolean; dietary_tags: string[]; est_servings: number | null };
export type PosterPrediction = {
  is_event_with_food: boolean;
  date: string | null;
  start_time: string | null;
  building_id: string | null;
};

export interface FoodCaseScore {
  isFoodCorrect: boolean;
  tagTP: number;
  tagFP: number;
  tagFN: number;
  /** null when not applicable (no expected servings or not food) */
  servingsWithin50: boolean | null;
}

export function scoreFood(expected: FoodExpected, pred: FoodPrediction): FoodCaseScore {
  const exp = new Set(expected.dietary_tags);
  const got = new Set(pred.dietary_tags);
  let tp = 0;
  for (const t of got) if (exp.has(t as never)) tp++;
  const servingsWithin50 =
    expected.is_food && expected.est_servings !== null
      ? pred.est_servings !== null &&
        Math.abs(pred.est_servings - expected.est_servings) <= 0.5 * expected.est_servings
      : null;
  return {
    isFoodCorrect: expected.is_food === pred.is_food,
    tagTP: tp,
    tagFP: got.size - tp,
    tagFN: exp.size - tp,
    servingsWithin50,
  };
}

export interface PosterCaseScore {
  detectionCorrect: boolean;
  dateCorrect: boolean | null;
  startCorrect: boolean | null;
  buildingCorrect: boolean | null;
  /** model produced a building that isn't the labelled one (incl. labelled null) */
  inventedLocation: boolean;
}

export function scorePoster(expected: PosterExpected, pred: PosterPrediction): PosterCaseScore {
  const applicable = expected.is_event_with_food && pred.is_event_with_food;
  return {
    detectionCorrect: expected.is_event_with_food === pred.is_event_with_food,
    dateCorrect: applicable ? expected.date === pred.date : null,
    startCorrect: applicable ? expected.start_time === pred.start_time : null,
    buildingCorrect: applicable && expected.building_id !== null ? expected.building_id === pred.building_id : null,
    inventedLocation: applicable && pred.building_id !== null && pred.building_id !== expected.building_id,
  };
}

const rate = (xs: (boolean | null)[]) => {
  const v = xs.filter((x): x is boolean => x !== null);
  return v.length ? v.filter(Boolean).length / v.length : null;
};

export function summarizeFood(scores: FoodCaseScore[]) {
  const tp = scores.reduce((s, c) => s + c.tagTP, 0);
  const fp = scores.reduce((s, c) => s + c.tagFP, 0);
  const fn = scores.reduce((s, c) => s + c.tagFN, 0);
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
  return {
    n: scores.length,
    isFoodAccuracy: rate(scores.map((s) => s.isFoodCorrect)),
    tagPrecision: precision,
    tagRecall: recall,
    tagF1: f1,
    servingsWithin50: rate(scores.map((s) => s.servingsWithin50)),
  };
}

export function summarizePoster(scores: PosterCaseScore[]) {
  return {
    n: scores.length,
    detectionAccuracy: rate(scores.map((s) => s.detectionCorrect)),
    dateAccuracy: rate(scores.map((s) => s.dateCorrect)),
    startTimeAccuracy: rate(scores.map((s) => s.startCorrect)),
    buildingAccuracy: rate(scores.map((s) => s.buildingCorrect)),
    inventedLocationRate: rate(scores.map((s) => s.inventedLocation)),
  };
}
