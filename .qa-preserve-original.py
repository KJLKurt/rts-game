"""Preserve every downloaded first-gate file in bounded, verified content-addressed parts."""
from pathlib import Path
import hashlib,json,zipfile,shutil
root=Path('.qa-original'); out=Path('original-evidence-parts'); out.mkdir(exist_ok=True)
files=sorted(p for p in root.rglob('*') if p.is_file())
assert len(files)==303, f'Expected all 303 original artifact files, got {len(files)}'
entries=[]; unique={}; chunkroot=Path('.qa-original-chunks');chunkroot.mkdir(exist_ok=True)
for p in files:
 chunks=[];whole=hashlib.sha256();size=0
 with p.open('rb') as stream:
  while b:=stream.read(32*1024*1024):
   whole.update(b);size+=len(b);h=hashlib.sha256(b).hexdigest();chunks.append(h)
   if h not in unique:
    target=chunkroot/h;target.write_bytes(b);unique[h]=target
 entries.append({'path':p.relative_to(root).as_posix(),'bytes':size,'sha256':whole.hexdigest(),'chunks':chunks})
bins=[[] for _ in range(8)];sizes=[0]*8
for h,p in sorted(unique.items(),key=lambda x:(-x[1].stat().st_size,x[0])):
 i=min(range(8),key=lambda n:sizes[n]);bins[i].append((h,p));sizes[i]+=p.stat().st_size
assert max(sizes)<270*1024*1024, f'Part exceeds bounded size: {sizes}'
manifest={'sourceRun':38002426925,'sourceCommit':'1bdc346c7744924d959326508629e2906325b9f5','sourceArtifact':11650036567,'sourceArtifactZipSha256':'33fbaea193b357f5496cf10e828ef10356b7275f4f84879a0c72cffe1e2faf4f','fileCount':len(entries),'uniqueContents':len(unique),'files':entries,'parts':[[h for h,p in part] for part in bins]}
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
 if ('/' not in n and n.endswith('.json')) or (n.startswith('test-results-') and '/attachments/' not in n and p.suffix in ['.json','.png','.md']):
  target=review/n;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
shutil.copyfile(out/'original-content-manifest.json',review/'original-content-manifest.json')
def walk(suites):
 for s in suites:
  for spec in s.get('specs',[]):
   for test in spec.get('tests',[]):yield spec,test
  yield from walk(s.get('suites',[]))
summary={}
for f in ['preview-layout-red-ledger.json','preview-layout-identity-ledger.json']:
 data=json.loads((root/f).read_text()); cases=list(walk(data['suites']));summary[f]={'stats':data['stats'],'errors':data.get('errors',[]),'cases':[{'title':s['title'],'project':t['projectName'],'status':t['status'],'attempts':len(t['results']),'results':[{'status':r['status'],'retry':r.get('retry'), 'errors':r.get('errors',[])} for r in t['results']]} for s,t in cases]}
(review/'original-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for f,d in summary.items():print(f, json.dumps(d['stats']), 'globalErrors',len(d['errors']))
assert summary['preview-layout-identity-ledger.json']['stats']['expected']==4
assert summary['preview-layout-identity-ledger.json']['stats']['unexpected']==3
assert all(c['attempts']==1 and c['results'][0]['retry']==0 for d in summary.values() for c in d['cases'])
assert all(not d['errors'] for d in summary.values())
print('Preserved every original path and SHA-256:',len(entries),'files,',len(unique),'unique payloads; parts',sizes)

assert all(json.loads((root/'preview-layout-red-proof.json').read_text())['checks'].values())
print('Largest original files:', json.dumps(sorted(entries,key=lambda e:-e['bytes'])[:8]))
