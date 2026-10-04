"""Recover exact authorized QA assets when a connector supports UTF-8 files only."""
import pathlib,json,base64,hashlib
root=pathlib.Path(__file__).resolve().parent.parent
manifest=json.loads((root/'transport/manifest.json').read_text())
for item in manifest['files']:
 target=pathlib.PurePosixPath(item['path'])
 if target.is_absolute() or '..' in target.parts:raise ValueError('Unsafe target path')
 encoded=''.join((root/part['path']).read_text().strip() for part in item['parts'])
 data=base64.b64decode(encoded,validate=True)
 if len(data)!=item['size'] or hashlib.sha256(data).hexdigest()!=item['sha256']:raise ValueError('Asset hash mismatch: '+item['path'])
 path=root/target;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 print('Verified',item['path'],len(data))
