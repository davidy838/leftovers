"use client";
// Leaflet must only run in the browser; import this via MapView (next/dynamic, ssr: false).
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { getBuilding } from "@/lib/buildings";
import { CAMPUS_CENTER } from "@/lib/constants";
import { foodEmoji } from "@/lib/emoji";
import type { PublicPost } from "@/lib/types";

function iconFor(post: PublicPost, selected: boolean) {
  const cls = ["food-marker", post.displayStatus === "upcoming" ? "is-upcoming" : "", selected ? "is-selected" : ""].join(" ");
  return L.divIcon({
    className: "", // drop Leaflet's default white square
    html: `<div class="${cls}">${foodEmoji(`${post.title} ${post.description}`)}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

/** Spread posts in the same building so markers don't stack exactly. */
function positions(posts: PublicPost[]): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const seen = new Map<string, number>();
  for (const p of posts) {
    const b = getBuilding(p.buildingId);
    if (!b) continue;
    const i = seen.get(b.id) ?? 0;
    seen.set(b.id, i + 1);
    const angle = i * 2.4;
    const r = i === 0 ? 0 : 0.00012 * Math.sqrt(i);
    out.set(p.id, [b.lat + r * Math.cos(angle), b.lng + r * Math.sin(angle) * 1.5]);
  }
  return out;
}

/**
 * Fly to the selected post once per selection. Keyed on the id (not the coordinates array,
 * which is rebuilt on every 5 s poll) so the map doesn't snap back while the user pans.
 */
function FlyTo({ selectedId, target }: { selectedId: string | null; target: [number, number] | null }) {
  const map = useMap();
  const flownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      flownFor.current = null;
      return;
    }
    if (!target || flownFor.current === selectedId) return;
    flownFor.current = selectedId;
    map.flyTo(target, Math.max(map.getZoom(), 17), { duration: 0.6 });
  }, [map, selectedId, target]);
  return null;
}

export default function FoodMap({
  posts,
  selectedId,
  onSelect,
  me,
}: {
  posts: PublicPost[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  me: { lat: number; lng: number } | null;
}) {
  const pos = useMemo(() => positions(posts), [posts]);
  const target = selectedId ? pos.get(selectedId) ?? null : null;
  const meIcon = useMemo(
    () => L.divIcon({ className: "", html: '<div class="food-marker" style="border-color:#1c7ed6">🧍</div>', iconSize: [36, 36], iconAnchor: [18, 18] }),
    [],
  );

  return (
    <MapContainer center={CAMPUS_CENTER} zoom={16} scrollWheelZoom className="h-full w-full" aria-label="Map of free food">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo selectedId={selectedId} target={target} />
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} />}
      {posts.map((p) => {
        const at = pos.get(p.id);
        if (!at) return null;
        return (
          <Marker key={p.id} position={at} icon={iconFor(p, p.id === selectedId)} eventHandlers={{ click: () => onSelect(p.id) }}>
            <Popup>
              <strong>{p.title}</strong>
              <br />
              {getBuilding(p.buildingId)?.name}
              {p.room ? `, ${p.room}` : ""}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
