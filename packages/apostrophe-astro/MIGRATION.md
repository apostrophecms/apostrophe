# Migrating to @apostrophecms/apostrophe-astro v2

## Overview

v2 ships two coordinated breaking changes:

1. **Generated runtime files** replace Vite virtual modules for Astro 6 / Vite 7 compatibility.
2. **Public helper import paths** are formalized. `helpers/server`, `helpers/universal`, and `helpers/client` are the new stable entry points. `lib/` is now internal.

Most projects need only the import-path changes described below. Integration options, component paths, and injected routes are unchanged.

---

## What stays the same

- `apostropheIntegration()` options (`aposHost`, `widgetsMapping`, `templatesMapping`, `onBeforeWidgetRender`, `staticBuild`, etc.) are unchanged.
- Component import paths (`@apostrophecms/apostrophe-astro/components/*`, `.../components/layouts/*`, `.../widgets/*`) are unchanged.
- Injected routes (`/apos-frontend/[...slug]`, `/api/v1/[...slug]`, etc.) are unchanged.

---

## Required changes

### 1. Update `lib/aposPageFetch.js` imports

```js
// Before
import aposPageFetch from '@apostrophecms/apostrophe-astro/lib/aposPageFetch.js';

// After
import { aposPageFetch } from '@apostrophecms/apostrophe-astro/helpers/server';
```

### 2. Update `lib/aposSetQueryParameter.js` imports

```js
// Before
import setParameter from '@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter.js';
// or
import setParameter from '@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter';

// After
import { aposSetQueryParameter } from '@apostrophecms/apostrophe-astro/helpers/universal';
```

### 3. Update `lib/util` imports

```js
// Before
import { slugify } from '@apostrophecms/apostrophe-astro/lib/util';
// or
import { slugify } from '@apostrophecms/apostrophe-astro/lib/util.js';

// After
import { slugify } from '@apostrophecms/apostrophe-astro/helpers/universal';
```

### 4. Update `lib/static.js` imports

```js
// Before
import { getAllStaticPaths } from '@apostrophecms/apostrophe-astro/lib/static.js';

// After
import { getAllStaticPaths } from '@apostrophecms/apostrophe-astro/helpers/server';
```

### 5. Update `lib/aposStyles.js` and `lib/attachment.js` imports

These files are no longer part of the public API.

```js
// Before
import { stylesAttributes } from '@apostrophecms/apostrophe-astro/lib/aposStyles.js';
import { getAttachmentUrl } from '@apostrophecms/apostrophe-astro/lib/attachment.js';

// After
import { stylesAttributes, getAttachmentUrl } from '@apostrophecms/apostrophe-astro/helpers/universal';
```

---

## Deprecated shims (v2)

The following `lib/` paths remain exported in v2 as compatibility shims. They will log `@deprecated` JSDoc notices but continue to work. Migrate before v3.

| Old path | New path |
| --- | --- |
| `@apostrophecms/apostrophe-astro/lib/aposPageFetch.js` | `@apostrophecms/apostrophe-astro/helpers/server` |
| `@apostrophecms/apostrophe-astro/lib/static.js` | `@apostrophecms/apostrophe-astro/helpers/server` |
| `@apostrophecms/apostrophe-astro/lib/util` | `@apostrophecms/apostrophe-astro/helpers/universal` |
| `@apostrophecms/apostrophe-astro/lib/util.js` | `@apostrophecms/apostrophe-astro/helpers/universal` |
| `@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter` | `@apostrophecms/apostrophe-astro/helpers/universal` |
| `@apostrophecms/apostrophe-astro/lib/aposSetQueryParameter.js` | `@apostrophecms/apostrophe-astro/helpers/universal` |

---

## Unsupported usage that must be removed

### Virtual module imports

If your project imports `virtual:apostrophe-config` or `virtual:apostrophe-doctypes` directly, those imports are unsupported and must be removed. These were private implementation details and have been replaced by generated files that are not part of the public API.

### Unlisted `lib/` paths

Any import of a `lib/` path not listed in the deprecated shims table above (e.g. `lib/aposRequest.js`, `lib/aposResponse.js`, `lib/format.js`, `lib/static.js`) will fail under the v2 exports map. These are internal modules with no public equivalent. If you need functionality that was only accessible via an internal path, open an issue to discuss adding a proper public helper.

---

## Helper import contract

| Import path | Use in |
| --- | --- |
| `@apostrophecms/apostrophe-astro/helpers/server` | Astro frontmatter, server endpoints, SSR routes, prerendering. Depends on generated config and Node.js built-ins — do not use in client scripts. |
| `@apostrophecms/apostrophe-astro/helpers/universal` | Utilities that work in both server and client contexts. Pure functions only — no generated config, no `process.env`, no Node.js built-ins. |
| `@apostrophecms/apostrophe-astro/helpers/client` | Reserved for future browser-only helpers. Empty in v2. |

There is no top-level `helpers` barrel — always use one of the three explicit category paths.

---

## Static build cache directory

The static build cache has moved from `node_modules/.apostrophe-astro/` to `node_modules/.apostrophe-astro-static/`. Both directories live under `node_modules/` and require no `.gitignore` changes. This is an internal implementation detail with no user-facing impact.
