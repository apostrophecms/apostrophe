---
"sanitize-html": patch
---

Remove the `deepmerge` dependency, which was used only to combine tag-specific and `*` (all tags) entries in `allowedClasses` and `allowedStyles`. That is now done by a few lines of code within sanitize-html.

This is not a fix for a vulnerability in sanitize-html. Security scanners such as Snyk now report [CVE-2026-93753](https://security.snyk.io/vuln/SNYK-JS-DEEPMERGE-19964053) in `deepmerge`, which can affect applications that merge untrusted objects, such as parsed JSON request bodies. sanitize-html only ever merged the developer's own configuration, never anything taken from the HTML being sanitized, so it was not exploitable through sanitize-html. Since we needed only a small part of what `deepmerge` does, we removed the dependency so that these reports no longer appear for sanitize-html users.
