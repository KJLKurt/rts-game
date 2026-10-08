import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';

const prefix='frontier-command:rts-game:v1:';
function localStore(){const values=new Map<string,string>();return{values,getItem:vi.fn((key:string)=>values.get(key)??null),setItem:vi.fn((key:string,value:string)=>{values.set(key,value);}),removeItem:vi.fn((key:string)=>{values.delete(key);})};}
function mockIDB(){
 const values=new Map<string,unknown>();const close=vi.fn();const transactions:any[]=[];
 const database={createObjectStore:vi.fn(),close,transaction:vi.fn(()=>{
  const tx:any={error:null,oncomplete:null,onerror:null,objectStore:()=>({
   put:(value:unknown,key:string)=>{values.set(key,structuredClone(value));setTimeout(()=>tx.oncomplete?.(),0);},
   get:(key:string)=>{const request:any={result:structuredClone(values.get(key))};queueMicrotask(()=>request.onsuccess?.());return request;},
   delete:(key:string)=>{values.delete(key);setTimeout(()=>tx.oncomplete?.(),0);},
  })};transactions.push(tx);return tx;
 })};
 const indexedDB={open:vi.fn(()=>{const request:any={result:database};queueMicrotask(()=>request.onsuccess?.());return request;})};
 return{values,indexedDB,close,transactions};
}

beforeEach(()=>{vi.resetModules();vi.stubGlobal('matchMedia',()=>({matches:false}));});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});

describe('namespaced offline storage',()=>{
 it('defaults are cloned and malformed JSON is recoverable',async()=>{
  const local=localStore();vi.stubGlobal('localStorage',local);const storage=await import('../src/platform/storage');
  const fallback={nested:[] as string[],volume:.5};const first=storage.readLocal('test',fallback);first.nested.push('changed');expect(fallback.nested).toEqual([]);
  local.values.set(prefix+'test','{bad');expect(storage.readLocal('test',fallback)).toEqual(fallback);
 });
 it('preferences use the game namespace and preserve default fields',async()=>{
  const local=localStore();vi.stubGlobal('localStorage',local);const storage=await import('../src/platform/storage');
  storage.writeLocal('preferences',{music:.2});expect([...local.values.keys()]).toEqual([prefix+'preferences']);
  expect(storage.readLocal('preferences',storage.defaultPreferences)).toMatchObject({music:.2,sfx:.65,showTips:true});
 });
 it('rejects wrong primitive preference/profile types and unknown stored fields',async()=>{
  const local=localStore();vi.stubGlobal('localStorage',local);const storage=await import('../src/platform/storage');
  local.values.set(prefix+'preferences',JSON.stringify({master:'\" oninput=alert(1)',muted:'false',showTips:false,music:.5,unknown:'ignored'}));
  const preferences=storage.readLocal('preferences',storage.defaultPreferences);
  expect(preferences).toMatchObject({master:.85,muted:false,showTips:false,music:.5});expect(preferences).not.toHaveProperty('unknown');
  local.values.set(prefix+'profile',JSON.stringify({games:'<img src=x>',wins:null,unlocked:'all',campaignProgress:{'rise-of-the-frontier':2}}));
  expect(storage.readLocal('profile',storage.defaultProfile)).toMatchObject({games:0,wins:0,unlocked:[],campaignProgress:{'rise-of-the-frontier':2}});
 });
 it('preference reads and writes survive blocked storage',async()=>{
  vi.stubGlobal('localStorage',{getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}});
  const storage=await import('../src/platform/storage');expect(storage.readLocal('preferences',{music:.4})).toEqual({music:.4});expect(()=>storage.writeLocal('preferences',{})).not.toThrow();
 });
 it('saves to IndexedDB and waits for transaction commit before resolving',async()=>{
  const local=localStore(),db=mockIDB();vi.stubGlobal('localStorage',local);vi.stubGlobal('indexedDB',db.indexedDB);
  const storage=await import('../src/platform/storage');const save=storage.saveRecord('battle',{version:1,game:'fixture'});let committed=false;void save.then(()=>{committed=true;});
  await Promise.resolve();await Promise.resolve();expect(committed).toBe(false);await save;expect(committed).toBe(true);
  expect(local.setItem).not.toHaveBeenCalled();expect(db.close).toHaveBeenCalledOnce();
  expect(await storage.loadRecord('battle')).toEqual({version:1,game:'fixture'});
 });
 it('uses namespaced local fallback if IndexedDB is unavailable',async()=>{
  const local=localStore();vi.stubGlobal('localStorage',local);vi.stubGlobal('indexedDB',{open(){throw new Error('unavailable');}});
  const storage=await import('../src/platform/storage');await storage.saveRecord('battle',{version:1,data:'saved'});
  expect(local.values.has(prefix+'battle')).toBe(true);expect(await storage.loadRecord('battle')).toEqual({version:1,data:'saved'});
 });
 it('reports failure when neither persistence backend can save',async()=>{
  vi.stubGlobal('indexedDB',{open(){throw new Error('unavailable');}});vi.stubGlobal('localStorage',{setItem(){throw new Error('QuotaExceeded');}});
  const storage=await import('../src/platform/storage');await expect(storage.saveRecord('battle',{})).rejects.toThrow('QuotaExceeded');
 });
 it('returns null for a malformed fallback save without wiping it',async()=>{
  const local=localStore();local.values.set(prefix+'battle','invalid-json');vi.stubGlobal('localStorage',local);vi.stubGlobal('indexedDB',{open(){throw new Error('unavailable');}});
  const storage=await import('../src/platform/storage');expect(await storage.loadRecord('battle')).toBeNull();expect(local.values.get(prefix+'battle')).toBe('invalid-json');
 });
 it('record deletion is limited to the requested game key',async()=>{
  const local=localStore(),db=mockIDB();local.values.set(prefix+'battle','{}');local.values.set('sibling:save','keep');db.values.set('battle',{});db.values.set('editor-map',{seed:'keep'});
  vi.stubGlobal('localStorage',local);vi.stubGlobal('indexedDB',db.indexedDB);const storage=await import('../src/platform/storage');await storage.removeRecord('battle');
  expect(local.values.get('sibling:save')).toBe('keep');expect(db.values.get('editor-map')).toEqual({seed:'keep'});expect(await storage.loadRecord('battle')).toBeNull();
 });
});

