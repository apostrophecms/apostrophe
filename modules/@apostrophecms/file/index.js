const _ = require('lodash');

// A subclass of `@apostrophecms/piece-type`, `@apostrophecms/file` establishes a library
// of uploaded files, which may be of any type acceptable to the
// [@apostrophecms/attachment](../@apostrophecms/attachment/index.html) module.
// Together with [@apostrophecms/file-widget](../@apostrophecms/file-widget/index.html),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.

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
    editRole: 'editor',
    publishRole: 'editor',
    showPermissions: true,
    // Files should by default be considered "related documents" when localizing
    // another document that references them
    relatedDocument: true,
    relationshipSuggestionIcon: 'file-document-icon'
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
    remove: [ 'visibility' ]
  },
  methods(self) {
    return {
      addUrls(req, files) {
        _.each(files, function (file) {
          file._url = self.apos.attachment.url(file.attachment);
        });
      }
    };
  }
};
