// Umami Cloud wiring. Centralized so flipping endpoints/keys is a
// one-file change reviewable on its own — and never spreads through callers.

export const TELEMETRY_ENDPOINT = 'https://cloud.umami.is';

export const TELEMETRY_WRITE_KEY = 'bdf673e4-10de-4cb5-a787-b76c6bda0f89';

// Umami drops events whose `hostname` doesn't match the website's configured
// domain. The CLI has no real domain, so we attach a fixed placeholder.
export const TELEMETRY_HOSTNAME = 'cli.apostrophecms.com';
