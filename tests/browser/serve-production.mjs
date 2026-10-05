/** Test-only static host with a controlled new SW release. Never included in dist. */
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const current=resolve('dist');
const previous=process.env.FRONTIER_PREVIOUS_DIST ? resolve(process.env.FRONTIER_PREVIOUS_DIST) : null;
let root=current;
const base='/rts-game/';
let release=0;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__qa/previous'&&req.method==='POST'&&previous){
   root=previous;release=0;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({previous:true}));return;
  }
  if(url.pathname==='/__qa/release'&&req.method==='POST'){
   root=current;
   release++;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({release}));return;
  }
  if(!url.pathname.startsWith(base)){res.writeHead(404);res.end('Outside game scope');return;}
  const relative=decodeURIComponent(url.pathname.slice(base.length))||'index.html';
  const path=resolve(root,relative);
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  if(!(await stat(path)).isFile()){res.writeHead(404);res.end();return;}
  let body=await readFile(path);
  if(relative==='sw.js'&&release)body=Buffer.from(body.toString().replace(/(const CACHE=['"])([^'"]+)/,`$1$2-qa-${release}`));
  res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4181,'127.0.0.1',()=>console.log('Production test host: http://127.0.0.1:4181/rts-game/'));
