// Announce new posts in a Discord channel via webhook (docs/LLD.md §5). SERVER ONLY.
// Best effort: the route calls this from `after()`, once the post is saved and the
// response is sent. It never throws, so Discord being down can't affect posting.
import { getBuilding } from "./buildings";
import { CAMPUS_TIMEZONE, DISCORD_TIMEOUT_MS } from "./constants";
import { foodEmoji } from "./emoji";
import type { Post } from "./types";

/** "ICICS / Computer Science" → "ICICS", "Allard Hall (Law)" → "Allard Hall". */
export function shortBuildingName(name: string): string {
  return name.split(/\s+[/(]/)[0]!.trim() || name;
}

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: CAMPUS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** "7:45pm", or "Sat 7:45pm" when it isn't on the same campus day as `now`. */
export function discordTime(iso: string, now: Date): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TIMEZONE, hour: "numeric", minute: "2-digit" })
    .format(d)
    .replace(/\s/g, "") // also strips the narrow no-break space some ICU versions use
    .toLowerCase();
  if (dayKey(d) === dayKey(now)) return time;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: CAMPUS_TIMEZONE, weekday: "short" }).format(d);
  return `${weekday} ${time}`;
}

/**
 * One line, e.g. "🍕 Leftover pizza · ICICS X836 · ~20 servings · ends 7:45pm · <link>".
 * Upcoming posts say "starts … · ends …". Room, servings and link are left out when absent.
 */
export function formatDiscordMessage(post: Post, opts: { now?: Date; postUrl?: string | null } = {}): string {
  const now = opts.now ?? new Date();
  const building = getBuilding(post.buildingId);
  const where = [building ? shortBuildingName(building.name) : post.buildingId, post.room].filter(Boolean).join(" ");
  const parts = [`${foodEmoji(`${post.title} ${post.description}`)} ${post.title}`, where];
  if (post.estServings) parts.push(`~${post.estServings} servings`);
  if (Date.parse(post.availableFrom) > now.getTime()) parts.push(`starts ${discordTime(post.availableFrom, now)}`);
  parts.push(`ends ${discordTime(post.expiresAt, now)}`);
  // <…> stops Discord unfurling a big link preview under every message.
  if (opts.postUrl) parts.push(`<${opts.postUrl}>`);
  return parts.join(" · ");
}

export type DiscordResult = "sent" | "skipped" | "failed";

/** POST the announcement. Resolves with what happened; never rejects. */
export async function notifyDiscord(
  post: Post,
  opts: { webhookUrl: string | null; origin?: string | null; fetchImpl?: typeof fetch; timeoutMs?: number; now?: Date },
): Promise<DiscordResult> {
  if (!opts.webhookUrl) return "skipped";
  try {
    const postUrl = opts.origin ? `${opts.origin}/?post=${post.id}` : null;
    const res = await (opts.fetchImpl ?? fetch)(opts.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: formatDiscordMessage(post, { now: opts.now, postUrl }),
        username: "Leftovers",
        // Titles are user input: never let "@everyone" or <@id> in a title ping anyone.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DISCORD_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[discord] webhook returned ${res.status} for post ${post.id}`);
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.warn(`[discord] webhook failed for post ${post.id}:`, err instanceof Error ? err.message : err);
    return "failed";
  }
}
