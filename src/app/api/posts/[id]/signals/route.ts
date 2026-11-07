import { getClientId, isUuid, jsonError, readJson, zodError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/limits";
import { deriveStatus, toPublic } from "@/lib/status";
import { getStore } from "@/lib/store";
import { SignalRequestSchema } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return jsonError(404, "not_found", "Post not found");
  const clientId = getClientId(req);
  if (!clientId) return jsonError(400, "missing_client_id", "Missing or invalid x-client-id header");
  const limited = enforceRateLimit(req, "signal");
  if (limited) return limited;

  const body = await readJson(req);
  if (body === undefined) return jsonError(400, "invalid_json", "Body must be JSON");
  const parsed = SignalRequestSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  try {
    const store = getStore();
    const existing = await store.getPost(id);
    if (!existing) return jsonError(404, "not_found", "Post not found");
    if (deriveStatus(existing) !== "live") {
      return jsonError(409, "post_not_live", "This post isn't live right now");
    }
    const updated = await store.recordSignal(id, clientId, parsed.data.type);
    if (!updated) return jsonError(404, "not_found", "Post not found");
    const owned = await store.ownedPostIds(clientId, [id]);
    return Response.json({ post: toPublic(updated, owned) });
  } catch (err) {
    console.error("[api/signals]", err);
    return jsonError(500, "internal", "Could not record that");
  }
}
