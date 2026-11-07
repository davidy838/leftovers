"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BUILDINGS } from "@/lib/buildings";
import { api, ApiError } from "@/lib/client/api";
import { prepareImage } from "@/lib/client/image";
import { DEFAULT_DURATION_MINUTES, DURATION_CHOICES } from "@/lib/constants";
import { ALLERGEN_LABELS, DIETARY_LABELS } from "@/lib/labels";
import { RequestSeq } from "@/lib/requestSeq";
import { fromCampusLocalInput, toCampusLocalInput } from "@/lib/time";
import {
  ALLERGENS,
  DIETARY_TAGS,
  type Allergen,
  type CreatePostRequest,
  type DietaryTag,
  type ImageInput,
  type PostSource,
  type Suggestion,
} from "@/lib/types";

type Field = "title" | "description" | "buildingId" | "room" | "estServings" | "dietaryTags" | "allergens" | "start" | "end";

const SORTED_BUILDINGS = [...BUILDINGS].sort((a, b) => a.name.localeCompare(b.name));

const MODES: { id: PostSource; label: string; hint: string }[] = [
  { id: "photo", label: "📸 Leftovers now", hint: "Snap the food. AI fills in the details and you check them." },
  { id: "poster", label: "🗓️ Event poster", hint: "Upload a poster or screenshot that promises free food." },
  { id: "manual", label: "✍️ No photo", hint: "Just type it in." },
];

function AiBadge({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand" title="Suggested by AI. Please check it.">
      AI
    </span>
  );
}

