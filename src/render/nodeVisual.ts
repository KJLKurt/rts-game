import type { ResourceNode } from "../sim/types";
import type { SpriteBounds } from "./SpriteAtlas";
/** The sprite and pivot footprint used by both painting and touch picking. */
export function nodeVisual(node: ResourceNode): {
  frame: string;
  width: number;
  height?: number;
  fallback: SpriteBounds;
} {
  if (node.kind === "relic") {
    const contested = node.captureTeam !== null && node.captureProgress > 0;
    return {
      frame:
        node.owner === null
          ? "relic-neutral"
          : contested
            ? "relic-contested"
            : "relic-captured",
      width: 75,
      height: 91,
      fallback: { x: -35, y: -73, width: 70, height: 89 },
    };
  }
  const amount = node.amount ?? 1000,
    max = node.maxAmount ?? 1000,
    ratio = amount / max;
  const stage =
    amount <= 0
      ? "empty"
      : ratio < 0.3
        ? "sparse"
        : ratio < 0.65
          ? "half"
          : "full";
  return {
    frame: `${node.kind}-${stage}`,
    width: node.kind === "wood" ? 84 : 78,
    fallback:
      node.kind === "wood"
        ? {
            x: -33,
            y: amount <= 0 ? -12 : -67,
            width: 69,
            height: amount <= 0 ? 26 : 81,
          }
        : { x: -34, y: -38, width: 64, height: 51 },
  };
}
