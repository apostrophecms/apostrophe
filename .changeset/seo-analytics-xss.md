---
"@apostrophecms/seo": patch
---

Security: the Google Analytics tracking ID (`seoGoogleTrackingId`) and Google Tag Manager ID (`seoGoogleTagManager`) global SEO fields were interpolated directly into the bodies of inline `<script>` tags without escaping. Any user permitted to edit the global document, including editors and contributors (if their submission were approved), could set these fields to a value that broke out of the surrounding script and executed arbitrary JavaScript for every visitor on every page (stored XSS). These values are now emitted as escaped `json` nodes, matching the JSON-LD handling, so they can no longer terminate the `<script>` element or escape the string literal they sit in. All projects using `@apostrophecms/seo` with untrusted editors should upgrade promptly to close this vulnerability. Thanks to [H3xV0rT3x](https://github.com/H3xV0rT3x) and [hibrian827](https://github.com/hibrian827) for reporting the issue.
