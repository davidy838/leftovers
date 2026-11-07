"use client";
import { DIETARY_LABELS } from "@/lib/labels";
import { DIETARY_TAGS, type DietaryTag } from "@/lib/types";

export interface Filters {
  tags: DietaryTag[];
  liveOnly: boolean;
  sortByDistance: boolean;
}

export function FilterBar({
  filters,
  onChange,
  locating,
  locationError,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  locating: boolean;
  locationError: string | null;
}) {
  const toggleTag = (t: DietaryTag) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(t) ? filters.tags.filter((x) => x !== t) : [...filters.tags, t],
    });

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition ${
      active ? "border-brand bg-brand-soft text-fg" : "border-line bg-surface text-muted hover:text-fg"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Dietary filters">
        {DIETARY_TAGS.map((t) => (
          <button key={t} type="button" aria-pressed={filters.tags.includes(t)} className={chip(filters.tags.includes(t))} onClick={() => toggleTag(t)}>
            {DIETARY_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={filters.liveOnly} className={chip(filters.liveOnly)} onClick={() => onChange({ ...filters, liveOnly: !filters.liveOnly })}>
          Live now only
        </button>
        <button
          type="button"
          aria-pressed={filters.sortByDistance}
          className={chip(filters.sortByDistance)}
          onClick={() => onChange({ ...filters, sortByDistance: !filters.sortByDistance })}
        >
          {locating ? "Finding you…" : "📍 Nearest first"}
        </button>
        {locationError && <span className="text-xs text-warn">{locationError}</span>}
      </div>
    </div>
  );
}
