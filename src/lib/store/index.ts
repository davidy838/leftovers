// Picks the store from env: Supabase if configured, otherwise the local file store.
import { supabaseServerConfig } from "../config";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { PostStore } from "./types";

const g = globalThis as unknown as { __leftoversStore?: PostStore };

export function getStore(): PostStore {
  if (!g.__leftoversStore) {
    const sb = supabaseServerConfig();
    g.__leftoversStore = sb ? new SupabaseStore(sb.url, sb.serviceRoleKey) : new MemoryStore();
  }
  return g.__leftoversStore;
}

export type { PostStore } from "./types";
