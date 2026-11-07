"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { api, ApiError } from "@/lib/client/api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import type { PublicPost, SignalType } from "@/lib/types";

/** Feed data: polling + refetch on focus + optional Supabase realtime "ping" (docs/LLD.md §2). */
export function usePosts() {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const data = await api.listPosts();
      setPosts(data.posts);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load food posts");
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Optional realtime ping: only refetches, never trusts the payload.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let cleanupRealtime = () => {};
    if (url && anon) {
      const sb = createClient(url, anon, { auth: { persistSession: false } });
      const channel = sb
        .channel("posts-feed")
        .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void refresh())
        .subscribe();
      cleanupRealtime = () => void sb.removeChannel(channel);
    }

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      cleanupRealtime();
    };
  }, [refresh]);

  const sendSignal = useCallback(
    async (id: string, type: SignalType) => {
      const { post } = await api.signal(id, type);
      setPosts((prev) =>
        post.displayStatus === "live" || post.displayStatus === "upcoming"
          ? prev.map((p) => (p.id === id ? post : p))
          : prev.filter((p) => p.id !== id),
      );
      return post;
    },
    [],
  );

  return { posts, loading, error, refresh, sendSignal };
}
