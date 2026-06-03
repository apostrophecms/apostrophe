# Tech Design: Apostrophe-Astro Integration v2

**Status:** Draft
**Date:** 2026-06-02

---

## Background and Motivation

The `@apostrophecms/apostrophe-astro` integration currently relies on two Vite virtual modules to surface runtime configuration and doctype mappings to Astro components and helper code:

- `virtual:apostrophe-config`: exports resolved integration config, including host, prefix, header lists, and static build flags.
- `virtual:apostrophe-doctypes`: re-exports the user-supplied widgets and templates mapping modules, plus the optional `onBeforeWidgetRender` hook.

These virtual modules are implemented with Vite plugin `resolveId` and `load` hooks using the `\0`-prefixed internal module ID convention.

Vite virtual modules are a documented Vite plugin pattern, but this integration's current use is fragile in newer Astro/Vite versions because the generated modules are consumed across Astro's server, prerender, and client-oriented processing paths. Astro 6 uses Vite 7 and Vite's Environment API internally, which makes the old assumptions around one consistent module graph less reliable.

The goal of v2 is to remove these runtime virtual-module dependencies and use the same breaking release to define the package's public import surface clearly.

---

## v2 Scope

This release makes two coordinated breaking changes:

1. **Generated runtime files** replace the current Vite virtual modules. This is the Astro 6 compatibility fix.
2. **Public helper import paths** are formalized. Public helpers move behind stable helper entry points, while `lib/` becomes internal implementation.

These changes ship together in v2. There is no phased rollout. Starter kits and README examples should be updated in the same release window so project code moves to the final public import paths immediately.

---

## Problem: Why the Current Virtual Modules Break

### Astro now processes code through multiple Vite environments

Astro 6 runs on Vite 7 and uses Vite's Environment API internally. During dev and build, Astro code can be processed for different purposes: server rendering, prerendering, client output, and framework/runtime integration work.

The current integration assumes that an import of `virtual:apostrophe-config` or `virtual:apostrophe-doctypes` will always be resolved through the same plugin pipeline and with the same surrounding module graph. That assumption is now too weak. Helpers and internal library modules are server-only, while components and endpoints can be transformed in several Astro build contexts.

### The doctype virtual module is the riskiest part

`vite-plugin-apostrophe-doctype.js` currently calls `this.resolve()` inside its `load()` hook to resolve the user's `widgetsMapping`, `templatesMapping`, and optional `onBeforeWidgetRender` files. It then synthesizes a module that imports those resolved IDs.

That creates a fragile chain:

1. Resolve user mapping IDs during virtual module load.
2. Emit synthetic import statements from the virtual module.
3. Rely on those emitted imports resolving again in the environment that consumes the virtual module.

This is sensitive to when and where `load()` runs. Failures show up as missing `virtual:apostrophe-config` or `virtual:apostrophe-doctypes` modules, failed widget/template lookup, or helper code being unable to read integration config.

### The `\0` prefix is not the root bug

The `\0` prefix is still a normal Vite virtual-module convention. The issue is not that Vite has removed support for virtual modules. The issue is that this package is using virtual modules to carry generated integration state and resolved user imports across Astro/Vite environments where real files are a better fit.

---

## Implementation Area 1: Generated Runtime Files

### Core idea

Replace the virtual module plugins with generated real files:

1. During `astro:config:setup`, write generated runtime files under `node_modules/.apostrophe-astro-config`. ⚠️ **Needs follow-up before v2 ships**: verify behavior in multisite setups. In a monorepo with pnpm hoisting, multiple Astro projects could share a `node_modules` and write to the same path. Using `config.root` from the setup hook instead of `process.cwd()` may be sufficient, but the multisite scenario needs to be confirmed. If namespacing is required, a per-project subdirectory keyed on `config.root` is the likely approach.
2. Point internal imports at those files with Vite aliases.
3. Keep using Vite's resolver for user-supplied mapping paths so extensionless directories, project aliases, and package exports continue to work.

