var _ = require('@sailshq/lodash');

// A subclass of `apostrophe-pieces`, `apostrophe-files` establishes a library
// of uploaded files, which may be of any type acceptable to the
// [apostrophe-attachments](https://docs.apostrophecms.org/apostrophe/modules/apostrophe-attachments) module.
// Together with [apostrophe-files-widgets](/modules/apostrophe-file-widgets),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-file',
  label: 'File',
  alias: 'files',
  slugPrefix: 'file-',
  insertViaUpload: true,
  beforeConstruct: function(self, options) {
    options.addFields = [
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
          'tags'
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
  construct: function (self, options) {
    self.addUrls = function (req, files, callback) {
      _.each(files, function (file) {
        file._url = self.apos.attachments.url(file.attachment);
      });
      return callback(null);
    };
  }
};
