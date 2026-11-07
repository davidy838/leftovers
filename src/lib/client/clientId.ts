"use client";
// Anonymous per-device id (not auth). Stored in localStorage; falls back to an in-memory id.
const KEY = "leftovers.clientId";
let memoryId: string | null = null;

export function getClientId(): string {
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}