Real files on disk are easier for Vite, Astro, and Node to reason about than synthetic modules returned from `load()`. They are also directly inspectable when debugging a project.

### Generated file location

Files are written to a dedicated hidden directory:

```txt
node_modules/
  .apostrophe-astro-config/
    config.js
    doctypes.js
```

The static build cache in `lib/static.js` is also refactored in this release from `node_modules/.apostrophe-astro/` to `node_modules/.apostrophe-astro-static/`. This is a private internal change with no user-facing impact. It makes the naming convention consistent across all three directories and removes any risk of the static setup wipe accidentally deleting generated runtime files.

The three directories and their responsibilities:

- `node_modules/.apostrophe-astro-static/`: temporary static build cache owned by `lib/static.js`.
- `node_modules/.apostrophe-astro-config/`: generated runtime modules owned by the integration setup hook.

No `.gitignore` change is needed because both directories live under `node_modules/`.

### Generated file content

Each generated file includes a header:

```js
// AUTO-GENERATED by @apostrophecms/apostrophe-astro. Do not edit.
// This file is regenerated on every dev server start and build.
```

`config.js` serializes the resolved integration config as a static ES module export:

```js
export default {
  aposHost: "http://localhost:3000",
  aposPrefix: "",
  includeResponseHeaders: ["set-cookie"],
  excludeRequestHeaders: [],
  viewTransitionWorkaround: false,
  staticBuild: null
};
```

This is the same object currently produced by the `load()` handler of `vite-plugin-apostrophe-config.js`.

`doctypes.js` re-exports the user's mapping modules:

```js
import { default as widgets } from "../../src/widgets/index.js";
import { default as templates } from "../../src/templates/index.js";
import onBeforeWidgetRenderHookFn from "../../src/hooks/onBeforeWidgetRender.js";

export { widgets, templates };
export const onBeforeWidgetRenderHook = onBeforeWidgetRenderHookFn;
```

When no hook is provided, `onBeforeWidgetRenderHook` exports `undefined` as before.

### Resolving user mapping files

The rewrite must preserve the current behavior of `widgetsMapping`, `templatesMapping`, and `onBeforeWidgetRender`.

The README documents values like:

```js
widgetsMapping: './src/widgets',
templatesMapping: './src/templates',
onBeforeWidgetRender: './src/hooks/before-widget-render.js'
```

Those paths may be extensionless directories, explicit files, package subpaths, or project aliases. A simple `path.resolve(process.cwd(), mapping)` is not equivalent to the current behavior.

Implementation should resolve these mappings with a small internal Vite plugin that runs before normal module transformation. This preserves Vite/Rollup resolution behavior while removing the runtime virtual modules.

The integration's `astro:config:setup` hook should register a setup-only Vite plugin:

```js
function vitePluginApostropheGeneratedConfig(options, resolvedConfig) {
  return {
    name: 'vite-plugin-apostrophe-generated-config',
    enforce: 'pre',
    async buildStart() {
      const resolvedWidgets = await this.resolve(options.widgetsMapping);
      const resolvedTemplates = await this.resolve(options.templatesMapping);
      const resolvedHook = options.onBeforeWidgetRender
        ? await this.resolve(options.onBeforeWidgetRender)
        : null;

      await writeGeneratedRuntimeFiles({
        config: resolvedConfig,
        widgetsId: resolvedWidgets?.id,
        templatesId: resolvedTemplates?.id,
        hookId: resolvedHook?.id
      });
    }
  };
}
```

This plugin replaces the two existing virtual-module plugins. It does not return generated module source from `load()`. Its only job is to use Vite's resolver, then write real files under `node_modules/.apostrophe-astro-config/`.

The generated files are then consumed through aliases registered in the same `astro:config:setup` call. All paths are computed from `config.root` — the project root Astro is operating on — rather than `process.cwd()`. This keeps paths correct regardless of where `astro` is invoked from, and is portable across project renames and moves since the paths are recomputed fresh on every dev server start and build:

