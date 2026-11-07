// What Claude must output (docs/LLD.md §7.2). Kept flat: range checks live in postprocess.ts,
// because structured outputs support only a subset of JSON Schema.
import { z } from "zod";
import { AllergenSchema, DietaryTagSchema } from "../types";

export const RawFoodSchema = z.object({
  is_food: z.boolean().describe("true only if the photo clearly shows food or drink to share"),
  title: z.string().describe("short, friendly post title, max ~60 chars, e.g. 'Leftover cheese pizza'"),
  items: z.array(z.string()).describe("distinct food items visible"),
  est_servings: z.number().nullable().describe("rough number of individual servings visible, or null if unclear"),
  dietary_tags: z.array(DietaryTagSchema).describe("only tags clearly supported by what is visible"),
  possible_allergens: z.array(AllergenSchema).describe("allergens the food may plausibly contain"),
  confidence: z.number().describe("0 to 1: confidence in this description overall"),
  notes: z.string().nullable().describe("one short helpful note for students, or null"),
});
export type RawFood = z.infer<typeof RawFoodSchema>;

export const RawPosterSchema = z.object({
  is_event_with_food: z.boolean().describe("true only if the image announces an event that offers food"),
  title: z.string().nullable().describe("event name"),
  date: z.string().nullable().describe("event date as YYYY-MM-DD, or null if not stated"),
  start_time: z.string().nullable().describe("24h HH:MM start time, or null"),
  end_time: z.string().nullable().describe("24h HH:MM end time, or null"),
  location_text: z.string().nullable().describe("location exactly as written on the poster, or null"),
  room: z.string().nullable().describe("room number if stated, or null"),
  food_mentioned: z.array(z.string()).describe("food or drinks mentioned"),
  dietary_tags: z.array(DietaryTagSchema).describe("only tags the poster explicitly states"),
  confidence: z.number().describe("0 to 1: confidence in the extracted details overall"),
});
export type RawPoster = z.infer<typeof RawPosterSchema>;
