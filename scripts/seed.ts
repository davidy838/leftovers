/**
 * Seed realistic demo posts so the map isn't empty during a demo.
 *   npm run seed            # into whichever store .env.local selects (memory by default)
 */
import { randomUUID } from "node:crypto";
import { getStore } from "../src/lib/store";
import type { NewPost } from "../src/lib/types";

const min = (m: number) => new Date(Date.now() + m * 60000).toISOString();

const DEMO: NewPost[] = [
  { title: "Leftover cheese & veggie pizza", description: "3 boxes, mostly full, from the CS Club social", buildingId: "ICCS", room: "X836", photoUrl: null, estServings: 20, dietaryTags: ["vegetarian"], allergens: ["dairy", "gluten"], source: "manual", availableFrom: min(-5), expiresAt: min(40), aiRunId: null },
  { title: "Sandwich platters", description: "Turkey and veggie wraps after a career info session", buildingId: "ANGU", room: "241", photoUrl: null, estServings: 15, dietaryTags: [], allergens: ["gluten", "dairy", "eggs"], source: "manual", availableFrom: min(-10), expiresAt: min(25), aiRunId: null },
  { title: "Fruit & veggie trays", description: "Grapes, melon, carrots, hummus", buildingId: "NEST", room: "2306", photoUrl: null, estServings: 12, dietaryTags: ["vegan", "gluten_free"], allergens: ["sesame"], source: "manual", availableFrom: min(-2), expiresAt: min(60), aiRunId: null },
  { title: "Donuts from the engineering mixer", description: "Two dozen assorted", buildingId: "ESC", room: null, photoUrl: null, estServings: 24, dietaryTags: ["vegetarian"], allergens: ["gluten", "dairy", "eggs"], source: "manual", availableFrom: min(-1), expiresAt: min(15), aiRunId: null },
  { title: "Biryani night (Desi Students' Assoc.)", description: "Free food after the general meeting", buildingId: "LIFE", room: "2201", photoUrl: null, estServings: null, dietaryTags: ["halal"], allergens: [], source: "poster", availableFrom: min(180), expiresAt: min(300), aiRunId: null },
];

async function main() {
  const store = getStore();
  const owner = randomUUID();
  for (const p of DEMO) await store.createPost(p, owner);
  console.log(`Seeded ${DEMO.length} demo posts into the ${store.kind} store.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
