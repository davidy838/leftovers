"use client";
import { useState } from "react";
import { getBuilding } from "@/lib/buildings";
import { ApiError } from "@/lib/client/api";
import { foodEmoji } from "@/lib/emoji";
import { ALLERGEN_LABELS, DIETARY_LABELS } from "@/lib/labels";
import { formatCampusTime } from "@/lib/time";
import type { PublicPost, SignalType } from "@/lib/types";
import { Countdown } from "./Countdown";

export function PostCard({
  post,
  distanceMin,
  selected,
  onSelect,
  onSignal,
}: {
  post: PublicPost;
  distanceMin: number | null;
  selected: boolean;
  onSelect: () => void;
  onSignal: (id: string, type: SignalType) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState<SignalType | null>(null);
  const [done, setDone] = useState<SignalType[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const building = getBuilding(post.buildingId);
  const live = post.displayStatus === "live";

  async function send(type: SignalType) {
    setBusy(type);
    setMsg(null);
    try {
      await onSignal(post.id, type);
      setDone((d) => [...d, type]);
      if (type === "gone") setMsg(post.isMine ? "Marked as gone. Thanks for sharing!" : "Thanks! We'll end it once someone else confirms.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      id={`post-${post.id}`}
      className={`overflow-hidden rounded-2xl border bg-surface shadow-sm transition ${
        selected ? "border-brand ring-2 ring-brand/30" : "border-line"
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-label={`Show ${post.title} on map`}>
        {post.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads with unknown dimensions/hosts
          <img src={post.photoUrl} alt={post.title} className="h-40 w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-20 place-items-center bg-surface-2 text-4xl" aria-hidden>
            {foodEmoji(`${post.title} ${post.description}`)}
          </div>
        )}
      </button>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug">{post.title}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              live ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted"
            }`}
          >
            {live ? "Live" : `From ${formatCampusTime(post.availableFrom)}`}
          </span>
        </div>
        <p className="text-sm text-muted">
          📍 {building?.name ?? post.buildingId}
          {post.room ? `, ${post.room}` : ""}
          {distanceMin !== null ? ` · ${distanceMin} min walk` : ""}
        </p>
        <p className="text-sm">
          <Countdown availableFrom={post.availableFrom} expiresAt={post.expiresAt} />
          {post.estServings ? <span className="text-muted"> · ~{post.estServings} servings</span> : null}
          {post.headingCount > 0 ? (
            <span className="text-muted"> · {post.headingCount} heading there</span>
          ) : null}
        </p>
        {post.description && <p className="text-sm text-muted">{post.description}</p>}
        {post.dietaryTags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Dietary tags">
            {post.dietaryTags.map((t) => (
              <li key={t} className="rounded-full bg-ok-soft px-2 py-0.5 text-xs text-ok">
                {DIETARY_LABELS[t]}
              </li>
            ))}
          </ul>
        )}
        {post.allergens.length > 0 && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
            ⚠️ May contain: {post.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")}. Check with the organiser if you have allergies.
          </p>
        )}
        {live && (
          <div className="mt-1 flex flex-wrap gap-2">
            {!post.isMine && (
              <button
                type="button"
                disabled={busy !== null || done.includes("heading")}
                onClick={() => send("heading")}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-fg disabled:opacity-50"
              >
                {done.includes("heading") ? "You're on your way ✓" : busy === "heading" ? "…" : "I'm heading there"}
              </button>
            )}
            <button
              type="button"
              disabled={busy !== null || done.includes("gone")}
              onClick={() => send("gone")}
              className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy === "gone" ? "…" : post.isMine ? "Mark as gone" : done.includes("gone") ? "Reported ✓" : "It's gone"}
            </button>
          </div>
        )}
        {msg && <p className="text-xs text-muted" role="status">{msg}</p>}
      </div>
    </article>
  );
}
