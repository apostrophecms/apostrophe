import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Resolve bare imports that Vite could not resolve from the dependencies of
 * the package the importing file belongs to.
 *
 * UI source is copied to `apos-build/.../src` and built from there, so a bare
 * import like `vue` is looked up from the project root. That only works when
 * the package manager hoists Apostrophe's dependencies to the project's
 * `node_modules` (npm does, pnpm does not). `resolve.dedupe` (`vue`, set by
 * `@vitejs/plugin-vue`) has the same effect for every importer, including
 * files inside other packages.
 *
 * This is a normal-phase plugin, so it runs after Vite's own resolver and
 * only sees imports that Vite could not resolve. Projects that build today
 * are not affected.
 *
 * `getSearchDirs(file)` returns the (real) directories to resolve from for an
 * importing file, most specific first: for copied UI source, the directory of
 * the original file; otherwise the file's own directory. Then Apostrophe
 * core, then this package.
 *
 * Returns two plugins, see also `realStorePaths()`.
 *
 * @param {{ getSearchDirs: (file: string) => string[] }} options
 * @returns {import('vite').Plugin[]}
 */
export default function VitePluginAposDeps({ getSearchDirs } = {}) {
  return [
    realStorePaths(),
    resolveFromOwner({ getSearchDirs })
  ];
}

/**
 * Give each package in the pnpm store a single module id.
 *
 * pnpm links a package's dependencies next to it with symlinks, one per
 * dependent package. With `resolve.preserveSymlinks` (which our base config
 * needs for `npm link`-ed modules) Vite keeps those symlinked paths as ids,
 * so a package used by several others (`@tiptap/core`, `prosemirror-model`)
 * is bundled once per dependent. Besides the size, that breaks code relying
 * on a single instance.
 *
 * For imports from a file in the store (`node_modules/.pnpm/`), this resolves
 * to the real path instead. With npm, or with pnpm hoisting to the project's
 * `node_modules`, no importer is in the store, so nothing changes.
 *
 * @returns {import('vite').Plugin}
 */
export function realStorePaths() {
  return {
    name: 'vite-plugin-apostrophe-deps:real-store-paths',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (
        !importer ||
        source.startsWith('\0') ||
        !isInPnpmStore(importer)
      ) {
        return null;
      }
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true
      });
      if (!resolved || resolved.external) {
        return resolved;
      }
      const [ file, ...query ] = resolved.id.split('?');
      if (!path.isAbsolute(file)) {
        return resolved;
      }
      const real = realpath(file);
      if (real === toPosix(file)) {
        return resolved;
      }
      return {
        ...resolved,
        id: [ real, ...query ].join('?')
      };
    }
  };
}

/**
 * The fallback resolver itself, see the default export.
 *
 * @param {{ getSearchDirs: (file: string) => string[] }} options
 * @returns {import('vite').Plugin}
 */
export function resolveFromOwner({ getSearchDirs } = {}) {
  if (typeof getSearchDirs !== 'function') {
    throw new Error('[vite-plugin-apostrophe-deps] `getSearchDirs` option is required.');
  }
  const ctx = {
    getSearchDirs,
    dedupe: new Set(),
    packageDirCache: new Map()
  };
  let resolvedConfig;

  return {
    name: 'vite-plugin-apostrophe-deps',

    // Dev dependency pre-bundling (esbuild) and Sass do not run Vite
    // plugins for this, so they get their own hooks.
    config() {
      const importers = [ sassImporter(ctx) ];
      return {
        optimizeDeps: {
          esbuildOptions: {
            plugins: [ optimizerPlugin(ctx, () => resolvedConfig) ]
          }
        },
        css: {
          preprocessorOptions: {
            scss: { importers },
            sass: { importers }
          }
        }
      };
    },

    configResolved(config) {
      resolvedConfig = config;
      ctx.dedupe = new Set(config.resolve?.dedupe ?? []);
    },

    async resolveId(source, importer, options) {
      if (!importer || importer.startsWith('\0')) {
        return null;
      }
      const name = getPackageName(source);
      if (!name) {
        return null;
      }
      const file = importer.split('?')[0];
      if (!path.isAbsolute(file)) {
        return null;
      }
      const resolveOptions = {
        ...options,
        skipSelf: true
      };
      // `null` lets Vite report its usual error.
      return resolveFromOwners(
        source,
        name,
        file,
        ctx,
        (id, from) => this.resolve(id, from, resolveOptions)
      );
    }
  };
}

