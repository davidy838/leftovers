// Domain schemas — the single source of truth for shapes (docs/LLD.md §4, §6).
// Client and server both import from here. Do not hand-write duplicate interfaces.
import { z } from "zod";
import { DURATION_CHOICES } from "./constants";

// ---------- enums ----------
export const DIETARY_TAGS = [
  "vegetarian",
  "vegan",
  "halal",
  "kosher",
  "gluten_free",
  "dairy_free",
] as const;
export const DietaryTagSchema = z.enum(DIETARY_TAGS);
export type DietaryTag = z.infer<typeof DietaryTagSchema>;

export const ALLERGENS = [
  "peanuts",
  "tree_nuts",
  "dairy",
  "gluten",
  "eggs",
  "soy",
  "fish",
  "shellfish",
  "sesame",
] as const;
export const AllergenSchema = z.enum(ALLERGENS);
export type Allergen = z.infer<typeof AllergenSchema>;

export const PostSourceSchema = z.enum(["photo", "poster", "manual"]);
export type PostSource = z.infer<typeof PostSourceSchema>;

export const StoredStatusSchema = z.enum(["active", "gone", "removed"]);
export type StoredStatus = z.infer<typeof StoredStatusSchema>;

export type DisplayStatus = "upcoming" | "live" | "gone" | "expired";

export const SignalTypeSchema = z.enum(["heading", "gone"]);
export type SignalType = z.infer<typeof SignalTypeSchema>;

export const ExtractModeSchema = z.enum(["food", "poster"]);
export type ExtractMode = z.infer<typeof ExtractModeSchema>;

export const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ImageMediaTypeSchema = z.enum(IMAGE_MEDIA_TYPES);
export type ImageMediaType = z.infer<typeof ImageMediaTypeSchema>;

// ---------- building ----------
export interface Building {
  id: string;
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
}

// ---------- post ----------
const uniqueArray = <T extends z.ZodType>(item: T) =>
  z.array(item).transform((arr) => Array.from(new Set(arr)) as z.infer<T>[]);

export const PostSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(80),
  description: z.string().max(500),
  buildingId: z.string().min(1),
  room: z.string().max(40).nullable(),
  photoUrl: z.string().nullable(),
  estServings: z.number().int().min(1).max(500).nullable(),
  dietaryTags: z.array(DietaryTagSchema),
  allergens: z.array(AllergenSchema),
  source: PostSourceSchema,
  availableFrom: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  status: StoredStatusSchema,
  headingCount: z.number().int().min(0),
  goneCount: z.number().int().min(0),
  aiRunId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});
export type Post = z.infer<typeof PostSchema>;

/** What a store needs to create a post (server fills id/createdAt/counts/status). */
export type NewPost = Omit<Post, "id" | "createdAt" | "status" | "headingCount" | "goneCount">;

export type PublicPost = Post & { displayStatus: DisplayStatus; isMine: boolean };

// ---------- images ----------
export const ImageInputSchema = z.object({
  mediaType: ImageMediaTypeSchema,
  // base64 without data: prefix. ~4.1M chars ≈ 3 MB decoded; exact byte check happens server-side.
  data: z.string().min(1).max(4_200_000),
});
export type ImageInput = z.infer<typeof ImageInputSchema>;

// ---------- requests ----------
const trimmed = (max: number) => z.string().trim().max(max);

export const CreatePostRequestSchema = z
  .object({
    title: trimmed(80).min(1, "Title is required"),
    description: trimmed(500).default(""),
    buildingId: z.string().min(1, "Pick a building"),
    room: trimmed(40)
      .nullish()
      .transform((v) => (v ? v : null)),
    estServings: z.number().int().min(1).max(500).nullish().transform((v) => v ?? null),
    dietaryTags: uniqueArray(DietaryTagSchema).default([]),
    allergens: uniqueArray(AllergenSchema).default([]),
    source: PostSourceSchema,
    availableFrom: z.iso.datetime().nullish().transform((v) => v ?? null),
    durationMinutes: z
      .number()
      .int()
      .refine((n) => (DURATION_CHOICES as readonly number[]).includes(n), "Invalid duration")
      .nullish()
      .transform((v) => v ?? null),
    expiresAt: z.iso.datetime().nullish().transform((v) => v ?? null),
    image: ImageInputSchema.nullish().transform((v) => v ?? null),
    aiRunId: z.uuid().nullish().transform((v) => v ?? null),
    acknowledged: z.literal(true, { error: "Please confirm the food-safety note" }),
  })
  .refine((r) => r.durationMinutes !== null || r.expiresAt !== null, {
    message: "Provide durationMinutes or expiresAt",
    path: ["durationMinutes"],
  });
export type CreatePostRequest = z.input<typeof CreatePostRequestSchema>;
export type CreatePostParsed = z.output<typeof CreatePostRequestSchema>;

export const SignalRequestSchema = z.object({ type: SignalTypeSchema });

export const ExtractRequestSchema = z.object({
  mode: ExtractModeSchema,
  image: ImageInputSchema,
});

// ---------- AI ----------
export interface FoodSuggestion {
  title: string;
  description: string;
  estServings: number | null;
  dietaryTags: DietaryTag[];
  allergens: Allergen[];
  confidence: number;
  lowConfidence: boolean;
}

export interface PosterSuggestion {
  title: string;
  description: string;
  buildingId: string | null;
  locationText: string | null;
  room: string | null;
  availableFrom: string | null;
  expiresAt: string | null;
  dietaryTags: DietaryTag[];
  confidence: number;
  lowConfidence: boolean;
}

export type Suggestion = FoodSuggestion | PosterSuggestion;

export interface AiRun {
  id: string;
  mode: ExtractMode;
  model: string;
  promptVersion: string;
  output: Suggestion;
  latencyMs: number;
  postId: string | null;
  editedFields: string[] | null;
  createdAt: string;
}
export type NewAiRun = Omit<AiRun, "id" | "createdAt" | "postId" | "editedFields">;

export interface ExtractResponse {
  runId: string;
  mode: ExtractMode;
  ai: "live" | "mock";
  suggestion: Suggestion;
}

// ---------- stats ----------
export interface Stats {
  postsShared: number;
  servingsClaimed: number;
  ai: { runs: number; runsUsed: number; runsEdited: number; fieldEditRate: number | null };
}

// ---------- errors ----------
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
