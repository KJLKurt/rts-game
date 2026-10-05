import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';

/** Identify the shipped source and assets, independent of checkout, Git or time. */
export function buildIdentifier(root: string): string {
  const files: string[] = [];
  function collect(dir: string) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  collect(join(root, 'src'));
  collect(join(root, 'public'));
  for (const name of ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'scripts/build-sw.mjs', 'scripts/build-identity.ts']) files.push(join(root, name));
  const inputs = files.map(path => ({path, name: relative(root, path).replaceAll('\\', '/')})).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const hash = createHash('sha256');
  for (const {path, name} of inputs) {
    const bytes = readFileSync(path);
    hash.update(name).update('\0').update(String(bytes.length)).update('\0').update(bytes);
  }
  return `fc-${hash.digest('hex').slice(0, 12)}`;
}
