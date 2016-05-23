module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-file',
  label: 'File',
  alias: 'files',
  beforeConstruct: function(self, options) {
    options.addFields = options.addFields.concat([
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
  }
}
