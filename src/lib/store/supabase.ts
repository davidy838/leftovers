// Supabase-backed store (docs/LLD.md §8.3). Server only — uses the service-role key.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GONE_THRESHOLD } from "../constants";
import type { AiRun, ImageMediaType, NewAiRun, NewPost, Post, SignalType, Stats, Suggestion } from "../types";
import { computeStats, EXT_FOR, type PostStore } from "./types";

type PostRow = {
  id: string;
  title: string;
  description: string;
  building_id: string;
  room: string | null;
  photo_url: string | null;
  est_servings: number | null;
  dietary_tags: string[];
  allergens: string[];
  source: Post["source"];
  available_from: string;
  expires_at: string;
  status: Post["status"];
  heading_count: number;
  gone_count: number;
  ai_run_id: string | null;
  created_at: string;
};

type AiRunRow = {
  id: string;
  mode: AiRun["mode"];
  model: string;
  prompt_version: string;
  output: Suggestion;
  latency_ms: number;
  post_id: string | null;
  edited_fields: string[] | null;
  created_at: string;
};

const iso = (t: string) => new Date(t).toISOString();

export function rowToPost(r: PostRow): Post {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    buildingId: r.building_id,
    room: r.room,
    photoUrl: r.photo_url,
    estServings: r.est_servings,
    dietaryTags: r.dietary_tags as Post["dietaryTags"],
    allergens: r.allergens as Post["allergens"],
    source: r.source,
    availableFrom: iso(r.available_from),
    expiresAt: iso(r.expires_at),
    status: r.status,
    headingCount: r.heading_count,
    goneCount: r.gone_count,
    aiRunId: r.ai_run_id,
    createdAt: iso(r.created_at),
  };
}

function rowToRun(r: AiRunRow): AiRun {
  return {
    id: r.id,
    mode: r.mode,
    model: r.model,
    promptVersion: r.prompt_version,
    output: r.output,
    latencyMs: r.latency_ms,
    postId: r.post_id,
    editedFields: r.edited_fields,
    createdAt: iso(r.created_at),
  };
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`[supabase] ${what}: ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements PostStore {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listPosts(): Promise<Post[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows = check(
      await this.db.from("posts").select("*").neq("status", "removed").gt("expires_at", cutoff).limit(500),
      "listPosts",
    ) as PostRow[];
    return rows.map(rowToPost);
  }

  async getPost(id: string): Promise<Post | null> {
    const row = check(await this.db.from("posts").select("*").eq("id", id).maybeSingle(), "getPost") as PostRow | null;
    return row ? rowToPost(row) : null;
  }

  async createPost(p: NewPost, ownerClientId: string): Promise<Post> {
    const row = check(
      await this.db
        .from("posts")
        .insert({
          title: p.title,
          description: p.description,
          building_id: p.buildingId,
          room: p.room,
          photo_url: p.photoUrl,
          est_servings: p.estServings,
          dietary_tags: p.dietaryTags,
          allergens: p.allergens,
          source: p.source,
          available_from: p.availableFrom,
          expires_at: p.expiresAt,
          ai_run_id: p.aiRunId,
        })
        .select("*")
        .single(),
      "createPost",
    ) as PostRow;
    check(await this.db.from("post_owners").insert({ post_id: row.id, client_id: ownerClientId }), "createPost.owner");
    return rowToPost(row);
  }

  async ownedPostIds(clientId: string, postIds: string[]): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    const rows = check(
      await this.db.from("post_owners").select("post_id").eq("client_id", clientId).in("post_id", postIds),
      "ownedPostIds",
    ) as { post_id: string }[];
    return new Set(rows.map((r) => r.post_id));
  }

  async recordSignal(postId: string, clientId: string, type: SignalType): Promise<Post | null> {
    const rows = check(
      await this.db.rpc("record_signal", {
        p_post_id: postId,
        p_client_id: clientId,
        p_type: type,
        p_gone_threshold: GONE_THRESHOLD,
      }),
      "recordSignal",
    ) as PostRow[] | null;
    const row = rows?.[0];
    return row ? rowToPost(row) : null;
  }

  async savePhoto(bytes: Uint8Array, mediaType: ImageMediaType): Promise<string> {
    const objectPath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${EXT_FOR[mediaType]}`;
    const up = await this.db.storage.from("photos").upload(objectPath, bytes, { contentType: mediaType, upsert: false });
    if (up.error) throw new Error(`[supabase] savePhoto: ${up.error.message}`);
    return this.db.storage.from("photos").getPublicUrl(objectPath).data.publicUrl;
  }

  async createAiRun(run: NewAiRun): Promise<AiRun> {
    const row = check(
      await this.db
        .from("ai_runs")
        .insert({
          mode: run.mode,
          model: run.model,
          prompt_version: run.promptVersion,
          output: run.output,
          latency_ms: run.latencyMs,
        })
        .select("*")
        .single(),
      "createAiRun",
    ) as AiRunRow;
    return rowToRun(row);
  }

  async getAiRun(id: string): Promise<AiRun | null> {
    const row = check(await this.db.from("ai_runs").select("*").eq("id", id).maybeSingle(), "getAiRun") as AiRunRow | null;
    return row ? rowToRun(row) : null;
  }

  async linkAiRun(id: string, postId: string, editedFields: string[]): Promise<void> {
    check(await this.db.from("ai_runs").update({ post_id: postId, edited_fields: editedFields }).eq("id", id), "linkAiRun");
  }

  async getStats(): Promise<Stats> {
    const posts = check(
      await this.db.from("posts").select("status, est_servings").limit(10_000),
      "getStats.posts",
    ) as { status: Post["status"]; est_servings: number | null }[];
    const runs = check(
      await this.db.from("ai_runs").select("post_id, edited_fields").limit(10_000),
      "getStats.runs",
    ) as { post_id: string | null; edited_fields: string[] | null }[];
    return computeStats(
      posts.map((p) => ({ status: p.status, estServings: p.est_servings })),
      runs.map((r) => ({ postId: r.post_id, editedFields: r.edited_fields })),
    );
  }
}
