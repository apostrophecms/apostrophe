// A subclass of `apostrophe-pieces`, `apostrophe-files` establishes a library
// of uploaded files, which may be of any type acceptable to the
// [apostrophe-attachments](../apostrophe-attachments/index.html) module.
// Together with [apostrophe-files-widgets](../apostrophe-files-widgets/index.html),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-file',
  label: 'File',
  alias: 'files',
  insertViaUpload: true,
  beforeConstruct: function(self, options) {
    options.addFields = (options.addFields || []).concat([
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
    ]);
  },
  arrangeFields: [
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
  ],
}
