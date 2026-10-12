#!/usr/bin/env node
// Build a catalog directory that holds only some apps, so CI can validate them with an older Harbor release.
//   node scripts/subset.mjs <catalogDir> <outDir> <id> [<id> ...]
// Copies each listed app's directory and writes an index.json with only their entries (every other top-level
// field and every entry field kept as is). Dependency-free on purpose: it runs before any Harbor checkout is
// trusted with this repository's files. Refuses unknown or malformed ids, an entry whose dir is not its id,
// symlinks and anything but plain files and directories, and an outDir that already exists.
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(message) {
  console.error(`subset: ${message}`);
  process.exit(1);
}

function copyTree(from, to) {
  mkdirSync(to);
  for (const name of readdirSync(from).sort()) {
    if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) fail(`bad file name ${JSON.stringify(name)} in ${from}`);
    const src = path.join(from, name);
    const dst = path.join(to, name);
    const st = lstatSync(src);
    if (st.isSymbolicLink()) fail(`${src} is a symlink; packages hold plain files only`);
    if (st.isDirectory()) copyTree(src, dst);
    else if (st.isFile()) copyFileSync(src, dst);
    else fail(`${src} is not a plain file or directory`);
  }
}

const [catalogArg, outArg, ...ids] = process.argv.slice(2).filter((a) => a !== '--');
if (!catalogArg || !outArg || ids.length === 0) fail('usage: node scripts/subset.mjs <catalogDir> <outDir> <id> [<id> ...]');

const catalogDir = path.resolve(catalogArg);
const outDir = path.resolve(outArg);
if (existsSync(outDir)) fail(`${outDir} already exists; pass a new directory`);
const rel = path.relative(catalogDir, outDir);
if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) fail(`${outDir} is inside the catalog ${catalogDir}`);

let index;
try {
  index = JSON.parse(readFileSync(path.join(catalogDir, 'index.json'), 'utf8'));
} catch (e) {
  fail(`cannot read ${path.join(catalogDir, 'index.json')}: ${e.message}`);
}
if (!index || typeof index !== 'object' || Array.isArray(index) || !index.packages || typeof index.packages !== 'object' || Array.isArray(index.packages)) {
  fail('index.json has no "packages" object');
}

const seen = new Set();
for (const id of ids) {
  if (!ID.test(id)) fail(`bad app id ${JSON.stringify(id)} (lowercase letters, digits and single dashes only)`);
  if (seen.has(id)) fail(`app ${id} listed twice`);
  seen.add(id);
  if (!Object.hasOwn(index.packages, id)) fail(`app ${id} is not in index.json`);
  const entry = index.packages[id];
  if (!entry || typeof entry !== 'object' || entry.dir !== id) fail(`app ${id}: index.json dir must be "${id}"`);
  const st = lstatSync(path.join(catalogDir, id), { throwIfNoEntry: false });
  if (!st || !st.isDirectory() || st.isSymbolicLink()) fail(`app ${id}: ${path.join(catalogDir, id)} is not a directory`);
}

mkdirSync(outDir, { recursive: true });
const packages = {};
for (const id of [...seen].sort()) {
  copyTree(path.join(catalogDir, id), path.join(outDir, id));
  packages[id] = index.packages[id];
}
writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify({ ...index, packages }, null, 2)}\n`);
console.log(`subset ${outDir}: ${[...seen].sort().join(' ')}`);
