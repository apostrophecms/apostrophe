let _ = require('lodash');

// A subclass of `@apostrophecms/piece-type`, `@apostrophecms/files` establishes a library
// of uploaded files, which may be of any type acceptable to the
// [@apostrophecms/attachments](../@apostrophecms/attachments/index.html) module.
// Together with [@apostrophecms/files-widgets](../@apostrophecms/files-widgets/index.html),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    name: '@apostrophecms/file',
    label: 'File',
    alias: 'file',
    insertViaUpload: true
  },
  beforeSuperClass(self, options) {
    options.addFields = [
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        prefix: 'file',
        required: true
      },
      {
        type: 'attachment',
        name: 'attachment',
        label: 'File',
        required: true
      },
      {
        type: 'string',
        name: 'description',
        label: 'Description',
        textarea: true
      },
      {
        type: 'string',
        name: 'credit',
        label: 'Credit'
      },
      {
        type: 'url',
        name: 'creditUrl',
        label: 'Credit URL'
      },
      {
        type: 'joinByArray',
        name: '_tags',
        label: 'Tags',
        withType: '@apostrophecms/files-tags'
      }
    ].concat(options.addFields || []);
    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [
          'attachment',
          'title',
          'slug',
          'published',
          '_tags'
        ]
      },
      {
        name: 'info',
        label: 'Info',
        fields: [
          'description',
          'credit',
          'creditUrl'
        ]
      }
    ].concat(options.arrangeFields || []);
  },
  methods(self, options) {
    return {
      addUrls(req, files) {
        _.each(files, function (file) {
          file._url = self.apos.attachments.url(file.attachment);
        });
      }
    };
  }
};
