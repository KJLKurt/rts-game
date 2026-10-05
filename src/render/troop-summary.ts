import type { UnitId } from "../sim/types";

export interface VisibleTroop { team: number; type: UnitId; x: number; y: number }
export interface TroopSummary { team: number; count: number; types: string; x: number; y: number }
const names: Record<UnitId, string> = {
  swordsman: "Swordsmen", spearman: "Spearmen", archer: "Archers",
  cavalry: "Cavalry", siege: "Runebreakers", support: "Menders",
};

/** Input consists only of currently visible, on-screen troop paint items.
 * One summary per team appears only when at least six sprites share a small
 * screen region. Its count explicitly describes all visible troops, not a
 * simulation formation or a whole army. Linear work, including dense armies. */
export function visibleTroopSummaries(troops: readonly VisibleTroop[]): TroopSummary[] {
  const teams = new Map<number, { count: number; types: Map<UnitId, number>; cells: Map<string, { count: number; x: number; y: number }> }>();
  for (const troop of troops) {
    let team = teams.get(troop.team);
    if (!team) { team = { count: 0, types: new Map(), cells: new Map() }; teams.set(troop.team, team); }
    team.count++;
    team.types.set(troop.type, (team.types.get(troop.type) ?? 0) + 1);
    const key = `${Math.floor(troop.x / 120)},${Math.floor(troop.y / 90)}`;
    let cell = team.cells.get(key);
    if (!cell) { cell = { count: 0, x: 0, y: 0 }; team.cells.set(key, cell); }
    cell.count++; cell.x += troop.x; cell.y += troop.y;
  }
  const summaries: TroopSummary[] = [];
  for (const [id, team] of teams) {
    let dense: { count: number; x: number; y: number } | undefined;
    for (const cell of team.cells.values()) if (!dense || cell.count > dense.count) dense = cell;
    if (!dense || dense.count < 6) continue;
    const types = [...team.types.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const other = types.slice(2).reduce((sum, [, count]) => sum + count, 0);
    summaries.push({ team: id, count: team.count, x: dense.x / dense.count, y: dense.y / dense.count,
      types: types.slice(0, 2).map(([type, count]) => `${count} ${names[type]}`).join(" · ") + (other ? ` · +${other} other` : "") });
  }
  return summaries.sort((a, b) => b.count - a.count || a.team - b.team);
}
