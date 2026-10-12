#!/usr/bin/env node
// Sign the catalog metadata (Harbor decision 158). No dependencies.
//   CATALOG_SIGNING_KEY="$(cat key.pem)" node scripts/sign.mjs [distDir]
// Reads <distDir>/catalog.json (default dist/), writes <distDir>/catalog.json.sig (base64 ed25519 over the
// exact catalog.json bytes), then verifies it against the public key Harbor pins (keys/harbor-apps.pub,
// or CATALOG_PUBLIC_KEY_FILE for a local test key). A key that does not match fails here, before anything
// is released, and leaves no signature behind.
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.resolve(process.argv[2] ?? path.join(ROOT, 'dist'));
const metaFile = path.join(dist, 'catalog.json');
const sigFile = path.join(dist, 'catalog.json.sig');
const pubFile = path.resolve(process.env.CATALOG_PUBLIC_KEY_FILE ?? path.join(ROOT, 'keys', 'harbor-apps.pub'));

function fail(message) {
  rmSync(sigFile, { force: true });
  console.error(`sign: ${message}`);
  process.exit(1);
}

const pem = process.env.CATALOG_SIGNING_KEY;
if (!pem || !pem.trim()) fail('CATALOG_SIGNING_KEY is empty (an ed25519 private key, PKCS8 PEM)');
let privateKey;
try {
  privateKey = createPrivateKey({ key: pem, format: 'pem' });
} catch (e) {
  fail(`CATALOG_SIGNING_KEY is not a PEM private key: ${e.message}`);
}
if (privateKey.asymmetricKeyType !== 'ed25519') fail(`CATALOG_SIGNING_KEY is a ${privateKey.asymmetricKeyType} key, not ed25519`);

const meta = readFileSync(metaFile);
const signature = sign(null, meta, privateKey);
writeFileSync(sigFile, signature.toString('base64'));

let publicKey;
try {
  publicKey = createPublicKey({ key: Buffer.from(readFileSync(pubFile, 'utf8').trim(), 'base64'), format: 'der', type: 'spki' });
} catch (e) {
  fail(`${pubFile} is not a base64 SPKI public key: ${e.message}`);
}
const written = Buffer.from(readFileSync(sigFile, 'utf8').trim(), 'base64');
if (!verify(null, meta, publicKey, written)) fail(`the signature does not verify against ${pubFile}: CATALOG_SIGNING_KEY is not the key Harbor trusts`);
console.log(`signed ${metaFile} -> ${sigFile}; verified against ${pubFile}`);
