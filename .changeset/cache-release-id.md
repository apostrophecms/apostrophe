---
"apostrophe": patch
---

Faster pages in production when the release id comes from the `release-id` file, the release directory or git rather than an environment variable. The release id was looked up again for every asset URL a page rendered, which for git meant running `git rev-parse` each time: most of the time spent on each page of a site that calls `apos.asset.url()` in its templates. It is now looked up once. `APOS_RELEASE_ID`, `HEROKU_RELEASE_VERSION` and `PLATFORM_TREE_ID` are still read every time and still take precedence.
