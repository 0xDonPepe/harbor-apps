# harbor-apps

The official app catalog for [Harbor](https://github.com/carlosalaniz/harbor): every app you see in a
Harbor box's App Store comes from this repository.

Each app is a data-only package: a manifest, a Compose subset with images pinned by digest, a README and
a `release.json` with file hashes. No code runs from here; Harbor validates every package before it lists it.

## Layout

```
apps/index.json          the list of apps: id -> { revision, dir, optional minHarbor (normally computed) }
apps/<id>/manifest.yaml  what Harbor needs to know (endpoints, storage, health, presentation)
apps/<id>/compose.yaml   the services, Compose subset only, images pinned by digest
apps/<id>/README.md      shown in the App Store
apps/<id>/release.json   sha256 of every file, image digests, qualification result
apps/<id>/icon.svg|png   optional icon (plus optional screenshots)
.harbor-ref              the Harbor commit (full 40-hex sha, on Harbor's main) whose tools CI uses
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

You normally do not set it. The release job works out which Harbor each app needs from the fields and
values it uses (Harbor's `src/packages/features.ts`, decision 159) and stamps `"minHarbor": "x.y.z"` on
its entry in the published `index.json`. Older Harbor boxes still list such an app, but as unavailable
("needs Harbor x.y.z or newer"), and never install or update it.

If you do set `"minHarbor"` by hand in `apps/index.json` (for a behaviour the table cannot see), the
bundle keeps the higher of yours and the computed one, and `pnpm catalog:verify` fails when yours is lower.
It prints `minHarbor declared=… computed=…` for every app.

A new package field reaches this catalog only after Harbor learns it: bump `.harbor-ref` to a Harbor
commit that accepts the field before an app here uses it.

## How publishing works

Every push to `main` that touches `apps/` (or `.harbor-ref` or the workflow) runs two jobs in
`.github/workflows/ci.yml`. Pull requests run only the first.

1. **verify** checks every app with Harbor's loader (Harbor checked out at `.harbor-ref`) and checks the
   hashes are current.
2. **release** builds `apps/` into `catalog.zip` plus `catalog.json` (the zip's sha256 and size, the
   commit and the serial) with Harbor's tools at the same commit, then creates a GitHub release tagged
   `c<serial>` with the two files and marks it latest. It is the only job that may write to the
   repository; the write token is passed only to the two `gh` steps.

The serial is the commit's committer time (unix seconds). Harbor only ever moves to a higher serial, so:

- A commit dated more than 5 minutes in the future fails the release job: it would freeze every box until
  the clock caught up. Fix the clock and make a new commit.
- A re-run for a commit that is already released does nothing.
- A different commit in the same committer second as an existing release fails: make a new commit.
- A commit older than the latest release is skipped when `main` has already moved on (the newer commit
  publishes). When it is still `main`'s tip, that is clock skew and the job fails: make a new commit.

### Bumping .harbor-ref

`.harbor-ref` holds one full 40-hex commit sha of
[carlosalaniz/harbor](https://github.com/carlosalaniz/harbor), and it must be a commit on Harbor's `main`.
CI refuses a branch name, a tag, a short sha, or a commit that is not on Harbor's `main`. The reason is
trust: the release job runs Harbor's code and its dependencies, and that code decides what goes into the
published catalog. A branch or tag can move without anyone reviewing this repository. A pinned
sha changes only through a reviewed commit here.

To bump it, once the Harbor change you need is merged:

```sh
git -C ../harbor fetch origin main
git -C ../harbor rev-parse origin/main > .harbor-ref
```

Then check the catalog with that Harbor commit (`pnpm catalog:verify` and `pnpm catalog:hash --check` in
`../harbor`), and open a pull request that changes only `.harbor-ref`. Say which Harbor change it brings in.

Harbor boxes (0.28.0 and newer) check for a new catalog every 6 hours, or right away with **Check for new apps** in the
console or `harbor catalog refresh`. Each Harbor release also ships the latest catalog, so a new or
offline box has apps from the start.

## Trust

There are no keys. A Harbor box downloads the catalog over HTTPS from this repository's GitHub releases,
exactly the way it downloads its own updates from Harbor's releases: whoever can publish a release here is
trusted, the same as for Harbor itself. Harbor runs as a root-equivalent service, so a signed catalog
added little on top of that, for a lot of moving parts (key custody and rotation, more CI jobs); Harbor
built signing and removed it before release (Harbor decision 158). Signing Harbor releases and this
catalog together, with one key, is on Harbor's list for later (`docs/TODO.md`).

`catalog.json` still pins `catalog.zip` by sha256 and size. That is an integrity check (a truncated
download, or a zip from one release with the `catalog.json` of another), not a trust anchor. A box also
refuses a catalog that is older than the one it has, dated more than a day in the future, too large, or
that does not validate, and keeps the one it has.

What goes into a release rests on this repository's reviewed commits and on the Harbor commit pinned in
`.harbor-ref` with its locked dependencies.
