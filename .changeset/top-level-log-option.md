---
"apostrophe": minor
---

Added the top-level `log` option, configuring logging for the entire process from its first line, and routed every log entry through it. Note for custom loggers: the message no longer carries a `'<module>: <event-type>'` prefix - read the `module` and `type` fields instead.
