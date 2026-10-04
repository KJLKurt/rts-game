export interface AtlasFrame { x:number;y:number;w:number;h:number;anchorX?:number;anchorY?:number; }
export interface AtlasData { image:string;frames:Record<string,AtlasFrame>; }
/** Optional supplied artwork. Procedural originals remain available while loading and offline. */
export class SpriteAtlas {
 image: HTMLImageElement|null = null;
 frames: Record<string,AtlasFrame> = {};
 ready = false;
 async load(url:string):Promise<boolean>{
  try {
   const response=await fetch(url);if(!response.ok)return false;const data=await response.json() as AtlasData;
   const image=new Image();image.src=new URL(data.image,new URL(url,document.baseURI)).href;await image.decode();
   this.image=image;this.frames=data.frames;this.ready=true;return true;
  }catch{return false;}
 }
 draw(c:CanvasRenderingContext2D,name:string,width:number,height?:number):boolean{
  const f=this.frames[name];if(!this.ready||!this.image||!f)return false;
  const h=height??width*f.h/f.w;const w=height===undefined?width:h*f.w/f.h;const ax=f.anchorX??.5,ay=f.anchorY??.92;
  c.drawImage(this.image,f.x,f.y,f.w,f.h,-w*(ax>1?ax/f.w:ax),-h*(ay>1?ay/f.h:ay),w,h);return true;
 }
}
