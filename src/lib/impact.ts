// Turn "servings claimed" into food weight and emissions avoided (docs/LLD.md §5).
import { KG_CO2E_PER_KG_FOOD, KG_FOOD_PER_SERVING } from "./constants";

export interface Impact {
  kgFood: number;
  kgCo2e: number;
}

export function impactFromServings(servings: number): Impact {
  const s = Number.isFinite(servings) && servings > 0 ? servings : 0;
  const kgFood = s * KG_FOOD_PER_SERVING;
  return { kgFood, kgCo2e: kgFood * KG_CO2E_PER_KG_FOOD };
}

/** "0.4 kg", "12 kg", "1.2 t". One decimal under 10, whole numbers above. */
export function formatKg(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return "0 kg";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  if (kg < 10) return `${Math.round(kg * 10) / 10} kg`;
  return `${Math.round(kg)} kg`;
}
