import { BIOMES, MAP_DIMENSIONS } from "../sim/content";
import type { GameSettings } from "../sim/types";
/** A portable map code includes every generator input, not just the friendly seed name. */
export function encodeMapCode(settings: GameSettings, version: number): string {
  return [
    `FC${version}`,
    encodeURIComponent(settings.seed),
    settings.biome,
    settings.mapSize,
    settings.aiPlayers,
    settings.preset,
    settings.duration,
    settings.resourceAbundance,
    settings.terrainRoughness,
    settings.water,
    settings.objectiveDensity,
    settings.weirdness,
    settings.mode,
  ].join("|");
}
export function decodeMapCode(code: string): Partial<GameSettings> {
  const parts = code.trim().split("|");
  if (parts.length !== 13 || !/^FC[34]$/.test(parts[0]))
    throw new Error(
      "That map code is incomplete or from an unsupported version.",
    );
  const seed = decodeURIComponent(parts[1]);
  if (
    !seed ||
    seed.length > 80 ||
    !Object.hasOwn(BIOMES, parts[2]) ||
    !Object.hasOwn(MAP_DIMENSIONS, parts[3]) ||
    !["balanced", "competitive", "wild", "chaotic"].includes(parts[5]) ||
    !["domination", "conquest", "relic", "rush"].includes(parts[12])
  )
    throw new Error("That map code has an invalid seed or setting.");
  const values = [4, 6, 7, 8, 9, 10, 11].map((i) => Number(parts[i]));
  if (
    values.some((n) => !Number.isFinite(n)) ||
    values[0] < 1 ||
    values[0] > 5 ||
    !Number.isInteger(values[0]) ||
    values[1] < 4 ||
    values[1] > 90 ||
    values[2] < 0.3 ||
    values[2] > 5 ||
    values.slice(3).some((n) => n < 0 || n > 2)
  )
    throw new Error("That map code has an invalid range.");
  return {
    seed,
    mode: parts[12] as GameSettings["mode"],
    mapGenerationVersion: Number(parts[0].slice(2)) as 3 | 4,
    biome: parts[2] as GameSettings["biome"],
    mapSize: parts[3] as GameSettings["mapSize"],
    aiPlayers: values[0],
    preset: parts[5] as GameSettings["preset"],
    duration: values[1],
    resourceAbundance: values[2],
    terrainRoughness: values[3],
    water: values[4],
    objectiveDensity: values[5],
    weirdness: values[6],
  };
}
