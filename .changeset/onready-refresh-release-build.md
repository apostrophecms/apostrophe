---
"apostrophe": patch
---

Fix `apos.util.onReady` not running again after an editor refresh in release builds, when the project `ui/src` bundle runs before the admin UI bundle creates `apos.bus`. Thanks to [Michael Lip](https://github.com/theluckystrike).
