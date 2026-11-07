// Post status derivation + feed ordering (docs/LLD.md §5).
import { FEED_UPCOMING_DAYS } from "./constants";
import type { DisplayStatus, Post, PublicPost } from "./types";

export function deriveStatus(
  post: Pick<Post, "status" | "availableFrom" | "expiresAt">,
  now: Date = new Date(),
): DisplayStatus {
  if (post.status === "gone" || post.status === "removed") return "gone";
  const t = now.getTime();
  if (t >= Date.parse(post.expiresAt)) return "expired";
  if (t < Date.parse(post.availableFrom)) return "upcoming";
  return "live";
}

export function toPublic(post: Post, ownedIds: Set<string>, now: Date = new Date()): PublicPost {
  return { ...post, displayStatus: deriveStatus(post, now), isMine: ownedIds.has(post.id) };
}

/**
 * Feed = live posts (ending soonest first), then upcoming posts within
 * FEED_UPCOMING_DAYS (starting soonest first). Everything else is dropped.
 */
export function buildFeed(posts: PublicPost[], now: Date = new Date()): PublicPost[] {
  const horizon = now.getTime() + FEED_UPCOMING_DAYS * 24 * 60 * 60 * 1000;
  const live = posts
    .filter((p) => p.displayStatus === "live")
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  const upcoming = posts
    .filter((p) => p.displayStatus === "upcoming" && Date.parse(p.availableFrom) <= horizon)
    .sort((a, b) => Date.parse(a.availableFrom) - Date.parse(b.availableFrom));
  return [...live, ...upcoming];
}
