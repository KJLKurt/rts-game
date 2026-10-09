import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'dist';
const expected = JSON.parse(fs.readFileSync('.qa-candidate-sha256.json', 'utf8'));
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const actual = Object.fromEntries(files(root).map(file =>
  [path.relative(root, file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
if (Object.keys(actual).sort().join('\n') !== Object.keys(expected).sort().join('\n')) throw Error('Candidate dist inventory differs');
for (const [file, hash] of Object.entries(expected)) if (actual[file] !== hash) throw Error(`Candidate dist mismatch: ${file}`);
const receipt = {commit: process.env.GITHUB_SHA || 'local-learning-candidate', runtime: 'fc-3dce7db7d71b', matchedFiles: Object.keys(actual).length, source: 'Exact reviewed learning candidate SHA256 ledger, including source maps', actual};
fs.writeFileSync('candidate-dist-proof.json', JSON.stringify(receipt, null, 2));
console.log(`Verified all ${receipt.matchedFiles} candidate dist files byte-for-byte.`);

