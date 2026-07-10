---
"sanitize-html": patch
---

Address a potential vulnerability when nonTextTags is configured in a nonstandard way. While it is never a good idea to remove known non-text tags from the standard list e.g. script, styles, etc., this change ensures that doing so does not result in nested tags being passed through without sanitization when they are not expressly allowed. (ApostropheCMS would never trigger this situation.) Thanks to [Dipanshu singh](https://github.com/Dipanshusinghh) for pointing out the issue and contributing the fix.
