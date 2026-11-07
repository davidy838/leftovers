import type { Metadata } from "next";
import { AiTransparency } from "@/components/AiTransparency";

export const metadata: Metadata = { title: "How it works · Leftovers" };

export default function AboutPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 pt-8 leading-relaxed">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Less food in the bin, fewer hungry students</h1>
        <p className="mt-2 text-muted">
          Campus events regularly over-order. At the same time, many students skip meals because food is expensive.
          Leftovers connects the two within minutes.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>An organiser (or anyone) snaps a photo of surplus food, or uploads an event poster.</li>
          <li>AI suggests a title, servings and dietary info. <strong>A person checks and edits it before anything is posted.</strong></li>
          <li>The post appears on the live map with a countdown.</li>
          <li>Students tap &ldquo;I&apos;m heading there&rdquo;. When it&apos;s gone, the organiser or two students mark it gone.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold">How we use AI</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>It only <em>suggests</em>. Every field is editable and marked &ldquo;AI&rdquo; until a person changes it.</li>
          <li>Locations come from a fixed list of campus buildings, so the AI can&apos;t invent a place.</li>
          <li>When the AI isn&apos;t confident, it leaves dietary tags and servings blank instead of guessing.</li>
          <li>We log which suggestions people correct and test our prompts against hand-labelled images.</li>
        </ul>
        <AiTransparency />
      </section>

      <section className="rounded-2xl bg-warn-soft p-4 text-sm text-warn">
        <h2 className="font-semibold">Food safety</h2>
        <p className="mt-1">
          Allergen and dietary information is a best guess by the poster. If you have allergies or dietary
          restrictions, check with the organiser before eating. Don&apos;t share food that has been left out
          unsafely or is past its best.
        </p>
      </section>
    </article>
  );
}
