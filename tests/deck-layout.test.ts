import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeControlDeck, battlefieldCenterY } from '../src/ui/deck-layout';
afterEach(()=>vi.unstubAllGlobals());
function observerFixture() {
  let callback: ResizeObserverCallback=()=>{};
  const observe=vi.fn(), disconnect=vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb:ResizeObserverCallback){callback=cb;}
    observe=observe;disconnect=disconnect;
  });
  const emit=(target:Element,width:number,height:number)=>callback([{target,contentRect:{width,height}} as ResizeObserverEntry],{} as ResizeObserver);
  return {observe,disconnect,emit};
}
describe('event-driven command-deck geometry',()=>{
  it('measures populated content immediately and responds only to changed sizes',()=>{
    const fixture=observerFixture(), deck={} as Element, measure=vi.fn();
    observeControlDeck(deck,measure);expect(measure).toHaveBeenCalledTimes(1);
    expect(fixture.observe).toHaveBeenCalledWith(deck);
    fixture.emit(deck,390,150);expect(measure).toHaveBeenCalledTimes(2);
    fixture.emit(deck,390,150);expect(measure).toHaveBeenCalledTimes(2);
    fixture.emit(deck,390,240);expect(measure).toHaveBeenCalledTimes(3);
    fixture.emit(deck,844,240);expect(measure).toHaveBeenCalledTimes(4);
  });
  it('ignores unrelated entries and stops late callbacks after menu/editor/shell replacement',()=>{
    const fixture=observerFixture(),deck={} as Element,measure=vi.fn();
    const stop=observeControlDeck(deck,measure);
    fixture.emit({} as Element,390,300);expect(measure).toHaveBeenCalledTimes(1);
    stop();expect(fixture.disconnect).toHaveBeenCalledTimes(1);
    fixture.emit(deck,390,300);expect(measure).toHaveBeenCalledTimes(1);
  });
  it('retains an initial measurement on older hosts without ResizeObserver',()=>{
    vi.stubGlobal('ResizeObserver',undefined);
    const measure=vi.fn(),stop=observeControlDeck({} as Element,measure);
    expect(measure).toHaveBeenCalledTimes(1);expect(stop).not.toThrow();
  });
});

describe('landscape placement viewport',()=>{
  it('places the focus above the actual toolbar rather than beneath it',()=>{
    expect(battlefieldCenterY({height:390,landscape:true,hudBottom:48,objectiveBottom:97,deckTop:339,placementTop:269})).toBe(207);
    expect(battlefieldCenterY({height:390,landscape:true,hudBottom:48,objectiveBottom:97,deckTop:339,placementTop:245})).toBe(195);
  });
  it('preserves non-placement and portrait focus behavior',()=>{
    expect(battlefieldCenterY({height:390,landscape:true,hudBottom:48,objectiveBottom:97,deckTop:293})).toBe(219);
    expect(battlefieldCenterY({height:844,landscape:false,hudBottom:60,deckTop:650,placementTop:500})).toBe(355);
    expect(battlefieldCenterY({height:844,landscape:false})).toBe(422);
  });
});
