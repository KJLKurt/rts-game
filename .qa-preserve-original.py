"""Preserve every downloaded first-gate file in bounded, verified content-addressed parts."""
from pathlib import Path
import hashlib,json,zipfile,shutil
root=Path('.qa-original'); out=Path('original-evidence-parts'); out.mkdir(exist_ok=True)
files=sorted(p for p in root.rglob('*') if p.is_file())
assert len(files)==344, f'Expected all 344 original artifact files, got {len(files)}'
entries=[]; unique={}; chunkroot=Path('.qa-original-chunks');chunkroot.mkdir(exist_ok=True)
for p in files:
 chunks=[];whole=hashlib.sha256();size=0
 with p.open('rb') as stream:
  while b:=stream.read(32*1024*1024):
   whole.update(b);size+=len(b);h=hashlib.sha256(b).hexdigest();chunks.append(h)
   if h not in unique:
    target=chunkroot/h;target.write_bytes(b);unique[h]=target
 entries.append({'path':p.relative_to(root).as_posix(),'bytes':size,'sha256':whole.hexdigest(),'chunks':chunks})
bins=[[] for _ in range(4)];sizes=[0]*4
for h,p in sorted(unique.items(),key=lambda x:(-x[1].stat().st_size,x[0])):
 i=min(range(4),key=lambda n:sizes[n]);bins[i].append((h,p));sizes[i]+=p.stat().st_size
assert max(sizes)<300*1024*1024, f'Part exceeds bounded size: {sizes}'
manifest={'sourceRun':37996727418,'sourceCommit':'64431ef36b28a05b7a6743b5b8447430929318ec','sourceArtifact':11648220748,'sourceArtifactZipSha256':'9756fe2afbdbfd9be516cc115474dd14cfaa4de84726f0752d392f3cb5681199','fileCount':len(entries),'uniqueContents':len(unique),'files':entries,'parts':[[h for h,p in part] for part in bins]}
manifest_bytes=(json.dumps(manifest,indent=2)+'\n').encode()
restore='''from pathlib import Path
import json,zipfile,hashlib,sys
here=Path(__file__).resolve().parent; dest=Path(sys.argv[1] if len(sys.argv)>1 else 'restored-original').resolve()
m=json.loads((here/'original-content-manifest.json').read_text()); blobs={}; archives=[]
for p in sorted(here.glob('original-part-*.zip')):
 z=zipfile.ZipFile(p);archives.append(z)
 for name in z.namelist():
  if name.startswith('blobs/'):blobs[name.split('/')[-1]]=(z,name)
for entry in m['files']:
 p=(dest/entry['path']).resolve(); assert p.is_relative_to(dest);p.parent.mkdir(parents=True,exist_ok=True);whole=hashlib.sha256();size=0
 with p.open('wb') as stream:
  for h in entry['chunks']:
   z,name=blobs[h];b=z.read(name);assert hashlib.sha256(b).hexdigest()==h;stream.write(b);whole.update(b);size+=len(b)
 assert size==entry['bytes'] and whole.hexdigest()==entry['sha256'],entry['path']
for z in archives:z.close()
print('Restored and SHA-256 verified',len(m['files']),'files to',dest)
'''
(out/'original-content-manifest.json').write_bytes(manifest_bytes);(out/'restore-original.py').write_text(restore)
for i,part in enumerate(bins):
 with zipfile.ZipFile(out/f'original-part-{i}.zip','w',compression=zipfile.ZIP_STORED) as z:
  z.writestr('original-content-manifest.json',manifest_bytes);z.writestr('restore-original.py',restore)
  for h,p in part:z.write(p,'blobs/'+h)
 with zipfile.ZipFile(out/f'original-part-{i}.zip') as z:assert z.testzip() is None
review=Path('original-review');review.mkdir(exist_ok=True)
for e in entries:
 n=e['path'];p=root/n
 if n.endswith('.json') or (n.startswith('test-results-') and (n.endswith('.png') or n.endswith('.md'))) or ('test-results-rally-workshop-upgrade/' in n and n.endswith('trace.zip')):
  target=review/n;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
shutil.copyfile(out/'original-content-manifest.json',review/'original-content-manifest.json')
def walk(suites):
 for s in suites:
  for spec in s.get('specs',[]):
   for test in spec.get('tests',[]):yield spec,test
  yield from walk(s.get('suites',[]))
summary={}
for f in ['rally-workshop-red-ledger.json','rally-workshop-identity-ledger.json','rally-workshop-upgrade-ledger.json']:
 data=json.loads((root/f).read_text()); cases=list(walk(data['suites']));summary[f]={'stats':data['stats'],'errors':data.get('errors',[]),'cases':[{'title':s['title'],'project':t['projectName'],'status':t['status'],'attempts':len(t['results']),'results':[{'status':r['status'],'retry':r.get('retry'), 'errors':r.get('errors',[])} for r in t['results']]} for s,t in cases]}
(review/'original-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for f,d in summary.items():print(f, json.dumps(d['stats']), 'globalErrors',len(d['errors']))
assert summary['rally-workshop-identity-ledger.json']['stats']['expected']==33
assert summary['rally-workshop-identity-ledger.json']['stats']['unexpected']==0
assert all(c['attempts']==1 and c['results'][0]['retry']==0 for d in summary.values() for c in d['cases'])
assert all(not d['errors'] for d in summary.values())
print('Preserved every original path and SHA-256:',len(entries),'files,',len(unique),'unique payloads; parts',sizes)
