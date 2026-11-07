// Versioned prompts (docs/LLD.md §7.4). BUMP THE VERSION ON EVERY CHANGE so eval results
// and logged AiRuns can be compared across versions. Keep system prompts static (cacheable);
// put per-request facts (today's date) in the user message.
import { BUILDINGS } from "../buildings";

export const FOOD_PROMPT_VERSION = "food-v1";
export const POSTER_PROMPT_VERSION = "poster-v1";

export const FOOD_SYSTEM_PROMPT = `You help students share leftover food from campus events.
You will see one photo that someone wants to post so other students can come eat it.

Describe what is shareable so a hungry student can decide whether to walk over:
- If the photo does not clearly show food or drink, set is_food to false.
- Estimate individual servings only from what is visible (e.g. 3 pizza boxes, about 8 slices each, mostly full is roughly 20). Use null if you can't tell.
- Dietary tags are a promise to someone with restrictions, so add one only when it is clearly supported (for example, a plain cheese pizza is vegetarian). Leave tags empty when unsure. A missing tag is fine; a wrong tag can hurt someone.
- Allergens are a caution, not a promise. List any that the food may plausibly contain (cheese means dairy, bread means gluten).
- Lower your confidence for blurry, dark or ambiguous photos.
- The title is short and plain (no emojis, no exclamation marks).`;

const BUILDING_HINT = BUILDINGS.map((b) => b.name).join("; ");

export const POSTER_SYSTEM_PROMPT = `You read event posters and social-media announcements for a university campus (UBC Vancouver)
and extract details for events that offer free food.

- If the image does not announce an event offering food, set is_event_with_food to false.
- Copy location_text exactly as written. Do not guess a building that isn't written. Known campus buildings include: ${BUILDING_HINT}.
- Resolve relative dates ("this Friday", "tomorrow") using the current date you are given. If no date is stated, use null.
- Times are 24h HH:MM. If only a start time is given, end_time is null.
- Dietary tags only when the poster states them explicitly (e.g. "vegan options").
- Use null for anything not stated. Never invent details.`;

export function foodUserText(today: { date: string; weekday: string }): string {
  return `Today is ${today.weekday}, ${today.date}. Describe the shareable food in this photo.`;
}

export function posterUserText(today: { date: string; weekday: string }): string {
  return `Today is ${today.weekday}, ${today.date} (America/Vancouver). Extract the event details from this image.`;
}
