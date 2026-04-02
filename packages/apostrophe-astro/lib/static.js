import { writeFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { bgGreen, black, blue, dim, green, yellow, red, getTimeStat, timestamp } from './format.js';

const CACHE_DIR = join(process.cwd(), 'node_modules', '.apostrophe-astro');
const CONFIG_CACHE = join(CACHE_DIR, '_config.json');
const ATTACHMENTS_CACHE = join(CACHE_DIR, '_attachments.json');
// Maximum number of concurrent attachment file downloads.
const DOWNLOAD_CONCURRENCY = 5;

/**
 * Persist static build configuration to the cache directory.
 * Cleans previous cache before writing. Called from the
 * integration's `astro:config:setup` hook.
 *
 * @param {object} staticBuild - Resolved static build config.
 */
export async function writeConfigCache(staticBuild) {
  await rm(CACHE_DIR, { recursive: true, force: true }).catch(() => {});
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CONFIG_CACHE, JSON.stringify(staticBuild));
}

function authHeaders(key) {
  return {
    'x-requested-with': 'AposExternalFront',
    'apos-external-front-key': key,
    'x-apos-static-base-url': '1'
  };
}

/**
 * Fetch supported locales from the Apostrophe backend.
 *
 * @param {object} config
 * @param {string} config.aposHost - The Apostrophe backend URL.
 * @param {string} config.aposExternalFrontKey - The external front key.
 * @returns {Promise<Record<string, { label: string, prefix?: string, private?: boolean }>>}
 */
