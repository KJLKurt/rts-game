import { describe, expect, it } from "vitest";
import { visibleTroopSummaries, type VisibleTroop } from "../../src/render/troop-summary";

describe("dense visible troop summaries", () => {
  it("counts both visible groups of a team, describes its composition, and leaves input untouched", () => {
    const troops: VisibleTroop[] = Array.from({length:34}, () => ({team:1,type:"swordsman",x:190,y:350}));
    troops.push({team:1,type:"cavalry",x:200,y:350});
    for(let i=0;i<8;i++)troops.push({team:1,type:"archer",x:330,y:440});
    for(let i=0;i<5;i++)troops.push({team:1,type:"support",x:330,y:440});
    const before = JSON.stringify(troops);
    expect(visibleTroopSummaries(troops)).toEqual([{team:1,count:48,types:"34 Swordsmen · 8 Archers · +6 other",x:190+10/35,y:350}]);
    expect(JSON.stringify(troops)).toBe(before);
  });
  it("keeps teams separate and leaves small or scattered forces uncluttered", () => {
    const troops:VisibleTroop[] = Array.from({length:5},()=>({team:0,type:"swordsman",x:100,y:100}));
    troops.push(...Array.from({length:12},(_,i)=>({team:1,type:"archer" as const,x:i*120,y:400})));
    expect(visibleTroopSummaries(troops)).toEqual([]);
    troops.push({team:0,type:"swordsman",x:100,y:100});
    expect(visibleTroopSummaries(troops)).toHaveLength(1);
    expect(visibleTroopSummaries(troops)[0].count).toBe(6);
  });
  it("handles the 600-troop stress size with one bounded summary", () => {
    const troops:VisibleTroop[]=Array.from({length:600},()=>({team:2,type:"swordsman",x:200,y:200}));
    expect(visibleTroopSummaries(troops)).toEqual([{team:2,count:600,types:"600 Swordsmen",x:200,y:200}]);
  });
});
