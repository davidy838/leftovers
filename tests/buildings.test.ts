import { describe, expect, it } from "vitest";
import { BUILDINGS, matchBuilding } from "@/lib/buildings";

describe("matchBuilding", () => {
  it.each([
    ["ICICS X836", "ICCS"],
    ["the Nest, room 2306", "NEST"],
    ["AMS Student Nest", "NEST"],
    ["Life Sciences Centre 1510", "LSC"],
    ["Life Building", "LIFE"],
    ["Henry Angus 104", "ANGU"],
    ["Sauder", "ANGU"],
    ["IKB 261", "IKB"],
    ["Irving K. Barber", "IKB"],
    ["DMP 110", "DMP"],
  ])("%s → %s", (text, id) => {
    expect(matchBuilding(text)).toBe(id);
  });

  it.each([null, undefined, "", "   ", "Online on Zoom", "my house", "Room 101"])("returns null for %s", (text) => {
    expect(matchBuilding(text)).toBeNull();
  });

  it("does not match aliases inside other words", () => {
    expect(matchBuilding("Hollywood Theatre")).toBeNull(); // contains "wood"
  });

  it("has unique ids and valid coordinates", () => {
    const ids = BUILDINGS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BUILDINGS) {
      expect(b.lat).toBeGreaterThan(49.24);
      expect(b.lat).toBeLessThan(49.28);
      expect(b.lng).toBeGreaterThan(-123.27);
      expect(b.lng).toBeLessThan(-123.23);
    }
  });
});
