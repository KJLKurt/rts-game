import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const expected=JSON.parse(await readFile('.qa-current-dist.json','utf8'));
const files=[];
async function walk(dir='dist',prefix='') {for(const e of await readdir(dir,{withFileTypes:true})){const p=prefix+e.name;if(e.isDirectory())await walk(dir+'/'+e.name,p+'/');else files.push(p);}}
await walk();files.sort();
const missing=Object.keys(expected).filter(p=>!files.includes(p));
const extra=files.filter(p=>!(p in expected));
const mismatches=[];
for(const p of files){if(p in expected){const actual=createHash('sha256').update(await readFile('dist/'+p)).digest('hex');if(actual!==expected[p])mismatches.push({path:p,expected:expected[p],actual});}}
const proof={expectedCount:Object.keys(expected).length,actualCount:files.length,missing,extra,mismatches,baseline:'5c16fba12c4cfc97e026f1ddbf073e637daf2fc2',runtime:'fc-088b668ca425',note:'All production files including source map, checked before and after red reproductions.'};
await writeFile('current-live-dist-proof.json',JSON.stringify(proof,null,2)+'\n');
if(missing.length||extra.length||mismatches.length)throw new Error(JSON.stringify(proof));
console.log(`Exact current production verified: ${files.length} files.`);