export async function getLocales({ aposHost, aposExternalFrontKey }) {
  if (!aposHost) {
    throw new Error('aposHost is required.');
  }
  if (!aposExternalFrontKey) {
    throw new Error('aposExternalFrontKey is required.');
  }
  const url = new URL(aposHost + '/api/v1/@apostrophecms/i18n/locales');
  const response = await fetch(url, {
    headers: authHeaders(aposExternalFrontKey)
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch locales from Apostrophe (${response.status}): ${await response.text()}`
    );
  }
  return response.json();
}

/**
 * Fetch URL metadata for a single locale from the Apostrophe backend.
 *
 * Returns an object with four properties:
 * - `paths`: entries for `getStaticPaths` (renderable HTML pages)
 * - `literalContent`: entries with a `contentType` (CSS, robots.txt, etc.)
 *   that must be written to disk separately.
 * - `attachments`: attachment metadata from the backend (when requested).
 *   Each entry has `_id` and `urls` (array of `{ size, path }`).
 *   Also includes `uploadsUrl` — the uploadfs base URL prefix.
 *   Entries for pretty-URL files additionally carry a `base` property
 *   that overrides `uploadsUrl` for those entries.
 *
 * Results are cached to the filesystem per locale so that the
 * `astro:build:done` hook can read literal content entries without
 * re-fetching.
 *
 * @param {object} config
 * @param {string} config.aposHost - The Apostrophe backend URL
 *   (e.g. `http://localhost:3000`).
 * @param {string} config.aposExternalFrontKey - The shared secret key
 *   used to authenticate with the Apostrophe external frontend API.
 * @param {string} [config.locale] - The locale to fetch metadata for.
 *   When omitted, the backend returns metadata for the default locale.
 * @param {object} [config.staticBuild] - Static build config from the
 *   integration (resolved from `virtual:apostrophe-config`).
 * @returns {Promise<{ paths: Array<{ params: { slug: string | undefined }, props: object }>, literalContent: Array<object>, attachments: object | null }>}
 */
export async function getAllUrlMetadata(config) {
  const { aposHost, aposExternalFrontKey, locale, staticBuild } = config;

  if (!aposHost) {
    throw new Error(
      'aposHost is required. Pass it in the config object or set the APOS_HOST environment variable.'
    );
  }
  if (!aposExternalFrontKey) {
    throw new Error(
      'aposExternalFrontKey is required. Pass it in the config object or set the APOS_EXTERNAL_FRONT_KEY environment variable.'
    );
  }

  const url = new URL(aposHost + '/api/v1/@apostrophecms/url');
  if (locale) {
    url.searchParams.set('aposLocale', locale);
  }
  url.searchParams.set('aposMode', 'published');

  // Append attachment query parameters when attachment copying is
  // enabled.  The backend will include attachment metadata in the
  // response alongside the URL results.
  const wantAttachments = staticBuild && staticBuild.attachments !== false;
  if (wantAttachments) {
    url.searchParams.set('attachments', '1');
    if (staticBuild.attachmentScope) {
      url.searchParams.set('attachmentScope', staticBuild.attachmentScope);
    }
    if (Array.isArray(staticBuild.attachmentSizes) && staticBuild.attachmentSizes.length) {
      url.searchParams.set('attachmentSizes', staticBuild.attachmentSizes.join(','));
    }
    if (Array.isArray(staticBuild.attachmentSkipSizes) && staticBuild.attachmentSkipSizes.length) {
      url.searchParams.set('attachmentSkipSizes', staticBuild.attachmentSkipSizes.join(','));
    }
  }

  const response = await fetch(url, {
    headers: authHeaders(aposExternalFrontKey)
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch URL metadata from Apostrophe (${response.status}): ${await response.text()}`
    );
  }

  const data = await response.json();
  const results = data.pages;

  // Separate literal content entries from renderable pages
  const pages = [];
  const literalContent = [];
  for (const entry of results) {
    if (entry.contentType) {
      literalContent.push(entry);
    } else {
      pages.push(entry);
    }
  }

  // The CMS returns page URLs that are already relative and
  // prefix-free (e.g. `/about-us`, `/fr/articles/page/2`).  Astro's
  // `base` config adds the prefix when generating output paths, so no
  // stripping is needed here — just convert to [...slug] params.
  const paths = pages.map((entry) => {
    const rawSlug = entry.url.replace(/^\//, '').replace(/\/+$/, '');
    const slug = rawSlug === '' ? undefined : rawSlug;

    return {
      params: { slug },
      props: entry
    };
  });

  // Cache literal content to the filesystem per locale so it can be
  // read by the `astro:build:done` hook without re-fetching.
  const cacheKey = locale || '_default';
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    join(CACHE_DIR, `${cacheKey}.json`),
    JSON.stringify({ locale: locale || null, literalContent })
  );

  return {
    paths,
    literalContent,
    attachments: data.attachments || null
  };
}

/**
 * Fetch URL metadata for all supported locales and return a combined
 * paths array suitable for Astro's `getStaticPaths`.
 *
 * This is the main entry point for static builds. It:
 * 1. Fetches the list of supported locales from Apostrophe
 * 2. Calls `getAllUrlMetadata` for each non-private locale
 * 3. Caches literal content per locale for the post-build hook
 * 4. Deduplicates attachment metadata across locales and caches it
 * 5. Returns a flat array of `{ params, props }` entries
 *
 * Static build configuration is read from `virtual:apostrophe-config`
 * (injected by the integration plugin).  Callers may override any
 * value by passing it explicitly in `config`.
 *
 * @param {object} config
 * @param {string} config.aposHost - The Apostrophe backend URL.
 * @param {string} config.aposExternalFrontKey - The external front key.
 * @returns {Promise<Array<{ params: { slug: string | undefined }, props: object }>>}
 */
export async function getAllStaticPaths(config) {
  const { aposHost, aposExternalFrontKey } = config;

  if (!aposHost) {
    throw new Error('aposHost is required.');
  }
  if (!aposExternalFrontKey) {
    throw new Error('aposExternalFrontKey is required.');
  }

  // Merge caller overrides with integration config
  // written to the cache directory during `astro:config:setup`.
  let integrationConfig;
  try {
    integrationConfig = JSON.parse(await readFile(CONFIG_CACHE, 'utf-8'));
  } catch {
    throw new Error(
      'Static build config cache not found. The Apostrophe integration must run its ' +
      '`astro:config:setup` hook before `getAllStaticPaths` is called.'
    );
  }
  const staticBuild = {
    ...integrationConfig,
    ...(config.staticBuild || {})
  };

  const locales = await getLocales({ aposHost, aposExternalFrontKey });
  const localeKeys = Object.keys(locales).filter((k) => !locales[k].private);

  const allPaths = [];
  // Deduplicate attachments across locales by _id.
  // Attachments are not localized — the same attachment record
  // will appear in every locale's response.  Entries for pretty-URL
  // files carry a `base` property that overrides `uploadsUrl`.
  const attachmentMap = new Map();
  let uploadsUrl = null;

  for (const locale of localeKeys) {
    const { paths, attachments } = await getAllUrlMetadata({
      aposHost,
      aposExternalFrontKey,
      locale,
      staticBuild
    });
    for (const path of paths) {
      allPaths.push(path);
    }

    if (attachments) {
      if (!uploadsUrl) {
        uploadsUrl = attachments.uploadsUrl;
      }
      for (const att of attachments.results) {
        if (!attachmentMap.has(att._id)) {
          attachmentMap.set(att._id, att);
        }
      }
    }
  }

  // Cache deduplicated attachment metadata for the post-build hook
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    ATTACHMENTS_CACHE,
    JSON.stringify({
      uploadsUrl,
      results: [ ...attachmentMap.values() ]
    })
  );

  return allPaths;
}

/**
 * Read cached literal content entries and write them to the build
 * output directory. Called from the integration's `astro:build:done`
 * hook.
 *
 * Literal content entries (CSS, robots.txt, etc.) have a `contentType`
 * and cannot be generated as Astro pages (which always produce HTML).
 * Duplicate URLs across locales are written only once.
 *
 * @param {object} options
 * @param {string} options.aposHost - The Apostrophe backend URL.
 * @param {string} options.aposExternalFrontKey - The external front key.
 * @param {string} options.outDir - The absolute path to the build output directory.
 * @param {import('astro').AstroIntegrationLogger} options.logger - Astro integration logger.
 */
export async function writeLiteralContent({ aposHost, aposExternalFrontKey, outDir, logger, aposPrefix = '' }) {
  const totalStart = performance.now();
  const stats = { written: 0, warnings: 0, errors: 0 };

  // Collect literal content from cached locale files, deduplicating
  // by URL so each file is written only once.
  // The cache is populated by `getAllStaticPaths` during the build —
  // if it's missing, the build pipeline is broken.
  const seen = new Set();
  const literalContent = [];
  let files;
  try {
    files = await readdir(CACHE_DIR);
  } catch {
    throw new Error(
      'Apostrophe static build cache not found. Ensure the `[...slug].astro` page calls ' +
      '`getAllStaticPaths()` during `getStaticPaths()`.'
    );
  }
  for (const file of files) {
    if (!file.endsWith('.json') || file.startsWith('_')) {
      continue;
    }
    const data = JSON.parse(
      await readFile(join(CACHE_DIR, file), 'utf-8')
    );
    for (const entry of (data.literalContent || [])) {
      if (!seen.has(entry.url)) {
        seen.add(entry.url);
        literalContent.push(entry);
      }
    }
  }

  if (!literalContent.length) {
    return stats;
  }

  // Green block header matching Astro's "generating static routes" style
  process.stdout.write(`${bgGreen(black(' generating literal content '))}\n`);
  process.stdout.write(`${timestamp()} ${green('▶')} ${blue('/')}\n`);

  for (let i = 0; i < literalContent.length; i++) {
    const entry = literalContent[i];
    const isLast = i === literalContent.length - 1;
    const branch = isLast ? '└─' : '├─';
    try {
      const timeStart = performance.now();
      // Literal content URLs are relative and prefix-free
      // (e.g. `/sitemap.xml`, `/api/v1/.../stylesheet/...`).
      // Prepend the Apostrophe prefix so the fetch hits the
      // correct backend route.
      const fetchUrl = new URL((aposPrefix || '') + entry.url, aposHost);
      const res = await fetch(fetchUrl, {
        headers: authHeaders(aposExternalFrontKey)
      });
      if (!res.ok) {
        const isError = res.status >= 500;
        if (isError) {
          stats.errors++;
        } else {
          stats.warnings++;
        }
        const color = isError ? red : yellow;
        process.stdout.write(
          `${timestamp()}   ${blue(branch)} ${dim(entry.url)} ${color(`${res.status} skipped`)}\n`
        );
        continue;
      }
      // Output path matches the prefix-free URL — the hosting
      // platform serves under the prefix path already.
      const urlPath = new URL(entry.url, 'http://localhost').pathname;
      const filePath = join(outDir, urlPath);
      await mkdir(dirname(filePath), { recursive: true });
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(filePath, buffer);
      const timeStat = getTimeStat(timeStart, performance.now());
      process.stdout.write(`${timestamp()}   ${blue(branch)} ${dim(urlPath)} ${dim(`(+${timeStat})`)}\n`);
      stats.written++;
    } catch (err) {
      stats.errors++;
      process.stdout.write(
        `${timestamp()}   ${blue(branch)} ${dim(entry.url)} ${red(`✗ ${err.message}`)}\n`
      );
    }
  }

  const totalTime = getTimeStat(totalStart, performance.now());
  process.stdout.write(`${timestamp()} ${green(`✓ ${stats.written} completed in ${totalTime}.`)}\n\n`);
  return stats;
}

/**
 * Read cached attachment metadata and download attachment files into
 * the build output directory. Called from the integration's
 * `astro:build:done` hook after `writeLiteralContent`.
 *
 * Attachments are not localized — the cache file contains a single
 * deduplicated set of attachments across all locales, written by
 * `getAllStaticPaths`.
 *
 * If `uploadsUrl` (from the backend's uploadfs configuration) is a
 * relative path (e.g. `/uploads`), it is prefixed with `aposHost` for
 * downloading.  If it is an absolute URL (e.g. a CDN), it is used
 * directly.
 *
 * Downloads are performed with controlled concurrency to avoid
 * overwhelming the server.
 *
 * @param {object} options
 * @param {string} options.aposHost - The Apostrophe backend URL.
 * @param {string} options.outDir - The absolute path to the build output directory.
 * @param {import('astro').AstroIntegrationLogger} options.logger - Astro integration logger.
 */
export async function writeAttachments({ aposHost, outDir, logger, aposPrefix = '', attachmentFilter = 'all' }) {
  const stats = { written: 0, warnings: 0, errors: 0 };
  let cache;
  try {
    cache = JSON.parse(await readFile(ATTACHMENTS_CACHE, 'utf-8'));
  } catch {
    throw new Error(
      'Apostrophe attachment cache not found. Ensure the `[...slug].astro` page calls ' +
      '`getAllStaticPaths()` during `getStaticPaths()`.'
    );
  }

  const { uploadsUrl, results } = cache;
  if (!results || !results.length) {
    return stats;
  }

  const totalStart = performance.now();

  // Flatten all attachment URLs into download tasks.
  // Each attachment entry may carry a `base` property (for pretty-URL
  // files) that overrides the global `uploadsUrl`.
  const downloads = [];
  for (const att of results) {
    // Apply attachment filter:
    // - 'prettyOnly': skip entries without a per-entry `base`
    //   (regular uploadfs attachments served by CDN)
    if (attachmentFilter === 'prettyOnly' && !att.base) {
      continue;
    }
    const entryBase = att.base || uploadsUrl;
    const isAbsolute = /^https?:\/\//i.test(entryBase);
    const dlBase = isAbsolute ? entryBase : aposHost + entryBase;
    // Strip the Apostrophe prefix from the output path — the hosting
    // platform already serves under the prefix path.
    let outPrefix = isAbsolute ? '' : entryBase;
    if (aposPrefix && outPrefix.startsWith(aposPrefix + '/')) {
      outPrefix = outPrefix.slice(aposPrefix.length);
    } else if (aposPrefix && outPrefix === aposPrefix) {
      outPrefix = '/';
    }
    for (const entry of att.urls) {
      downloads.push({
        path: entry.path,
        downloadBase: dlBase,
        outputPrefix: outPrefix
      });
    }
  }

  if (!downloads.length) {
    return stats;
  }

  process.stdout.write(`${bgGreen(black(' copying attachments '))}\n`);
  process.stdout.write(`${timestamp()} ${green('▶')} ${dim('/')}\n`);

  // Download in batches with controlled concurrency
  for (let i = 0; i < downloads.length; i += DOWNLOAD_CONCURRENCY) {
    const batch = downloads.slice(i, i + DOWNLOAD_CONCURRENCY);
    await Promise.all(batch.map(async (task) => {
      try {
        const timeStart = performance.now();
        const downloadUrl = task.downloadBase + task.path;
        const res = await fetch(downloadUrl);
        if (!res.ok) {
          const isError = res.status >= 500;
          if (isError) {
            stats.errors++;
          } else {
            stats.warnings++;
          }
          const color = isError ? red : yellow;
          const displayPath = task.outputPrefix + task.path;
          process.stdout.write(
            `${timestamp()}   ${blue('├─')} ${dim(displayPath)} ${color(`${res.status} skipped`)}\n`
          );
          return;
        }
        const outPath = join(outDir, task.outputPrefix, task.path);
        await mkdir(dirname(outPath), { recursive: true });
        const buffer = Buffer.from(await res.arrayBuffer());
        await writeFile(outPath, buffer);
        const timeStat = getTimeStat(timeStart, performance.now());
        stats.written++;
        const displayPath = task.outputPrefix + task.path;
        process.stdout.write(`${timestamp()}   ${blue('├─')} ${dim(displayPath)} ${dim(`(+${timeStat})`)}\n`);
      } catch (err) {
        stats.errors++;
        const displayPath = task.outputPrefix + task.path;
        process.stdout.write(
          `${timestamp()}   ${blue('├─')} ${dim(displayPath)} ${red(`✗ ${err.message}`)}\n`
        );
      }
    }));
  }

  process.stdout.write(`${timestamp()}   ${blue('└─')} ${dim('Done')}\n`);
  const totalTime = getTimeStat(totalStart, performance.now());
  process.stdout.write(`${timestamp()} ${green(`✓ ${stats.written} completed in ${totalTime}.`)}\n\n`);
  return stats;
}

/**
 * Write a combined post-build summary for literal content and
 * attachment downloads.  Uses warning-level output when only
 * client errors (4xx) occurred, and error-level output when
 * server errors (5xx) or exceptions were encountered.
 *
 * @param {object} options
 * @param {{ written: number, warnings: number, errors: number }} options.literal - Stats from writeLiteralContent.
 * @param {{ written: number, warnings: number, errors: number }} options.attachments - Stats from writeAttachments.
 * @param {import('astro').AstroIntegrationLogger} options.logger - Astro integration logger.
 */
export function writePostBuildSummary({ literal, attachments, logger }) {
  const totalWritten = literal.written + attachments.written;
  const totalWarnings = literal.warnings + attachments.warnings;
  const totalErrors = literal.errors + attachments.errors;

  const parts = [`${totalWritten} written`];
  if (totalWarnings) {
    parts.push(`${totalWarnings} skipped`);
  }
  if (totalErrors) {
    parts.push(`${totalErrors} failed`);
  }
  const message = `files and uploads: ${parts.join(', ')}`;

  if (totalErrors) {
    logger.error(message);
  } else if (totalWarnings) {
    logger.warn(message);
  } else {
    logger.info(message);
  }
}

export async function cleanupCache() {
  await rm(CACHE_DIR, { recursive: true, force: true }).catch(() => {});
}
