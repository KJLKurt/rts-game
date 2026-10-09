import type { Entity } from '../sim/types';

export const MAX_SELECTED_INDICATORS = 12;
export interface IndicatorActor { entity: Entity; x: number; y: number }
export interface ActorIndicator {
 id: string; team: number; x: number; y: number; selected: boolean; commander: boolean;
 radius: number; radiusY: number; ringY: number; stroke: number;
 health?: { y: number; width: number; height: number; ratio: number };
}

/** Only visible mobile paint items enter here, already at their interpolated screen positions.
 * Small selections get clear rings; larger selections retain their ordinary depth-layer markers.
 * At most one selected actor and the player's commander get elevated health/identity markers.
 * Linear scan, at most 13 plans, and no simulation or input changes. */
export function actorIndicators(actors: readonly IndicatorActor[], selected: ReadonlySet<string>, team: number, zoom: number): ActorIndicator[] {
 const eligible = actors.filter(({ entity: e }) => e.kind !== 'building' && e.hp > 0 && e.respawnAt === null);
 const selection = eligible.filter(({ entity }) => selected.has(entity.id));
 const commanderId = eligible.find(({ entity: e }) => e.kind === 'commander' && e.team === team)?.entity.id;
 const single = selection.length === 1 ? selection[0].entity.id : undefined;
 const smallSelection = selection.length <= MAX_SELECTED_INDICATORS;
 const result: ActorIndicator[] = [];
 for (const { entity: e, x, y } of eligible) {
  const ownCommander = e.id === commanderId, isSelected = selected.has(e.id);
  if (!ownCommander && !(isSelected && smallSelection)) continue;
  const commander = e.kind === 'commander', radius = (commander ? 33 : e.type === 'siege' || e.type === 'cavalry' ? 24 : 19) * zoom;
  result.push({ id: e.id, team: e.team, x, y, selected: isSelected, commander: ownCommander,
   radius, radiusY: radius * .48, ringY: 2 * zoom, stroke: Math.max(1.2, (isSelected ? 1.8 : 1.1) * zoom),
   health: ownCommander || e.id === single ? {
    y: y - Math.max((commander ? 82 : 58) * zoom, commander ? 43 : 31),
    width: Math.max(commander ? 30 : 24, (commander ? 46 : 30) * zoom),
    height: Math.max(3, (commander ? 4.3 : 3) * zoom), ratio: Math.max(0, Math.min(1, e.hp / e.maxHp)),
   } : undefined,
  });
 }
 // The exact selected actor paints last. Separate the only two possible elevated bars.
 result.sort((a, b) => Number(a.selected && a.id === single) - Number(b.selected && b.id === single));
 const bars = result.filter(indicator => indicator.health);
 if (bars.length === 2) {
  const [first, last] = bars, a = first.health!, b = last.health!, gap = Math.max(18, 20 * zoom);
  if (Math.abs(first.x - last.x) < (a.width + b.width) / 2 + 4 && Math.abs(a.y - b.y) < gap)
   a.y = b.y - gap;
 }
 return result;
}