```js
const generatedDir = path.join(config.root, 'node_modules/.apostrophe-astro-config');

updateConfig({
  vite: {
    plugins: [
      vitePluginApostropheGeneratedConfig(options, resolvedConfig)
    ],
    resolve: {
      alias: {
        'apostrophe-astro-config/config': path.join(generatedDir, 'config.js'),
        'apostrophe-astro-config/doctypes': path.join(generatedDir, 'doctypes.js')
      }
    }
  }
});
```

The aliases point directly to the generated files. That keeps internal imports deterministic even though the files are generated during startup.

If Vite starts resolving internal imports before `buildStart()` writes the files in dev mode, the fix is not a simple move to `configResolved()`. The `configResolved()` hook does not provide `this.resolve()`, so extensionless directory paths, project aliases, and package subpaths in `widgetsMapping` and `templatesMapping` would not resolve correctly there. The likely solution is a `configureServer` hook for dev mode or an explicit two-pass approach. The implementation must verify timing across dev startup, SSR rendering, and static build startup, because the hook execution order differs between those paths.

If resolution fails, the integration should throw an error that names the specific option that failed, for example:

```txt
Could not resolve apostrophe-astro widgetsMapping: ./src/widgets
```

### Import specifiers

Internal imports are updated from virtual module specifiers to internal alias specifiers:

| Old | New |
| --- | --- |
| `virtual:apostrophe-config` | `apostrophe-astro-config/config` |
| `virtual:apostrophe-doctypes` | `apostrophe-astro-config/doctypes` |

These specifiers remain internal implementation details. They are not documented for project code.

All internal files that currently import `virtual:apostrophe-config` or `virtual:apostrophe-doctypes` are updated:

`apostrophe-astro-config/config`:

- `lib/aposRequest.js`
- `lib/aposResponse.js`
- `lib/aposPageFetch.js`
- `helpers/fetch.js`
- `helpers/url.js`
- `components/layouts/AposLayout.astro`
- `components/layouts/AposEditLayout.astro`

`apostrophe-astro-config/doctypes`:

- `components/AposWidget.astro`
- `components/AposTemplate.astro`
- `endpoints/renderWidget.astro`

### Hidden virtual import audit

The implementation must remove all internal imports of:

- `virtual:apostrophe-config`
- `virtual:apostrophe-doctypes`

Current known import sites are:

- `helpers/fetch.js`
- `helpers/url.js`
- `lib/aposPageFetch.js`
- `lib/aposRequest.js`
- `lib/aposResponse.js`
- `components/layouts/AposLayout.astro`
- `components/layouts/AposEditLayout.astro`
- `components/AposWidget.astro`
- `components/AposTemplate.astro`
- `endpoints/renderWidget.astro`

The implementation should also search for `virtual:` in the package before release to catch any hidden or newly introduced virtual imports.

### Tradeoffs

| | Virtual modules (current) | Generated runtime files (proposed) |
| --- | --- | --- |
| Astro 6 / Vite 7 environments | Fragile for this use case | Real files resolve consistently |
| Debuggability | Module content invisible on disk | Files inspectable in `node_modules/.apostrophe-astro-config/` |
| Static cache interaction | Not applicable | Kept separate; static cache refactored to `.apostrophe-astro-static/` |
| Complexity | Two virtual-module plugins with `resolveId`/`load` | File generation plus mapping resolution |
| Cold start | No disk I/O | Writes two small files at config time |

---

## Implementation Area 2: Public Helper Architecture

### Problem with the current state

The integration currently has no `package.json` exports map. Consumers can import any file path that happens to exist in the package, including internal `lib/` files. The README also documents at least one `lib/` import, `@apostrophecms/apostrophe-astro/lib/aposPageFetch.js`, so the current public surface is partly accidental and partly documented.

This v2 release should be the last breaking change around project helper imports. The package needs a clear rule:

- `helpers/` is public.
- `lib/` is internal.
- Helpers are separated into three explicit categories by import path: server-only, universal, and client-only.
- There is no top-level `helpers` barrel — consumers must choose the correct path deliberately.
- README examples and starter kits use only public helper paths.

### Public helper entry points

