// Claude vision + structured outputs (docs/LLD.md §7.1). Server only.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { aiMode, aiModel } from "../config";
import type { DecodedImage } from "../image.server";
import { campusToday } from "../time";
import type { ExtractMode, Suggestion } from "../types";
import { mockFood, mockPoster } from "./mock";
import { postprocessFood, postprocessPoster } from "./postprocess";
import {
  FOOD_PROMPT_VERSION,
  FOOD_SYSTEM_PROMPT,
  foodUserText,
  POSTER_PROMPT_VERSION,
  POSTER_SYSTEM_PROMPT,
  posterUserText,
} from "./prompts";
import { RawFoodSchema, RawPosterSchema, type RawFood, type RawPoster } from "./schemas";

export class AiError extends Error {
  constructor(
    readonly code: "ai_failed" | "ai_refused",
    message: string,
  ) {
    super(message);
  }
}

export interface ExtractResult {
  suggestion: Suggestion;
  raw: RawFood | RawPoster;
  ai: "live" | "mock";
  model: string;
  promptVersion: string;
  latencyMs: number;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // Resolves ANTHROPIC_API_KEY (or another configured credential) from the environment.
  client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}

async function callClaude<S extends z.ZodType>(
  schema: S,
  system: string,
  userText: string,
  image: DecodedImage,
): Promise<{ parsed: z.infer<S>; model: string }> {
  const model = aiModel();
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model,
      max_tokens: 2048,
      // Server-side refusal fallback: if a safety classifier declines, the API retries on a
      // suitable fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
            { type: "text", text: userText },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new AiError("ai_failed", "The AI is busy right now. Try again in a moment, or fill the form in by hand.");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[ai] authentication failed. Check ANTHROPIC_API_KEY");
      throw new AiError("ai_failed", "AI is misconfigured on the server.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[ai] API error ${err.status}:`, err.message);
      throw new AiError("ai_failed", "The AI request failed. You can still fill the form in by hand.");
    }
    console.error("[ai] unexpected error:", err);
    throw new AiError("ai_failed", "The AI request failed. You can still fill the form in by hand.");
  }

  if (response.stop_reason === "refusal") {
    throw new AiError("ai_refused", "The AI declined to analyse this image. Please fill the form in by hand.");
  }
  if (response.parsed_output === null || response.parsed_output === undefined) {
    console.error("[ai] no parsable output; stop_reason =", response.stop_reason);
    throw new AiError("ai_failed", "The AI returned something unreadable. Please fill the form in by hand.");
  }
  return { parsed: response.parsed_output as z.infer<S>, model: response.model ?? model };
}

/**
 * Run extraction for one image. Throws ExtractRejected (not food / no event) or AiError.
 */
export async function extract(mode: ExtractMode, image: DecodedImage, now: Date = new Date()): Promise<ExtractResult> {
  const started = Date.now();
  const today = campusToday(now);
  const live = aiMode() === "live";

  if (mode === "food") {
    const { parsed, model } = live
      ? await callClaude(RawFoodSchema, FOOD_SYSTEM_PROMPT, foodUserText(today), image)
      : { parsed: mockFood(), model: "mock" };
    return {
      suggestion: postprocessFood(parsed),
      raw: parsed,
      ai: live ? "live" : "mock",
      model,
      promptVersion: FOOD_PROMPT_VERSION,
      latencyMs: Date.now() - started,
    };
  }

  const { parsed, model } = live
    ? await callClaude(RawPosterSchema, POSTER_SYSTEM_PROMPT, posterUserText(today), image)
    : { parsed: mockPoster(now), model: "mock" };
  return {
    suggestion: postprocessPoster(parsed),
    raw: parsed,
    ai: live ? "live" : "mock",
    model,
    promptVersion: POSTER_PROMPT_VERSION,
    latencyMs: Date.now() - started,
  };
}
