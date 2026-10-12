#!/usr/bin/env node
// Re-check an unsigned bundle before it is signed (Harbor decision 158). No dependencies.
//   EXPECT_SERIAL=<unix-seconds> EXPECT_COMMIT=<sha> node scripts/check-bundle.mjs [distDir]
// The bundle job runs Harbor's tools (and their npm dependencies); the sign job runs only this file and
// sign.mjs. So before the key is used, check that what the bundle job handed over is self-consistent:
//   - <distDir>/catalog.json is a schemaVersion 1 bundle for exactly EXPECT_SERIAL and EXPECT_COMMIT,
//   - <distDir>/catalog.zip has exactly the sha256 and size that catalog.json pins,
//   - <distDir>/build.txt (written by the bundle job) names the same serial and commit.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.resolve(process.argv[2] ?? path.join(ROOT, 'dist'));
const MAX_META_BYTES = 64 * 1024; // Harbor's MAX_BUNDLE_META_BYTES
const MAX_ZIP_BYTES = 96 * 1024 * 1024; // Harbor's MAX_BUNDLE_ZIP_BYTES

function fail(message) {
  console.error(`check-bundle: ${message}`);
  process.exit(1);
}

const expectSerial = process.env.EXPECT_SERIAL ?? '';
const expectCommit = process.env.EXPECT_COMMIT ?? '';
if (!/^[1-9][0-9]{0,15}$/.test(expectSerial)) fail(`EXPECT_SERIAL must be a positive integer, got "${expectSerial}"`);
if (!/^[0-9a-f]{40}$/.test(expectCommit)) fail(`EXPECT_COMMIT must be a full 40-hex commit sha, got "${expectCommit}"`);

function read(name, maxBytes) {
  const file = path.join(dist, name);
  if (!existsSync(file)) fail(`${file} is missing: did the bundle job fail or upload an incomplete artifact?`);
  const size = statSync(file).size;
  if (size > maxBytes) fail(`${file} is ${size} bytes, over the ${maxBytes} byte limit`);
  return readFileSync(file);
}

const metaBytes = read('catalog.json', MAX_META_BYTES);
let meta;
try {
  meta = JSON.parse(metaBytes.toString('utf8'));
} catch (e) {
  fail(`catalog.json is not JSON: ${e.message}`);
}
if (!meta || typeof meta !== 'object' || Array.isArray(meta)) fail('catalog.json is not an object');
if (meta.schemaVersion !== 1) fail(`catalog.json schemaVersion is ${JSON.stringify(meta.schemaVersion)}, expected 1`);
if (meta.serial !== Number(expectSerial)) fail(`catalog.json serial is ${JSON.stringify(meta.serial)}, expected ${expectSerial}`);
if (meta.commit !== expectCommit) fail(`catalog.json commit is ${JSON.stringify(meta.commit)}, expected ${expectCommit}`);
const zipMeta = meta.zip;
if (!zipMeta || typeof zipMeta.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(zipMeta.sha256)) fail('catalog.json zip.sha256 is not a sha256 hex digest');
if (!Number.isSafeInteger(zipMeta.bytes) || zipMeta.bytes < 22) fail(`catalog.json zip.bytes is ${JSON.stringify(zipMeta.bytes)}, not a zip size`);

const zip = read('catalog.zip', MAX_ZIP_BYTES);
if (zip.length !== zipMeta.bytes) fail(`catalog.zip is ${zip.length} bytes, catalog.json says ${zipMeta.bytes}`);
const sha = createHash('sha256').update(zip).digest('hex');
if (sha !== zipMeta.sha256) fail(`catalog.zip sha256 is ${sha}, catalog.json says ${zipMeta.sha256}`);

const build = Object.fromEntries(
  read('build.txt', 4096)
    .toString('utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
if (build.serial !== expectSerial) fail(`build.txt serial is "${build.serial ?? ''}", expected ${expectSerial}`);
if (build.commit !== expectCommit) fail(`build.txt commit is "${build.commit ?? ''}", expected ${expectCommit}`);

console.log(`bundle ok: serial ${expectSerial}, commit ${expectCommit}, catalog.zip ${zip.length} bytes sha256 ${sha}`);
