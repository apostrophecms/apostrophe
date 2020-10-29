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
    label: 'File',
    alias: 'file',
    insertViaUpload: true,
    slugPrefix: 'file-'
  },
  fields: {
    add: {
      slug: {
        type: 'slug',
        label: 'Slug',
        prefix: 'file',
        required: true,
        following: 'title'
      },
      attachment: {
        type: 'attachment',
        label: 'File',
        required: true
      },
      description: {
        type: 'string',
        label: 'Description',
        textarea: true
      },
      credit: {
        type: 'string',
        label: 'Credit'
      },
      creditUrl: {
        type: 'url',
        label: 'Credit URL'
      },
      _tags: {
        type: 'relationship',
        label: 'Tags',
        withType: '@apostrophecms/file-tag'
      }
    },
    group: {
      basics: {
        label: 'Basics',
        fields: [
          'attachment',
          'title',
          'slug',
          '_tags'
        ]
      },
      details: {
        label: 'Details',
        fields: [
          'description',
          'credit',
          'creditUrl'
        ]
      }
    }
  },
  methods(self, options) {
    return {
      addUrls(req, files) {
        _.each(files, function (file) {
          file._url = self.apos.attachment.url(file.attachment);
        });
      }
    };
  }
};