/**
 * esbuild plugin for Vite's dev dependency pre-bundling, which resolves
 * imports between dependencies with Vite's internal resolver only. Same jobs
 * as the two Vite plugins, for that step: resolve imports Node could not
 * find from the importer, and use real paths for imports from the pnpm
 * store. Leaves everything else to Vite.
 *
 * @param {object} ctx shared state, see `resolveFromOwner()`
 * @param {() => import('vite').ResolvedConfig} getConfig
 * @returns {import('esbuild').Plugin}
 */
function optimizerPlugin(ctx, getConfig) {
  return {
    name: 'vite-plugin-apostrophe-deps',
    setup(build) {
      // Vite also passes these plugins to its dependency scan. Stay out of
      // it: the scan resolves through the Vite plugins (which handle the
      // fallback), and answering here would hide imports from it, so they
      // would not be pre-bundled.
      const isPreBundle = build.initialOptions.plugins
        ?.some((plugin) => plugin.name === 'vite:dep-pre-bundle');
      if (!isPreBundle) {
        return;
      }
      const config = getConfig();
      const exclude = config.optimizeDeps?.exclude ?? [];
      const resolvers = {
        esm: config.createResolver({
          asSrc: false,
          scan: true
        }),
        require: config.createResolver({
          asSrc: false,
          scan: true,
          isRequire: true
        })
      };
      const nodeLookupCache = new Map();

      // Same filter as Vite's own bare import handler.
      build.onResolve({ filter: /^[\w@][^:]/ }, async ({
        path: source, importer, kind
      }) => {
        const name = getPackageName(source);
        if (
          !name ||
          !importer ||
          !path.isAbsolute(importer) ||
          // Assets, CSS etc. are externalized by Vite.
          !isScriptLike(source) ||
          exclude.some((id) => source === id || source.startsWith(`${id}/`))
        ) {
          return;
        }
        const inStore = isInPnpmStore(importer);
        if (
          !inStore &&
          walkPackageDir(name, path.dirname(importer), nodeLookupCache)
        ) {
          // Resolvable as usual (always the case with npm).
          return;
        }
        const resolver = kind.startsWith('require')
          ? resolvers.require
          : resolvers.esm;
        const tryResolve = (id, from) => resolver(id, from);
        const resolved = (inStore ? await tryResolve(source, importer) : null) ??
          await resolveFromOwners(source, name, importer, ctx, tryResolve);
        // Ids that are not plain files (e.g. browser externals) stay Vite's.
        if (!resolved || !path.isAbsolute(resolved)) {
          return;
        }
        return { path: realpath(resolved) };
      });
    }
  };
}

/**
 * Sass importer for `@use 'package'` / `@use 'package/path'` in stylesheets.
 * Sass only asks importers after its own lookup (relative to the importing
 * file) and Vite's (from the project root) have failed, so like the Vite
 * plugin this only sees imports that would not resolve otherwise.
 *
 * @param {object} ctx shared state, see `resolveFromOwner()`
 * @returns {{ findFileUrl: Function }} a Sass `FileImporter`
 */
function sassImporter(ctx) {
  return {
    findFileUrl(url, { containingUrl } = {}) {
      const name = getPackageName(url);
      if (!name || containingUrl?.protocol !== 'file:') {
        return null;
      }
      const file = fileURLToPath(containingUrl);
      for (const dir of ctx.getSearchDirs(file)) {
        const packageDir = findPackageDir(name, dir, ctx.packageDirCache);
        if (packageDir) {
          // Sass resolves partials, extensions and `_index` files itself.
          return pathToFileURL(
            path.join(packageDir, url.slice(name.length) || getSassEntry(packageDir))
          );
        }
      }
      return null;
    }
  };
}

