// Serves photos saved by MemoryStore (local dev). Supabase mode uses public storage URLs instead.
import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultDataDir } from "@/lib/store/memory";

const NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const m = NAME_RE.exec(name);
  if (!m) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(path.join(defaultDataDir(), "uploads", name));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TYPES[m[1] as keyof typeof TYPES],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
