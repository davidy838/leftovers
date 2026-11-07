// Tunables in one place. See docs/LLD.md §5 (business rules).

/** A post ends once this many distinct devices report it gone (owner ends it instantly). */
export const GONE_THRESHOLD = 2;

/** Durations offered for "leftovers now" posts, in minutes. */
export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120] as const;
export const DEFAULT_DURATION_MINUTES = 45;

/** Poster posts: how long food is assumed to last after the event ends / starts. */
export const POSTER_AFTER_END_MINUTES = 30;
export const POSTER_DEFAULT_LENGTH_MINUTES = 120;

/** Max post lifetime and how far ahead a post may be scheduled. */
export const MAX_POST_HOURS = 12;
export const MAX_SCHEDULE_AHEAD_DAYS = 14;
/** Upcoming posts further away than this are hidden from the feed. */
export const FEED_UPCOMING_DAYS = 7;

/** Client polling interval for the feed. */
export const POLL_INTERVAL_MS = 5_000;

/** AI confidence below this → servings + dietary tags are not suggested. */
export const LOW_CONFIDENCE = 0.5;

/** Image limits. Client resizes before upload; server enforces. */
export const CLIENT_IMAGE_MAX_DIM = 1280;
export const CLIENT_IMAGE_QUALITY = 0.8;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Rate limits per IP over a sliding window. */
export const RATE_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMITS = {
  createPost: 8,
  aiExtract: 20,
  signal: 60,
} as const;

export const CAMPUS_TIMEZONE = "America/Vancouver";
export const CAMPUS_CENTER: [number, number] = [49.2648, -123.2518];
