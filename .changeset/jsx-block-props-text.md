---
"apostrophe": patch
---

Security: when a JSX template extended a Nunjucks template with `<Extend>`, a prop that was a plain string was inserted into the matching block without escaping. JSX projects pass the page title to core's Nunjucks outer layout this way, so anyone able to edit a page or piece title could inject markup and script into that page. String props are now escaped like any other text, quotes included. Markup is still passed as a JSX element or fragment, or as a string marked with `apos.template.safe()`. A plain object is now written as HTML attributes with escaped values, for blocks inside a tag such as `extraHtml`: `extraHtml={{ 'data-theme': 'dark' }}`. If your project deliberately passes an HTML string to a block, wrap it with `apos.template.safe()` or use the object form. Projects without JSX templates were not affected (CWE-79, GHSA-ffmj-5cgg-p842).
