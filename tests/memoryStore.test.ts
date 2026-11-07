import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GONE_THRESHOLD } from "@/lib/constants";
import { MemoryStore } from "@/lib/store/memory";
import type { NewPost } from "@/lib/types";

let dir: string;
let store: MemoryStore;
const owner = crypto.randomUUID();
const a = crypto.randomUUID();
const b = crypto.randomUUID();

const newPost = (over: Partial<NewPost> = {}): NewPost => ({
  title: "Pizza",
  description: "",
  buildingId: "ICCS",
  room: null,
  photoUrl: null,
  estServings: 10,
  dietaryTags: [],
  allergens: [],
  source: "manual",
  availableFrom: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  aiRunId: null,
  ...over,
});

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "leftovers-test-"));
  store = new MemoryStore(dir);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("MemoryStore", () => {
  it("creates and lists posts, persisting to disk", async () => {
    const p = await store.createPost(newPost(), owner);
    expect(p.status).toBe("active");
    expect(p.headingCount).toBe(0);
    const fresh = new MemoryStore(dir); // new instance reads the file
    expect((await fresh.listPosts()).map((x) => x.id)).toEqual([p.id]);
    expect(await fresh.getPost(p.id)).toMatchObject({ title: "Pizza" });
  });

  it("does not expose owners on posts, but reports ownership", async () => {
    const p = await store.createPost(newPost(), owner);
    expect(JSON.stringify(p)).not.toContain(owner);
    expect(await store.ownedPostIds(owner, [p.id])).toEqual(new Set([p.id]));
    expect(await store.ownedPostIds(a, [p.id])).toEqual(new Set());
  });

  it("dedupes heading signals per device", async () => {
    const p = await store.createPost(newPost(), owner);
    await store.recordSignal(p.id, a, "heading");
    await store.recordSignal(p.id, a, "heading");
    const after = await store.recordSignal(p.id, b, "heading");
    expect(after?.headingCount).toBe(2);
  });

  it(`needs ${GONE_THRESHOLD} distinct non-owner gone reports`, async () => {
    const p = await store.createPost(newPost(), owner);
    expect((await store.recordSignal(p.id, a, "gone"))?.status).toBe("active");
    expect((await store.recordSignal(p.id, a, "gone"))?.status).toBe("active"); // same device again
    expect((await store.recordSignal(p.id, b, "gone"))?.status).toBe("gone");
  });

  it("owner ends a post immediately", async () => {
    const p = await store.createPost(newPost(), owner);
    expect((await store.recordSignal(p.id, owner, "gone"))?.status).toBe("gone");
  });

  it("returns null for unknown posts", async () => {
    expect(await store.recordSignal(crypto.randomUUID(), a, "gone")).toBeNull();
    expect(await store.getPost(crypto.randomUUID())).toBeNull();
  });

  it("serialises concurrent writes without losing any", async () => {
    const p = await store.createPost(newPost(), owner);
    const devices = Array.from({ length: 25 }, () => crypto.randomUUID());
    await Promise.all(devices.map((d) => store.recordSignal(p.id, d, "heading")));
    expect((await store.getPost(p.id))?.headingCount).toBe(25);
  });

  it("hides posts that expired more than a day ago", async () => {
    await store.createPost(
      newPost({ availableFrom: new Date(Date.now() - 3 * 86_400_000).toISOString(), expiresAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }),
      owner,
    );
    expect(await store.listPosts()).toHaveLength(0);
  });

  it("saves photos and links AI runs into stats", async () => {
    const url = await store.savePhoto(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg");
    expect(url).toMatch(/^\/api\/photos\/[0-9a-f-]{36}\.jpg$/);

    const run = await store.createAiRun({
      mode: "food",
      model: "mock",
      promptVersion: "food-v1",
      output: { title: "x", description: "", estServings: null, dietaryTags: [], allergens: [], confidence: 1, lowConfidence: false },
      latencyMs: 5,
    });
    const p = await store.createPost(newPost({ aiRunId: run.id }), owner);
    await store.linkAiRun(run.id, p.id, ["title"]);
    await store.recordSignal(p.id, owner, "gone");
    expect(await store.getStats()).toEqual({
      postsShared: 1,
      servingsClaimed: 10,
      ai: { runs: 1, runsUsed: 1, runsEdited: 1, fieldEditRate: 1 },
    });
  });
});
