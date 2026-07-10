---
"apostrophe": minor
---

Added support for modules to declare *literal content* routes - URLs that serve non-page files such as `robots.txt`, `sitemap.xml`, or `llms.txt` rather than rendered pages. External front-end integrations (such as the Astro integration) can now read these routes and serve such files correctly instead of attempting to render them as pages. Custom modules can contribute their own routes by handling the new `@apostrophecms/url:getLiteralContentRoutes` event.