The package exports three helper entry points. There is no top-level `helpers` barrel — all imports must use an explicit path:

- `@apostrophecms/apostrophe-astro/helpers/server`: server-only helpers for Astro frontmatter, routes, endpoints, prerendering, and SSR. These import from generated config, `process.env`, or Node.js built-ins unavailable in browsers.
- `@apostrophecms/apostrophe-astro/helpers/universal`: helpers that work in both server and client contexts. These are pure functions with no environment dependencies.
- `@apostrophecms/apostrophe-astro/helpers/client`: browser-only helpers that depend on browser APIs such as `window` or `document`. Currently reserved — no helpers are in this category yet — but the path and taxonomy are established now for future use.

### Helper classification

Server-only public helpers:

| Export | Source | Reason |
| --- | --- | --- |
| `aposPageFetch` | `lib/aposPageFetch.js` | Fetches Apostrophe page data through server request/response helpers and generated config |
| `aposFetch` | `helpers/fetch.js` | Prepends backend host and reads generated config |
| `getAposHost` | `helpers/server-url.js` | Exposes backend host from generated config |
| `isStaticBuild` | `helpers/server-url.js` | Reads generated config |

Universal public helpers:

| Export | Source | Reason |
| --- | --- | --- |
| `buildPageUrl` | `helpers/universal/url.js` | Pure URL construction from provided Apostrophe data |
| `getFilterBaseUrl` | `helpers/universal/url.js` | Pure data inspection |
| `aposSetQueryParameter` | `helpers/universal/url.js` | Pure URL manipulation |
| `slugify` | `helpers/universal/slug.js` | Pure string utility |
| `stylesElements` | `helpers/universal/styles.js` | Pure widget data helper moved from `lib/aposStyles.js` |
| `stylesAttributes` | `helpers/universal/styles.js` | Pure widget data helper moved from `lib/aposStyles.js` |
| `getFocalPoint` | `helpers/universal/attachment.js` | Pure attachment data helper moved from `lib/attachment.js` |
| `getAttachmentUrl` | `helpers/universal/attachment.js` | Pure attachment data helper moved from `lib/attachment.js` |
| `getAttachmentSrcset` | `helpers/universal/attachment.js` | Pure attachment data helper moved from `lib/attachment.js` |
| `getWidth` | `helpers/universal/attachment.js` | Pure attachment data helper moved from `lib/attachment.js` |
| `getHeight` | `helpers/universal/attachment.js` | Pure attachment data helper moved from `lib/attachment.js` |

The `helpers/universal/index.js` barrel must not import any module that imports generated config. If `helpers/url.js` currently mixes server-only functions with pure URL functions, split it before wiring the universal barrel.

### Proposed helper files

The final helper structure uses folders with an `index.js` barrel per category. There is no top-level `helpers/index.js`:

```txt
helpers/
  server/
    index.js        # barrel: re-exports all server-only public helpers
    fetch.js        # aposFetch, aposPageFetch
    url.js          # getAposHost, isStaticBuild
  universal/
    index.js        # barrel: re-exports all universal public helpers
    url.js          # buildPageUrl, getFilterBaseUrl, aposSetQueryParameter
    slug.js         # slugify
    styles.js       # stylesElements, stylesAttributes (moved from lib/aposStyles.js)
    attachment.js   # getFocalPoint, getAttachmentUrl, etc. (moved from lib/attachment.js)
  client/
    index.js        # barrel: reserved for future browser-only helpers
```

### Package exports

The exports map is intentionally restrictive — it exposes only what is considered public API. If a consumer needs something that is not listed, the right response is to deliver it through a proper public path in a subsequent release, not to access private code directly. This makes future internal refactoring possible without BC concerns.

The map is a breaking change in the sense that any undocumented `lib/` imports in user projects will stop resolving. That is acceptable — those paths were never supported.

The exports map must preserve the documented root import and documented component/widget imports:

