/**
 * Offline eval (docs/LLD.md §7.6). Runs the real extraction pipeline over hand-labelled images
 * and scores it. COSTS REAL API CREDITS: one Claude call per image.
 *
 *   npm run eval                     # uses evals/labels.json
 *   npm run eval -- --labels evals/labels.example.json --limit 5
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { extract } from "../src/lib/ai/extract";
import { ExtractRejected } from "../src/lib/ai/postprocess";
import { FOOD_PROMPT_VERSION, POSTER_PROMPT_VERSION } from "../src/lib/ai/prompts";
import { aiMode, aiModel } from "../src/lib/config";
import { decodeImage } from "../src/lib/image.server";
import {
  LabelsFileSchema,
  scoreFood,
  scorePoster,
  summarizeFood,
  summarizePoster,
  type FoodCaseScore,
  type PosterCaseScore,
} from "../src/lib/eval/score";
import { campusToday } from "../src/lib/time";
import type { FoodSuggestion, PosterSuggestion } from "../src/lib/types";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const labelsPath = arg("labels") ?? "evals/labels.json";
const limit = arg("limit") ? Number(arg("limit")) : Infinity;
const imagesDir = arg("images") ?? "evals/images";

const EXT_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

async function main() {
  if (aiMode() !== "live") {
    console.error("AI is in mock mode. Set ANTHROPIC_API_KEY in .env.local (or AI_MODE=live) to run the eval.");
    process.exit(1);
  }
  let labelsRaw: string;
  try {
    labelsRaw = await fs.readFile(labelsPath, "utf8");
  } catch {
    console.error(`No labels file at ${labelsPath}. Copy evals/labels.example.json to evals/labels.json and add your images.`);
    process.exit(1);
  }
  const labels = LabelsFileSchema.parse(JSON.parse(labelsRaw)).slice(0, limit);
  console.log(`Model ${aiModel()} · prompts ${FOOD_PROMPT_VERSION}/${POSTER_PROMPT_VERSION} · ${labels.length} cases`);

  const food: FoodCaseScore[] = [];
  const poster: PosterCaseScore[] = [];
  const rows: unknown[] = [];

  for (const [i, label] of labels.entries()) {
    const file = path.join(imagesDir, label.file);
    const mediaType = EXT_TYPES[path.extname(file).toLowerCase()];
    if (!mediaType) {
      console.warn(`skip ${label.file}: unsupported extension`);
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(file);
    } catch {
      console.warn(`skip ${label.file}: file not found in ${imagesDir}`);
      continue;
    }
    const image = decodeImage({ mediaType, data: bytes.toString("base64") });
    process.stdout.write(`[${i + 1}/${labels.length}] ${label.file} … `);

    let suggestion: FoodSuggestion | PosterSuggestion | null = null;
    let rejected = false;
    let error: string | null = null;
    try {
      suggestion = (await extract(label.mode, image)).suggestion;
    } catch (e) {
      if (e instanceof ExtractRejected) rejected = true;
      else error = e instanceof Error ? e.message : String(e);
    }
    if (error) {
      console.log(`ERROR ${error}`);
      rows.push({ file: label.file, error });
      continue;
    }

    if (label.mode === "food") {
      const s = suggestion as FoodSuggestion | null;
      const pred = { is_food: !rejected, dietary_tags: s?.dietaryTags ?? [], est_servings: s?.estServings ?? null };
      const sc = scoreFood(label.expected, pred);
      food.push(sc);
      rows.push({ file: label.file, mode: "food", expected: label.expected, predicted: pred, score: sc });
      console.log(sc.isFoodCorrect ? "ok" : "WRONG is_food");
    } else {
      const s = suggestion as PosterSuggestion | null;
      const pred = {
        is_event_with_food: !rejected,
        date: s?.availableFrom ? campusDate(s.availableFrom) : null,
        start_time: s?.availableFrom ? campusTime(s.availableFrom) : null,
        building_id: s?.buildingId ?? null,
      };
      const sc = scorePoster(label.expected, pred);
      poster.push(sc);
      rows.push({ file: label.file, mode: "poster", expected: label.expected, predicted: pred, score: sc });
      console.log(sc.inventedLocation ? "INVENTED LOCATION" : sc.detectionCorrect ? "ok" : "WRONG detection");
    }
  }

  const summary = {
    model: aiModel(),
    foodPromptVersion: FOOD_PROMPT_VERSION,
    posterPromptVersion: POSTER_PROMPT_VERSION,
    ranAt: new Date().toISOString(),
    food: summarizeFood(food),
    poster: summarizePoster(poster),
  };
  console.log("\nFood:");
  console.table(fmt(summary.food));
  console.log("Poster:");
  console.table(fmt(summary.poster));

  await fs.mkdir("evals/results", { recursive: true });
  const out = `evals/results/${summary.ranAt.replace(/[:.]/g, "-")}_${FOOD_PROMPT_VERSION}_${POSTER_PROMPT_VERSION}.json`;
  await fs.writeFile(out, JSON.stringify({ summary, rows }, null, 2));
  console.log(`Saved ${out}`);
}

function campusDate(iso: string) {
  return campusToday(new Date(iso)).date;
}
function campusTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Vancouver", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
function fmt(o: Record<string, number | null>) {
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, v === null ? "n/a" : k === "n" ? v : `${(v * 100).toFixed(0)}%`]),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
