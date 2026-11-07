import { connection } from "next/server";
import { getClientId, jsonError, readJson, zodError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/limits";
import { createPostFromRequest, CreatePostError } from "@/lib/posts.server";
import { buildFeed, toPublic } from "@/lib/status";
import { getStore } from "@/lib/store";
import { CreatePostRequestSchema } from "@/lib/types";

export async function GET(req: Request) {
  await connection(); // always run per request (cacheComponents would otherwise prerender)
  try {
    const store = getStore();
    const now = new Date();
    const posts = await store.listPosts();
    const clientId = getClientId(req);
    const owned = clientId ? await store.ownedPostIds(clientId, posts.map((p) => p.id)) : new Set<string>();
    const feed = buildFeed(posts.map((p) => toPublic(p, owned, now)), now);
    return Response.json({ posts: feed, serverTime: now.toISOString() });
  } catch (err) {
    console.error("[api/posts GET]", err);
    return jsonError(500, "internal", "Could not load posts");
  }
}

export async function POST(req: Request) {
  const clientId = getClientId(req);
  if (!clientId) return jsonError(400, "missing_client_id", "Missing or invalid x-client-id header");
  const limited = enforceRateLimit(req, "createPost");
  if (limited) return limited;

  const body = await readJson(req);
  if (body === undefined) return jsonError(400, "invalid_json", "Body must be JSON");
  const parsed = CreatePostRequestSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  try {
    const store = getStore();
    const post = await createPostFromRequest(store, parsed.data, clientId);
    return Response.json({ post: toPublic(post, new Set([post.id])) }, { status: 201 });
  } catch (err) {
    if (err instanceof CreatePostError) return jsonError(400, err.code, err.message);
    console.error("[api/posts POST]", err);
    return jsonError(500, "internal", "Could not create the post");
  }
}
