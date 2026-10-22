/**
 * Override the static build cache directory.
 * Must be called by the Apostrophe integration before any static-build
 * functions are used. The integration sets this from `config.root` in its
 * `astro:config:setup` hook so that the cache always lands inside the
 * project's `node_modules`, regardless of where the Node process was started.
 *
 * @internal
 * @param {string} dir - Absolute cache directory path.
 */
export function setStaticCacheDir(dir: string): void;
/**
 * Persist static build configuration to the cache directory.
 * Cleans previous cache before writing. Called from the
 * integration's `astro:config:setup` hook.
 *
 * @param {object} staticBuild - Resolved static build config.
 */
export function writeConfigCache(staticBuild: object): Promise<void>;
/**
 * Fetch supported locales from the Apostrophe backend.
 *
 * @param {object} config
 * @param {string} config.aposHost - The Apostrophe backend URL.
 * @param {string} config.aposExternalFrontKey - The external front key.
 * @returns {Promise<Record<string, { label: string, prefix?: string, private?: boolean }>>}
 */
export function getLocales({ aposHost, aposExternalFrontKey }: {
    aposHost: string;
    aposExternalFrontKey: string;
}): Promise<Record<string, {
    label: string;
    prefix?: string;
    private?: boolean;
}>>;
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
 *   integration (resolved from `apostrophe-astro-config/config`).
 * @returns {Promise<{ paths: Array<{ params: { slug: string | undefined }, props: object }>, literalContent: Array<object>, attachments: object | null }>}
 */
export function getAllUrlMetadata(config: {
    aposHost: string;
    aposExternalFrontKey: string;
    locale?: string;
    staticBuild?: object;
}): Promise<{
    paths: Array<{
        params: {
            slug: string | undefined;
        };
        props: object;
    }>;
    literalContent: Array<object>;
    attachments: object | null;
}>;
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
 * Static build configuration is read from the cache written during
 * `astro:config:setup`.  Callers may override any value by passing
 * it explicitly in `config`.
 *
 * @param {object} config
 * @param {string} config.aposHost - The Apostrophe backend URL.
 * @param {string} config.aposExternalFrontKey - The external front key.
 * @returns {Promise<Array<{ params: { slug: string | undefined }, props: object }>>}
 */
export function getAllStaticPaths(config: {
    aposHost: string;
    aposExternalFrontKey: string;
}): Promise<Array<{
    params: {
        slug: string | undefined;
    };
    props: object;
}>>;
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
export function writeLiteralContent({ aposHost, aposExternalFrontKey, outDir, logger, aposPrefix }: {
    aposHost: string;
    aposExternalFrontKey: string;
    outDir: string;
    logger: any;
}): Promise<{
    written: number;
    warnings: number;
    errors: number;
}>;
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
export function writeAttachments({ aposHost, outDir, logger, aposPrefix, attachmentFilter }: {
    aposHost: string;
    outDir: string;
    logger: any;
}): Promise<{
    written: number;
    warnings: number;
    errors: number;
}>;
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
export function writePostBuildSummary({ literal, attachments, logger }: {
    literal: {
        written: number;
        warnings: number;
        errors: number;
    };
    attachments: {
        written: number;
        warnings: number;
        errors: number;
    };
    logger: any;
}): void;
export function cleanupCache(): Promise<void>;
