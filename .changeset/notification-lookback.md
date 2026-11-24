---
"apostrophe": patch
---

Notifications and browser bus events are no longer lost when several processes write them at the same moment. Each poll now also reads a short time below the newest notification the browser tab has received (the new `lookback` option of `@apostrophecms/notification`, 2 seconds by default), and the browser tab tells the server what it already holds in that range so nothing is sent twice. That list travels on the poll's query string. As a safety measure, when a burst makes it long the same poll is sent as a POST with the query in its body, so it is never refused for its length.
