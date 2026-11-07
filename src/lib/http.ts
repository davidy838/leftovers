// Server-side HTTP helpers shared by route handlers.
import type { ZodError } from "zod";
import type { ApiErrorBody } from "./types";

export function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return Response.json(body, { status });
}

export function zodError(err: ZodError): Response {
  const first = err.issues[0];
  const message = first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request";
  return jsonError(400, "invalid_request", message, err.issues.map((i) => ({ path: i.path, message: i.message })));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v);
}

/** Anonymous device id sent by the client in `x-client-id`. Not authentication. */
export function getClientId(req: Request): string | null {
  const v = req.headers.get("x-client-id");
  return isUuid(v) ? v.toLowerCase() : null;
}

/** Best-effort client IP for rate limiting. */
export function getIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Parse a JSON body; returns undefined on malformed JSON. */
export async function readJson(req: Request): Promise<unknown | undefined> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
