"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { formatKg, impactFromServings } from "@/lib/impact";
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
  const impact = impactFromServings(stats.servingsClaimed);
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-fg tabular-nums">{stats.postsShared}</span> posts shared ·{" "}
      <span className="font-semibold text-fg tabular-nums">~{stats.servingsClaimed}</span> servings claimed instead of binned
      {stats.servingsClaimed > 0 && (
        <>
          {" "}·{" "}
          <Link href="/about#impact" className="underline-offset-2 hover:underline" title="How we estimate this">
            ≈<span className="font-semibold text-fg tabular-nums">{formatKg(impact.kgFood)}</span> food and{" "}
            <span className="font-semibold text-fg tabular-nums">{formatKg(impact.kgCo2e)}</span> CO₂e saved
          </Link>
        </>
      )}
    </p>
  );
}
