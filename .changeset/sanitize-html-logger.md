---
"sanitize-html": minor
---

Added a `logger` option: pass any console-shaped object, with `debug`, `info`, `warn` and `error` methods, and sanitize-html's own diagnostics are delivered to it rather than to the console, so an application with a logging pipeline of its own can route them. Missing methods, and no option at all, fall back to the console. Those messages also lost their decorative line breaks and warning icon, so each is now a single line of text; their wording is otherwise unchanged.
