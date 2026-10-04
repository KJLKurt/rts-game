const PREFIX = 'frontier-command:rts-game:v1:';
const DB = 'frontier-command-rts-game';
export interface Preferences {music:number;sfx:number;reducedMotion:boolean;showTips:boolean;uiScale:number;}
export interface Profile {version:1;games:number;wins:number;seconds:number;kills:number;bestStreak:number;streak:number;unlocked:string[];campaign:number;expedition:number;}
export const defaultPreferences:Preferences={music:0.32,sfx:0.65,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,showTips:true,uiScale:1};
export const defaultProfile:Profile={version:1,games:0,wins:0,seconds:0,kills:0,bestStreak:0,streak:0,unlocked:[],campaign:0,expedition:0};
export function readLocal<T>(key:string, fallback:T):T {try {const v=localStorage.getItem(PREFIX+key);return v?{...fallback,...JSON.parse(v)}:structuredClone(fallback);}catch{return structuredClone(fallback);}}
export function writeLocal(key:string,value:unknown){try{localStorage.setItem(PREFIX+key,JSON.stringify(value));}catch{}}
async function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveRecord(key:string,value:unknown){let db:IDBDatabase|undefined;try{db=await database();await new Promise<void>((resolve,reject)=>{const tx=db!.transaction('records','readwrite');tx.objectStore('records').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}catch{localStorage.setItem(PREFIX+key,JSON.stringify(value));}finally{db?.close();}}
export async function loadRecord<T>(key:string):Promise<T|null>{let db:IDBDatabase|undefined;try{db=await database();const data=await new Promise<T|undefined>((resolve,reject)=>{const r=db!.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});if(data!==undefined)return data;}catch{}finally{db?.close();}try{return JSON.parse(localStorage.getItem(PREFIX+key)||'null');}catch{return null;}}
export async function removeRecord(key:string){localStorage.removeItem(PREFIX+key);try{const db=await database();const tx=db.transaction('records','readwrite');tx.objectStore('records').delete(key);tx.oncomplete=()=>db.close();}catch{}}