- `@apostrophecms/apostrophe-astro`
- `@apostrophecms/apostrophe-astro/helpers/server`
- `@apostrophecms/apostrophe-astro/helpers/universal`
- `@apostrophecms/apostrophe-astro/helpers/client`
- `@apostrophecms/apostrophe-astro/components/*`
- `@apostrophecms/apostrophe-astro/components/layouts/*`
- `@apostrophecms/apostrophe-astro/widgets/*`

The integration also injects endpoint entry points by package path, so those must remain resolvable:

- `@apostrophecms/apostrophe-astro/endpoints/aposProxy.js`
- `@apostrophecms/apostrophe-astro/endpoints/renderWidget.astro`

### Deprecated shims

The following `lib/` paths remain exported for backwards compatibility and receive JSDoc `@deprecated` notices pointing to `/helpers`:

- `@apostrophecms/apostrophe-astro/lib/aposPageFetch.js`
- `@apostrophecms/apostrophe-astro/lib/util`
- `@apostrophecms/apostrophe-astro/lib/util.js`
- `@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter`
- `@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter.js`

Projects should migrate these imports to `@apostrophecms/apostrophe-astro/helpers/server` or `@apostrophecms/apostrophe-astro/helpers/universal`, depending on the helper.

### Internal paths

Other `lib/` paths are internal and are not listed in the exports map:

- `lib/aposRequest.js`
- `lib/aposResponse.js`
- `lib/getAreaForApi.js`
- `lib/static.js`
- `lib/format.js`

Projects importing these directly will need to move to `/helpers/server` or `/helpers/universal` where a public equivalent exists.

`lib/aposStyles.js` and `lib/attachment.js` should be removed or reduced to temporary internal shims only if package internals still need them during the refactor. Their public implementations belong in `helpers/universal/styles.js` and `helpers/universal/attachment.js`.

### README and starter-kit updates

The README should explain the import contract and contribution rules directly:

- Use `@apostrophecms/apostrophe-astro/helpers/server` in Astro frontmatter, endpoints, and other server-only code.
- Use `@apostrophecms/apostrophe-astro/helpers/universal` for utilities that work in both server and client contexts.
- Use `@apostrophecms/apostrophe-astro/helpers/client` for browser-only utilities that depend on `window`, `document`, or other browser APIs.
- There is no top-level `helpers` import — always use the explicit category path.
- Avoid importing from `@apostrophecms/apostrophe-astro/lib/*`; `lib/` is internal.

The README must also document how to add a new helper so that developers and agents follow the same rules:

- Classify the helper: does it import generated config, use `process.env`, or use a Node.js built-in unavailable in browsers? If yes, it is server-only (`helpers/server/`). Does it use browser APIs like `window` or `document`? If yes, it is client-only (`helpers/client/`). Otherwise it is universal (`helpers/universal/`).
- Add the implementation file to the correct category folder.
- Add a complete JSDoc block (`@param`, `@returns`, `@example`).
- Re-export the helper from that category's `index.js` barrel.

Starter kits should be updated in the same release window so they no longer teach `lib/` imports.

### TypeScript support

All public helpers exported from `helpers/server/index.js`, `helpers/universal/index.js`, and `helpers/client/index.js` must have complete JSDoc annotations (`@param`, `@returns`, `@typedef` where needed). The package already uses JSDoc throughout — this extends that pattern consistently to the full public surface.

TypeScript declarations are generated from JSDoc using `tsc --declaration --allowJs --emitDeclarationOnly` and published with the package. The `package.json` `types` field points to the generated declarations. This gives TypeScript projects proper type checking and provides IntelliSense in VSCode for all projects regardless of whether they use TypeScript.

---

## Migration Path for Existing Projects

### Version bump

This change ships as **v2.0.0**.

Adding a `package.json` exports map is a breaking change because Node will reject imports of paths not listed in the map. A major version bump is required even if most projects do not need code changes.

### What most projects need to do

Most projects do not need to change integration configuration:

- `apostropheIntegration()` options stay the same.
- `widgetsMapping`, `templatesMapping`, and `onBeforeWidgetRender` keep the same semantics.
- Component import paths stay the same.
- Injected routes stay the same.

### Required and recommended changes