function workerFixture(waiting=true){
 const worker=new EventTarget() as EventTarget&{state:string;postMessage:ReturnType<typeof vi.fn>};worker.state='installed';worker.postMessage=vi.fn();
 const registration=new EventTarget() as EventTarget&{waiting:typeof worker|null;installing:typeof worker|null};registration.waiting=waiting?worker:null;registration.installing=null;
 const serviceWorker=Object.assign(new EventTarget(),{controller:{},register:vi.fn(async()=>registration)});
 const reload=vi.fn();vi.stubGlobal('navigator',{serviceWorker});vi.stubGlobal('location',{reload});vi.stubEnv('DEV',false);vi.stubEnv('BASE_URL','/rts-game/');
 return{worker,registration,serviceWorker,reload};
}
describe('PWA update coordinator with mocked browser events',()=>{
 it('does not register a worker in development',async()=>{
  const fixture=workerFixture();vi.stubEnv('DEV',true);const {setupPWA}=await import('../src/platform/pwa');await setupPWA(vi.fn(),vi.fn());expect(fixture.serviceWorker.register).not.toHaveBeenCalled();
 });
 it('registers only within the repository scope and does not auto-activate a waiting release',async()=>{
  const f=workerFixture(),offer=vi.fn();const {setupPWA}=await import('../src/platform/pwa');await setupPWA(offer,vi.fn());
  expect(f.serviceWorker.register).toHaveBeenCalledWith('/rts-game/sw.js',{scope:'/rts-game/'});expect(offer).toHaveBeenCalledOnce();expect(f.worker.postMessage).not.toHaveBeenCalled();expect(f.reload).not.toHaveBeenCalled();
 });
 it('persists before activation and reloads only after user-approved controllerchange',async()=>{
  const f=workerFixture(),offer=vi.fn();let release!:()=>void;const saved=new Promise<void>(resolve=>{release=resolve;});const beforeUpdate=vi.fn(()=>saved);
  const {setupPWA}=await import('../src/platform/pwa');await setupPWA(offer,beforeUpdate);
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(f.reload).not.toHaveBeenCalled();
  const apply=offer.mock.calls[0][0] as ()=>Promise<void>;const applying=apply();expect(beforeUpdate).toHaveBeenCalledOnce();expect(f.worker.postMessage).not.toHaveBeenCalled();
  release();await applying;expect(f.worker.postMessage).toHaveBeenCalledWith({type:'ACTIVATE_UPDATE'});
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(f.reload).toHaveBeenCalledOnce();
 });
 it('does not activate or reload when the pre-update save rejects',async()=>{
  const f=workerFixture(),offer=vi.fn();const {setupPWA}=await import('../src/platform/pwa');await setupPWA(offer,async()=>{throw new Error('Storage full');});
  await expect(offer.mock.calls[0][0]()).rejects.toThrow('Storage full');expect(f.worker.postMessage).not.toHaveBeenCalled();f.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(f.reload).not.toHaveBeenCalled();
 });
 it('rejects a stale update instead of silently leaving the application locked',async()=>{
  const f=workerFixture(),offer=vi.fn();let release!:()=>void;
  const saved=new Promise<void>(resolve=>{release=resolve;});
  const {setupPWA,UpdateUnavailableError}=await import('../src/platform/pwa');await setupPWA(offer,()=>saved);
  const applying=offer.mock.calls[0][0]();f.registration.waiting=null;release();
  await expect(applying).rejects.toBeInstanceOf(UpdateUnavailableError);
  expect(f.worker.postMessage).not.toHaveBeenCalled();f.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(f.reload).not.toHaveBeenCalled();
 });
 it('does not leave reload armed when activation messaging fails',async()=>{
  const f=workerFixture(),offer=vi.fn();f.worker.postMessage.mockImplementation(()=>{throw new Error('Worker unavailable');});
  const {setupPWA}=await import('../src/platform/pwa');await setupPWA(offer,vi.fn());
  await expect(offer.mock.calls[0][0]()).rejects.toThrow('Worker unavailable');
  f.serviceWorker.dispatchEvent(new Event('controllerchange'));expect(f.reload).not.toHaveBeenCalled();
 });
 it('offers an installed update discovered during play',async()=>{
  const f=workerFixture(false),offer=vi.fn();const {setupPWA}=await import('../src/platform/pwa');await setupPWA(offer,vi.fn());expect(offer).not.toHaveBeenCalled();
  f.registration.installing=f.worker;f.serviceWorker.controller={};f.registration.dispatchEvent(new Event('updatefound'));
  f.registration.waiting=f.worker;f.worker.dispatchEvent(new Event('statechange'));expect(offer).toHaveBeenCalledOnce();expect(f.reload).not.toHaveBeenCalled();
 });
 it('registration failure leaves the application usable',async()=>{
  const f=workerFixture();f.serviceWorker.register.mockRejectedValue(new Error('unavailable'));vi.spyOn(console,'warn').mockImplementation(()=>{});
  const {setupPWA}=await import('../src/platform/pwa');await expect(setupPWA(vi.fn(),vi.fn())).resolves.toBeUndefined();
 });
});

