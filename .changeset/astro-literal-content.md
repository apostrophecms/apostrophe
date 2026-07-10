---
"@apostrophecms/apostrophe-astro": minor
---

In SSR mode, the integration now automatically serves *literal content* files declared by Apostrophe modules - such as `robots.txt`, `sitemap.xml`, and `llms.txt` - by proxying them directly to Apostrophe instead of rendering them as pages. These files no longer need to be listed individually in the `proxyRoutes` option, which continues to work as before for any additional routes you wish to proxy.
