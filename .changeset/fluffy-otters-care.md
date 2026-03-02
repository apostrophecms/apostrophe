---
"sanitize-html": patch
---

Upgrade `htmlparser2` from 8.x to 10.1.0. This improves security by correctly decoding zero-padded numeric character references (e.g., `&#0000001`) that previously bypassed `javascript:` URL detection. Also fixes double-encoding of entities inside raw text elements like `textarea` and `option`.
