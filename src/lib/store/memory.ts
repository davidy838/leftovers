// File-backed store for zero-setup local dev (docs/LLD.md §8.2).
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GONE_THRESHOLD } from "../constants";
import type { AiRun, ImageMediaType, NewAiRun, NewPost, Post, SignalType, Stats } from "../types";
import { computeStats, EXT_FOR, type PostStore } from "./types";

interface DbShape {
  version: 1;
  posts: Post[];
  owners: { postId: string; clientId: string }[];
  signals: { postId: string; clientId: string; type: SignalType; createdAt: string }[];
  aiRuns: AiRun[];
}

const empty = (): DbShape => ({ version: 1, posts: [], owners: [], signals: [], aiRuns: [] });

export function defaultDataDir(): string {
  if (process.env.LEFTOVERS_DATA_DIR) return process.env.LEFTOVERS_DATA_DIR;
  // Vercel/serverless: only the tmp dir is writable (data is ephemeral there — use Supabase to deploy).
  if (process.env.VERCEL) return path.join(os.tmpdir(), "leftovers-data");
  return path.join(process.cwd(), ".data");
}

export class MemoryStore implements PostStore {
  readonly kind = "memory" as const;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly dbFile: string;
  readonly uploadsDir: string;

  constructor(private readonly dir: string = defaultDataDir()) {
    this.dbFile = path.join(dir, "db.json");
    this.uploadsDir = path.join(dir, "uploads");
  }

  /** Serialise all access so read-modify-write is atomic within the process. */
  private run<T>(fn: (db: DbShape) => T | Promise<T>, write: boolean): Promise<T> {
    const next = this.queue.then(async () => {
      const db = await this.load();
      const result = await fn(db);
      if (write) await this.persist(db);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  /**
   * Re-read from disk on every operation (the file is tiny) so `npm run seed` in another
   * process and the dev server never overwrite each other's data with a stale cache.
   */
  private async load(): Promise<DbShape> {
    try {
      const raw = await fs.readFile(this.dbFile, "utf8");
      const parsed = JSON.parse(raw) as DbShape;
      return parsed?.version === 1 ? parsed : empty();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("[memory-store] could not read db.json, starting empty:", err);
      }
      return empty();
    }
  }

  private async persist(db: DbShape): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${this.dbFile}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, this.dbFile);
  }

  listPosts(): Promise<Post[]> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.run(
      (db) => db.posts.filter((p) => p.status !== "removed" && Date.parse(p.expiresAt) > cutoff).map((p) => ({ ...p })),
      false,
    );
  }

  getPost(id: string): Promise<Post | null> {
    return this.run((db) => {
      const p = db.posts.find((x) => x.id === id);
      return p ? { ...p } : null;
    }, false);
  }

  createPost(input: NewPost, ownerClientId: string): Promise<Post> {
    return this.run((db) => {
      const post: Post = {
        ...input,
        id: randomUUID(),
        status: "active",
        headingCount: 0,
        goneCount: 0,
        createdAt: new Date().toISOString(),
      };
      db.posts.push(post);
      db.owners.push({ postId: post.id, clientId: ownerClientId });
      return { ...post };
    }, true);
  }

  ownedPostIds(clientId: string, postIds: string[]): Promise<Set<string>> {
    const wanted = new Set(postIds);
    return this.run(
      (db) => new Set(db.owners.filter((o) => o.clientId === clientId && wanted.has(o.postId)).map((o) => o.postId)),
      false,
    );
  }

  recordSignal(postId: string, clientId: string, type: SignalType): Promise<Post | null> {
    return this.run((db) => {
      const post = db.posts.find((p) => p.id === postId);
      if (!post) return null;
      const dup = db.signals.some((s) => s.postId === postId && s.clientId === clientId && s.type === type);
      if (!dup) {
        db.signals.push({ postId, clientId, type, createdAt: new Date().toISOString() });
        if (type === "heading") post.headingCount += 1;
        else post.goneCount += 1;
      }
      if (type === "gone" && post.status === "active") {
        const isOwner = db.owners.some((o) => o.postId === postId && o.clientId === clientId);
        if (isOwner || post.goneCount >= GONE_THRESHOLD) post.status = "gone";
      }
      return { ...post };
    }, true);
  }

  async savePhoto(bytes: Uint8Array, mediaType: ImageMediaType): Promise<string> {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    const name = `${randomUUID()}.${EXT_FOR[mediaType]}`;
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ this.uploadsDir, name), bytes);
    return `/api/photos/${name}`;
  }

  createAiRun(run: NewAiRun): Promise<AiRun> {
    return this.run((db) => {
      const full: AiRun = { ...run, id: randomUUID(), postId: null, editedFields: null, createdAt: new Date().toISOString() };
      db.aiRuns.push(full);
      return { ...full };
    }, true);
  }

  getAiRun(id: string): Promise<AiRun | null> {
    return this.run((db) => {
      const r = db.aiRuns.find((x) => x.id === id);
      return r ? { ...r } : null;
    }, false);
  }

  linkAiRun(id: string, postId: string, editedFields: string[]): Promise<void> {
    return this.run((db) => {
      const r = db.aiRuns.find((x) => x.id === id);
      if (r) {
        r.postId = postId;
        r.editedFields = editedFields;
      }
    }, true);
  }

  getStats(): Promise<Stats> {
    return this.run((db) => computeStats(db.posts, db.aiRuns), false);
  }
}
