// Deterministic stand-in used when no ANTHROPIC_API_KEY is set, so the whole app works
// offline. The UI labels these results "Demo AI" so nobody mistakes them for real output.
import { campusToday } from "../time";
import type { RawFood, RawPoster } from "./schemas";

export function mockFood(): RawFood {
  return {
    is_food: true,
    title: "Leftover cheese pizza (demo AI)",
    items: ["cheese pizza", "veggie pizza"],
    est_servings: 16,
    dietary_tags: ["vegetarian"],
    possible_allergens: ["dairy", "gluten"],
    confidence: 0.8,
    notes: "Demo suggestion: add ANTHROPIC_API_KEY to get real analysis of your photo",
  };
}

export function mockPoster(now: Date = new Date()): RawPoster {
  return {
    is_event_with_food: true,
    title: "CS Club social (demo AI)",
    // tomorrow, so the demo post is always in the future whatever time you test
    date: campusToday(new Date(now.getTime() + 24 * 60 * 60 * 1000)).date,
    start_time: "18:00",
    end_time: "20:00",
    location_text: "ICICS X836",
    room: "X836",
    food_mentioned: ["pizza", "pop"],
    dietary_tags: [],
    confidence: 0.75,
  };
}
