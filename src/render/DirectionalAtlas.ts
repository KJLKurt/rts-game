import {animationFrame, type AnimationFrame, type AnimationPose} from './AnimationAtlas';

export interface DirectionClip {idle:string; walk:string[]; attack:string[]}
export interface DirectionalActor {
  referenceBodyHeight:number;
  suggestedHeight:number;
  walkFrameMs:number;
  attackFrameMs:number[];
  impactFrame:number;
  directions:DirectionClip[];
}
export interface DirectionalData {
  version:1;
  image:string;
  width:number;
  height:number;
  actors:Record<string,DirectionalActor>;
  frames:Record<string,AnimationFrame & {actor:string;bodyHeight:number}>;
}

/** Sixteen screen headings clockwise from north, projected from the real world-facing vector. */
export function facingDirection(facing:number):number {
  if (!Number.isFinite(facing)) return 0;
  const x=Math.cos(facing)-Math.sin(facing), y=(Math.cos(facing)+Math.sin(facing))*.5;
  return ((Math.round((Math.atan2(y,x)+Math.PI/2)/(Math.PI*2)*16)%16)+16)%16;
}

export function validDirectionalData(data:DirectionalData):boolean {
  if (!data || data.version!==1 || typeof data.image!=='string' || !data.image ||
      !Number.isInteger(data.width) || !Number.isInteger(data.height) ||
      data.width<=0 || data.height<=0 || data.width>8192 || data.height>8192 ||
      !data.actors || !data.frames || Object.keys(data.actors).length===0) return false;
  return Object.entries(data.actors).every(([id,actor]) => {
    if (!actor || ![actor.referenceBodyHeight,actor.suggestedHeight,actor.walkFrameMs].every(n=>Number.isFinite(n)&&n>0) || actor.impactFrame!==2 ||
        !Array.isArray(actor.attackFrameMs) || ![0,4].includes(actor.attackFrameMs.length) ||
        !actor.attackFrameMs.every(ms=>Number.isFinite(ms)&&ms>0) ||
        !Array.isArray(actor.directions) || actor.directions.length!==16) return false;
    return actor.directions.every(clip => {
      if (!clip || typeof clip.idle!=='string' || !Array.isArray(clip.walk) ||
          clip.walk.length!==4 || !Array.isArray(clip.attack) || clip.attack.length!==actor.attackFrameMs.length) return false;
      const ids=[clip.idle,...clip.walk,...clip.attack];
      return new Set(ids).size===5+actor.attackFrameMs.length && ids.every(frameId => {
        const f=data.frames[frameId];
        return f && f.actor===id && f.bodyHeight>0 && [f.x,f.y,f.w,f.h,f.bodyHeight,f.groundPivot?.x,f.groundPivot?.y].every(Number.isFinite) &&
          f.x>=0 && f.y>=0 && f.w>0 && f.h>0 && f.x+f.w<=data.width && f.y+f.h<=data.height &&
          f.groundPivot.x>=0 && f.groundPivot.x<=f.w && f.groundPivot.y>=0 && f.groundPivot.y<=f.h;
      });
    });
  });
}

/** Authored direction and gait; animation never creates commands, damage or projectiles. */
export class DirectionalAtlas {
  image:HTMLImageElement|null=null;
  data:DirectionalData|null=null;
  async load(url:string):Promise<boolean> {
    try {
      const response=await fetch(url);
      if (!response.ok) return false;
      const data=await response.json() as DirectionalData;
      if (!validDirectionalData(data)) return false;
      const image=new Image();
      image.src=new URL(data.image,new URL(url,document.baseURI)).href;
      await image.decode();
      if (image.naturalWidth!==data.width || image.naturalHeight!==data.height) return false;
      this.image=image; this.data=data; return true;
    } catch {return false;}
  }
  frame(actor:string,facing:number,pose:AnimationPose,reducedMotion=false):string|undefined {
    if (!this.image) return undefined;
    const definition=this.data?.actors[actor];
    if (!definition) return undefined;
    const clip=definition.directions[facingDirection(facing)];
    if (reducedMotion) return clip.idle;
    if (!clip.attack.length && (pose.attackAge<.43 || pose.anticipation>0)) return clip.idle;
    return animationFrame({...definition,walk:clip.walk,attack:clip.attack},pose) ?? clip.idle;
  }
  draw(c:CanvasRenderingContext2D,actor:string,frameId:string,height?:number):boolean {
    const definition=this.data?.actors[actor], frame=this.data?.frames[frameId];
    if (!this.image || !definition || !frame || frame.actor!==actor) return false;
    if (!definition.directions.some(clip=>clip.idle===frameId || clip.walk.includes(frameId) || clip.attack.includes(frameId))) return false;
    const scale=(height??definition.suggestedHeight)/frame.bodyHeight;
    c.drawImage(this.image,frame.x,frame.y,frame.w,frame.h,
      -frame.groundPivot.x*scale,-frame.groundPivot.y*scale,frame.w*scale,frame.h*scale);
    return true;
  }
}
