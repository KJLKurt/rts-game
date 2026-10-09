/** Require both intended source failures, never reinterpret driver or setup errors as red proof. */
import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('rally-workshop-red-ledger.json','utf8'));
const cases=[];function walk(s){for(const spec of s.specs??[])for(const test of spec.tests)cases.push({title:spec.title,project:test.projectName,status:test.status,results:test.results});for(const child of s.suites??[])walk(child);}walk(data);
const checks={nonzeroTestExit:Number(process.argv[2])===1,exactTwoCases:cases.length===2,noGlobalErrors:data.errors.length===0,exactTwoUnexpected:data.stats.unexpected===2&&data.stats.expected===0&&data.stats.skipped===0&&data.stats.flaky===0,oneAttemptEach:cases.every(c=>c.project==='desktop'&&c.results.length===1&&c.results[0].retry===0&&c.results[0].status==='failed')};
const rally=cases.find(c=>c.title.includes('C3 native mass rally 60 pending'));
const workshop=cases.find(c=>c.title.includes('C5 native workshop 91 minutes:'));
const errors=c=>(c?.results.flatMap(r=>r.errors).map(e=>e.message).join('\n')??'');
checks.rallyIntendedFailure=errors(rally).includes('Full tactical queue must report rejection')&&errors(rally).includes('Current buildings now send recruits');
checks.workshopIntendedFailure=errors(workshop).includes('Targets longer than 90 minutes require generator v5.');
checks.noTimeoutFailure=cases.every(c=>!/(?:Test timeout|Timeout \d+ms exceeded)/.test(errors(c)));
await writeFile('rally-workshop-red-proof.json',JSON.stringify({checks,cases:cases.map(c=>({title:c.title,project:c.project,status:c.status,errors:errors(c)})),stats:data.stats},null,2));
console.log(JSON.stringify(checks,null,2));
if(Object.values(checks).some(value=>!value))throw new Error('Baseline native evidence did not reach both intended product failures; stop for diagnosis.');
