// A subclass of `@apostrophecms/piece-type`, `@apostrophecms/file` establishes
// a library of uploaded files, which may be of any type acceptable to the
// [@apostrophecms/attachment](../@apostrophecms/attachment/index.html) module.
// Together with
// [@apostrophecms/file-widget](../@apostrophecms/file-widget/index.html), this
// module provides a simple way to add downloadable PDFs and the like to a
// website, and to manage a library of them for reuse.

const streamProxy = require('../../../lib/stream-proxy.js');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    name: '@apostrophecms/file',
    label: 'apostrophe:file',
    pluralLabel: 'apostrophe:files',
    alias: 'file',
    quickCreate: false,
    insertViaUpload: true,
    slugPrefix: 'file-',
    autopublish: true,
    versions: true,
    editRole: 'editor',
    publishRole: 'editor',
    showPermissions: true,
    // Files should by default be considered "related documents" when localizing
    // another document that references them
    relatedDocument: true,
    relationshipSuggestionIcon: 'file-document-icon',
    prettyUrls: false,
    prettyUrlDir: '/files'
  },
  fields: {
    remove: [ 'visibility' ],
    add: {
      slug: {
        type: 'slug',
        label: 'apostrophe:slug',
        prefix: 'file',
        required: true,
        following: [ 'title', 'archived' ]
      },
      attachment: {
        type: 'attachment',
        label: 'apostrophe:file',
        required: true
      },
      description: {
        type: 'string',
        label: 'apostrophe:description',
        textarea: true
      },
      credit: {
        type: 'string',
        label: 'apostrophe:credit'
      },
      creditUrl: {
        type: 'url',
        label: 'apostrophe:creditUrl'
      },
      _tags: {
        type: 'relationship',
        label: 'apostrophe:tags',
        withType: '@apostrophecms/file-tag'
      }
    },
    group: {
      basics: {
        label: 'apostrophe:basics',
        fields: [
          'title',
          'attachment',
          'description',
          'credit',
          'creditUrl'
        ]
      },
      utility: {
        label: 'apostrophe:utility',
        fields: [
          'slug',
          '_tags'
        ]
      }
    }
  },
  filters: {
    remove: [ 'visibility' ],
    add: {
      _tags: {
        label: 'apostrophe:tags'
      }
    }
  },
  methods(self) {
    return {
      // File docs are attachment containers themselves — their
      // attachments are discovered via relationship walking from
      // the content docs that reference them.  Iterating all
      // published files here would make the "used" scope
      // equivalent to "all", defeating scoped attachment builds.
      async getAllUrlMetadata() {
        return {
          metadata: [],
          attachmentDocIds: []
        };
      },
      // Returns the pretty URL base path (e.g. `/files`) when
      // pretty URLs are enabled, or `null` otherwise.
      // The returned path is prefix-qualified. If `options.relative`
      // is true, the path is relative (no origin).
      getPrettyUrlBase(req, { relative = false } = {}) {
        if (!self.options.prettyUrls) {
          return null;
        }
        const base = relative
          ? self.apos.url.getBaseUrl(req, {
            relative: true,
            localePrefix: true
          })
          : req.prefix;
        return `${base}${self.options.prettyUrlDir}`;
      },
      // Returns the pretty-URL path component for a file doc.
      // E.g. `/my-document.pdf` — just the filename portion,
      // without any base, prefix, or origin.
      // Returns `null` when pretty URLs are disabled or the
      // doc has no attachment.  Works with any object that has
      // `slug` and `attachment.extension` (including the
      // lightweight projections used by `applyPrettyUrlPaths`).
      getPrettyPath(doc) {
        if (!self.options.prettyUrls || !doc.attachment) {
          return null;
        }
        const slug = doc.slug.replace(self.options.slugPrefix || '', '');
        return `/${slug}.${doc.attachment.extension}`;
      },
      // When `options.relative` is true, pretty URLs are built
      // with only the prefix + prettyUrlDir (no origin).
      addUrls(req, files, { relative = false } = {}) {
        const prettyBase = self.getPrettyUrlBase(req, { relative });
        for (const file of files) {
          const prettyPath = self.getPrettyPath(file);
          if (prettyBase && prettyPath) {
            file._url = `${prettyBase}${prettyPath}`;
            file.attachment._prettyUrl = file._url;
          } else if (file.attachment) {
            file._url = self.apos.attachment.url(file.attachment);
          }
        }
      },
      // Mutates `attachmentMeta.results` in-place, replacing
      // uploadfs paths with pretty URL paths for file pieces
      // that have pretty URLs enabled.  Adds a `base` property
      // to each affected entry so the consumer can override the
      // global `uploadsUrl` for those entries.
      //
      // Uses a lightweight direct DB query (no builders) to
      // find file docs by attachment ID.  Returns nothing —
      // the mutation is performed on the input object.
      //
      // Does nothing when pretty URLs are disabled.
      // For the shape of the `attachmentMeta` object, see the
      // `@apostrophecms/url:getAllAttachmentMetadata` method documentation.
      async applyPrettyUrlPaths(req, attachmentMeta) {
        if (!self.options.prettyUrls || !attachmentMeta?.results?.length) {
          return;
        }

        const base = self.getPrettyUrlBase(req, { relative: true });
        const batchSize = 100;

        for (let i = 0; i < attachmentMeta.results.length; i += batchSize) {
          const batch = attachmentMeta.results.slice(i, i + batchSize);
          const batchIds = batch.map(a => a._id);

          // Lightweight direct query — no builders, no relationship
          // resolution.  Only needs slug and attachment ID/extension.
          const fileDocs = await self.apos.doc.db.find({
            type: self.options.name,
            'attachment._id': { $in: batchIds },
            aposLocale: `${req.locale}:${req.mode}`,
            archived: { $ne: true }
          }, {
            projection: {
              slug: 1,
              'attachment._id': 1,
              'attachment.extension': 1
            }
          }).toArray();

          if (!fileDocs.length) {
            continue;
          }

          const byAttId = new Map();
          for (const entry of batch) {
            byAttId.set(entry._id, entry);
          }

          for (const doc of fileDocs) {
            const entry = byAttId.get(doc.attachment._id);
            if (!entry) {
              continue;
            }
            const prettyPath = self.getPrettyPath(doc);
            if (!prettyPath) {
              continue;
            }
            entry.urls = [ { path: prettyPath } ];
            entry.base = base;
          }
        }
      }
    };
  },
  routes(self) {
    if (!self.options.prettyUrls) {
      return;
    }
    return {
      get: {
        async [`${self.options.prettyUrlDir}/*`](req, res) {
          try {
            const matches = (req.params[0] || '').match(/^([^.]+)\.\w+$/);
            if (!matches) {
              return res.status(400).send('invalid');
            }
            const [ , slug ] = matches;
            if (slug.includes('..') || slug.includes('/')) {
              return res.status(403).send('forbidden');
            }
            const file = await self.find(req, {
              slug: `${self.options.slugPrefix}${slug}`
            }).toObject();
            if (!file) {
              return res.status(404).send('not found');
            }

            // Determine the normal, "ugly" URL and stream the
            // response from it, passing on the most important
            // headers. Supporting range requests, which PDF viewers
            // like to use for pagination, was considered but
            // the potential interacts with gzip encoding are complex
            // and we currently do use it by default with s3 for PDFs.
            // Viewers will still display the document after
            // completing the download
            const uglyUrl = self.apos.attachment.url(file.attachment, {
              prettyUrl: false
            });
            // For relative URLs (local uploadfs, not CDN), resolve
            // against the current server's origin so the proxy can
            // make the self-request.  During static builds
            // `attachment.url()` may return only a path.
            const proxyUrl = uglyUrl.startsWith('/')
              ? `${req.protocol}://${req.get('host')}${uglyUrl}`
              : uglyUrl;
            return await streamProxy(req, proxyUrl, { error: self.apos.util.error });
          } catch (e) {
            self.apos.util.error('Error in pretty URL route:', e);
            return res.status(500).send('error');
          }
        }
      }
    };
  }
};
