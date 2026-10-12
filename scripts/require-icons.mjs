#!/usr/bin/env node
// Every app in the official catalog has an icon (the store and the launcher never show a bare monogram for one).
//   node scripts/require-icons.mjs <catalogDir>
// Checks each index entry: manifest presentation.icon names a .svg or .png file that exists in the app's folder,
// at most 256 KiB (Harbor's asset limit). Dependency-free, like subset.mjs: it runs before any Harbor checkout.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: require-icons.mjs <catalogDir>');
  process.exit(2);
}
const index = JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf8'));
const problems = [];
for (const [id, entry] of Object.entries(index.packages ?? {})) {
  const manifest = readFileSync(path.join(dir, entry.dir, 'manifest.yaml'), 'utf8');
  // presentation is a top-level block; its keys are indented two spaces
  const block = /^presentation:\n((?: {2}.*\n?)*)/m.exec(manifest)?.[1] ?? '';
  const icon = /^ {2}icon: *"?([^"\s]+)"?\s*$/m.exec(block)?.[1];
  if (!icon) { problems.push(`${id}: no presentation.icon`); continue; }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}\.(svg|png)$/.test(icon)) { problems.push(`${id}: icon ${icon} must be a .svg or .png file name`); continue; }
  const file = path.join(dir, entry.dir, icon);
  if (!existsSync(file)) { problems.push(`${id}: ${icon} is missing`); continue; }
  const size = statSync(file).size;
  if (size === 0 || size > 256 * 1024) problems.push(`${id}: ${icon} is ${size} bytes (1 byte to 256 KiB)`);
}
if (problems.length) {
  console.error(`apps without a usable icon (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`all ${Object.keys(index.packages ?? {}).length} apps have an icon`);
