/** Original, cached Canvas2D art. The simulation never depends on these drawings. */
export type Ctx = CanvasRenderingContext2D;
export const TILE_W = 72;
export const TILE_H = 36;
export const TEAM = [
  { main: '#67d6ff', dark: '#17647e', light: '#d7f9ff', banner: '#187d9e' },
  { main: '#ff8e70', dark: '#8b3836', light: '#ffe2ba', banner: '#b44d3d' },
  { main: '#d8afff', dark: '#704686', light: '#f3e3ff', banner: '#7e50ac' },
  { main: '#f5d96c', dark: '#927126', light: '#fff6c9', banner: '#ad8730' },
];
export function palette(team: number) { return team < 0 ? {main:'#d8b874',dark:'#76634b',light:'#fff1c9',banner:'#837152'} : TEAM[team % TEAM.length]; }
export function hash(x: number, y = 0, salt = 0): number { let h = Math.imul(x + salt * 91 + 173, 374761393) + Math.imul(y + 71, 668265263); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295; }
export function poly(c: Ctx, points: number[], color: string, stroke?: string, line = 1) {
  c.beginPath(); c.moveTo(points[0], points[1]); for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]); c.closePath(); c.fillStyle=color; c.fill(); if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
}
export function ellipse(c: Ctx,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string,line=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
export function line(c:Ctx,points:number[],color:string,width=1){c.beginPath();c.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke();}
export function diamond(c:Ctx,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string,width=1){poly(c,[x,y-ry,x+rx,y,x,y+ry,x-rx,y],fill,stroke,width);}
export function shadow(c:Ctx,rx:number,ry:number,alpha=.22){ellipse(c,3,3,rx,ry,`rgba(4,18,23,${alpha})`);}
/** World-facing masonry block, origin at the bottom centre. */
export function block(c:Ctx,x:number,y:number,w:number,d:number,h:number,top:string,left:string,right:string){
 poly(c,[x-w,y-d-h,x,y-d*2-h,x+w,y-d-h,x,y-h],top);
 poly(c,[x-w,y-d-h,x,y-h,x,y,x-w,y-d],left);
 poly(c,[x,y-h,x+w,y-d-h,x+w,y-d,x,y],right);
 line(c,[x-w,y-d-h,x,y-h,x+w,y-d-h],'#e9e4bc40',.8);
}
export function tree(c:Ctx,variant:number,biome:string='grasslands',size=1){
 c.save();c.scale(size,size);shadow(c,19,8,.23);
 c.fillStyle='#5c4940';c.fillRect(-3,-24,6,24);line(c,[1,-20,1,-1],'#907059',1.3);
 const snowy=biome==='snow';const autumn=biome==='desert';const colors=snowy?['#547872','#d9e6dc','#b6d4c8']:autumn?['#797946','#b8a75e','#d2b976']:['#245845','#367b55','#58a065'];
 if(variant%3===0 || snowy){
  for(let i=0;i<3;i++){const y=-15-i*13,w=22-i*4;poly(c,[-w,y,0,y-30,w,y,0,y+6],colors[i%3]);poly(c,[-w,y,0,y-30,0,y+6],i===0?'#204e43':colors[Math.max(0,i-1)]);line(c,[-w+5,y,0,y+4,w-4,y],snowy?'#edf4e650':'#97b78540',1);}
 } else {
  ellipse(c,-10,-28,15,15,colors[0]);ellipse(c,10,-33,16,17,colors[0]);ellipse(c,-7,-41,16,17,colors[1]);ellipse(c,10,-42,15,17,colors[1]);ellipse(c,1,-51,15,15,colors[2]);ellipse(c,-4,-53,8,5,'#a4c97830');
 }
 c.restore();
}
export function rock(c:Ctx,seed:number,scale=1,gold=false){
 c.save();c.scale(scale,scale);shadow(c,15,6,.16);
 poly(c,[-17,-3,-15,-14,-6,-23,8,-21,18,-9,13,0,-3,4],gold?'#837249':'#657c76');
 poly(c,[-15,-14,-6,-23,8,-21,3,-11,-5,-7],gold?'#bca579':'#a6b8a6');
 poly(c,[-5,-7,3,-11,8,-21,18,-9,13,0],gold?'#ad8c44':'#7b948a');
 if(gold){poly(c,[-11,-9,-5,-18,0,-10,-4,-4],'#e8bd56');poly(c,[1,-12,5,-18,12,-12,7,-5],'#ffe6a0');line(c,[-10,-8,-6,-16],'#fff5c9',1.2);}
 else if(seed>.5)line(c,[-11,-8,-4,-12,0,-6,8,-5],'#435b56',1);
 c.restore();
}
export function flag(c:Ctx,x:number,y:number,team:number,time=0,small=false){const p=palette(team);const s=small?.65:1;
 c.save();c.translate(x,y);c.scale(s,s);line(c,[0,0,0,-31],'#514a38',2);line(c,[1,-29,1,-1],'#d7c6a0',.75);const flutter=Math.sin(time*4+x)*1.8;
 poly(c,[1,-30,18,-27+flutter,15,-18+flutter,1,-21],p.banner,p.main,.6);
 if(team===1)poly(c,[7,-26,11,-23+flutter/2,7,-21+flutter/2,4,-24],p.light);else {line(c,[7,-27,7,-22],p.light,1.7);line(c,[5,-25,10,-25],p.light,1.7);}
 ellipse(c,0,-32,2,2,'#e9ce80');c.restore();
}
export function building(c:Ctx,type:string,team:number,time=0){
 const p=palette(team);const large=['keep','townhall','commandKeep','arcane'].includes(type),r=large?49:34;shadow(c,r+6,(r+6)/2,.26);
 diamond(c,0,2,r+6,(r+6)/2,'#9b9b78','#61776a',1);
 for(let i=-2;i<3;i++)line(c,[-r+i*7,-i*3,r+i*5,8-i*4],'#3d594d30',.7);
 const roof=team===1?'#9c5245':team===2?'#796395':'#456f7d';const roofLight=team===1?'#bf6a54':team===2?'#a17bba':'#638f96';
 const stone='#b7b89b',side='#788d82',wall='#d0ccac';
 if(type==='tower'){
  block(c,0,0,18,9,52,stone,side,wall);block(c,0,-47,24,12,9,'#d7d3ad','#8d9c89','#b9baa0');
  for(let i=0;i<4;i++){const x=-19+i*12;block(c,x,-53+Math.abs(x)*.35,4,2,6,'#e1ddbc','#9fa98f','#c4c6a4');}
  c.fillStyle='#344d4d';c.fillRect(7,-34,5,14);line(c,[8,-33,8,-22],'#182b35',1);flag(c,-7,-57,team,time);return;
 }
 if(type==='wall'){block(c,0,0,37,10,24,stone,side,wall);for(let i=0;i<5;i++)block(c,-28+i*14,-19+Math.abs(i-2)*3,5,3,7,stone,side,wall);return;}
 if(type==='arcane'){
  block(c,0,0,34,17,15,'#c0c4b1','#708982','#9ca99c');
  ellipse(c,0,-20,22,12,'#445b70','#c2cba7',3);poly(c,[-20,-22,0,-64,20,-22,0,-13],roof);poly(c,[0,-64,20,-22,0,-13],roofLight);ellipse(c,0,-66,6,6,'#b8eeff');
  for(let i=0;i<4;i++)block(c,-30+i*20,-5+Math.abs(i-1.5)*-6,4,2,17,stone,side,wall);flag(c,-25,-25,team,time);return;
 }
 const h=large?39:26,w=large?36:27,d=large?19:15;
 block(c,0,0,w,d,h,'#a79f7f',side,wall);
 poly(c,[-w-7,-d-h,0,-d*2-h-24,w+7,-d-h,0,-h+7],roofLight,'#263f46',1);
 poly(c,[0,-d*2-h-24,w+7,-d-h,0,-h+7],roof);
 line(c,[-w-7,-d-h,0,-h+7,w+7,-d-h],'#d0b28a',2);
 for(let i=1;i<4;i++){const t=i/4;line(c,[-(w+7)*(1-t),-d-h-(d+24)*t,(w+7)*t,-h+7-(d+7)*t],'#263f4530',.8);}
 poly(c,[9,-4,9,-22,17,-26,23,-22,23,-11],'#3b5553','#758678',1);line(c,[16,-23,16,-8],'#b39866',1);ellipse(c,20,-14,1,1,'#e7c574');
 for(let i=0;i<2;i++){const x=-22+i*12;poly(c,[x,-21,x+6,-18,x+6,-11,x,-14],'#f1cb74','#67715a',1);}
 if(type==='keep' || type==='townhall' || type==='commandKeep'){
  for(const sx of [-1,1]){const x=sx*33,y=-13;block(c,x,y,13,7,45,'#ced0b3','#8e9c8c','#bbbca2');poly(c,[x-17,y-48,x,y-74,x+17,y-48,x,y-40],roofLight,'#2d4c52',1);poly(c,[x,y-74,x+17,y-48,x,y-40],roof);}
  flag(c,0,-76,team,time);line(c,[-5,-38,-5,-24],p.main,5);
 }else if(type==='house'){c.fillStyle='#77877b';c.fillRect(12,-62,7,16);poly(c,[11,-62,16,-65,21,-62,16,-59],'#b7b89b');}
 else if(type==='barracks'){flag(c,-23,-43,team,time);line(c,[-13,-3,-4,-32],'#d4dce0',2.5);line(c,[-20,-11,3,-19],'#d4dce0',2.5);ellipse(c,-11,-15,6,8,p.banner,'#d7c590',1.8);}
 else if(type==='range' || type==='archery'){ellipse(c,-27,-13,10,13,'#ddc792','#725749',1);ellipse(c,-27,-13,7,9,'#a75345');ellipse(c,-27,-13,4,5,'#e6d9a3');line(c,[-35,2,-31,-5],'#5d4c39',2);flag(c,19,-42,team,time);}
 else if(type==='stable'){poly(c,[-35,-13,-16,-4,-16,-24,-35,-33],'#6c6250');for(let i=0;i<3;i++)line(c,[-34+i*6,-27,-34+i*6,-12+i*2],'#bf9a65',2);ellipse(c,30,-3,10,4,'#c5a365');}
 else if(type==='workshop' || type==='siegeworkshop'){ellipse(c,-27,-8,12,12,'#715d41','#c8ab6d',3);for(let i=0;i<6;i++){let a=i*Math.PI/3;line(c,[-27,-8,-27+Math.cos(a)*10,-8+Math.sin(a)*10],'#cbb782',2);}c.fillStyle='#62756b';c.fillRect(13,-61,8,23);}
 else if(type==='blacksmith'){block(c,-27,0,12,7,11,'#777c72','#405553','#61736d');poly(c,[-39,-12,-18,-12,-20,-7,-33,-6],'#d0d2bd');ellipse(c,12,-17,5,7,'#ffc665');c.fillStyle='#62756b';c.fillRect(14,-65,9,27);}
 else if(type==='depot'){for(let i=0;i<3;i++){block(c,-24+i*12,8+i%2*4,7,4,9,'#b99e66','#715d3f','#a08350');line(c,[-27+i*12,-1+i%2*4,-27+i*12,7+i%2*4],'#d0b47b',1);}}
 if(!['house','keep','townhall','commandKeep'].includes(type))flag(c,17,-47,team,time,true);
}
export function unit(c:Ctx,type:string,team:number,time:number,moving:boolean,attacking:boolean,facing=1,attackProgress=0){
 const p=palette(team),commander=['warlord','ranger','engineer','commander'].includes(type);const scale=commander?1.27:1;
 c.save();c.scale(scale,scale);const stride=moving?Math.sin(time*10)*3:0;const swing=attacking?Math.sin(Math.max(0,Math.min(1,attackProgress))*Math.PI)*12:0;shadow(c,type==='cavalry'?15:10,4.8,.28);
 if(type==='siege'){
  for(const sx of [-1,1])ellipse(c,sx*12,0,6,8,'#524d3d','#ccb579',2);poly(c,[-15,-7,7,-17,19,-10,-3,1],'#7d6744','#c4a870',1);line(c,[-9,-9,8,-31],'#b0955b',5);poly(c,[5,-34,15,-31,14,-24,4,-27],'#54666b','#a9bdba',1);poly(c,[-4,-19,9,-23,13,-16,0,-12],p.banner);c.restore();return;
 }
 if(type==='cavalry'){
  ellipse(c,0,-12,17,9,'#8d7660');poly(c,[7,-13,9,-29,17,-30,19,-20,12,-10],'#a58a6a');line(c,[13,-29,13,-33,17,-30],'#52483f',2);line(c,[-10,-10,-12-stride,0, -9-stride,1],'#403f36',3);line(c,[8,-9,8+stride,1,12+stride,1],'#403f36',3);poly(c,[-7,-19,5,-19,9,-10,-6,-9],p.banner);c.translate(-3,-13);
 }
 line(c,[-4,-11,-5-stride,-2,-8-stride,-1],'#34444d',3.5);line(c,[4,-11,4+stride,-2,7+stride,-1],'#34444d',3.5);
 if(commander || type==='support'){poly(c,[-7,-27,7,-27,10+stride*.3,-5,-10+stride*.3,-7],p.dark);poly(c,[-7,-27,-2,-26,-5,-6,-10+stride*.3,-7],p.main);}
 poly(c,[-7,-26,5,-26,8,-12,-5,-9,-9,-15],p.banner,'#223c49',1);poly(c,[-7,-26,0,-28,5,-26,4,-17,-5,-15],'#d3d4bd');line(c,[-5,-12,5,-14],'#c9a064',2);
 ellipse(c,0,-32,5.5,6,'#dab992','#2b3e49',.8);poly(c,[-6,-33,-5,-39,2,-41,7,-36,6,-32],'#b8cbd0','#3e5661',1);line(c,[-4,-38,1,-39,5,-36],'#e4ebe0',1);line(c,[1,-32,4,-32],'#4c4a44',.9);
 if(commander){poly(c,[-3,-40,-3,-47,1,-45,6,-42,4,-38],p.main);ellipse(c,0,-22,2,2,'#f4da8b');}
 if(type==='archer'||type==='ranger'){
  c.save();c.translate(10,-23);c.rotate(swing*.025);c.beginPath();c.arc(0,0,12,-1.3,1.3);c.strokeStyle='#d2af72';c.lineWidth=2;c.stroke();line(c,[3,-11,3,11],'#efe1b4',.7);line(c,[-2,1,15,-3],'#e2d2a3',1.1);c.restore();line(c,[4,-24,10,-22],'#d6b790',3);
 }else if(type==='spearman'){line(c,[10,-3,11+swing*.2,-48],'#c5a46b',2);poly(c,[8+swing*.2,-46,11+swing*.2,-56,14+swing*.2,-46],'#dbe4d5','#536e78',.7);line(c,[5,-24,10,-21],'#cfb492',3);}
 else if(type==='support'){line(c,[11,-3,11,-43],'#bb9e69',2);ellipse(c,11,-46,4,5,'#9ee5e8','#e6cf8b',1.5);poly(c,[-7,-36,0,-47,8,-34],'#769a99','#bed8c3',.8);}
 else if(type==='engineer'){line(c,[9,-17,13+swing,-31],'#b8a57b',3);poly(c,[8+swing,-34,19+swing,-32,19+swing,-27,8+swing,-29],'#d0d7cf','#475e64',1);ellipse(c,0,-34,6,3,'#bfa77a');ellipse(c,3,-34,2,2,'#a8e5e6');}
 else {c.save();c.translate(8,-22);c.rotate(swing*.035);line(c,[0,4,3,-17],'#d8e5de',2.7);poly(c,[1,-17,4,-23,5,-17],'#f1f5df');line(c,[-2,-1,5,0],'#d9b272',2);c.restore();ellipse(c,-8,-20,5,8,p.banner,'#d8c78a',1.8);line(c,[-8,-23,-8,-17],p.light,1.5);}
 if(facing<0){/* Silhouette remains screen-readable; directional movement is shown by cadence. */}
 c.restore();
}
