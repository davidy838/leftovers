import { connection } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  await connection(); // always run per request (cacheComponents would otherwise prerender)
  try {
    return Response.json(await getStore().getStats());
  } catch (err) {
    console.error("[api/stats]", err);
    return Response.json({ error: { code: "internal", message: "Could not load stats" } }, { status: 500 });
  }
}
