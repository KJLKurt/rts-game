import type { Point } from "./types";

/** A small clearance gives neighboring buildings room without a full extra tile. */
export const BUILDING_CLEARANCE = 0.25;
export function footprintsOverlap(
  a: Point,
  radiusA: number,
  b: Point,
  radiusB: number,
) {
  return (
    Math.hypot(a.x - b.x, a.y - b.y) < radiusA + radiusB + BUILDING_CLEARANCE
  );
}
export function snapConstruction(point: Point): Point {
  return { x: Math.round(point.x * 2) / 2, y: Math.round(point.y * 2) / 2 };
}
