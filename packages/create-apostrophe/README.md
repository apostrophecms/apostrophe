# create-apostrophe

The guided installer behind `npm create apostrophe`. It clones a starter kit,
wires up your database, installs dependencies, and creates an admin user - so a
fresh Apostrophe project is running in a few minutes.

```bash
npm create apostrophe@latest
```

That runs the interactive flow. A few supporting commands:

```bash
# Run without prompts (CI / scripting)
npm create apostrophe@latest -- --unattended \
  --project-name=my-site --password=secret --telemetry=off

# Inspect or change your telemetry preference
npm create apostrophe@latest -- telemetry status
npm create apostrophe@latest -- telemetry on
npm create apostrophe@latest -- telemetry off
npm create apostrophe@latest -- telemetry preview   # show the exact payload

# Help / version
npm create apostrophe@latest -- --help
```

> Everything after `--` is forwarded to the installer; npm swallows args without it.
> Run `-- --help` any time for the full flag list.

Requires **Node 22+** and **npm** (pnpm and yarn aren't by this CLI yet, but they work fine with apostrophe).

## Architecture

Four layers, with one hard rule: **the headless layers never import the UI.**

- **`bin/`** - entry shim. Guards the Node version, then hands off to the CLI.
- **`cli/`** - argv parsing and command dispatch (interactive vs. unattended vs.
  `telemetry`).
- **`core/`** - the headless installer. `createProject()` orchestrates the
  install as a sequence of steps (clone → scaffold → install → db → sample data
  → admin). No prompts, no `process.exit`, no UI. Returns a structured result.
- **`telemetry/`** - consent, payload building, and the wire transport.
- **`ui/`** - clack prompts and terminal rendering, on top of a known-good core.

**Import rule:** `core/` and `telemetry/` must not import from `ui/`. `ui/` may
import from either freely. This keeps the installer logic testable in isolation
and reusable from a non-interactive host. The boundary is enforced by eslint
(`no-restricted-imports`).

## Public API

Only `create-apostrophe` itself is importable; everything under `core/`, `ui/`,
and `telemetry/` is private.

```js
import {
  createProject,        // headless install orchestration
  runInteractive,       // guided install, no argv parsing
  runTelemetryCommand,  // status | on | off | preview
  runCli                // argv-driven entry (full pass-through)
} from 'create-apostrophe';
```

- **`createProject(options, deps)`** → `Promise<CreateProjectResult>`. The headless
  orchestrator. Takes fully resolved, already-validated inputs; never prompts or
  exits. Resolves with `{ ok, kitId, dbChoice, packageManager, durationMs }`
  (plus `failStage` / `errorCode` on failure) instead of throwing on an expected
  install failure.
- **`runInteractive(deps?)`** → `Promise<number>` (exit code). The guided install
  with no argv parsing - what `@apostrophecms/cli`'s `create` delegate calls, so
  Commander keeps ownership of `--help`.
- **`runTelemetryCommand({ sub }, deps?)`** → `Promise<number>`. Handles the
  `status | on | off | preview` subcommands; used by the `apos telemetry` delegate.
- **`runCli(argv, deps?)`** → `Promise<number>`. The argv-driven entry for the
  standalone bin and any host that wants full pass-through.

Exit codes: `0` success · `1` install failure · `2` argument error · `130`
cancelled (Ctrl-C).

## Telemetry

Telemetry is **opt-in** and anonymous. It exists to tell us which kits and
databases people actually pick, and where installs break - nothing more. You can
see the exact payload before sending anything with `telemetry preview`.

- **Consent** is stored locally and starts off. `telemetry on` flips it on and
  generates a stable anonymous id (UUID v4) the first time; `telemetry off` keeps
  the id so opting back in resumes the same identity.
- **Kill switch:** `APOS_TELEMETRY=0` disables telemetry entirely, regardless of
  stored consent.

### Payload

Exactly one event is emitted per install attempt: `install_success` or
`install_fail`. The payload is built from a closed allowlist - it is structurally
impossible to attach anything outside it (no email, paths, project name, db URI,
or env).

Both events carry:

- **`event`** - `install_success` or `install_fail`.
- **`cliVersion`** - version of the installer.
- **`kitId`** - the starter kit chosen (e.g. `apostrophe-demo`).
- **`dbChoice`** - `sqlite`, `mongodb`, or `postgres`.
- **`packageManager`** - `npm`, `pnpm`, `yarn`, or `unknown` (detected).
- **`durationMs`** - how long the attempt took.
- **`anonymousId`** - UUID v4, present only once you've opted in.

`install_fail` additionally carries:

- **`failStage`** - which stage failed (see below), or `null` for a preflight
  failure (Node / package-manager check, before any stage runs).
- **`errorCode`** - a symbolic code, present only when it's one of the known
  values below. Unknown codes are dropped, never raw error text.

### Fail stages

- **`clone`** - cloning the starter kit.
- **`scaffold`** - writing project identity, secrets, and `.env`.
- **`dependency_install`** - `npm install` (or pnpm/yarn).
- **`db_connect`** - connecting to / preparing the database.
- **`sample_data`** - downloading and importing demo content.
- **`admin`** - creating the admin user.
- **`unknown`** - unexpected error that didn't map to a stage.
- **`null`** - preflight, before any stage ran.

### Error codes

Grouped by the stage that emits them.

**Preflight**

- **`unsupported_pm`** - running under an unsupported package manager.

**clone**

- **`target_exists`** - the target directory already exists.
- **`git_missing`** - `git` isn't installed.
- **`git_spawn_failed`** - `git` failed to launch (not a missing binary).
- **`git_clone_failed`** - `git clone` exited non-zero.

**scaffold**

- **`missing_scaffold_file`** - the clone is missing `app.js` or `package.json`.
- **`scaffold_io`** - an I/O error while writing project files.

**dependency_install**

- **`npm_missing`** - the package manager binary isn't installed.
- **`npm_spawn_failed`** - the package manager failed to launch.
- **`install_failed`** - the install command exited non-zero.
- **`apostrophe_missing`** - apostrophe isn't in `node_modules` after install.

**db_connect**

- **`db_unreachable`** - the database server isn't reachable.
- **`db_auth_failed`** - authentication was rejected.
- **`db_connect_failed`** - some other connection error.
- **`db_drop_failed`** - failed to drop a pre-existing database.

**sample_data**

- **`seed_manifest_invalid`** - the sample-data manifest is malformed.
- **`seed_download_failed`** - downloading the seed archive failed.
- **`seed_checksum_failed`** - the seed archive failed its checksum.
- **`seed_unpack_failed`** - unpacking the seed archive failed.
- **`seed_clear_failed`** - clearing the database before import failed.
- **`seed_restore_failed`** - restoring the seed database failed.
- **`seed_uploads_failed`** - extracting seed uploads (images/attachments) failed.

**admin**

- **`node_missing`** - `node` isn't installed.
- **`node_spawn_failed`** - `node` failed to launch.
- **`admin_user_failed`** - creating the admin user failed.

### Starter-kit sample-data manifest

The `seed_*` codes above all come from the sample-data step, which runs only for
`*-demo-data` kits. By default it pulls a fixed pair of archives (a database dump
and an uploads bundle) baked into the installer. A kit can override that by
shipping a manifest at:

```
<project>/.apostrophe/sample-data.json
```

If present, the manifest **wholesale-replaces** the built-in defaults - it is not
merged. Its shape:

- **`db`** *(optional)* - the database dump archive (`.zip`).
- **`uploads`** *(optional)* - the uploads archive (`.zip`).

Each is an `{ url, sha256 }` pair:

- **`url`** - where to download the archive from.
- **`sha256`** - 64-char lowercase-hex checksum. Each archive is verified against
  it after download and before it's unpacked - a mismatch aborts
  (`seed_checksum_failed`) before anything touches your database or files.

At least one of `db` / `uploads` must be present. No manifest file → the built-in
defaults are used. A file that's unparseable, the wrong shape, or declares
neither asset is a kit misconfiguration and surfaces as `seed_manifest_invalid`.

```json
{
  "db": {
    "url": "https://static.apostrophecms.com/public-demo/starter-database.jsonl.zip",
    "sha256": "862fc4b380675e0eaade8447f6a137807ce54b54acbbee79636e581e0c5f29b1"
  },
  "uploads": {
    "url": "https://static.apostrophecms.com/public-demo/starter-uploads.zip",
    "sha256": "b1a70f3372f8c897fd934abbe711cc1a8b0aeaf7d38b165890dd96939ab62f58"
  }
}
```

## License

MIT
