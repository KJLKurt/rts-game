import { BUILDINGS } from "../sim/content";
import type { BuildingId, Entity, GameState, Point, ResourceNode } from "../sim/types";

const position = (point: Point) => `${point.x.toFixed(1)}, ${point.y.toFixed(1)}`;

/** Public landmarks and the player's own orders only; never inspect hidden enemies. */
export function resourceTargetName(node: ResourceNode): string {
  const name = node.kind === "relic" ? "Relic" : node.kind === "gold" ? "Gold mine" : "Timber camp";
  return `${name} (${position(node)})`;
}

export function rallyDestination(producer: Entity): string {
  return producer.rally
    ? `New troops attack-move to the fixed rally point (${position(producer.rally)}), engaging enemies along the way. This point does not follow the commander.`
    : "New troops move to the commander’s position when training finishes; they do not keep following. If the commander is recovering then, they guard near this building. Set a safe rally point to assemble reinforcements.";
}

export function recruitDestination(producer: Entity): string {
  const name = BUILDINGS[producer.type as BuildingId]?.name ?? "Producer";
  return `${name}: ${producer.rally ? `fixed rally (${position(producer.rally)})` : "commander’s position at completion"}`;
}

export function orderDescription(state: GameState, entity: Entity): string {
  const order = entity.order;
  if (entity.kind === "building") return BUILDINGS[entity.type as BuildingId]?.recruits.length
    ? "Inspect production and rally in Details"
    : "Inspect actions and upgrades in Details";
  switch (order.type) {
    case "hold": return "Hold: stay here; attack within range";
    case "idle": return "Guard: defend nearby, then return";
    case "move": return `Move to (${position(order)})`;
    case "attackMove": return `Attack-move to (${position(order)})`;
    case "attack": return "Attack selected enemy";
    case "capture": {
      const node = state.map.nodes.find((candidate) => candidate.id === order.nodeId);
      const name = node ? resourceTargetName(node) : `point (${position(order)})`;
      return `Capture / defend ${name}; engages nearby enemies`;
    }
  }
}

export function selectedOrderDescription(state: GameState, ids: Iterable<string>): string {
  const selection = new Set(ids);
  const selected = state.entities.filter((entity) => selection.has(entity.id) && entity.hp > 0);
  if (!selected.length) return "Select troops to give an order";
  const orders = new Set(selected.map((entity) => orderDescription(state, entity)));
  return orders.size === 1 ? [...orders][0] : "Mixed orders: select a unit for its destination";
}

/** One battle-wide choice includes future recruits; direct movement and Hold retain priority. */
export function rangedSpacingDescription(state: GameState, ids: Iterable<string>): string {
  const selected = new Set(ids);
  const ranged = state.entities.filter(e => selected.has(e.id) && e.team === 0 && e.hp > 0 && e.kind !== "building" && e.type !== "siege" && e.range > 3);
  if (!ranged.length) return "";
  if (!state.players[0].rangedSpacing) return "Keep distance off";
  if (ranged.every(e => e.order.type === "hold" && !e.directControl)) return "Hold: spacing off";
  if (ranged.every(e => e.order.type === "move" || e.directControl)) return "Move: spacing off";
  return ranged.every(e => e.order.type === "move" || e.order.type === "hold" || e.directControl)
    ? "Orders: spacing off"
    : "Keep distance on";
}

/** The first encounter teaches the stakes even when optional field tips are disabled. */
export function expeditionOpeningGuidance(nodeId: string): string {
  if (nodeId !== "foothold") return "";
  return '<section class="expedition-opening"><h3>Establish your foothold</h3><p>Use the opening minute to capture another gold mine and timber camp near home. Starting deposits support a small army; extra income replaces losses during relic fights.</p><p>New recruits move to the commander’s position when training finishes. Select a production building, open Details, and set a safe rally point before fighting far from home. Keep Menders behind your frontline.</p><p>Capture orders engage nearby enemies, then defend the point. Hold stays exactly where your troops are. The Relic button chooses the nearest relic your side does not control; tap a particular relic to choose it yourself. Use tactical pause to plan.</p></section>';
}
