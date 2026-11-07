import { connection } from "next/server";
import { aiMode, aiModel } from "@/lib/config";
import { getStore } from "@/lib/store";

export async function GET() {
  await connection(); // always run per request (cacheComponents would otherwise prerender)
  const mode = aiMode();
  return Response.json({ ok: true, store: getStore().kind, ai: mode, model: mode === "live" ? aiModel() : "mock" });
}
