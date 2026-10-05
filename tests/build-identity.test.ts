import {afterEach, describe, expect, it} from 'vitest';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildIdentifier} from '../scripts/build-identity';

const roots: string[] = [];
function fixture(reverse = false) {
  const root = mkdtempSync(join(tmpdir(), 'frontier-build-identity-')); roots.push(root);
  for (const dir of ['src', 'public', 'scripts', 'docs']) mkdirSync(join(root, dir));
  const names = ['src/main.ts', 'src/other.ts', 'public/icon.svg', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'scripts/build-sw.mjs', 'scripts/build-identity.ts'];
  for (const name of reverse ? names.reverse() : names) writeFileSync(join(root, name), `contents:${name}`);
  return root;
}
afterEach(() => {for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});});
describe('visible build identity', () => {
  it('is stable across checkout paths and file creation order, without Git metadata', () => {
    expect(buildIdentifier(fixture())).toBe(buildIdentifier(fixture(true)));
    expect(buildIdentifier(fixture())).toMatch(/^fc-[0-9a-f]{12}$/);
  });
  it('changes for shipped source, asset and locked dependency changes', () => {
    for (const name of ['src/main.ts', 'public/icon.svg', 'package-lock.json']) {
      const root = fixture(), before = buildIdentifier(root);
      writeFileSync(join(root, name), 'changed release content');
      expect(buildIdentifier(root)).not.toBe(before);
    }
  });
  it('does not change for QA output or documentation', () => {
    const root = fixture(), before = buildIdentifier(root);
    writeFileSync(join(root, 'docs/QA.md'), 'another verification receipt');
    mkdirSync(join(root, 'dist')); writeFileSync(join(root, 'dist/report.json'), 'temporary output');
    expect(buildIdentifier(root)).toBe(before);
  });
});
