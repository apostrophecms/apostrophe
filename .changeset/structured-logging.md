---
"apostrophe": minor
---

Logging is now fully structured. Every diagnostic Apostrophe emits - boot and cluster notices, fatal startup errors, deprecations, runtime error catches and long-running tasks, which report a start, periodic progress and a summary instead of a line per item - is a typed event rather than a raw `console` call. Program output such as task help, listings and reports is unchanged.

- The new top-level `log` option configures logging for the whole process from its first line, with `format`, a custom `logger`, `messageAs` and `filter`. When present it is the entire configuration and the legacy `@apostrophecms/log` and `@apostrophecms/util` options are ignored, with a startup warning listing them.
- `format` defaults to `auto`: colorized pretty output in development, one JSON object per line in production. `format: 'legacy'` pins the output shape of earlier releases. `APOS_LOG_FORMAT`, `APOS_FILTER_LOGS`, `NO_COLOR` and `FORCE_COLOR` set or override this per process.
- The moment the site starts listening is the `apos-listening` event, drawn as a startup banner in development and kept by the default filter in production.
- `require('apostrophe/logger')` is the same logger as a standalone factory, usable before or entirely without an `apos` object.
- Libraries that have no `apos` object, including uploadfs, express-cache-on-demand and sanitize-html, receive a logger from Apostrophe and join the pipeline.
- For custom loggers, the message no longer carries the `'<module>: <event-type>'` prefix - read the `module` and `type` fields instead. `apos.util.warnDev` no longer prefixes a warning icon, since the renderer marks severity.
- An event's `stack` is the error's own stack string, no longer an array of trimmed lines with the first one dropped. The human formats indent it below the entry, and it stays a single escaped string in structured mode.
