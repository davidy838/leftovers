import { AiError, extract } from "@/lib/ai/extract";
import { ExtractRejected } from "@/lib/ai/postprocess";
import { jsonError, readJson, zodError } from "@/lib/http";
import { decodeImage, ImageError } from "@/lib/image.server";
import { enforceRateLimit } from "@/lib/limits";
import { getStore } from "@/lib/store";
import { ExtractRequestSchema, type ExtractResponse } from "@/lib/types";

// Vision calls can take a while; give serverless hosts room.
export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "aiExtract");
  if (limited) return limited;

  const body = await readJson(req);
  if (body === undefined) return jsonError(400, "invalid_json", "Body must be JSON");
  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  let image;
  try {
    image = decodeImage(parsed.data.image);
  } catch (e) {
    if (e instanceof ImageError) return jsonError(400, "invalid_image", e.message);
    throw e;
  }

  try {
    const result = await extract(parsed.data.mode, image);
    const run = await getStore().createAiRun({
      mode: parsed.data.mode,
      model: result.model,
      promptVersion: result.promptVersion,
      output: result.suggestion,
      latencyMs: result.latencyMs,
    });
    const res: ExtractResponse = { runId: run.id, mode: parsed.data.mode, ai: result.ai, suggestion: result.suggestion };
    return Response.json(res);
  } catch (err) {
    if (err instanceof ExtractRejected) return jsonError(422, err.code, err.message);
    if (err instanceof AiError) return jsonError(err.code === "ai_refused" ? 503 : 502, err.code, err.message);
    console.error("[api/ai/extract]", err);
    return jsonError(500, "internal", "Something went wrong analysing that image");
  }
}
