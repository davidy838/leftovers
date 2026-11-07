import { describe, expect, it } from "vitest";
import { buildFeed, deriveStatus, toPublic } from "@/lib/status";
import type { Post } from "@/lib/types";

const now = new Date("2026-11-07T20:00:00.000Z");
const at = (mins: number) => new Date(now.getTime() + mins * 60000).toISOString();

function post(over: Partial<Post>): Post {
  return {
    id: crypto.randomUUID(),
    title: "Pizza",
    description: "",
    buildingId: "ICCS",
    room: null,
    photoUrl: null,
    estServings: null,
    dietaryTags: [],
    allergens: [],
    source: "manual",
    availableFrom: at(-10),
    expiresAt: at(30),
    status: "active",
    headingCount: 0,
    goneCount: 0,
    aiRunId: null,
    createdAt: at(-10),
    ...over,
  };
}

describe("deriveStatus", () => {
  it("live inside the window", () => expect(deriveStatus(post({}), now)).toBe("live"));
  it("upcoming before start", () => expect(deriveStatus(post({ availableFrom: at(5), expiresAt: at(60) }), now)).toBe("upcoming"));
  it("expired at exactly expiresAt", () => expect(deriveStatus(post({ expiresAt: at(0) }), now)).toBe("expired"));
  it("live at exactly availableFrom", () => expect(deriveStatus(post({ availableFrom: at(0) }), now)).toBe("live"));
  it("gone beats time", () => expect(deriveStatus(post({ status: "gone" }), now)).toBe("gone"));
  it("removed shows as gone", () => expect(deriveStatus(post({ status: "removed" }), now)).toBe("gone"));
});

describe("buildFeed", () => {
  it("orders live by soonest end, then upcoming by soonest start, drops the rest", () => {
    const a = post({ title: "a", expiresAt: at(50) });
    const b = post({ title: "b", expiresAt: at(10) });
    const c = post({ title: "c", availableFrom: at(120), expiresAt: at(180) });
    const d = post({ title: "d", availableFrom: at(30), expiresAt: at(90) });
    const e = post({ title: "e", expiresAt: at(-1) });
    const f = post({ title: "f", status: "gone" });
    const far = post({ title: "far", availableFrom: at(8 * 24 * 60), expiresAt: at(8 * 24 * 60 + 60) });
    const feed = buildFeed([a, b, c, d, e, f, far].map((p) => toPublic(p, new Set(), now)), now);
    expect(feed.map((p) => p.title)).toEqual(["b", "a", "d", "c"]);
  });

  it("marks owned posts", () => {
    const p = post({});
    expect(toPublic(p, new Set([p.id]), now).isMine).toBe(true);
    expect(toPublic(p, new Set(), now).isMine).toBe(false);
  });
});