describe('generated worker contract in an isolated build fixture',()=>{
 function generatedWorker(){
  const directory=mkdtempSync(join(tmpdir(),'frontier-sw-'));mkdirSync(join(directory,'dist/assets'),{recursive:true});
  writeFileSync(join(directory,'dist/index.html'),'<html>frontier</html>');writeFileSync(join(directory,'dist/assets/app.js'),'console.log("frontier")');writeFileSync(join(directory,'dist/assets/app.js.map'),'{}');
  try{const result=spawnSync(process.execPath,[resolve('scripts/build-sw.mjs')],{cwd:directory,encoding:'utf8'});expect(result.status,result.stderr).toBe(0);return readFileSync(join(directory,'dist/sw.js'),'utf8');}finally{rmSync(directory,{recursive:true,force:true});}
 }
 function runWorker(){
  const handlers:Record<string,(event:any)=>void>={};const cache={addAll:vi.fn(async()=>{}),match:vi.fn(async()=>undefined)};
  const caches={open:vi.fn(async()=>cache),keys:vi.fn(async()=>['sibling-pwa-v1','frontier-command-rts-game-old']),delete:vi.fn(async()=>true)};
  const self={location:{origin:'https://example.test'},addEventListener:(name:string,callback:(event:any)=>void)=>{handlers[name]=callback;},skipWaiting:vi.fn(),clients:{claim:vi.fn(async()=>{})}};
  runInNewContext(generatedWorker(),{self,caches,URL,fetch:vi.fn(async()=>({ok:true}))});return{handlers,cache,caches,self};
 }
 it('precaches production assets but excludes source maps',async()=>{
  const f=runWorker();let done!:Promise<unknown>;f.handlers.install({waitUntil:(p:Promise<unknown>)=>{done=p;}});await done;
  expect(f.cache.addAll).toHaveBeenCalledWith(['/rts-game/assets/app.js','/rts-game/index.html']);expect(f.self.skipWaiting).not.toHaveBeenCalled();
 });
 it('activates only on explicit message and deletes only its own superseded caches',async()=>{
  const f=runWorker();f.handlers.message({data:{type:'OTHER'}});expect(f.self.skipWaiting).not.toHaveBeenCalled();f.handlers.message({data:{type:'ACTIVATE_UPDATE'}});expect(f.self.skipWaiting).toHaveBeenCalledOnce();
  let done!:Promise<unknown>;f.handlers.activate({waitUntil:(p:Promise<unknown>)=>{done=p;}});await done;expect(f.caches.delete).toHaveBeenCalledWith('frontier-command-rts-game-old');expect(f.caches.delete).not.toHaveBeenCalledWith('sibling-pwa-v1');
 });
 it('does not intercept sibling applications, external resources or POST requests',()=>{
  const f=runWorker();for(const request of [{method:'GET',url:'https://example.test/sibling/app.js'},{method:'GET',url:'https://external.test/rts-game/app.js'},{method:'POST',url:'https://example.test/rts-game/save'}]){const respondWith=vi.fn();f.handlers.fetch({request,respondWith});expect(respondWith).not.toHaveBeenCalled();}
 });
});

describe('damaged saves cannot escape validation into gameplay',()=>{
 it.each(['fog','commander','abilityCooldowns'] as const)('rejects or safely repairs damaged %s data',async(field)=>{
  const {createGame,restoreGame,stepGame,COMMANDERS}=await import('../src/sim');
  const data:any=createGame({seed:'QA-DAMAGED-SAVE'});
  if(field==='fog')delete data.fog;
  if(field==='commander')data.settings.commander='not-a-commander';
  if(field==='abilityCooldowns')delete data.entities.find((e:any)=>e.kind==='commander').abilityCooldowns;
  let restored:ReturnType<typeof restoreGame>;
  try{restored=restoreGame(data);}catch(error){expect((error as Error).message).toMatch(/save|saved/i);return;}
  // A supported migration may repair optional data instead of rejecting it.
  expect(restored.fog?.visible[0]).toHaveLength(restored.map.width*restored.map.height);
  expect(COMMANDERS[restored.settings.commander]).toBeDefined();
  expect(()=>stepGame(restored,.1)).not.toThrow();
 });
});
