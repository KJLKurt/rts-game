import type { Entity } from '../sim/types';
import type { ScreenRect } from './troop-summary';

export const MAX_SELECTED_INDICATORS = 12;
export interface IndicatorActor { entity: Entity; x: number; y: number }
export interface ActorIndicator {
 id: string; team: number; x: number; y: number; selected: boolean; commander: boolean;
 radius: number; radiusY: number; ringY: number; stroke: number;
 health?: { y: number; width: number; height: number; ratio: number };
}

/** Shared by painting and summary exclusions so the identity follows any bar separation. */
export function actorIndicatorIdentity(marker: ActorIndicator, zoom: number) {
 if (!marker.health) return;
 const scale = Math.max(.8, zoom), { y, height } = marker.health;
 return marker.commander ? { kind: 'star' as const, y: y + height + 9 * scale, size: 10 * scale }
  : marker.selected ? { kind: 'pip' as const, y: y + height + 5 * scale, size: 3 * scale } : undefined;
}

/** At most two priority rectangles. Include the ring, bar border and identity stroke;
 * a full font em plus descent conservatively contains the platform's star glyph. */
export function actorIndicatorBounds(indicators: readonly ActorIndicator[], zoom: number): ScreenRect[] {
 const bounds: ScreenRect[] = [];
 for (const marker of indicators) {
  const health = marker.health;
  if (!health) continue;
  const identity = actorIndicatorIdentity(marker, zoom);
  const ringBorder = (marker.stroke + 2) / 2;
  let halfWidth = Math.max(health.width / 2 + 1, marker.radius + ringBorder);
  let top = Math.min(health.y - 1, marker.y + marker.ringY - marker.radiusY - ringBorder);
  let bottom = Math.max(health.y + health.height + 1, marker.y + marker.ringY + marker.radiusY + ringBorder);
  if (identity) {
   const star = identity.kind === 'star', stroke = star ? 1.25 : .65;
   halfWidth = Math.max(halfWidth, identity.size * (star ? .5 : 1) + stroke);
   top = Math.min(top, identity.y - identity.size - stroke);
   bottom = Math.max(bottom, identity.y + identity.size * (star ? .3 : 1) + stroke);
  }
  bounds.push({ x: marker.x - halfWidth, y: top, w: halfWidth * 2, h: bottom - top });
 }
 return bounds;
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
