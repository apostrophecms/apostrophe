---
"apostrophe": patch
---

Fixed incorrect sizing and spacing across the admin UI in webpack builds. A byte order mark preserved by PostCSS 8.5.24 invalidated the stylesheet rule setting `box-sizing` for `.apos-` elements. Sass is now compiled with `charset: false` in webpack builds, so the marker is never emitted. Vite builds were unaffected.
