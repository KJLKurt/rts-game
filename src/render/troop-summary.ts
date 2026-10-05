import type { UnitId } from "../sim/types";

export interface VisibleTroop { team: number; type: UnitId; x: number; y: number }
export interface TroopSummary { team: number; count: number; types: string; x: number; y: number }
export interface ScreenRect { x:number; y:number; w:number; h:number }

/** HUD controls and other badges are hard exclusions; silhouettes are a soft preference. */
export function troopSummaryPosition(anchor:{x:number;y:number}, size:{w:number;h:number}, viewport:{w:number;h:number}, controls:readonly ScreenRect[], badges:readonly ScreenRect[], landmarks:readonly ScreenRect[]):{x:number;y:number}|undefined {
  const {w,h}=size,gap=4,edge=8;
  if(w<=0||h<=0||w>viewport.w-edge*2||h>viewport.h-edge*2)return;
  const candidates=[
    {x:anchor.x-w/2,y:anchor.y-92}, {x:anchor.x-w-45,y:anchor.y-50},
    {x:anchor.x+45,y:anchor.y-50}, {x:anchor.x-w/2,y:anchor.y-150},
    {x:anchor.x-w/2,y:anchor.y+20},
    {x:edge,y:edge},{x:viewport.w-w-edge,y:edge},
    {x:edge,y:viewport.h-h-edge},{x:viewport.w-w-edge,y:viewport.h-h-edge},
  ];
  for(const r of controls)for(const x of [r.x,r.x+r.w-w,r.x-w-gap,r.x+r.w+gap])
    for(const y of [r.y-h-gap,r.y+r.h+gap])candidates.push({x,y});
  const overlap=(p:{x:number;y:number},r:ScreenRect,padding=0)=>Math.max(0,Math.min(p.x+w,r.x+r.w+padding)-Math.max(p.x,r.x-padding))*Math.max(0,Math.min(p.y+h,r.y+r.h+padding)-Math.max(p.y,r.y-padding));
  const available=candidates.map(p=>({x:Math.max(edge,Math.min(viewport.w-w-edge,p.x)),y:Math.max(edge,Math.min(viewport.h-h-edge,p.y))})).filter(p=>![...controls,...badges].some(r=>overlap(p,r,gap)>0));
  const score=(p:{x:number;y:number})=>landmarks.reduce((sum,r)=>sum+overlap(p,r),0);
  available.sort((a,b)=>score(a)-score(b)||Math.hypot(a.x+w/2-anchor.x,a.y+h-anchor.y)-Math.hypot(b.x+w/2-anchor.x,b.y+h-anchor.y));
  return available[0];
}
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
