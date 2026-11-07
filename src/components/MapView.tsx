"use client";
import dynamic from "next/dynamic";

const FoodMap = dynamic(() => import("./FoodMap"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center bg-surface-2 text-sm text-muted">Loading map…</div>,
});

export default FoodMap;
