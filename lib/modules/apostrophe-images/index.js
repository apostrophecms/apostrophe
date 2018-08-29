const _ = require('@sailshq/lodash');
// A subclass of `apostrophe-pieces`, `apostrophe-images` establishes a library
// of uploaded images in formats suitable for use on the web.
//
// Together with [apostrophe-images-widgets](../apostrophe-images-widgets/index.html),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.
//
// Each `apostrophe-image` doc has an `attachment` schema field, implemented
// by the [apostrophe-attachments](../apostrophe-attachments/index.html) module.

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-image',
  label: 'Image',
  alias: 'images',
  perPage: 20,
  manageViews: ['grid', 'list'],
  insertViaUpload: true,
  // Means not included in public sitewide search. -Tom
  searchable: false,
  beforeConstruct: function(self, options) {
    options.addFields = [
      {
        type: 'slug',
        name: 'slug',
        label: 'Slug',
        prefix: 'image',
        required: true
      },
      {
        type: 'attachment',
        name: 'attachment',
        label: 'Image File',
        fileGroup: 'images',
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
  construct: function(self, options) {
    const titleField = _.find(options.addFields, {name: 'title'});
    if (titleField) {
      titleField.help = 'This field is used for the default image widget\'s "alternative text," read by assistive devices.';
    }

    self.pushAsset('script', 'chooser', { when: 'user' });
    self.pushAsset('script', 'relationship-editor', { when: 'user' });
    self.pushAsset('script', 'manager-modal', { when: 'user' });
    self.pushAsset('script', 'editor-modal', { when: 'user' });
    self.pushAsset('script', 'focal-point-editor', { when: 'user' });
    self.pushAsset('stylesheet', 'user', { when: 'user' });
    require('./lib/api.js')(self, options);
    self.enableHelpers();
  }
};
