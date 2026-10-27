# PRO-10258: Windows test plan

> **Delete this folder before merging.** It's a hand-off for testing the
> branch on Windows. It lives in its own commit so it's easy to drop.

This is written for a Claude Code instance (or a person) on a Windows
machine. It assumes no context beyond this file and the branch.

## What changed and why

Under pnpm's default settings, a stock Apostrophe project could not build
its assets. `@apostrophecms/vite` copies each module's `ui/` source to
`apos-build/` and builds from there, so a bare import like `vue` is looked
up from the project root. npm hoists Apostrophe's dependencies there; pnpm
doesn't, so the build failed with
`Rollup failed to resolve import "tiny-emitter/instance"`.

The fix is `packages/vite/lib/vite-plugin-apostrophe-deps.mjs`, registered
in `getBaseViteConfig` in `packages/vite/lib/internals.js`:

1. **Fallback resolver** (Vite plugin, after Vite's own resolver). If Vite
   can't resolve a bare import, it resolves it from the package the
   importing file came from. For copied files that's the original file's
   location (`getDepsSearchDirs` / `getOriginalSourceDir` in
   `internals.js`). Then it tries Apostrophe core, then
   `@apostrophecms/vite`. It also handles `resolve.dedupe` (`vue`).
2. **Real store paths** (Vite plugin, `enforce: 'pre'`). For imports *from*
   a file in `node_modules/.pnpm/`, it uses the real path of the result.
   Without this, `preserveSymlinks: true` bundles `@tiptap/core` once per
   dependent (about 30 copies), which breaks the rich-text editor.
3. **esbuild plugin** for Vite's dev dependency pre-bundling, which does not
   run Vite plugins. It must stay out of Vite's dependency *scan*;
   otherwise packages aren't pre-bundled and CommonJS packages such as
   `dayjs` are served raw and break in the browser.
4. **Sass importer** for `@use 'package'` in stylesheets.

Every hook only acts when the normal lookup fails, or (for 2 and 3) when
the importer is inside pnpm's store. With npm the output must not change.

## Why Windows needs its own pass

Everything passed on macOS (results at the end). The code compares and
rewrites paths, which is where Windows tends to differ. Watch for:

- **Drive letter case.** `realStorePaths` compares `realpath(file)` with
  the id Vite gave it. If Windows returns `c:/…` for one and `C:/…` for the
  other, the same file gets two ids and is **bundled twice**.
  `bundle-check.mjs` and `dev-check.mjs` compare paths case-insensitively
  to catch this.
- **Separators.** Vite ids use `/`; `path` gives `\`. Look at
  `getDepsSearchDirs` (`path.relative` against `buildRootSource`), the
  `isInPnpmStore` check, and the esbuild plugin returning `C:/…` paths.
- **Junctions.** pnpm links with junctions on Windows, not symlinks.
  `fs.realpathSync` should follow them.
- **Sass importer.** It uses `fileURLToPath(containingUrl)` and
  `pathToFileURL`.
- **Unit tests** create junctions (`test/deps-plugin.test.js`).

## Prerequisites

- Node 22 (macOS testing used 22.23.1), pnpm 10, git
- MongoDB running on `localhost:27017`. Each test project uses its own
  `pro10258-<label>` database.
- yarn 1 (`npm i -g yarn`) is optional, for the yarn row.

Commands below are PowerShell. `$T` is the folder holding the test
projects; `$R` is this folder.

## 1. Get the branch and run the package tests

```powershell
git clone https://github.com/apostrophecms/apostrophe.git
cd apostrophe
git checkout bob/pro-10258-vite-build-resolve-apostrophes-own-dependencies-without
pnpm install
cd packages/vite
npx eslint lib test index.js
$env:APOS_TEST_DB_PROTOCOL = 'mongodb'; npx mocha
```

Expect: lint clean, **34 passing**. If `test/deps-plugin.test.js` fails,
fix that first; it isolates the plugin from Apostrophe.

## 2. Pack the branch

```powershell
$R = "<path-to-repo>\PRO-10258-windows-testing"
$T = "C:\pro10258"           # any empty folder
$TGZ = node $R\scripts\pack.mjs $T\tarballs
```

Run `pack.mjs` again after any code change, and reinstall into the
projects that use the fix. The tarball name changes each time **on
purpose**: pnpm and yarn cache `file:` tarballs by name and silently keep
old code. Don't delete old tarballs; a lockfile may still point at one.

## 3. Create the test projects

All projects are fresh clones of `starter-kit-essentials` with the
versions from the ticket pinned:

```powershell
function New-Kit($name) {
  git clone -q --depth 1 https://github.com/apostrophecms/starter-kit-essentials.git "$T\$name"
}
```

| Project | Commands (inside the project folder) |
|---|---|
| `npm` (baseline) | `npm install apostrophe@4.34.0 @apostrophecms/vite@1.2.0` |
| `npm-fix` | `npm install apostrophe@4.34.0 $TGZ` |
| `pnpm` (should fail) | `pnpm add apostrophe@4.34.0 @apostrophecms/vite@1.2.0` |
| `pnpm-fix` | `pnpm add apostrophe@4.34.0 $TGZ` |
| `pnpm-hoisted-fix` | `Set-Content .npmrc 'public-hoist-pattern[]=*'` then `pnpm add apostrophe@4.34.0 $TGZ` |
| `yarn-fix` (optional) | `yarn add apostrophe@4.34.0 "@apostrophecms/vite@file:$TGZ"` |
| `pnpm-ext-fix` | `pnpm add apostrophe@4.34.0 $TGZ "file:$R/fixtures/pro10258-test-ext"`, then see below |

For `pnpm-ext-fix`, register the test extension in `app.js` by adding
`'pro10258-test-ext': {},` at the top of `modules: {`. The extension's UI
code imports `mitt` (public JS), `nanoevents` (admin JS) and
`pro10258-sass-dep` (Sass). These are installed only for the extension,
not at the project root, so this project tests the per-file owner lookup.

In **every** project, edit `modules/@apostrophecms/asset/index.js` so the
scripts can switch HMR mode and source maps:

```js
hmr: process.env.HMR || 'public',
productionSourceMaps: process.env.SOURCEMAPS === '1',
```

pnpm 10 warns about ignored build scripts (esbuild, better-sqlite3, …).
That's expected and doesn't matter with MongoDB.

## 4. Production builds

```powershell
foreach ($k in 'npm','npm-fix','pnpm','pnpm-fix','pnpm-hoisted-fix','yarn-fix') {
  node $R\scripts\build.mjs $T\$k $k
}
foreach ($k in 'npm-fix','pnpm-fix','pnpm-hoisted-fix','yarn-fix') {
  node $R\scripts\compare.mjs $T\npm $T\$k
}
node $R\scripts\build.mjs $T\pnpm-fix pnpm-fix --sourcemaps
node $R\scripts\bundle-check.mjs $T\pnpm-fix
node $R\scripts\build.mjs $T\pnpm-ext-fix pnpm-ext-fix --sourcemaps
node $R\scripts\bundle-check.mjs $T\pnpm-ext-fix
```

Expected:

- `pnpm` (no fix) **fails** with `failed to resolve import "tiny-emitter/instance"`.
  If it builds, the test isn't reproducing the bug; check for a stray
  `.npmrc` with hoisting.
- Every `compare.mjs` prints **byte-identical**. Before you suspect the
  code, check that the dependency versions match. Independent installs can
  resolve different versions:
  `node -p "require('vite/package.json').version"`, inside
  `node_modules/@apostrophecms/vite` for each project.
- `bundle-check.mjs`: **0 bundled more than once**, admin bundle about the
  same size as npm's (1,748,120 bytes on macOS). For `pnpm-ext-fix`: all
  three markers `yes`.

A build with `--sourcemaps` adds map comments, so don't `compare.mjs` it
against a build without them; rebuild first.

## 5. Dev server checks

Create the test user once per project. It prompts for a password; any
test value works. Then start the server in its own terminal:

```powershell
cd $T\pnpm-fix
$env:APOS_MONGODB_URI = 'mongodb://localhost:27017/pro10258-pnpm-fix'
node app @apostrophecms/user:add pro10258 admin
Remove-Item -Recurse -Force apos-build, data\temp -ErrorAction SilentlyContinue
$env:PORT = '3110'; $env:HMR = 'apos'; node app
```

In another terminal:

```powershell
$env:PRO10258_PASSWORD = '<the password you set>'
node $R\scripts\dev-check.mjs $T\pnpm-fix 3110 $T\pnpm-fix-apos.txt
```

Run it for these combinations, stopping the server and clearing
`apos-build` and `data\temp` between runs:

| Project | `HMR` | Expected |
|---|---|---|
| `npm` | `apos` | baseline; save the URL list |
| `npm-fix` | `apos` | URL list identical to `npm`'s |
| `pnpm-fix` | `apos` | 754 modules, 59 pre-bundled, 0 failed / raw CommonJS / served twice |
| `pnpm-fix` | `public` | 0 failed (17 modules logged out; more logged in) |
| `pnpm-ext-fix` | `apos` | 755 modules, 60 pre-bundled, all zeros |

Compare URL lists with
`Compare-Object (Get-Content a.txt) (Get-Content b.txt)`. Between npm
and pnpm, only esbuild's `chunk-XXXX.js` names should differ. Between
`npm` and `npm-fix` there should be no difference at all.

Also check the server's console for `pre-transform`, `Could not resolve`
or `Can't find stylesheet` errors.

## 6. Browser check

With `pnpm-fix` running in `HMR=apos` mode, open `http://localhost:3110/login`
and log in. Then:

1. Click **Edit**, then **Add Content** → **Rich Text**, type some text,
   press Ctrl+B and type more. The draft should autosave.
2. Click **Update** to publish, then reload. The text should still be there.
3. Open **Pages**. The list should show a relative "last edited" time
   (formatted by `dayjs`, a CommonJS package).
4. DevTools console: no errors.

Repeat steps 1 and 4 against the production build: run
`node $R\scripts\build.mjs $T\pnpm-fix pnpm-fix`, then start with
`$env:NODE_ENV='production'; $env:APOS_RELEASE_ID='pro10258'` (and the
same `APOS_MONGODB_URI` and `PORT`) and `node app`.

## Results on macOS (for comparison)

macOS, Node 22.23.1, pnpm 10.29.3, yarn 1.22.22, apostrophe 4.34.0, vite 6.4.5:

- Package tests: 34 passing, lint clean
- `pnpm` without fix: fails as expected
- npm-fix, pnpm-fix, pnpm-hoisted-fix, yarn-fix: byte-identical to npm
- pnpm-fix / pnpm-ext-fix: 0 files bundled twice; extension markers present
- Dev `apos` HMR: npm and npm-fix identical (754 URLs); pnpm-fix 754 modules,
  59 pre-bundled, same packages as npm; pnpm-ext-fix 755 / 60; all zeros
- Browser: rich text (bold, italic), publish, reload, Pages manager — no
  console errors, in both admin HMR mode and the production build

## Not covered yet

- `npm link`-ed / symlinked local modules (`preserveSymlinks` exists for them)
- Sass's legacy `@import` API (the importer targets Vite's default modern API)
- Yarn Plug'n'Play (out of scope; needs `nodeLinker: node-modules`)

## Reporting back

Add a comment on PRO-10258 with the table rows above filled in for
Windows. For any failure, include the command, its full output, and the
versions (`node -v`, `pnpm -v`, vite version). If you fix something,
commit it on the branch separately from this folder, with a test in
`packages/vite/test/deps-plugin.test.js` where possible.
