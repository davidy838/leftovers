// Env → feature flags. SERVER ONLY (never import from a client component).
// (No `server-only` import: scripts/ run this file under plain Node via tsx.)

export const DEFAULT_MODEL = "claude-opus-5-5";

export function aiMode(): "live" | "mock" {
  const m = process.env.AI_MODE?.trim().toLowerCase();
  if (m === "live" || m === "mock") return m;
  return process.env.ANTHROPIC_API_KEY ? "live" : "mock";
}

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

const DISCORD_HOSTS = new Set(["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"]);

/**
 * Discord webhook for new-post announcements, or null when unset/invalid.
 * Only https Discord webhook URLs are accepted so a typo can't make the server POST elsewhere.
 */
export function discordWebhookUrl(): string | null {
  const raw = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === "https:" && DISCORD_HOSTS.has(u.hostname) && u.pathname.startsWith("/api/webhooks/")) return u.toString();
  } catch {
    /* fall through */
  }
  console.warn("[discord] DISCORD_WEBHOOK_URL is not a Discord webhook URL; announcements are off");
  return null;
}

export function supabaseServerConfig(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}
