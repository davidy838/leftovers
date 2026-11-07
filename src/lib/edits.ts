// Which fields did the human change vs. the AI suggestion? (docs/LLD.md §7.5)
import type { CreatePostParsed, Suggestion } from "./types";

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/** Minutes precision is enough — the UI edits times in minutes. */
const sameTime = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && Math.floor(Date.parse(a) / 60000) === Math.floor(Date.parse(b) / 60000));

/**
 * @param submitted the parsed create request, with availableFrom/expiresAt resolved to ISO strings
 */
export function diffSuggestion(
  suggestion: Suggestion,
  submitted: Pick<CreatePostParsed, "title" | "dietaryTags" | "buildingId" | "room" | "estServings" | "allergens"> & {
    availableFrom: string;
    expiresAt: string;
  },
): string[] {
  const edited: string[] = [];
  if (suggestion.title.trim() !== submitted.title.trim()) edited.push("title");
  if (!sameSet(suggestion.dietaryTags, submitted.dietaryTags)) edited.push("dietaryTags");

  if ("allergens" in suggestion) {
    // food suggestion
    if (suggestion.estServings !== submitted.estServings) edited.push("estServings");
    if (!sameSet(suggestion.allergens, submitted.allergens)) edited.push("allergens");
  } else {
    // poster suggestion
    if (suggestion.buildingId !== submitted.buildingId) edited.push("buildingId");
    if ((suggestion.room ?? null) !== (submitted.room ?? null)) edited.push("room");
    if (suggestion.availableFrom !== null && !sameTime(suggestion.availableFrom, submitted.availableFrom)) {
      edited.push("availableFrom");
    }
    if (suggestion.expiresAt !== null && !sameTime(suggestion.expiresAt, submitted.expiresAt)) {
      edited.push("expiresAt");
    }
  }
  return edited;
}