// The stylesheet a package's root resolves to: its `sass` or `style` field,
// or the package folder (Sass then looks for `_index.scss` / `index.scss`).
function getSassEntry(packageDir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    const entry = [ pkg.sass, pkg.style ]
      .find((value) => typeof value === 'string' && /\.(s[ac]ss|css)$/.test(value));
    return entry ?? '';
  } catch (_) {
    return '';
  }
}

/**
 * Try to resolve `source` (package `name`) imported by `file` from each of
 * the search directories in turn. `tryResolve(id, importer)` is the
 * environment's resolver and returns a result or `null`/`undefined`.
 */
async function resolveFromOwners(source, name, file, ctx, tryResolve) {
  for (const dir of ctx.getSearchDirs(file)) {
    const packageDir = findPackageDir(name, dir, ctx.packageDirCache);
    if (!packageDir) {
      continue;
    }
    // Resolve the import as if from inside the package's own folder, which
    // honours its `exports` map and conditions.
    const resolved = await tryResolve(
      source,
      path.join(packageDir, 'package.json')
    );
    if (resolved) {
      return resolved;
    }
    // `resolve.dedupe` (e.g. `vue`, set by `@vitejs/plugin-vue`) always
    // resolves from the project root, so the lookup above fails for it.
    // Resolve the package folder by path instead. For a package root this
    // still reads `exports`; a subpath is resolved as a plain file path.
    if (ctx.dedupe.has(name)) {
      const byPath = await tryResolve(
        toPosix(packageDir) + source.slice(name.length),
        file
      );
      if (byPath) {
        return byPath;
      }
    }
  }
  return null;
}

/**
 * The package name of a bare import (`vue`, `@tiptap/core` from
 * `@tiptap/core/dist/x.js`), or `null` for anything that is not a bare
 * import: relative and absolute paths, `#` subpath imports, virtual modules,
 * `scheme:` ids (incl. Windows drive letters) and the `Modules/` alias.
 *
 * @param {string} source
 * @returns {string | null}
 */
export function getPackageName(source) {
  if (
    !source ||
    /^[./\\#\0]/.test(source) ||
    /^[a-zA-Z][\w+.-]*:/.test(source) ||
    source.startsWith('Modules/')
  ) {
    return null;
  }
  const parts = source.split('/');
  if (source.startsWith('@')) {
    return parts.length > 1 && parts[0].length > 1 && parts[1]
      ? `${parts[0]}/${parts[1]}`
      : null;
  }
  return parts[0] || null;
}

/**
 * Find the (real) folder of package `name` the way Node would from inside
 * `fromDir`: check `node_modules/<name>` in `fromDir` and each parent.
 * Starting from a package's real path under pnpm, this finds its
 * dependencies, which pnpm installs as siblings of the package.
 *
 * @param {string} name
 * @param {string} fromDir
 * @param {Map<string, string | null>} [cache]
 * @returns {string | null}
 */
export function findPackageDir(name, fromDir, cache) {
  // Real path, so every importer gets the same copy of the package
  // (`preserveSymlinks` would otherwise keep the symlinked path).
  const found = walkPackageDir(name, fromDir, cache);
  return found && realpath(found);
}

// Node's lookup of package `name` from `fromDir`, without following links.
function walkPackageDir(name, fromDir, cache) {
  const key = `${fromDir}\0${name}`;
  if (cache?.has(key)) {
    return cache.get(key);
  }
  let result = null;
  let dir = fromDir;
  while (true) {
    if (path.basename(dir) !== 'node_modules') {
      const candidate = path.join(dir, 'node_modules', name);
      if (fs.existsSync(path.join(candidate, 'package.json'))) {
        result = candidate;
        break;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  cache?.set(key, result);
  return result;
}

// Bare imports without an extension, or with a script one.
function isScriptLike(source) {
  const last = source.slice(source.lastIndexOf('/') + 1);
  const ext = /\.([a-z0-9]+)(\?.*)?$/i.exec(last)?.[1];
  return !ext || /^[cm]?[jt]sx?$/i.test(ext);
}

function realpath(p) {
  try {
    return toPosix(fs.realpathSync(p));
  } catch (_) {
    return p;
  }
}

function isInPnpmStore(id) {
  return toPosix(id).includes('/node_modules/.pnpm/');
}

function toPosix(p) {
  return p.replaceAll('\\', '/');
}
