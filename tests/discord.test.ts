import { afterEach, describe, expect, it, vi } from "vitest";
import { discordWebhookUrl } from "@/lib/config";
import { discordTime, formatDiscordMessage, notifyDiscord, shortBuildingName } from "@/lib/discord.server";
import { zonedToUtc } from "@/lib/time";
import type { Post } from "@/lib/types";

// Times are built from Vancouver wall-clock values, never a hard-coded UTC offset: BC's move
// to permanent daylight time means the Nov 2026 offset depends on the tzdata version.
const campus = (date: string, time: string) => zonedToUtc(date, time)!;
const now = campus("2026-11-07", "19:00"); // a Saturday
const at = (mins: number) => new Date(now.getTime() + mins * 60000).toISOString();

const post = (over: Partial<Post> = {}): Post => ({
  id: "00000000-0000-4000-8000-000000000001",
  title: "Leftover pizza",
  description: "",
  buildingId: "ICCS",
  room: "X836",
  photoUrl: null,
  estServings: 20,
  dietaryTags: [],
  allergens: [],
  source: "photo",
  availableFrom: at(0),
  expiresAt: at(45),
  status: "active",
  headingCount: 0,
  goneCount: 0,
  aiRunId: null,
  createdAt: at(0),
  ...over,
});

const WEBHOOK = "https://discord.com/api/webhooks/123/abc";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("formatDiscordMessage", () => {
  it("matches the agreed one-line format", () => {
    expect(formatDiscordMessage(post(), { now })).toBe("🍕 Leftover pizza · ICICS X836 · ~20 servings · ends 7:45pm");
  });

  it("appends the post link without an embed preview", () => {
    expect(formatDiscordMessage(post(), { now, postUrl: "https://x.app/?post=1" })).toMatch(/ · <https:\/\/x\.app\/\?post=1>$/);
  });

  it("drops room and servings when unknown", () => {
    expect(formatDiscordMessage(post({ room: null, estServings: null, title: "Bagels" }), { now })).toBe(
      "🥯 Bagels · ICICS · ends 7:45pm",
    );
  });

  it("says when an upcoming post starts, with the weekday if it isn't today", () => {
    const msg = formatDiscordMessage(
      post({ availableFrom: campus("2026-11-08", "18:00").toISOString(), expiresAt: campus("2026-11-08", "20:00").toISOString() }),
      { now },
    );
    expect(msg).toContain("starts Sun 6:00pm · ends Sun 8:00pm");
  });
});

describe("helpers", () => {
  it("shortBuildingName trims the descriptive suffix", () => {
    expect(shortBuildingName("ICICS / Computer Science")).toBe("ICICS");
    expect(shortBuildingName("Allard Hall (Law)")).toBe("Allard Hall");
    expect(shortBuildingName("Hebb")).toBe("Hebb");
  });
  it("discordTime is campus-zoned and compact", () => {
    expect(discordTime(campus("2026-11-07", "21:05").toISOString(), now)).toBe("9:05pm");
    expect(discordTime(campus("2026-11-07", "09:00").toISOString(), now)).toBe("9:00am");
  });
});

describe("notifyDiscord", () => {
  it("does nothing when no webhook is configured", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await notifyDiscord(post(), { webhookUrl: null, fetchImpl })).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs the message with mentions disabled", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const result = await notifyDiscord(post({ title: "@everyone free pizza" }), {
      webhookUrl: WEBHOOK,
      origin: "https://leftovers.app",
      fetchImpl,
      now,
    });
    expect(result).toBe("sent");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(WEBHOOK);
    const body = JSON.parse(String(init?.body));
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.content).toContain("@everyone free pizza");
    expect(body.content).toContain("<https://leftovers.app/?post=00000000-0000-4000-8000-000000000001>");
  });

  it("never throws when Discord is down, errors, or hangs", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const error = vi.fn<typeof fetch>().mockResolvedValue(new Response("nope", { status: 500 }));
    const hang = vi.fn<typeof fetch>((_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))),
    );
    await expect(notifyDiscord(post(), { webhookUrl: WEBHOOK, fetchImpl: down })).resolves.toBe("failed");
    await expect(notifyDiscord(post(), { webhookUrl: WEBHOOK, fetchImpl: error })).resolves.toBe("failed");
    await expect(notifyDiscord(post(), { webhookUrl: WEBHOOK, fetchImpl: hang, timeoutMs: 20 })).resolves.toBe("failed");
  });
});

describe("discordWebhookUrl", () => {
  it("accepts Discord webhook URLs only", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("DISCORD_WEBHOOK_URL", "");
    expect(discordWebhookUrl()).toBeNull();
    vi.stubEnv("DISCORD_WEBHOOK_URL", ` ${WEBHOOK} `);
    expect(discordWebhookUrl()).toBe(WEBHOOK);
    vi.stubEnv("DISCORD_WEBHOOK_URL", "http://discord.com/api/webhooks/1/a");
    expect(discordWebhookUrl()).toBeNull();
    vi.stubEnv("DISCORD_WEBHOOK_URL", "https://evil.example/api/webhooks/1/a");
    expect(discordWebhookUrl()).toBeNull();
  });
});
