"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFoodAlerts } from "@/hooks/useFoodAlerts";
import { usePosts } from "@/hooks/usePosts";
import { getBuilding } from "@/lib/buildings";
import { haversineMeters, walkMinutes } from "@/lib/geo";
import type { PublicPost } from "@/lib/types";
import { FilterBar, type Filters } from "./FilterBar";
import { ImpactBanner } from "./ImpactBanner";
import MapView from "./MapView";
import { PostCard } from "./PostCard";

export function FoodFeed() {
  const { posts, loading, error, sendSignal } = usePosts();
  const [filters, setFilters] = useState<Filters>({ tags: [], liveOnly: false, sortByDistance: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const alerts = useFoodAlerts(posts, !loading, filters.tags);
  const deepLinked = useRef(false);

  // Shared links look like /?post=<id>: open that post once the feed has loaded.
  useEffect(() => {
    if (loading || deepLinked.current) return;
    deepLinked.current = true;
    const id = new URLSearchParams(window.location.search).get("post");
    if (!id || !posts.some((p) => p.id === id)) return;
    const t = window.setTimeout(() => {
      setSelectedId(id);
      setView("list");
    }, 0);
    // Once the list is showing, jump to the post. Instant, not smooth: a smooth scroll
    // during page load gets interrupted (and doesn't run at all in a background tab).
    const s = window.setTimeout(() => document.getElementById(`post-${id}`)?.scrollIntoView({ block: "center" }), 50);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(s);
    };
  }, [loading, posts]);

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocationError("Location isn't available in this browser");
      setFilters((f) => ({ ...f, sortByDistance: false }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocationError(null);
        setLocating(false);
      },
      () => {
        setLocationError("Couldn't get your location");
        setLocating(false);
        setFilters((f) => ({ ...f, sortByDistance: false }));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function changeFilters(next: Filters) {
    setFilters(next);
    if (next.sortByDistance && !filters.sortByDistance && !me) locate();
  }

  const distance = (p: PublicPost): number | null => {
    const b = getBuilding(p.buildingId);
    return me && b ? haversineMeters(me, b) : null;
  };

  const visible = useMemo(() => {
    let list = posts.filter((p) => filters.tags.every((t) => p.dietaryTags.includes(t)));
    if (filters.liveOnly) list = list.filter((p) => p.displayStatus === "live");
    if (filters.sortByDistance && me) {
      list = [...list].sort((a, b) => (distance(a) ?? Infinity) - (distance(b) ?? Infinity));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- distance only depends on `me`
  }, [posts, filters, me]);

  const liveCount = posts.filter((p) => p.displayStatus === "live").length;

  function select(id: string) {
    setSelectedId(id);
    document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="flex flex-col gap-4 pt-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {liveCount > 0 ? `${liveCount} free food ${liveCount === 1 ? "spot" : "spots"} on campus right now` : "Free food on campus"}
        </h1>
        <ImpactBanner />
      </section>

      <FilterBar
        filters={filters}
        onChange={changeFilters}
        locating={locating}
        locationError={locationError}
        alerts={{ enabled: alerts.enabled, permission: alerts.permission, onToggle: () => void alerts.toggle() }}
      />

      {alerts.fresh.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand bg-brand-soft px-4 py-3 text-sm">
          <span aria-hidden>🔔</span>
          <span className="font-medium">New food:</span>
          {alerts.fresh.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded-full bg-surface px-3 py-1 underline-offset-2 hover:underline"
              onClick={() => {
                setView("list");
                select(p.id);
              }}
            >
              {p.title}
            </button>
          ))}
          <button type="button" className="ml-auto text-muted hover:text-fg" onClick={alerts.dismiss}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2 md:hidden" role="tablist" aria-label="View">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${view === v ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}
          >
            {v === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className={`${view === "map" ? "block" : "hidden"} md:block`}>
          <div className="h-[60vh] overflow-hidden rounded-2xl border border-line md:sticky md:top-20 md:h-[calc(100dvh-7rem)]">
            <MapView posts={visible} selectedId={selectedId} onSelect={select} me={me} />
          </div>
        </div>

        <div className={`${view === "list" ? "flex" : "hidden"} flex-col gap-3 md:flex`}>
          {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
          {loading && posts.length === 0 && <p className="text-sm text-muted">Loading…</p>}
          {!loading && visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center">
              <p className="text-4xl" aria-hidden>🍽️</p>
              <p className="mt-2 font-medium">No free food posted{filters.tags.length || filters.liveOnly ? " matching your filters" : ""} yet</p>
              <p className="mt-1 text-sm text-muted">Got leftovers from an event? Share them before they&apos;re binned.</p>
              <Link href="/post" className="mt-4 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-fg">
                Post food
              </Link>
            </div>
          )}
          {visible.map((p) => {
            const d = distance(p);
            return (
              <PostCard
                key={p.id}
                post={p}
                distanceMin={d === null ? null : walkMinutes(d)}
                selected={p.id === selectedId}
                onSelect={() => setSelectedId(p.id)}
                onSignal={sendSignal}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
