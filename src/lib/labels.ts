import type { Allergen, DietaryTag } from "./types";

export const DIETARY_LABELS: Record<DietaryTag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  halal: "Halal",
  kosher: "Kosher",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
};

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  peanuts: "Peanuts",
  tree_nuts: "Tree nuts",
  dairy: "Dairy",
  gluten: "Gluten",
  eggs: "Eggs",
  soy: "Soy",
  fish: "Fish",
  shellfish: "Shellfish",
  sesame: "Sesame",
};
