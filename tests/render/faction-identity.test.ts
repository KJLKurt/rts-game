import { afterEach, describe, expect, it, vi } from 'vitest';
import { FACTION_IDENTITY, drawFactionAdornment, factionCrestSVG } from '../../src/render/factionIdentity';
import { drawTeamGlyph, palette, type Ctx } from '../../src/render/art';
import type { FactionId } from '../../src/sim/types';

function recordingContext() {
  const calls: unknown[][]=[];
  const context = new Proxy({} as Ctx, {
    get: (_target, name) => (...args:unknown[]) => {calls.push([name,...args]);},
    set: (_target, name, value) => {calls.push([name,value]);return true;},
  });
  return {context,calls};
}
afterEach(()=>vi.unstubAllGlobals());
describe('faction and team visual identity', () => {
  it('defines three distinct original shapes rather than swapping faction colors', () => {
    expect(new Set(Object.values(FACTION_IDENTITY).map(v=>v.path)).size).toBe(3);
    for(const id of Object.keys(FACTION_IDENTITY) as FactionId[]) expect(factionCrestSVG(id)).toContain(FACTION_IDENTITY[id].path);
  });
  it('uses six unique team colors and six distinct canvas glyphs', () => {
    expect(new Set(Array.from({length:6},(_,i)=>palette(i).main)).size).toBe(6);
    const shapes=Array.from({length:6},(_,i)=>{const r=recordingContext();drawTeamGlyph(r.context,i,0,0,5,'#ffffff');return JSON.stringify(r.calls);});
    expect(new Set(shapes).size).toBe(6);
  });
  it('renders distinct material and crest operations at all actor scales, with a preserved team accent', () => {
    vi.stubGlobal('Path2D',class {constructor(public path:string){}});
    for(const kind of ['unit','commander','building'] as const) {
      const recordings=Object.keys(FACTION_IDENTITY).map(faction=>{
        const r=recordingContext();drawFactionAdornment(r.context,faction as FactionId,1,kind,true);
        expect(r.calls.filter(c=>c[0]==='save').length).toBe(r.calls.filter(c=>c[0]==='restore').length);
        expect(JSON.stringify(r.calls)).toContain(FACTION_IDENTITY[faction as FactionId].path);
        expect(JSON.stringify(r.calls)).toContain(kind==='building'?palette(1).banner:palette(1).main);
        return JSON.stringify(r.calls);
      });
      expect(new Set(recordings).size).toBe(3);
    }
  });
});
