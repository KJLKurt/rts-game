import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [root,manifestPath,output]=process.argv.slice(2);
if(!root||!manifestPath||!output)throw new Error('Expected directory, manifest, proof path.');
const expected=JSON.parse(await readFile(manifestPath,'utf8')),files=[];
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const p=prefix+e.name;if(e.isDirectory())await walk(dir+'/'+e.name,p+'/');else files.push(p);}}
await walk(root);files.sort();
const missing=Object.keys(expected).filter(p=>!files.includes(p)),extra=files.filter(p=>!(p in expected)),mismatches=[];
for(const p of files)if(p in expected){const actual=createHash('sha256').update(await readFile(root+'/'+p)).digest('hex');if(actual!==expected[p])mismatches.push({path:p,expected:expected[p],actual});}
const proof={directory:root,manifest:manifestPath,expectedCount:Object.keys(expected).length,actualCount:files.length,missing,extra,mismatches,includesSourceMap:true};
await writeFile(output,JSON.stringify(proof,null,2)+'\n');
if(missing.length||extra.length||mismatches.length)throw new Error(JSON.stringify(proof));
console.log(`Verified all ${files.length} exact distribution files in ${root}.`);
