// Which feed posts are worth an alert? Pure so it can be unit-tested (docs/LLD.md §9).
import type { DietaryTag, PublicPost } from "./types";

/**
 * Posts that weren't in `seenIds`, aren't the viewer's own, are live or upcoming,
 * and carry every dietary tag in `tags` (same AND rule as the feed filter).
 */
export function newMatchingPosts(posts: PublicPost[], seenIds: ReadonlySet<string>, tags: readonly DietaryTag[]): PublicPost[] {
  return posts.filter(
    (p) =>
      !seenIds.has(p.id) &&
      !p.isMine &&
      (p.displayStatus === "live" || p.displayStatus === "upcoming") &&
      tags.every((t) => p.dietaryTags.includes(t)),
  );
}

/** Title for the browser tab: "(2) Leftovers…" when there are unseen alerts. */
export function titleWithCount(base: string, unseen: number): string {
  const clean = base.replace(/^\(\d+\)\s*/, "");
  return unseen > 0 ? `(${unseen}) ${clean}` : clean;
}
