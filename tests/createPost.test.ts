import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostFromRequest, CreatePostError, resolveWindow } from "@/lib/posts.server";
import { MemoryStore } from "@/lib/store/memory";
import { CreatePostRequestSchema, type CreatePostRequest } from "@/lib/types";

const now = new Date("2026-11-07T20:00:00.000Z");
const at = (mins: number) => new Date(now.getTime() + mins * 60000).toISOString();
const client = crypto.randomUUID();

// 1x1 JPEG header-ish bytes; only the magic number matters for validation
const tinyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString("base64");

const base = (over: Partial<CreatePostRequest> = {}): CreatePostRequest => ({
  title: "  Pizza  ",
  buildingId: "ICCS",
  source: "manual",
  durationMinutes: 45,
  acknowledged: true,
  ...over,
});

let dir: string;
let store: MemoryStore;
beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "leftovers-test-"));
  store = new MemoryStore(dir);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("CreatePostRequestSchema", () => {
  it("applies defaults and trims", () => {
    const r = CreatePostRequestSchema.parse(base({ room: "" }));
    expect(r).toMatchObject({ title: "Pizza", description: "", room: null, dietaryTags: [], image: null, aiRunId: null });
  });
  it("requires the safety acknowledgement", () => {
    expect(CreatePostRequestSchema.safeParse({ ...base(), acknowledged: false }).success).toBe(false);
  });
  it("requires a duration or end time", () => {
    expect(CreatePostRequestSchema.safeParse(base({ durationMinutes: null })).success).toBe(false);
  });
  it("rejects durations outside the allowed choices", () => {
    expect(CreatePostRequestSchema.safeParse(base({ durationMinutes: 7 })).success).toBe(false);
  });
  it("rejects unknown dietary tags", () => {
    expect(CreatePostRequestSchema.safeParse({ ...base(), dietaryTags: ["paleo"] }).success).toBe(false);
  });
  it("dedupes tags", () => {
    expect(CreatePostRequestSchema.parse(base({ dietaryTags: ["vegan", "vegan"] })).dietaryTags).toEqual(["vegan"]);
  });
});

describe("resolveWindow", () => {
  const w = (over: object) =>
    resolveWindow({ availableFrom: null, durationMinutes: null, expiresAt: null, ...over }, now);
  it("now + duration", () => expect(w({ durationMinutes: 45 })).toEqual({ availableFrom: at(0), expiresAt: at(45) }));
  it("explicit window", () => expect(w({ availableFrom: at(60), expiresAt: at(120) })).toEqual({ availableFrom: at(60), expiresAt: at(120) }));
  it("rejects end before start", () => expect(() => w({ availableFrom: at(60), expiresAt: at(30) })).toThrow(CreatePostError));
  it("rejects windows already over", () => expect(() => w({ availableFrom: at(-120), expiresAt: at(-60) })).toThrow(CreatePostError));
  it("rejects > 12 h", () => expect(() => w({ availableFrom: at(0), expiresAt: at(13 * 60) })).toThrow(CreatePostError));
  it("rejects > 14 days ahead", () => expect(() => w({ availableFrom: at(15 * 1440), expiresAt: at(15 * 1440 + 60) })).toThrow(CreatePostError));
});

describe("createPostFromRequest", () => {
  it("creates a post owned by the client", async () => {
    const post = await createPostFromRequest(store, CreatePostRequestSchema.parse(base()), client, now);
    expect(post).toMatchObject({ title: "Pizza", buildingId: "ICCS", availableFrom: at(0), expiresAt: at(45) });
    expect(await store.ownedPostIds(client, [post.id])).toEqual(new Set([post.id]));
  });

  it("rejects unknown buildings", async () => {
    await expect(createPostFromRequest(store, CreatePostRequestSchema.parse(base({ buildingId: "NOPE" })), client, now)).rejects.toMatchObject({
      code: "unknown_building",
    });
  });

  it("stores a valid photo and rejects a fake one", async () => {
    const ok = await createPostFromRequest(store, CreatePostRequestSchema.parse(base({ image: { mediaType: "image/jpeg", data: tinyJpeg } })), client, now);
    expect(ok.photoUrl).toMatch(/^\/api\/photos\//);
    const fake = Buffer.from("<script>alert(1)</script>").toString("base64");
    await expect(
      createPostFromRequest(store, CreatePostRequestSchema.parse(base({ image: { mediaType: "image/jpeg", data: fake } })), client, now),
    ).rejects.toMatchObject({ code: "invalid_image" });
  });

  it("links the AI run once and records edited fields", async () => {
    const run = await store.createAiRun({
      mode: "food",
      model: "mock",
      promptVersion: "food-v1",
      output: { title: "Pizza", description: "", estServings: 20, dietaryTags: ["vegetarian"], allergens: ["dairy"], confidence: 0.9, lowConfidence: false },
      latencyMs: 1,
    });
    const req = CreatePostRequestSchema.parse(base({ aiRunId: run.id, estServings: 12, dietaryTags: ["vegetarian"], allergens: ["dairy"] }));
    const post = await createPostFromRequest(store, req, client, now);
    expect(post.aiRunId).toBe(run.id);
    expect(await store.getAiRun(run.id)).toMatchObject({ postId: post.id, editedFields: ["estServings"] });

    // second post can't re-use the same run
    const again = await createPostFromRequest(store, req, client, now);
    expect(again.aiRunId).toBeNull();
    expect((await store.getAiRun(run.id))?.postId).toBe(post.id);
  });
});
