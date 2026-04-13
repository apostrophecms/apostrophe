---
"@apostrophecms/apostrophe-astro": minor
---

The `writeAttachments` step now supports per-entry base URL resolution, correctly downloading and writing pretty URL files to the appropriate output directory (e.g. `dist/files/`). A new `attachmentFilter` option ('all' or 'prettyOnly') lets you skip regular uploadfs attachments when those are served by a CDN, while still including backend-served pretty URL files in the static output. Configurable via the `staticBuild.attachmentFilter` integration option or the `APOS_ATTACHMENT_FILTER` environment variable.
