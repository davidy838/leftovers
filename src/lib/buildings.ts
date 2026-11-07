// UBC Vancouver buildings. Coordinates are approximate (±50 m) — good enough for a
// map pin. Verify/adjust on https://maps.ubc.ca before demo day if a pin looks off.
// The AI may only ever *select* from this list (docs/LLD.md §7.3) — it cannot invent locations.
import type { Building } from "./types";

export const BUILDINGS: Building[] = [
  { id: "NEST", name: "AMS Student Nest", aliases: ["nest", "the nest", "ams nest", "student nest", "sub"], lat: 49.2667, lng: -123.2499 },
  { id: "LIFE", name: "UBC Life Building", aliases: ["life building", "life", "old sub"], lat: 49.2675, lng: -123.2496 },
  { id: "IKB", name: "Irving K. Barber Learning Centre", aliases: ["ikb", "irving", "irving k barber", "barber"], lat: 49.2677, lng: -123.2527 },
  { id: "KOERNER", name: "Walter C. Koerner Library", aliases: ["koerner", "koerner library"], lat: 49.2665, lng: -123.2552 },
  { id: "BUCH", name: "Buchanan", aliases: ["buchanan", "buch"], lat: 49.2692, lng: -123.2546 },
  { id: "ALLARD", name: "Allard Hall (Law)", aliases: ["allard", "allard hall", "law building"], lat: 49.2697, lng: -123.2532 },
  { id: "ICCS", name: "ICICS / Computer Science", aliases: ["iccs", "icics", "x wing", "computer science", "cs building", "cpsc"], lat: 49.2612, lng: -123.2489 },
  { id: "DMP", name: "Hugh Dempster Pavilion", aliases: ["dmp", "dempster", "hugh dempster"], lat: 49.2612, lng: -123.2481 },
  { id: "KAIS", name: "Fred Kaiser Building", aliases: ["kaiser", "kais", "fred kaiser"], lat: 49.2621, lng: -123.2497 },
  { id: "MCLD", name: "MacLeod Building", aliases: ["macleod", "mcld"], lat: 49.2618, lng: -123.2492 },
  { id: "CEME", name: "Civil & Mechanical Engineering", aliases: ["ceme", "civil mechanical"], lat: 49.2624, lng: -123.2483 },
  { id: "ESC", name: "Engineering Student Centre", aliases: ["esc", "engineering student centre", "engineering student center"], lat: 49.2627, lng: -123.2495 },
  { id: "FSC", name: "Forest Sciences Centre", aliases: ["fsc", "forestry", "forest sciences"], lat: 49.2603, lng: -123.2486 },
  { id: "LSC", name: "Life Sciences Centre", aliases: ["lsc", "life sciences", "life sciences centre"], lat: 49.2623, lng: -123.2453 },
  { id: "WOOD", name: "Woodward IRC", aliases: ["woodward", "irc", "wood"], lat: 49.2645, lng: -123.2475 },
  { id: "ESB", name: "Earth Sciences Building", aliases: ["esb", "earth sciences"], lat: 49.2626, lng: -123.2520 },
  { id: "CIRS", name: "CIRS", aliases: ["cirs", "centre for interactive research on sustainability"], lat: 49.2621, lng: -123.2534 },
  { id: "SWNG", name: "West Mall Swing Space", aliases: ["swing", "swing space", "swng"], lat: 49.2620, lng: -123.2540 },
  { id: "BIOL", name: "Biological Sciences", aliases: ["biology", "biol", "bio sciences", "biological sciences"], lat: 49.2643, lng: -123.2517 },
  { id: "CHEM", name: "Chemistry", aliases: ["chemistry", "chem"], lat: 49.2659, lng: -123.2530 },
  { id: "HENN", name: "Hennings", aliases: ["hennings", "henn", "physics"], lat: 49.2665, lng: -123.2522 },
  { id: "HEBB", name: "Hebb", aliases: ["hebb", "hebb theatre"], lat: 49.2660, lng: -123.2512 },
  { id: "LASR", name: "Math / LASR", aliases: ["math", "math annex", "lasr", "leonard s klinck", "mathematics"], lat: 49.2664, lng: -123.2557 },
  { id: "ANGU", name: "Henry Angus (Sauder)", aliases: ["angus", "henry angus", "sauder", "angu", "commerce"], lat: 49.2651, lng: -123.2537 },
  { id: "SCRF", name: "Neville Scarfe (Education)", aliases: ["scarfe", "scrf", "neville scarfe"], lat: 49.2655, lng: -123.2547 },
  { id: "GEOG", name: "Geography", aliases: ["geography", "geog"], lat: 49.2662, lng: -123.2565 },
  { id: "ORCH", name: "Orchard Commons", aliases: ["orchard", "orchard commons"], lat: 49.2602, lng: -123.2509 },
  { id: "TOTEM", name: "Totem Park Commons", aliases: ["totem", "totem park", "totem commons"], lat: 49.2579, lng: -123.2549 },
  { id: "VANIER", name: "Place Vanier Commons", aliases: ["vanier", "place vanier"], lat: 49.2643, lng: -123.2591 },
  { id: "PONDE", name: "Ponderosa Commons", aliases: ["ponderosa", "ponde", "ponderosa commons"], lat: 49.2645, lng: -123.2565 },
  { id: "BRCK", name: "Brock Commons / Hall", aliases: ["brock", "brock hall", "brock commons"], lat: 49.2685, lng: -123.2538 },
  { id: "AMSSTUDIO", name: "Student Union Plaza (outdoor)", aliases: ["plaza", "university square", "student union plaza"], lat: 49.2671, lng: -123.2507 },
];

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

export function getBuilding(id: string): Building | undefined {
  return BY_ID.get(id);
}

export function isKnownBuilding(id: string): boolean {
  return BY_ID.has(id);
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeLocation(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map free text (e.g. "ICICS X836", "the Nest, room 2306") to a known building id,
 * or null when nothing matches confidently. Never guesses.
 *
 * Strategy: whole-word alias/id/name match; the longest matching alias wins so
 * "life sciences" beats "life". Ties between different buildings → null.
 */
export function matchBuilding(text: string | null | undefined): string | null {
  if (!text) return null;
  const hay = ` ${normalizeLocation(text)} `;
  if (hay.trim() === "") return null;

  let best: { id: string; len: number } | null = null;
  let tie = false;
  for (const b of BUILDINGS) {
    const needles = [b.id.toLowerCase(), normalizeLocation(b.name), ...b.aliases.map(normalizeLocation)];
    for (const n of needles) {
      if (n.length < 3) continue;
      if (!hay.includes(` ${n} `)) continue;
      if (!best || n.length > best.len) {
        best = { id: b.id, len: n.length };
        tie = false;
      } else if (n.length === best.len && best.id !== b.id) {
        tie = true;
      }
    }
  }
  return best && !tie ? best.id : null;
}