Projects importing documented legacy `lib/` paths should migrate to the explicit helper entry points:

```js
// Before
import aposPageFetch from '@apostrophecms/apostrophe-astro/lib/aposPageFetch.js';
import setParameter from '@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter.js';

// After
import { aposPageFetch } from '@apostrophecms/apostrophe-astro/helpers/server';
import { aposSetQueryParameter } from '@apostrophecms/apostrophe-astro/helpers/universal';
```

Projects importing directly from `lib/aposStyles.js` or `lib/attachment.js` should also move to `/helpers`:

```js
// Before
import { stylesAttributes } from '@apostrophecms/apostrophe-astro/lib/aposStyles.js';
import { getAttachmentUrl } from '@apostrophecms/apostrophe-astro/lib/attachment.js';

// After
import { stylesAttributes, getAttachmentUrl } from '@apostrophecms/apostrophe-astro/helpers/universal';
```

### Unsupported usage

Projects importing `virtual:apostrophe-config` or `virtual:apostrophe-doctypes` directly in their own Astro code were relying on private implementation details. Those imports are unsupported and must be removed.

The generated `apostrophe-astro-config/*` specifiers are also private implementation details and should not be documented as public API.

---

## Implementation Notes

- Write the generated runtime files before internal code that imports them is transformed.
- Ensure generated files are recreated on every dev server start and build.
- Refactor static build cache from `node_modules/.apostrophe-astro/` to `node_modules/.apostrophe-astro-static/` in `lib/static.js`.
- Implement helper entry points and package exports in the same v2 release as the generated runtime files.
- Update README examples and starter kits in the same release window.
- Produce a `MIGRATION.md` file in the repo as a required v2 deliverable. The Migration Path section of this document is its basis. It should cover: all required import path changes, deprecated shim guidance, unsupported usage removal, and a confirmation that integration options and component paths are unchanged.
- Add focused tests or example-build coverage for:
  - Astro 6 / Vite 7 dev startup.
  - Astro 6 / Vite 7 static build.
  - Extensionless directory mappings such as `./src/widgets`.
  - Explicit file mappings.
  - Missing mapping error messages.
  - Optional `onBeforeWidgetRender`.
- Ensure all public helpers have complete JSDoc before running declaration generation.
- Run `tsc --declaration --allowJs --emitDeclarationOnly` as part of the release process and include generated `.d.ts` files in the published package via the `package.json` `types` field.

---

## Main Risks

- Generated files may need to exist earlier than `buildStart()` in Astro dev mode.
- Splitting `helpers/url.js` may accidentally change public behavior if not tested carefully.
- Adding an exports map may block undocumented imports in user projects.

---


1. Is `buildStart()` the right Vite hook, or should this use `configResolved()` / another hook?
2. Are `helpers/server`, `helpers/client`, and `helpers` the right public import contract for v2?
3. Should any additional currently documented paths be included in the package exports map?
4. Should deprecated `lib/` shims remain for v2, or should v2 fully remove them?
5. Should any additional currently documented paths be included in the package exports map beyond those already listed?

## Resolved Design Decisions

- **`.gitignore`**: No special handling needed. Generated files live under `node_modules/`, which virtually all projects already ignore.
- **Generated file header**: Each generated file includes a header comment: `// AUTO-GENERATED by @apostrophecms/apostrophe-astro. Do not edit. This file is regenerated on every dev server start and build.`
- **Path computation**: All generated file paths and aliases are computed from `config.root`, not `process.cwd()`, ensuring portability across invocation contexts.
- **Static cache rename**: `lib/static.js` cache directory renamed from `node_modules/.apostrophe-astro/` to `node_modules/.apostrophe-astro-static/`. Internal change, no user impact.
- **TypeScript support**: Use complete JSDoc on all public helpers. Generate `.d.ts` via `tsc --declaration --allowJs --emitDeclarationOnly` and publish via `package.json` `types` field. Private generated module specifiers (`apostrophe-astro-config/config`, `apostrophe-astro-config/doctypes`) receive no published declarations as they are internal.
