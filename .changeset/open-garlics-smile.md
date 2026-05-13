---
"apostrophe": patch
---

Security: a malicious full name containing HTML was executed as HTML in the tooltip displayed with an "i" icon next to the title of the current page, creating an
XSS attack risk versus other users. Since most projects permit users to change their full name (the "title" property), All projects with multiple users should be
updated promptly to close this vulnerability. Thanks to [Muhammad Uwais](https://github.com/MuhammadUwais) for reporting the issue.
