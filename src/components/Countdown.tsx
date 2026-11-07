"use client";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";

/** "Ends in 12m" / "Starts in 2h 05m" / "Ended". Ticks every second. */
export function Countdown({ availableFrom, expiresAt }: { availableFrom: string; expiresAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, []);
  if (now === null) return <span className="tabular-nums">&nbsp;</span>; // avoid SSR/client mismatch

  const start = Date.parse(availableFrom);
  const end = Date.parse(expiresAt);
  if (now < start) return <span className="tabular-nums">Starts in {formatDuration(start - now)}</span>;
  if (now < end) {
    const urgent = end - now < 10 * 60 * 1000;
    return (
      <span className={`tabular-nums ${urgent ? "font-semibold text-brand" : ""}`}>
        Ends in {formatDuration(end - now)}
      </span>
    );
  }
  return <span>Ended</span>;
}
