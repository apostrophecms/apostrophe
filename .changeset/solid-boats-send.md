---
"apostrophe": patch
---

Security: the HTML import feature of the rich text widget no longer permits images to be fetched
from arbitrary hosts. This could be used to probe internal networks, and to exfiltrate images from
internal hosts if their URLs were known. Instead, the `imageImportAllowedHostnames` option of the
`@apostrophecms/rich-text-widget` must be configured to opt into that feature.

Thanks to [Yiğit Şengezer](https://github.com/yigitsengezer) and [Sainithin0309](https://github.com/Sainithin0309) for reporting this issue.