export function PostForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const extractSeq = useRef(new RequestSeq());
  const [mode, setMode] = useState<PostSource>("photo");
  const [image, setImage] = useState<{ input: ImageInput; previewUrl: string } | null>(null);
  const [ai, setAi] = useState<{ state: "idle" | "loading" | "done" | "error"; message?: string; kind?: "live" | "mock"; lowConfidence?: boolean }>({ state: "idle" });
  const [runId, setRunId] = useState<string | null>(null);
  const [aiFields, setAiFields] = useState<Set<Field>>(new Set());

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [room, setRoom] = useState("");
  const [estServings, setEstServings] = useState("");
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MINUTES);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const touched = (f: Field) =>
    setAiFields((prev) => {
      if (!prev.has(f)) return prev;
      const next = new Set(prev);
      next.delete(f);
      return next;
    });

  function switchMode(m: PostSource) {
    extractSeq.current.invalidate(); // drop any AI result still in flight for the old mode
    setMode(m);
    setImage(null);
    setAi({ state: "idle" });
    setRunId(null);
    setAiFields(new Set());
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function applySuggestion(s: Suggestion) {
    const filled = new Set<Field>(["title"]);
    setTitle(s.title);
    if (s.description) {
      setDescription(s.description);
      filled.add("description");
    }
    setDietaryTags(s.dietaryTags);
    if (s.dietaryTags.length) filled.add("dietaryTags");
    if ("allergens" in s) {
      setAllergens(s.allergens);
      if (s.allergens.length) filled.add("allergens");
      setEstServings(s.estServings ? String(s.estServings) : "");
      if (s.estServings) filled.add("estServings");
    } else {
      if (s.buildingId) {
        setBuildingId(s.buildingId);
        filled.add("buildingId");
      }
      if (s.room) {
        setRoom(s.room);
        filled.add("room");
      }
      if (s.availableFrom) {
        setStart(toCampusLocalInput(s.availableFrom));
        filled.add("start");
      }
      if (s.expiresAt) {
        setEnd(toCampusLocalInput(s.expiresAt));
        filled.add("end");
      }
    }
    setAiFields(filled);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    // A later file pick or a mode switch makes this request stale; its result must not
    // overwrite the form (or link the wrong AI run to the post).
    const ticket = extractSeq.current.next();
    setError(null);
    setAi({ state: "loading" });
    setRunId(null);
    let prepared;
    try {
      prepared = await prepareImage(file);
      if (!extractSeq.current.isCurrent(ticket)) return;
      setImage(prepared);
    } catch (e) {
      if (!extractSeq.current.isCurrent(ticket)) return;
      setAi({ state: "error", message: e instanceof Error ? e.message : "Couldn't read that image" });
      return;
    }
    try {
      const res = await api.extract(mode === "poster" ? "poster" : "food", prepared.input);
      if (!extractSeq.current.isCurrent(ticket)) return;
      setRunId(res.runId);
      applySuggestion(res.suggestion);
      setAi({ state: "done", kind: res.ai, lowConfidence: res.suggestion.lowConfidence });
    } catch (e) {
      if (!extractSeq.current.isCurrent(ticket)) return;
      setRunId(null);
      setAi({ state: "error", message: e instanceof ApiError ? e.message : "AI couldn't read that. Please fill in the form." });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!buildingId) return setError("Pick a building so people can find the food.");
    const servings = estServings.trim() ? Number(estServings) : null;
    if (servings !== null && (!Number.isInteger(servings) || servings < 1 || servings > 500)) {
      return setError("Servings must be a whole number from 1 to 500.");
    }

    let availableFrom: string | null = null;
    let expiresAt: string | null = null;
    if (mode === "poster") {
      availableFrom = fromCampusLocalInput(start);
      expiresAt = fromCampusLocalInput(end);
      if (!availableFrom || !expiresAt) return setError("Set when the food is available from and until.");
    }

    const body: CreatePostRequest = {
      title,
      description,
      buildingId,
      room: room || null,
      estServings: servings,
      dietaryTags,
      allergens,
      source: mode,
      availableFrom,
      durationMinutes: mode === "poster" ? null : duration,
      expiresAt,
      image: image?.input ?? null,
      aiRunId: runId,
      acknowledged: acknowledged as true,
    };

    setSubmitting(true);
    try {
      await api.createPost(body);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't post. Please try again.");
      setSubmitting(false);
    }
  }

  const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
  const label = "mb-1 flex items-center text-sm font-medium";
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-soft" : "border-line bg-surface text-muted"}`;

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const currentMode = MODES.find((m) => m.id === mode)!;

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col gap-5 pt-6" noValidate>
      <h1 className="text-2xl font-bold tracking-tight">Share free food</h1>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="How are you posting?">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => switchMode(m.id)}
            className={`rounded-xl border px-2 py-3 text-sm ${mode === m.id ? "border-brand bg-brand-soft font-medium" : "border-line bg-surface"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="-mt-3 text-sm text-muted">{currentMode.hint}</p>

      {mode !== "manual" && (
        <div className="flex flex-col gap-2">
          <label className={label} htmlFor="image">
            {mode === "poster" ? "Poster or screenshot" : "Photo of the food"}
          </label>
          <input
            ref={fileRef}
            id="image"
            type="file"
            accept="image/*"
            {...(mode === "photo" ? { capture: "environment" as const } : {})}
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-fg"
          />
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={image.previewUrl} alt="Selected" className="max-h-64 w-full rounded-xl border border-line object-contain" />
          )}
          {ai.state === "loading" && <p className="text-sm text-muted" role="status">✨ Reading your image…</p>}
          {ai.state === "error" && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{ai.message}</p>}
          {ai.state === "done" && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm" role="status">
              {ai.kind === "mock" ? "Demo AI (no API key set): these are sample values. " : "✨ AI filled in the fields marked AI. "}
              {ai.lowConfidence ? "It wasn't confident, so check everything and add the details yourself." : "Please check them before posting."}
            </p>
          )}
        </div>
      )}

      <div>
        <label className={label} htmlFor="title">
          Title <AiBadge on={aiFields.has("title")} />
        </label>
        <input id="title" className={input} maxLength={80} required value={title} placeholder="e.g. Leftover pizza from CS Club"
          onChange={(e) => { setTitle(e.target.value); touched("title"); }} />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <div>
          <label className={label} htmlFor="building">
            Building <AiBadge on={aiFields.has("buildingId")} />
          </label>
          <select id="building" className={input} required value={buildingId} onChange={(e) => { setBuildingId(e.target.value); touched("buildingId"); }}>
            <option value="">Choose…</option>
            {SORTED_BUILDINGS.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="room">
            Room <AiBadge on={aiFields.has("room")} />
          </label>
          <input id="room" className={input} maxLength={40} value={room} placeholder="X836"
            onChange={(e) => { setRoom(e.target.value); touched("room"); }} />
        </div>
      </div>

      {mode === "poster" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="start">Food from <AiBadge on={aiFields.has("start")} /></label>
            <input id="start" type="datetime-local" className={input} value={start} onChange={(e) => { setStart(e.target.value); touched("start"); }} />
          </div>
          <div>
            <label className={label} htmlFor="end">Until <AiBadge on={aiFields.has("end")} /></label>
            <input id="end" type="datetime-local" className={input} value={end} onChange={(e) => { setEnd(e.target.value); touched("end"); }} />
          </div>
        </div>
      ) : (
        <div>
          <span className={label}>Available for about</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duration">
            {DURATION_CHOICES.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={duration === d} className={chip(duration === d)} onClick={() => setDuration(d)}>
                {d < 60 ? `${d} min` : `${d / 60} h`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={label} htmlFor="servings">
          Roughly how many servings? <AiBadge on={aiFields.has("estServings")} />
        </label>
        <input id="servings" type="number" inputMode="numeric" min={1} max={500} className={input} value={estServings} placeholder="optional"
          onChange={(e) => { setEstServings(e.target.value); touched("estServings"); }} />
      </div>

      <fieldset>
        <legend className={label}>Dietary <AiBadge on={aiFields.has("dietaryTags")} /></legend>
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAGS.map((t) => (
            <button key={t} type="button" aria-pressed={dietaryTags.includes(t)} className={chip(dietaryTags.includes(t))}
              onClick={() => { setDietaryTags((a) => toggle(a, t)); touched("dietaryTags"); }}>
              {DIETARY_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Only tick these if you&apos;re sure.</p>
      </fieldset>

      <fieldset>
        <legend className={label}>May contain <AiBadge on={aiFields.has("allergens")} /></legend>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <button key={a} type="button" aria-pressed={allergens.includes(a)} className={chip(allergens.includes(a))}
              onClick={() => { setAllergens((x) => toggle(x, a)); touched("allergens"); }}>
              {ALLERGEN_LABELS[a]}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className={label} htmlFor="description">
          Anything else? <AiBadge on={aiFields.has("description")} />
        </label>
        <textarea id="description" className={`${input} min-h-20`} maxLength={500} value={description} placeholder="e.g. On the table by the window, bring a plate"
          onChange={(e) => { setDescription(e.target.value); touched("description"); }} />
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        <span>
          This food is okay to give away and has been stored sensibly. I understand allergen info is a best guess and students should check with the organiser.
        </span>
      </label>

      {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !acknowledged || !title.trim() || ai.state === "loading"}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-brand-fg shadow-sm disabled:opacity-50"
      >
        {submitting ? "Posting…" : "Post it"}
      </button>
    </form>
  );
}
