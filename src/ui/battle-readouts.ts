import { BUILDINGS, COMMANDERS, UNITS } from "../sim/content";
import type { Cost, Entity } from "../sim/types";
import { escapeText as esc } from "./escape";
import { icon } from "./icons";

/** Resource identity must not depend on which price happens to be first. */
export function resourceCostHTML(cost: Cost): string {
  const items = (["gold", "wood"] as const).filter(
    (resource) => cost[resource] > 0,
  );
  if (!items.length)
    return '<span class="cost no-resource-cost">No resource cost</span>';
  return `<span class="cost">${items.map((resource) => `<span class="resource-price" data-resource="${resource}">${icon(resource)}<span class="resource-amount">${cost[resource]}</span><span class="resource-name">${resource}</span></span>`).join("")}</span>`;
}

export function selectionName(entity: Pick<Entity, "kind" | "type">): string {
  if (entity.type === "turret") return "Runic Turret";
  if (entity.kind === "commander")
    return (
      COMMANDERS[entity.type as keyof typeof COMMANDERS]?.name ?? "Commander"
    );
  if (entity.kind === "building")
    return BUILDINGS[entity.type as keyof typeof BUILDINGS]?.name ?? "Building";
  return UNITS[entity.type as keyof typeof UNITS]?.name ?? "Unit";
}

/** Current health is never derived from a queued upgrade or illustrative art. */
export function selectionHealthHTML(
  entity: Pick<Entity, "kind" | "type" | "hp" | "maxHp">,
  queued = 0,
): string {
  const maximum = Math.max(1, Math.ceil(entity.maxHp));
  const health = Math.max(0, Math.min(maximum, Math.ceil(entity.hp)));
  const ratio = Math.max(0, Math.min(1, entity.hp / Math.max(1, entity.maxHp)));
  return `<small class="selection-vitals"><span class="selection-health-track" role="meter" aria-label="${esc(selectionName(entity))} health" aria-valuemin="0" aria-valuemax="${maximum}" aria-valuenow="${health}" aria-valuetext="${health} of ${maximum} health"><i style="width:${(ratio * 100).toFixed(2)}%"></i></span><span class="selection-health-value">${health} / ${maximum} health${queued ? ` · ${queued} queued` : ""}</span></small>`;
}

export function placementFeedback(
  site: { ok: boolean; error?: string } | null,
  neighbourCaution = false,
) {
  if (!site)
    return {
      state: "unplaced",
      icon: "crosshair",
      text: "Choose a location. Nothing spent yet.",
    };
  if (site.ok && neighbourCaution)
    return {
      state: "warning",
      icon: "alert",
      text: "Legal, but no room for a neighbor. Use Find pair site.",
    };
  if (site.ok)
    return {
      state: "valid",
      icon: "check",
      text: "Valid location · Confirm to spend.",
    };
  const reason = (site.error || "Choose another location")
    .trim()
    .replace(/[.!?\s]+$/, "");
  return {
    state: "blocked",
    icon: "close",
    text: `${reason}. Nothing spent yet.`,
  };
}
