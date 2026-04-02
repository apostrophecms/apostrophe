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
      addUrls(req, files) {
        for (const file of files) {
          // Watch out for projections with no attachment property
          // (the slug-taken route does that)
          if (self.options.prettyUrls && file.attachment) {
            const { extension } = file.attachment;
            file._url = `${req.prefix}${self.options.prettyUrlDir}/${file.slug.replace(self.options.slugPrefix || '', '')}.${extension}`;
            file.attachment._prettyUrl = file._url;
          } else {
            file._url = self.apos.attachment.url(file.attachment);
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
            return await streamProxy(req, uglyUrl, { error: self.apos.util.error });
          } catch (e) {
            self.apos.util.error('Error in pretty URL route:', e);
            return res.status(500).send('error');
          }
        }
      }
    };
  }
};
