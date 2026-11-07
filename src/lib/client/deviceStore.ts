"use client";
// Per-device conveniences in localStorage. Every access is try/catch'd: private mode or
// blocked storage just means nothing is remembered, never a crash.
import type { SignalType } from "../types";

const ALERTS_KEY = "leftovers.alerts";
const SIGNALS_KEY = "leftovers.signals";
const MAX_REMEMBERED_POSTS = 200;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function alertsEnabled(): boolean {
  return read<boolean>(ALERTS_KEY, false) === true;
}

export function setAlertsEnabled(on: boolean): void {
  write(ALERTS_KEY, on);
}

type SignalMap = Record<string, SignalType[]>;

/** Signals this device already sent for a post, so buttons stay "✓" after a reload. */
export function sentSignals(postId: string): SignalType[] {
  const v = read<SignalMap>(SIGNALS_KEY, {})[postId];
  return Array.isArray(v) ? v.filter((t) => t === "heading" || t === "gone") : [];
}

export function rememberSignal(postId: string, type: SignalType): void {
  const map = read<SignalMap>(SIGNALS_KEY, {});
  const next = Array.from(new Set([...(map[postId] ?? []), type]));
  delete map[postId]; // re-insert so it's the newest key
  map[postId] = next;
  const keys = Object.keys(map);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_REMEMBERED_POSTS))) delete map[k];
  write(SIGNALS_KEY, map);
}
