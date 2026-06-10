// Live wire transport over `@umami/node`. The telemetry layer owns the
// consent gate, payload validation, timeout, and silence; this module only
// knows how to send one already-validated payload to a Umami instance.
//
// Keeping the `fetch`-touching code in its own file lets the existing test
// suite continue to inject its own `transport` without `@umami/node` ever
// running, and lets us mock global fetch in one focused test file.

import { Umami } from '@umami/node';

/** @typedef {import('./schema.js').TelemetryPayload} TelemetryPayload */
/** @typedef {import('./index.js').Transport}         Transport         */

/**
 * Build a {@link Transport} backed by a Umami client.
 *
 * @param {object} opts
 * @param {string} opts.endpoint  Umami host URL (e.g. `https://cloud.umami.is`).
 * @param {string} opts.writeKey  Umami website id.
 * @param {string} opts.hostname  Domain attached to every payload so Umami
 *                                accepts it (matches the website's configured
 *                                domain in the Cloud admin).
 * @returns {Transport}
 */
export function createUmamiTransport({
  endpoint, writeKey, hostname
}) {
  const client = new Umami({
    hostUrl: endpoint,
    websiteId: writeKey
  });
  return async (payload) => {
    const { event: name, ...data } = payload;
    const response = await client.track({
      name,
      hostname,
      data
    });
    if (response && response.ok === false) {
      throw new Error(`umami: HTTP ${response.status}`);
    }
  };
}
