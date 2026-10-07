import type {AtlasFrame,SpriteBounds} from './SpriteAtlas';

interface Mask {data:Uint8Array;width:number;height:number;scaleX:number;scaleY:number}
const masks=new WeakMap<HTMLImageElement,Mask|null>();
/** One small CPU alpha mask per loaded image. Input never reads the live GPU canvas. */
export function spriteAlphaHit(image:HTMLImageElement,frame:AtlasFrame,bounds:SpriteBounds,x:number,y:number,padding=0):boolean {
 if(x<bounds.x-padding||y<bounds.y-padding||x>bounds.x+bounds.width+padding||y>bounds.y+bounds.height+padding)return false;
 let mask=masks.get(image);
 if(mask===undefined){
  mask=null;
  try{
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(image.naturalWidth/4);canvas.height=Math.ceil(image.naturalHeight/4);
   const c=canvas.getContext('2d',{willReadFrequently:true});
   if(c){c.imageSmoothingEnabled=false;c.drawImage(image,0,0,canvas.width,canvas.height);const rgba=c.getImageData(0,0,canvas.width,canvas.height).data,data=new Uint8Array(canvas.width*canvas.height);for(let i=0;i<data.length;i++)data[i]=rgba[i*4+3];mask={data,width:canvas.width,height:canvas.height,scaleX:canvas.width/image.naturalWidth,scaleY:canvas.height/image.naturalHeight};}
  }catch{/* Registered sprite bounds remain usable when image readback is unavailable. */}
  masks.set(image,mask);
 }
 if(!mask)return true;
 const sx=(frame.x+(x-bounds.x)/bounds.width*frame.w)*mask.scaleX,sy=(frame.y+(y-bounds.y)/bounds.height*frame.h)*mask.scaleY;
 const left=Math.floor(frame.x*mask.scaleX),right=Math.ceil((frame.x+frame.w)*mask.scaleX)-1,top=Math.floor(frame.y*mask.scaleY),bottom=Math.ceil((frame.y+frame.h)*mask.scaleY)-1;
 if(!padding){const px=Math.floor(sx),py=Math.floor(sy);return px>=left&&px<=right&&py>=top&&py<=bottom&&mask.data[py*mask.width+px]>24;}
 const rx=Math.max(1,padding*frame.w/bounds.width*mask.scaleX),ry=Math.max(1,padding*frame.h/bounds.height*mask.scaleY);
 for(let py=Math.max(top,Math.floor(sy-ry));py<=Math.min(bottom,Math.ceil(sy+ry));py++)for(let px=Math.max(left,Math.floor(sx-rx));px<=Math.min(right,Math.ceil(sx+rx));px++)if(((px-sx)/rx)**2+((py-sy)/ry)**2<=1&&mask.data[py*mask.width+px]>24)return true;
 return false;
}
