"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { newMatchingPosts, titleWithCount } from "@/lib/alerts";
import { getBuilding } from "@/lib/buildings";
import { alertsEnabled, setAlertsEnabled } from "@/lib/client/deviceStore";
import type { DietaryTag, PublicPost } from "@/lib/types";

export type AlertPermission = "unsupported" | "default" | "granted" | "denied";

function currentPermission(): AlertPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Opt-in alerts for new food that matches the viewer's dietary filters, while the tab is
 * open (no push server). Shows a system notification when allowed, and always counts
 * unseen posts in the tab title + an in-page banner.
 */
export function useFoodAlerts(posts: PublicPost[], loaded: boolean, tags: DietaryTag[]) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<AlertPermission>("unsupported");
  const [fresh, setFresh] = useState<PublicPost[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const baseTitle = useRef<string | null>(null);

  // Read device prefs after mount (localStorage/Notification don't exist during SSR).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setEnabled(alertsEnabled());
      setPermission(currentPermission());
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    // First load: everything already on the feed counts as seen.
    if (seen.current === null) {
      seen.current = new Set(posts.map((p) => p.id));
      return;
    }
    const matches = enabled ? newMatchingPosts(posts, seen.current, tags) : [];
    for (const p of posts) seen.current.add(p.id);
    if (matches.length === 0) return;

    // Deferred so it isn't a synchronous setState inside the effect; never cancelled,
    // because these ids are already marked seen and must not be lost.
    window.setTimeout(() => setFresh((prev) => [...matches, ...prev].slice(0, 5)), 0);
    if (currentPermission() === "granted" && document.visibilityState !== "visible") {
      for (const p of matches.slice(0, 3)) {
        const where = getBuilding(p.buildingId)?.name ?? p.buildingId;
        try {
          const n = new Notification(`🍱 ${p.title}`, { body: `Free food at ${where}`, tag: p.id });
          n.onclick = () => {
            window.focus();
            window.location.search = `?post=${p.id}`;
          };
        } catch {
          /* some mobile browsers only allow notifications from a service worker */
        }
      }
    }
  }, [posts, loaded, enabled, tags]);

  // Unseen count in the tab title.
  useEffect(() => {
    baseTitle.current ??= document.title;
    document.title = titleWithCount(baseTitle.current, fresh.length);
  }, [fresh.length]);

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      setAlertsEnabled(false);
      setFresh([]);
      return;
    }
    let perm = currentPermission();
    if (perm === "default") {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = currentPermission();
      }
    }
    setPermission(perm);
    // Even without system notifications, the in-page banner + tab count still work.
    setEnabled(true);
    setAlertsEnabled(true);
  }, [enabled]);

  const dismiss = useCallback(() => setFresh([]), []);

  return { enabled, permission, fresh, toggle, dismiss };
}
