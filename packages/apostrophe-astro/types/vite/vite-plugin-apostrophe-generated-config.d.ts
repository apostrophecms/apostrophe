/**
 * Vite plugin that generates real runtime files to replace the two
 * old virtual-module plugins (`vite-plugin-apostrophe-config` and
 * `vite-plugin-apostrophe-doctype`).
 *
 * Files are written to `node_modules/.apostrophe-astro-config/` and
 * consumed through Vite aliases registered by the integration's
 * `astro:config:setup` hook.
 *
 * Timing strategy
 * ───────────────
 * • Dev mode  – `configureServer` returns a post-middleware hook that
 *   runs after Vite's plugin container is fully initialised but before
 *   any request is served, giving us access to `server.pluginContainer`
 *   for resolution.
 * • Build mode – `buildStart` has `this.resolve()` available and runs
 *   before any module transformation begins.
 *
 * A `filesWritten` flag prevents redundant disk writes if both hooks
 * happen to fire in the same process.
 *
 * @param {import('../index.js').ApostropheIntegrationOptions} options
 * @param {object} integrationConfig - Resolved integration config to serialise.
 * @param {string} projectRoot - Astro project root (`config.root`).
 * @returns {import('vite').Plugin}
 */
export function vitePluginApostropheGeneratedConfig(options: import("../index.js").ApostropheIntegrationOptions, integrationConfig: object, projectRoot: string): import("vite").Plugin;
