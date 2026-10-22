/**
 * @typedef {object} StaticBuildOptions
 * @property {boolean} [attachments=true] - Whether to copy attachments
 *   into the static build output.  Overridden when `APOS_SKIP_ATTACHMENTS`
 *   env var is present (`1` disables, `0` enables).
 * @property {string[]} [attachmentSizes] - Explicit image sizes to
 *   include (e.g. `['max', 'full']`).  Overridden when the
 *   `APOS_ATTACHMENT_SIZES` env var is present (comma-separated,
 *   e.g. `max,full`).
 * @property {string[]} [attachmentSkipSizes=['original']] - Image sizes
 *   to exclude.  Overridden when `APOS_ATTACHMENT_SKIP_SIZES` env var
 *   is present (comma-separated, e.g. `original,max`).
 * @property {'all'|'prettyOnly'} [attachmentFilter='all'] - Controls
 *   which attachment types to include in the build output.
 *   `'all'` (default) writes both regular uploadfs attachments and
 *   pretty URL files.  `'prettyOnly'` skips regular uploadfs
 *   attachments (useful when those are served by a CDN) but still
 *   writes pretty URL files which are always backend-served.
 *   This option has no effect when `attachments` is `false`.
 *   Overridden when `APOS_ATTACHMENT_FILTER` env var is present.
 * @property {'used'|'all'} [attachmentScope='used'] - `'used'` limits
 *   to attachments referenced by built pages; `'all'` includes every
 *   attachment in the database.  Overridden when `APOS_ATTACHMENT_SCOPE`
 *   env var is present.
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
 * @property {string} [aposPrefix] - URL path prefix matching the
 *   Apostrophe backend `prefix` option (e.g. `'/my-repo'`).
 *   Auto-inferred from Astro's `base` config when omitted.
 *   Can also be set via the `APOS_PREFIX` environment variable.
 * @property {StaticBuildOptions} [staticBuild] - Options controlling
 *   static build behaviour (attachments, sizes, scope).
 */
/**
 * Apostrophe integration for Astro.
 *
 * @param {ApostropheIntegrationOptions} options
 * @returns {import('astro').AstroIntegration}
 */
export default function apostropheIntegration(options: ApostropheIntegrationOptions): any;
export type StaticBuildOptions = {
    /**
     * - Whether to copy attachments
     * into the static build output.  Overridden when `APOS_SKIP_ATTACHMENTS`
     * env var is present (`1` disables, `0` enables).
     */
    attachments?: boolean;
    /**
     * - Explicit image sizes to
     * include (e.g. `['max', 'full']`).  Overridden when the
     * `APOS_ATTACHMENT_SIZES` env var is present (comma-separated,
     * e.g. `max,full`).
     */
    attachmentSizes?: string[];
    /**
     * - Image sizes
     * to exclude.  Overridden when `APOS_ATTACHMENT_SKIP_SIZES` env var
     * is present (comma-separated, e.g. `original,max`).
     */
    attachmentSkipSizes?: string[];
    /**
     * - Controls
     * which attachment types to include in the build output.
     * `'all'` (default) writes both regular uploadfs attachments and
     * pretty URL files.  `'prettyOnly'` skips regular uploadfs
     * attachments (useful when those are served by a CDN) but still
     * writes pretty URL files which are always backend-served.
     * This option has no effect when `attachments` is `false`.
     * Overridden when `APOS_ATTACHMENT_FILTER` env var is present.
     */
    attachmentFilter?: "all" | "prettyOnly";
    /**
     * - `'used'` limits
     * to attachments referenced by built pages; `'all'` includes every
     * attachment in the database.  Overridden when `APOS_ATTACHMENT_SCOPE`
     * env var is present.
     */
    attachmentScope?: "used" | "all";
};
export type ApostropheIntegrationOptions = {
    /**
     * - The Apostrophe backend URL
     * (e.g. `http://localhost:3000`).  Can also be set via the
     * `APOS_HOST` environment variable.
     */
    aposHost: string;
    /**
     * - Import path to the widgets
     * mapping module (e.g. `'./src/widgets/index.js'`).
     */
    widgetsMapping: string;
    /**
     * - Import path to the templates
     * mapping module (e.g. `'./src/templates/index.js'`).
     */
    templatesMapping: string;
    /**
     * -
     * Optional callback invoked before each widget is rendered.
     */
    onBeforeWidgetRender?: ((widget: object) => object | void);
    /**
     * - Response headers to forward
     * from the Apostrophe backend to the client.  Deprecated in favour
     * of `includeResponseHeaders`.
     */
    forwardHeaders?: string[];
    /**
     * - Enable the Astro
     * view-transition workaround.
     */
    viewTransitionWorkaround?: boolean;
    /**
     * - Response headers to
     * include when proxying Apostrophe responses.  Takes precedence
     * over `forwardHeaders`.
     */
    includeResponseHeaders?: string[];
    /**
     * - Request headers to
     * strip before forwarding to the Apostrophe backend.
     */
    excludeRequestHeaders?: string[];
    /**
     * - Additional route patterns to
     * proxy to the Apostrophe backend in SSR mode.
     */
    proxyRoutes?: string[];
    /**
     * - URL path prefix matching the
     * Apostrophe backend `prefix` option (e.g. `'/my-repo'`).
     * Auto-inferred from Astro's `base` config when omitted.
     * Can also be set via the `APOS_PREFIX` environment variable.
     */
    aposPrefix?: string;
    /**
     * - Options controlling
     * static build behaviour (attachments, sizes, scope).
     */
    staticBuild?: StaticBuildOptions;
};
