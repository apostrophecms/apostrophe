---
"apostrophe": patch
---

Security: the color field accepted any value that merely contained a valid `rgb()`, `hsl()` or similar color, so extra content before or after the color was stored as-is. When such a color is used by a widget style field rendered inline (no `selector`), that content reached the wrapper's `style` attribute and could inject HTML attributes into the published page. The whole value must now be a valid color, otherwise it is discarded like any other invalid color. Legitimate values (hex, named colors, `transparent`, `rgb()`/`rgba()`/`hsl()`/`hsla()` notations, CSS variable names) are stored unchanged. Exploitation requires permission to edit content using a color field (CWE-20, CWE-79, GHSA-vmgj-9cwm-cf3h).

Thanks to [N.HARSHA VARDHAN](https://github.com/saiharsha0546-dot) for reporting the vulnerability.
