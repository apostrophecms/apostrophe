---
"apostrophe": patch
---

Security: changing the type of a page could reveal the stored values of fields the previous page type hid from the user with `viewPermission`, because responses are filtered with the schema of the new type. When a user changes a page's type through the REST API, fields that the old type hides from that user and the new type would not hide are now removed from the page. Only sites using `viewPermission` on page type fields are affected, and only users who can edit such pages could exploit it (CWE-200, CWE-863, GHSA-f74v-rxwx-7vv9).

Thanks to [leshipai](https://github.com/leshipai) for reporting the vulnerability.
