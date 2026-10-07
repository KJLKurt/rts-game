import type { FactionId } from '../sim/types';
import { ellipse, line, palette, poly, type Ctx } from './art';

/** Original vector motifs, independent from team colors and unit/weapon silhouettes. */
export const FACTION_IDENTITY = {
  ironhold: { title: 'The iron tower', material: 'Riveted steel, square shields and battlement trim', path: 'M5 3h4v4h6V3h4v9l-7 9-7-9ZM9 11h6v5H9Z', color: '#c8d4d9', dark: '#384f5c' },
  wildborn: { title: 'The branching antler', material: 'Carved timber, forked pennants and antler crests', path: 'M12 21V10M12 13 6 8 4 3M6 8 2 7M8 10 8 4M12 13 18 8 20 3M18 8 22 7M16 10V4', color: '#e9d2a2', dark: '#64523d' },
  arcanists: { title: 'The rune crystal', material: 'Faceted crystals, brass frames and geometric runes', path: 'm12 2 8 10-8 10-8-10ZM4 12h16M12 2v20M8 7h8M8 17h8', color: '#ded3ff', dark: '#504662' },
} as const;

export function factionCrestSVG(faction: FactionId): string {
  return `<svg class="faction-crest" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${FACTION_IDENTITY[faction].path}"/></svg>`;
}


const crestPaths: Partial<Record<FactionId, Path2D>> = {};
function crest(c: Ctx, faction: FactionId, x: number, y: number, size: number) {
  c.save(); c.translate(x, y); c.scale(size / 24, size / 24);
  c.strokeStyle = FACTION_IDENTITY[faction].color; c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
  c.stroke(crestPaths[faction] ??= new Path2D(FACTION_IDENTITY[faction].path)); c.restore();
}

/** Draw onto the existing sprite, never replacing the team plate, weapon or health bar. */
export function drawFactionAdornment(c: Ctx, faction: FactionId, team: number, kind: 'building' | 'unit' | 'commander', keep = false) {
  const material = FACTION_IDENTITY[faction], p = palette(team), building = kind === 'building';
  c.save();
  if (building) {
    const w = keep ? 40 : 28;
    if (faction === 'ironhold') {
      poly(c, [-w,-9,0,3,w,-9,w,-2,0,11,-w,-2], material.dark, material.color, 1);
      for (const x of [-.75,-.4,.4,.75]) ellipse(c, w*x, 5-Math.abs(x)*12, 1.3, 1.3, material.color);
    } else if (faction === 'wildborn') {
      for (const side of [-1,1]) {
        line(c, [side*w,0,side*(w+3),-24], material.dark, 4);
        line(c, [side*w,0,side*(w+3),-24], material.color, 1);
        line(c, [side*(w+2),-15,side*(w+10),-23], material.color, 2);
        line(c, [side*(w+3),-19,side*(w-3),-27], material.color, 2);
      }
      line(c, [-w,-3,0,8,w,-3], material.dark, 4);
      line(c, [-w,-3,0,8,w,-3], material.color, 1);
    } else {
      for (const side of [-1,1]) {
        poly(c, [side*w,-27,side*w+5,-15,side*w,-7,side*w-5,-15], material.dark, material.color, 1.5);
        line(c, [side*w,-25,side*w,-9], p.main, 1.4);
      }
      line(c, [-w,-2,0,9,w,-2], material.color, 1.2);
      for (const x of [-14,0,14]) poly(c, [x,1-Math.abs(x)*.3,x+3,4-Math.abs(x)*.3,x,7-Math.abs(x)*.3,x-3,4-Math.abs(x)*.3], material.dark, p.main, .8);
    }
    // A broad front hanging shows the same crest as the setup legend.
    poly(c, [-9,-30,9,-30,9,-10,0,-5,-9,-10], p.banner, material.color, 1.2);
    crest(c, faction, -8, -28, 16);
  } else {
    // Ground-side standards keep faction identity clear of faces and weapons.
    const large = kind === 'commander', x = large ? -32 : -25, y = 9, size = large ? 12 : 10;
    if (faction === 'ironhold') {
      poly(c, [x-2,y-2,x+size+2,y-2,x+size+2,y+size,x+size*.5,y+size+4,x-2,y+size], material.dark, material.color, 1);
      ellipse(c, x, y, 1, 1, material.color); ellipse(c, x+size, y, 1, 1, material.color);
    } else if (faction === 'wildborn') {
      poly(c, [x-2,y-3,x+size+2,y-3,x+size+2,y+size+4,x+size*.5,y+size,x-2,y+size+4], material.dark, material.color, 1);
      line(c, [x-3,y+size+4,x-3,y-6], material.color, 1.4);
    } else {
      poly(c, [x+size*.5,y-5,x+size+3,y+size*.5,x+size*.5,y+size+5,x-3,y+size*.5], material.dark, material.color, 1);
    }
    crest(c, faction, x, y, size);
    // The team-colored top edge is constant across the three material treatments.
    line(c, [x,y-2,x+size,y-2], p.main, 2);
  }
  c.restore();
}
