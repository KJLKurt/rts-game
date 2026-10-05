import { describe, expect, it } from 'vitest';
import { liveElementKey } from '../src/ui/live-html';
const element=(attributes:Record<string,string>)=>({getAttribute:(name:string)=>attributes[name]??null});
describe('live control identity',()=>{
  it('keeps action identity independent of changed label/count/disabled state',()=>{
    const before=element({'data-action':'mission-objectives','aria-label':'0 / 5 chapter objectives'});
    const after=element({'data-action':'mission-objectives','aria-label':'1 / 5 chapter objectives',disabled:''});
    expect(liveElementKey(before)).toBe(liveElementKey(after));
  });
  it('does not reuse a pressed node for a different action or target',()=>{
    expect(liveElementKey(element({'data-action':'focus'}))).not.toBe(liveElementKey(element({'data-action':'pause'})));
    expect(liveElementKey(element({'data-action':'view-attacked-building','data-id':'keep'}))).not.toBe(liveElementKey(element({'data-action':'view-attacked-building','data-id':'barracks'})));
  });
  it('preserves explicit production keys and avoids delimiter collisions',()=>{
    expect(liveElementKey(element({'data-live-key':'queue|item','data-action':'cancel-production'}))).toBe(JSON.stringify(['live','queue|item']));
    expect(liveElementKey(element({'data-action':'a|b','data-id':'c'}))).not.toBe(liveElementKey(element({'data-action':'a','data-id':'b|c'})));
    expect(liveElementKey(element({'data-live-key':'x'}))).not.toBe(liveElementKey(element({'data-action':'x'})));
  });
  it('leaves ordinary noninteractive text nodes unkeyed',()=>{
    expect(liveElementKey(element({class:'objective-description'}))).toBeNull();
  });
});
