// Storage abstraction (docs/LLD.md §8.1). Both implementations must behave identically;
// tests/memoryStore.test.ts is the behavioural spec.
import type { AiRun, ImageMediaType, NewAiRun, NewPost, Post, SignalType, Stats } from "../types";

export interface PostStore {
  readonly kind: "memory" | "supabase";
  /** Non-removed posts whose expiresAt is within the last 24 h or in the future. */
  listPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(post: NewPost, ownerClientId: string): Promise<Post>;
  ownedPostIds(clientId: string, postIds: string[]): Promise<Set<string>>;
  /**
   * Atomically: dedupe (postId, clientId, type), bump the matching counter, and for
   * `gone` mark the post gone if the caller owns it or goneCount ≥ GONE_THRESHOLD.
   * Returns the updated post, or null if the post does not exist.
   */
  recordSignal(postId: string, clientId: string, type: SignalType): Promise<Post | null>;
  /** Persist a validated image and return a URL the browser can load. */
  savePhoto(bytes: Uint8Array, mediaType: ImageMediaType): Promise<string>;
  createAiRun(run: NewAiRun): Promise<AiRun>;
  getAiRun(id: string): Promise<AiRun | null>;
  linkAiRun(id: string, postId: string, editedFields: string[]): Promise<void>;
  getStats(): Promise<Stats>;
}

export const EXT_FOR: Record<ImageMediaType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Shared stats math so both stores agree. */
export function computeStats(
  posts: Pick<Post, "status" | "estServings">[],
  runs: Pick<AiRun, "postId" | "editedFields">[],
): Stats {
  const visible = posts.filter((p) => p.status !== "removed");
  const servingsClaimed = visible
    .filter((p) => p.status === "gone")
    .reduce((sum, p) => sum + (p.estServings ?? 0), 0);
  const used = runs.filter((r) => r.postId !== null);
  const edited = used.filter((r) => (r.editedFields?.length ?? 0) > 0);
  return {
    postsShared: visible.length,
    servingsClaimed,
    ai: {
      runs: runs.length,
      runsUsed: used.length,
      runsEdited: edited.length,
      fieldEditRate: used.length ? edited.length / used.length : null,
    },
  };
}
