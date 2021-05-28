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
    quickCreate: false,
    insertViaUpload: true,
    slugPrefix: 'file-',
    autopublish: true,
    editRole: 'editor',
    publishRole: 'editor',
    showPermissions: true
  },
  fields: {
    remove: [ 'visibility' ],
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
          'title',
          'attachment',
          'description',
          'credit',
          'creditUrl'
        ]
      },
      utility: {
        label: 'Utility',
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
  handlers(self) {
    return {
      addUrls: {
        addAttachmentUrls(req, files) {
          for (const file of files) {
            file._url = self.apos.attachment.url(file.attachment);
          }
        }
      }
    };
  }
};
