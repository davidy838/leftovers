"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Stats } from "@/lib/types";

export function ImpactBanner() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.stats().then((s) => alive && setStats(s)).catch(() => {});
    load();
    const t = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  if (!stats) return null;
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-fg tabular-nums">{stats.postsShared}</span> posts shared ·{" "}
      <span className="font-semibold text-fg tabular-nums">~{stats.servingsClaimed}</span> servings claimed instead of binned
    </p>
  );
}
