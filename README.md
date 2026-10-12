# harbor-apps

The official app catalog for [Harbor](https://github.com/carlosalaniz/harbor): every app you see in a
Harbor box's App Store comes from this repository.

Each app is a data-only package: a manifest, a Compose subset with images pinned by digest, a README and
a `release.json` with file hashes. No code runs from here; Harbor validates every package before it lists it.

## Layout

```
apps/index.json          the list of apps: id -> { revision, dir, optional minHarbor }
apps/<id>/manifest.yaml  what Harbor needs to know (endpoints, storage, health, presentation)
apps/<id>/compose.yaml   the services, Compose subset only, images pinned by digest
apps/<id>/README.md      shown in the App Store
apps/<id>/release.json   sha256 of every file, image digests, qualification result
apps/<id>/icon.svg|png   optional icon (plus optional screenshots)
keys/harbor-apps.pub     the public key Harbor uses to check each published catalog
scripts/sign.mjs         signs a bundle in CI
.harbor-ref              the Harbor branch, tag or commit whose tools CI uses
```

## Add or update an app

The package format is described in Harbor's
[DEVELOPER_PACKAGES.md](https://github.com/carlosalaniz/harbor/blob/main/docs/DEVELOPER_PACKAGES.md).
Follow it; the short version:

1. Keep a checkout of Harbor next to this one (`../harbor`) and run its tools from there. They find
   `../harbor-apps/apps` on their own (or pass `--catalog <dir>`, or set `HARBOR_CATALOG_DIR`).
2. Edit `apps/<id>/`. Raise `release.revision` in the manifest **and** the app's `revision` in
   `apps/index.json` on every change: a higher revision is what makes Harbor offer an update.
3. Pin new images to digests: `node scripts/catalog-pin.mjs <id>` (in the Harbor checkout).
4. Refresh the hashes: `pnpm catalog:hash <id>`, then check everything: `pnpm catalog:verify`.
5. Open a pull request. CI runs the same checks with Harbor's own loader.

Qualification (`"status": "passed"` in `release.json`) only ever comes from Harbor's
`scripts/vm/qualify-catalog.mjs` run on a disposable droplet. Never set it by hand.

### minHarbor

An app that needs a newer Harbor feature sets `"minHarbor": "x.y.z"` on its entry in `apps/index.json`.
Older Harbor boxes still list it, but as unavailable ("needs Harbor x.y.z or newer"), and never install it.

## How publishing works

Every push to `main` that touches `apps/` (or the keys, scripts, `.harbor-ref` or the workflow):

1. checks every app with Harbor's loader and checks the hashes are current,
2. bundles `apps/` into `catalog.zip` plus `catalog.json` (its sha256, size, commit and serial),
3. signs `catalog.json` with the catalog key,
4. publishes the three files as a GitHub release tagged `c<serial>` and marks it latest.

The serial is the commit's committer time (unix seconds). Harbor only ever moves to a higher serial.

Harbor boxes check for a new catalog every 6 hours, or right away with **Check for new apps** in the
console or `harbor catalog refresh`. Each Harbor release also ships the latest catalog, so a new or
offline box has apps from the start.

## Trust

Catalogs are signed with ed25519. The public key is in `keys/harbor-apps.pub` and is pinned in Harbor
([`src/packages/catalog-bundle.ts`](https://github.com/carlosalaniz/harbor/blob/main/src/packages/catalog-bundle.ts)).
A box ignores any catalog whose signature, checksum or contents do not check out, and keeps the one it has.

The private key exists only as the `CATALOG_SIGNING_KEY` Actions secret of this repository. It is never
committed, and `scripts/sign.mjs` refuses to publish if the secret does not match the pinned public key.
