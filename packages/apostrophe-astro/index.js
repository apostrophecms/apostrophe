import { vitePluginApostropheDoctype } from './vite/vite-plugin-apostrophe-doctype.js';
import { vitePluginApostropheConfig } from './vite/vite-plugin-apostrophe-config.js';
import { writeConfigCache, writeLiteralContent, writeAttachments, cleanupCache } from './lib/static.js';

// Parse a comma-separated env var into an array, or return undefined.
function csvEnv(name) {
  const val = process.env[name];
  if (!val) {
    return undefined;
  }
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * @typedef {object} StaticBuildOptions
 * @property {boolean} [attachments=true] - Whether to copy attachments
 *   into the static build output.  Falls back to `APOS_SKIP_ATTACHMENTS=1`
 *   env var (disables when set).
 * @property {string[]} [attachmentSizes] - Explicit image sizes to
 *   include (e.g. `['max', 'full']`).  Falls back to the
 *   `APOS_ATTACHMENT_SIZES` env var (comma-separated, e.g. `max,full`).
 * @property {string[]} [attachmentSkipSizes=['original']] - Image sizes
 *   to exclude.  Falls back to `APOS_ATTACHMENT_SKIP_SIZES` env var
 *   (comma-separated, e.g. `original,max`).
 * @property {'used'|'all'} [attachmentScope='used'] - `'used'` limits
 *   to attachments referenced by built pages; `'all'` includes every
 *   attachment in the database.  Falls back to `APOS_ATTACHMENT_SCOPE`.
 */

/**
 * @typedef {object} ApostropheIntegrationOptions
 * @property {string} aposHost - The Apostrophe backend URL
 *   (e.g. `http://localhost:3000`).  Can also be set via the
 *   `APOS_HOST` environment variable.
 * @property {string} widgetsMapping - Import path to the widgets
 *   mapping module (e.g. `'./src/widgets/index.js'`).
 * @property {string} templatesMapping - Import path to the templates
 *   mapping module (e.g. `'./src/templates/index.js'`).
 * @property {((widget: object) => object|void)} [onBeforeWidgetRender] -
 *   Optional callback invoked before each widget is rendered.
 * @property {string[]} [forwardHeaders] - Response headers to forward
 *   from the Apostrophe backend to the client.  Deprecated in favour
 *   of `includeResponseHeaders`.
 * @property {boolean} [viewTransitionWorkaround] - Enable the Astro
 *   view-transition workaround.
 * @property {string[]} [includeResponseHeaders] - Response headers to
 *   include when proxying Apostrophe responses.  Takes precedence
 *   over `forwardHeaders`.
 * @property {string[]} [excludeRequestHeaders] - Request headers to
 *   strip before forwarding to the Apostrophe backend.
 * @property {string[]} [proxyRoutes] - Additional route patterns to
 *   proxy to the Apostrophe backend in SSR mode.
 * @property {StaticBuildOptions} [staticBuild] - Options controlling
 *   static build behaviour (attachments, sizes, scope).
 */

/**
 * Apostrophe integration for Astro.
 *
 * @param {ApostropheIntegrationOptions} options
 * @returns {import('astro').AstroIntegration}
 */
export default function apostropheIntegration(options) {
  let isStaticBuild = false;
  return {
    name: 'apostrophe-integration',
    hooks: {
      "astro:config:setup": async ({ config, injectRoute, updateConfig, injectScript }) => {
        isStaticBuild = config.output === 'static';
        if (!options.widgetsMapping || !options.templatesMapping) {
          throw new Error('Missing required options')
        }

        // Resolve static build configuration.
        // User config takes precedence over environment variables.
        // Env vars serve as fallback for zero-config CI setups.
        const userStatic = options.staticBuild || {};
        const staticBuild = {
          attachments: userStatic.attachments
            ?? (process.env.APOS_SKIP_ATTACHMENTS === '1' ? false : true),
          attachmentSizes: userStatic.attachmentSizes
            || csvEnv('APOS_ATTACHMENT_SIZES'),
          attachmentSkipSizes: userStatic.attachmentSkipSizes
            || csvEnv('APOS_ATTACHMENT_SKIP_SIZES')
            || [ 'original' ],
          attachmentScope: userStatic.attachmentScope
            || process.env.APOS_ATTACHMENT_SCOPE
            || 'used'
        };

        // Persist static build config so `lib/static.js` can read
        // it without depending on the Vite virtual module (which
        // is unavailable at config load time).
        if (isStaticBuild) {
          await writeConfigCache(staticBuild);
        }

        updateConfig({
          vite: {
            plugins: [
              vitePluginApostropheDoctype(
                options.widgetsMapping,
                options.templatesMapping,
                options.onBeforeWidgetRender
              ),
              vitePluginApostropheConfig(
                options.aposHost,
                options.forwardHeaders,
                options.viewTransitionWorkaround,
                options.includeResponseHeaders,
                options.excludeRequestHeaders,
                isStaticBuild ? staticBuild : undefined
              ),
            ],
          },
        });
        // Proxy routes are only needed for SSR — in static mode all data
        // is fetched at build time via getStaticPaths / aposPageFetch.
        if (isStaticBuild) {
          return;
        }
        const inject = [
          '/apos-frontend/[...slug]',
          '/api/v1/[...slug]',
          '/[locale]/api/v1/[...slug]',
          '/login',
          '/[locale]/login',
          '/uploads/[...slug]',
          ...(options.proxyRoutes || [])
        ];
        for (const pattern of inject) {
          // duplication of entrypoint needed for Astro 3.x support per
          // https://docs.astro.build/en/guides/upgrade-to/v4/#renamed-entrypoint-integrations-api
          injectRoute({
            pattern,
            entryPoint: '@apostrophecms/apostrophe-astro/endpoints/aposProxy.js',
            entrypoint: '@apostrophecms/apostrophe-astro/endpoints/aposProxy.js'
          });
        }
        // Different pattern from the rest
        injectRoute({
          pattern: '/[locale]/api/v1/@apostrophecms/area/render-widget',
          entryPoint: '@apostrophecms/apostrophe-astro/endpoints/renderWidget.astro',
          entrypoint: '@apostrophecms/apostrophe-astro/endpoints/renderWidget.astro'
        });
        injectRoute({
          pattern: '/api/v1/@apostrophecms/area/render-widget',
          entryPoint: '@apostrophecms/apostrophe-astro/endpoints/renderWidget.astro',
          entrypoint: '@apostrophecms/apostrophe-astro/endpoints/renderWidget.astro'
        });
      },
      // Write literal content entries (CSS, robots.txt, etc.) and
      // attachment files to the build output directory.
      "astro:build:done": async ({ dir, logger }) => {
        if (!isStaticBuild) {
          return;
        }
        const aposHost = process.env.APOS_HOST || options.aposHost;
        const aposExternalFrontKey = process.env.APOS_EXTERNAL_FRONT_KEY;
        if (!aposHost || !aposExternalFrontKey) {
          return;
        }
        try {
          await writeLiteralContent({
            aposHost,
            aposExternalFrontKey,
            outDir: dir.pathname,
            logger
          });
          await writeAttachments({
            aposHost,
            outDir: dir.pathname,
            logger
          });
        } finally {
          await cleanupCache();
        }
      }
    }
  };
};
