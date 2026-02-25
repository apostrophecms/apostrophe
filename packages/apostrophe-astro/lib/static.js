import { writeFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { bgGreen, black, blue, dim, green, getTimeStat, timestamp } from './format.js';

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
  const url = new URL('/api/v1/@apostrophecms/i18n/locales', aposHost);
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
 * Returns an object with three properties:
 * - `paths`: entries for `getStaticPaths` (renderable HTML pages)
 * - `literalContent`: entries with a `contentType` (CSS, robots.txt, etc.)
 *   that must be written to disk separately.
 * - `attachments`: attachment metadata from the backend (when requested).
 *   Each entry has `_id` and `urls` (array of `{ size, path }`).
 *   Also includes `uploadsUrl` — the uploadfs base URL prefix.
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

  const url = new URL('/api/v1/@apostrophecms/url', aposHost);
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

  const paths = pages.map((entry) => {
    // Strip leading and trailing slashes to match Astro's [...slug]
    // param format. The root "/" becomes `undefined` so Astro renders
    // the index page. Locale home pages like "/fr/" become "fr".
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
  // will appear in every locale's response.
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
export async function writeLiteralContent({ aposHost, aposExternalFrontKey, outDir, logger }) {
  const totalStart = performance.now();

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
    if (!file.endsWith('.json') || file === '_attachments.json' || file === '_config.json') {
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
    return;
  }

  // Green block header matching Astro's "generating static routes" style
  process.stdout.write(`${bgGreen(black(' generating literal content '))}\n`);
  process.stdout.write(`${timestamp()} ${green('▶')} ${blue('/')}\n`);

  let written = 0;
  for (let i = 0; i < literalContent.length; i++) {
    const entry = literalContent[i];
    const isLast = i === literalContent.length - 1;
    const branch = isLast ? '└─' : '├─';
    try {
      const timeStart = performance.now();
      const res = await fetch(new URL(entry.url, aposHost), {
        headers: authHeaders(aposExternalFrontKey)
      });
      if (!res.ok) {
        logger.warn(`Failed to fetch ${entry.url} (${res.status}), skipping`);
        continue;
      }
      // Determine output path from the URL, stripping query string
      const urlPath = new URL(entry.url, 'http://localhost').pathname;
      const filePath = join(outDir, urlPath);
      await mkdir(dirname(filePath), { recursive: true });
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(filePath, buffer);
      const timeStat = getTimeStat(timeStart, performance.now());
      process.stdout.write(`${timestamp()}   ${blue(branch)} ${dim(urlPath)} ${dim(`(+${timeStat})`)}\n`);
      written++;
    } catch (err) {
      logger.error(`Error writing ${entry.url}: ${err.message}`);
    }
  }

  const totalTime = getTimeStat(totalStart, performance.now());
  process.stdout.write(`${timestamp()} ${green(`✓ Completed in ${totalTime}.`)}\n\n`);
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
export async function writeAttachments({ aposHost, outDir, logger }) {
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
    return;
  }

  // Flatten all attachment URLs into a single list for downloading
  const downloads = [];
  for (const att of results) {
    for (const entry of att.urls) {
      downloads.push(entry.path);
    }
  }

  if (!downloads.length) {
    return;
  }

  // Resolve the base URL for downloading attachment files.
  // `uploadsUrl` may be a relative path (e.g. `/uploads`) or an
  // absolute URL (e.g. `https://cdn.example.com`).
  const isAbsoluteUploadsUrl = /^https?:\/\//i.test(uploadsUrl);
  const downloadBase = isAbsoluteUploadsUrl ? uploadsUrl : aposHost + uploadsUrl;

  // For the output path we need to replicate the same path structure
  // that HTML pages reference.  When `uploadsUrl` is a relative path
  // (e.g. `/uploads`), the page HTML has `src="/uploads/attachments/..."`.
  // So we write files to `outDir + uploadsUrl + path`.
  // When `uploadsUrl` is an absolute CDN URL the pages already point
  // to the CDN, but if the user still wants local copies we write
  // under `outDir + /attachments/...` (just the path portion).
  const outputPrefix = isAbsoluteUploadsUrl ? '' : uploadsUrl;

  const totalStart = performance.now();
  process.stdout.write(`${bgGreen(black(' copying attachments '))}\n`);
  process.stdout.write(`${timestamp()} ${green('▶')} ${dim(outputPrefix || '/')}\n`);

  let written = 0;
  let failed = 0;

  // Download in batches with controlled concurrency
  for (let i = 0; i < downloads.length; i += DOWNLOAD_CONCURRENCY) {
    const batch = downloads.slice(i, i + DOWNLOAD_CONCURRENCY);
    await Promise.all(batch.map(async (path) => {
      try {
        const timeStart = performance.now();
        const downloadUrl = downloadBase + path;
        const res = await fetch(downloadUrl);
        if (!res.ok) {
          logger.warn(`Failed to fetch attachment ${path} (${res.status}), skipping`);
          failed++;
          return;
        }
        // Write to the output directory preserving the URL path
        // structure so the file is served at the same path the
        // HTML pages reference.
        const outPath = join(outDir, outputPrefix, path);
        await mkdir(dirname(outPath), { recursive: true });
        const buffer = Buffer.from(await res.arrayBuffer());
        await writeFile(outPath, buffer);
        const timeStat = getTimeStat(timeStart, performance.now());
        written++;
        process.stdout.write(`${timestamp()}   ${blue('├─')} ${dim(path)} ${dim(`(+${timeStat})`)}\n`);
      } catch (err) {
        logger.error(`Error writing attachment ${path}: ${err.message}`);
        failed++;
      }
    }));
  }

  const totalTime = getTimeStat(totalStart, performance.now());
  const summary = failed
    ? `✓ ${written} written, ${failed} failed in ${totalTime}.`
    : `✓ ${written} files in ${totalTime}.`;
  process.stdout.write(`${timestamp()} ${green(summary)}\n\n`);
}

export async function cleanupCache() {
  await rm(CACHE_DIR, { recursive: true, force: true }).catch(() => {});
}
