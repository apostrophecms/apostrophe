---
"apostrophe": minor
---

Added `require('apostrophe/logger')`, a standalone logger factory that owns all log rendering. It is plain CommonJS with no dependencies and no framework initialization, so it can be used before - or entirely without - an `apos` object, which is what lets boot and cluster code, fatal startup errors and orchestration layers such as multisite emit the same output as the rest of Apostrophe.

Every call produces one envelope (`severity`, then `module`, `type` and `msg` when present, then the context and event data), and the configured `format` decides how it is drawn: `structured` for one JSON object per line, `pretty` for colorized development output, `plain` for the same layout without ANSI, or `auto` (the default). `APOS_LOG_FORMAT` overrides the option, in every logger instance in the process at once. Under `auto`, production output keeps the shape of previous releases in this release cycle; `format: 'structured'` is the explicit opt-in.

```js
const createLogger = require('apostrophe/logger');

const logger = createLogger({
  format: 'structured',
  context: { scope: 'multisite' }
});

logger.info('proxy-listening', { port });
logger.error('startup-failed', err.message, { stack: err.stack });
const siteLogger = logger.child({ site: 'site-a' });
```

A custom `logger` object (pino, winston, anything with `debug`, `info`, `warn` and `error` methods) bypasses the renderer entirely and receives the envelope. `child(context)` is our own facade rather than a backend capability: the same log methods closed over merged context, forwarding to the same destination, so backends that have no notion of child loggers behave identically.

Nothing in Apostrophe routes through it yet - existing logging behavior is unchanged.
