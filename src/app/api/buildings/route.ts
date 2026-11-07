import { BUILDINGS } from "@/lib/buildings";

export async function GET() {
  return Response.json({ buildings: BUILDINGS });
}
