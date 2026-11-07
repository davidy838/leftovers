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

export function supabaseServerConfig(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}
