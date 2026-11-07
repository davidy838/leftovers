// Create-post domain logic, separated from the route handler so it is unit-testable.
import { isKnownBuilding } from "./buildings";
import { MAX_POST_HOURS, MAX_SCHEDULE_AHEAD_DAYS } from "./constants";
import { diffSuggestion } from "./edits";
import { decodeImage, ImageError } from "./image.server";
import type { PostStore } from "./store/types";
import type { CreatePostParsed, Post } from "./types";

export class CreatePostError extends Error {
  constructor(
    readonly code: "unknown_building" | "invalid_image" | "invalid_window",
    message: string,
  ) {
    super(message);
  }
}

/** Resolve availableFrom/expiresAt and enforce window rules (docs/LLD.md §4.2). */
export function resolveWindow(
  req: Pick<CreatePostParsed, "availableFrom" | "durationMinutes" | "expiresAt">,
  now: Date = new Date(),
): { availableFrom: string; expiresAt: string } {
  // null → now. A start in the past is fine (the event already began); the end must be in the future.
  const fromMs = req.availableFrom ? Date.parse(req.availableFrom) : now.getTime();
  // expiresAt wins over durationMinutes when both are sent.
  const expMs = req.expiresAt ? Date.parse(req.expiresAt) : fromMs + (req.durationMinutes ?? 0) * 60000;

  if (fromMs > now.getTime() + MAX_SCHEDULE_AHEAD_DAYS * 86_400_000) {
    throw new CreatePostError("invalid_window", `Posts can be scheduled at most ${MAX_SCHEDULE_AHEAD_DAYS} days ahead`);
  }
  if (expMs <= fromMs) throw new CreatePostError("invalid_window", "End time must be after the start time");
  if (expMs <= now.getTime()) throw new CreatePostError("invalid_window", "End time is already in the past");
  if (expMs - fromMs > MAX_POST_HOURS * 3_600_000) {
    throw new CreatePostError("invalid_window", `A post can last at most ${MAX_POST_HOURS} hours`);
  }
  return { availableFrom: new Date(fromMs).toISOString(), expiresAt: new Date(expMs).toISOString() };
}

export async function createPostFromRequest(
  store: PostStore,
  req: CreatePostParsed,
  clientId: string,
  now: Date = new Date(),
): Promise<Post> {
  if (!isKnownBuilding(req.buildingId)) {
    throw new CreatePostError("unknown_building", "Pick a building from the list");
  }
  const window = resolveWindow(req, now);

  let photoUrl: string | null = null;
  if (req.image) {
    let decoded;
    try {
      decoded = decodeImage(req.image);
    } catch (e) {
      if (e instanceof ImageError) throw new CreatePostError("invalid_image", e.message);
      throw e;
    }
    photoUrl = await store.savePhoto(decoded.bytes, decoded.mediaType);
  }

  // Only link AI runs that exist and are unused, so a client can't overwrite another run's edit record.
  const run = req.aiRunId ? await store.getAiRun(req.aiRunId) : null;
  const linkable = run && run.postId === null ? run : null;

  const post = await store.createPost(
    {
      title: req.title,
      description: req.description,
      buildingId: req.buildingId,
      room: req.room,
      photoUrl,
      estServings: req.estServings,
      dietaryTags: req.dietaryTags,
      allergens: req.allergens,
      source: req.source,
      availableFrom: window.availableFrom,
      expiresAt: window.expiresAt,
      aiRunId: linkable ? linkable.id : null,
    },
    clientId,
  );

  if (linkable) {
    const edited = diffSuggestion(linkable.output, { ...req, ...window });
    await store.linkAiRun(linkable.id, post.id, edited);
  }
  return post;
}
