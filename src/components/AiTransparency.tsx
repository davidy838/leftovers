"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Stats } from "@/lib/types";

export function AiTransparency() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);
  if (!stats) return null;
  const { runs, runsUsed, runsEdited, fieldEditRate } = stats.ai;
  return (
    <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
      <div className="rounded-xl border border-line bg-surface p-3">
        <dt className="text-xs text-muted">AI suggestions</dt>
        <dd className="text-2xl font-semibold tabular-nums">{runs}</dd>
      </div>
      <div className="rounded-xl border border-line bg-surface p-3">
        <dt className="text-xs text-muted">Used in a post</dt>
        <dd className="text-2xl font-semibold tabular-nums">{runsUsed}</dd>
      </div>
      <div className="rounded-xl border border-line bg-surface p-3">
        <dt className="text-xs text-muted">Corrected by a person</dt>
        <dd className="text-2xl font-semibold tabular-nums">
          {fieldEditRate === null ? "–" : `${Math.round(fieldEditRate * 100)}%`}
        </dd>
        <dd className="text-[11px] text-muted">{runsEdited} of {runsUsed}</dd>
      </div>
    </dl>
  );
}
