import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = '.qa-previous/dist';
const expected = JSON.parse(fs.readFileSync('.qa-previous-sha256.json', 'utf8'));
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const actual = Object.fromEntries(files(root).filter(file => !file.endsWith('.map')).map(file =>
  [path.relative(root, file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
if (Object.keys(actual).sort().join('\n') !== Object.keys(expected).sort().join('\n')) throw Error('Previous dist inventory differs');
for (const [file, hash] of Object.entries(expected)) if (actual[file] !== hash) throw Error(`Previous dist mismatch: ${file}`);
const receipt = {commit: 'b8029a43e7a21e06b381bfd190689242798fd4a3', runtime: 'fc-fc75c030c578', matchedFiles: Object.keys(actual).length, source: 'Exact verified live-release dist SHA256 ledger; source maps excluded', actual};
fs.writeFileSync('previous-live-dist-proof.json', JSON.stringify(receipt, null, 2));
console.log(`Verified all ${receipt.matchedFiles} previous live dist files byte-for-byte.`);

