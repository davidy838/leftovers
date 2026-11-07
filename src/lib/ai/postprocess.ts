// Deterministic post-processing of raw model output (docs/LLD.md §7.3).
// AI output is untrusted: clamp, sanitise, and never invent locations.
import { matchBuilding } from "../buildings";
import { LOW_CONFIDENCE, POSTER_AFTER_END_MINUTES, POSTER_DEFAULT_LENGTH_MINUTES } from "../constants";
import { zonedToUtc } from "../time";
import {
  ALLERGENS,
  DIETARY_TAGS,
  type Allergen,
  type DietaryTag,
  type FoodSuggestion,
  type PosterSuggestion,
} from "../types";
import type { RawFood, RawPoster } from "./schemas";

export class ExtractRejected extends Error {
  constructor(
    readonly code: "not_food" | "no_event_found",
    message: string,
  ) {
    super(message);
  }
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function onlyKnown<T extends string>(values: readonly string[], allowed: readonly T[]): T[] {
  const set = new Set<string>(allowed);
  return Array.from(new Set(values.filter((v): v is T => set.has(v))));
}

export function postprocessFood(raw: RawFood): FoodSuggestion {
  if (!raw.is_food) throw new ExtractRejected("not_food", "That photo doesn't look like food. Try another one?");
  const confidence = clamp01(raw.confidence);
  const lowConfidence = confidence < LOW_CONFIDENCE;

  let estServings: number | null = null;
  if (!lowConfidence && raw.est_servings !== null && Number.isFinite(raw.est_servings)) {
    const n = Math.round(raw.est_servings);
    estServings = n >= 1 && n <= 500 ? n : null;
  }

  const items = raw.items.map(clean).filter(Boolean);
  const parts = [items.length ? items.join(", ") : "", clean(raw.notes)].filter(Boolean);

  return {
    title: clip(clean(raw.title) || "Free food", 80),
    description: clip(parts.join(". "), 500),
    estServings,
    dietaryTags: lowConfidence ? [] : onlyKnown<DietaryTag>(raw.dietary_tags, DIETARY_TAGS),
    allergens: onlyKnown<Allergen>(raw.possible_allergens, ALLERGENS), // kept even when unsure
    confidence,
    lowConfidence,
  };
}

export function postprocessPoster(raw: RawPoster): PosterSuggestion {
  if (!raw.is_event_with_food) {
    throw new ExtractRejected("no_event_found", "Couldn't find an event with food on that image.");
  }
  const confidence = clamp01(raw.confidence);
  const lowConfidence = confidence < LOW_CONFIDENCE;

  const locationText = clean(raw.location_text) || null;
  const buildingId = matchBuilding(locationText);

  let start: Date | null = null;
  let end: Date | null = null;
  if (raw.date && raw.start_time) start = zonedToUtc(raw.date.trim(), raw.start_time.trim());
  if (start && raw.date && raw.end_time) {
    end = zonedToUtc(raw.date.trim(), raw.end_time.trim());
    if (end && end <= start) end = null; // e.g. "6pm – late"
  }

  let expires: Date | null = null;
  if (start) {
    expires = end
      ? new Date(end.getTime() + POSTER_AFTER_END_MINUTES * 60000)
      : new Date(start.getTime() + POSTER_DEFAULT_LENGTH_MINUTES * 60000);
  }

  const food = raw.food_mentioned.map(clean).filter(Boolean);
  const room = clean(raw.room) || null;

  return {
    title: clip(clean(raw.title) || (food[0] ? `Free ${food[0]}` : "Free food at an event"), 80),
    description: clip(food.length ? `Food mentioned: ${food.join(", ")}` : "", 500),
    buildingId,
    locationText,
    room: room ? clip(room, 40) : null,
    availableFrom: start ? start.toISOString() : null,
    expiresAt: expires ? expires.toISOString() : null,
    dietaryTags: lowConfidence ? [] : onlyKnown<DietaryTag>(raw.dietary_tags, DIETARY_TAGS),
    confidence,
    lowConfidence,
  };
}
