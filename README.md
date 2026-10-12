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
keys/harbor-apps.pub     the public key Harbor uses to check each published catalog
scripts/check-bundle.mjs re-checks the unsigned bundle in CI before it is signed
scripts/sign.mjs         signs a bundle in CI
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

You normally do not set it. The bundle job works out which Harbor each app needs from the fields and
values it uses (Harbor's `src/packages/features.ts`, decision 159) and stamps `"minHarbor": "x.y.z"` on
its entry in the published `index.json`. Older Harbor boxes still list such an app, but as unavailable
("needs Harbor x.y.z or newer"), and never install or update it.

If you do set `"minHarbor"` by hand in `apps/index.json` (for a behaviour the table cannot see), the
bundle keeps the higher of yours and the computed one, and `pnpm catalog:verify` fails when yours is lower.
It prints `minHarbor declared=… computed=…` for every app.

A new package field reaches this catalog only after Harbor learns it: bump `.harbor-ref` to a Harbor
commit that accepts the field before an app here uses it.

## How publishing works

Every push to `main` that touches `apps/` (or the keys, scripts, `.harbor-ref` or the workflow) runs four
jobs in `.github/workflows/ci.yml`. Pull requests run only the first.

1. **verify** checks every app with Harbor's loader (Harbor checked out at `.harbor-ref`) and checks the
   hashes are current.
2. **bundle** builds `apps/` into `catalog.zip` plus an unsigned `catalog.json` (its sha256, size, commit
   and serial) with Harbor's tools, and hands both over as a workflow artifact. It runs Harbor's code and
   its npm dependencies, so it gets no secret and only a read-only token.
3. **sign** runs in the `catalog-signing` environment, the only place the key exists. It checks out only
   this repository and installs nothing. It re-checks that `catalog.json` names this commit and serial and
   that `catalog.zip` has exactly the sha256 and size `catalog.json` pins (`scripts/check-bundle.mjs`),
   then signs `catalog.json` (`scripts/sign.mjs`, no dependencies).
4. **publish** is the only job that may write to the repository. It creates a GitHub release tagged
   `c<serial>` with the three files and marks it latest.

The serial is the commit's committer time (unix seconds). Harbor only ever moves to a higher serial, so:

- A commit dated more than 5 minutes in the future fails the bundle job: it would freeze every box until
  the clock caught up. Fix the clock and make a new commit.
- A re-run for a commit that is already released does nothing.
- A different commit in the same committer second as an existing release fails: make a new commit.
- A commit older than the latest release is skipped when `main` has already moved on (the newer commit
  publishes). When it is still `main`'s tip, that is clock skew and the job fails: make a new commit.

### Bumping .harbor-ref

`.harbor-ref` holds one full 40-hex commit sha of
[carlosalaniz/harbor](https://github.com/carlosalaniz/harbor), and it must be a commit on Harbor's `main`.
CI refuses a branch name, a tag, a short sha, or a commit that is not on Harbor's `main`. The reason is
trust: the bundle job runs Harbor's code and its dependencies, and that code decides what goes into the
catalog that is then signed. A branch or tag can move without anyone reviewing this repository. A pinned
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

Catalogs are signed with ed25519. The public key is in `keys/harbor-apps.pub` and is pinned in Harbor
([`src/packages/catalog-bundle.ts`](https://github.com/carlosalaniz/harbor/blob/main/src/packages/catalog-bundle.ts)).
A box ignores any catalog whose signature, checksum or contents do not check out, and keeps the one it has.

The private key exists only as the `CATALOG_SIGNING_KEY` secret of the `catalog-signing` GitHub
Environment of this repository (deployment branches: `main` only), plus an offline backup kept by the
maintainer. There is no repository-level copy. It is never committed. Only the sign job can read it, and
that job runs nothing but `scripts/check-bundle.mjs` and `scripts/sign.mjs` from this repository. The
`CATALOG_SIGNING_KEY` variable is set only on the step that signs. `scripts/sign.mjs` refuses to sign if
the secret does not match the pinned public key.

The sign job checks that the bundle is complete and consistent. It cannot tell whether the bundle job
packed the right apps: that rests on the Harbor commit pinned in `.harbor-ref` and its locked dependencies.
