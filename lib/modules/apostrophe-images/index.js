// A subclass of `apostrophe-pieces`, `apostrophe-images` establishes a library
// of uploaded images in formats suitable for use on the web.
//
// Together with [apostrophe-images-widgets](/reference/modules/apostrophe-images-widgets),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.
//
// Each `apostrophe-image` doc has an `attachment` schema field, implemented
// by the [apostrophe-attachments](/reference/modules/apostrophe-attachments) module.
//
// ::: warning NOTE
// By default, `apostrophe-images-widgets` take the `title` field of the image piece to fill
// the `<img>` alt attribute.
//
// We recommend that new projects use the `enableAltField: true` option on the `apostrophe-images` module,
// in order to add a new `alt` field to images. It will then be used in alt attributes:
//
// ```javascript
//   // app.js
//   modules: {
//     'apostrophe-images': {
//       enableAltField: true
//     },
//   }
// ```
// This flag is now enabled by default in `apostrophe-boilerplate` for new projects.
// :::

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-image',
  slugPrefix: 'image-',
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
      },
      {
        name: 'camera',
        label: 'Camera Model',
        type: 'string'
      },
      {
        name: 'captureDate',
        label: 'Capture Date',
        type: 'string'
      }
    ].concat(options.addFields || []);

    const basicArrangeFields = [
      'attachment',
      'title',
      'slug',
      'published',
      'tags'
    ];

    if (options.enableAltField) {
      options.addFields.push({
        type: 'string',
        name: 'alt',
        label: 'Alt Text',
        help: 'Image description used for accessibility'
      });

      basicArrangeFields.splice(2, 0, 'alt');
    }

    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: basicArrangeFields
      },
      {
        name: 'info',
        label: 'Info',
        fields: [
          'description',
          'credit',
          'creditUrl',
          'camera',
          'captureDate'
        ]
      }
    ].concat(options.arrangeFields || []);

    options.addFilters = [
      {
        name: 'orientation',
        choices: [
          {
            value: 'landscape',
            label: 'Lansdscape'
          },
          {
            value: 'portrait',
            label: 'Portrait'
          },
          {
            value: 'square',
            label: 'Square'
          }
        ],
        def: null
      }
    ].concat(options.addFilters || []);

  },
  construct: function(self, options) {

    if (!options.enableAltField) {
      self.apos.utils.warnDev('⚠️  We recommend that you add enableAltField: true in apostrophe-images options to use a new alt text field on images. See https://docs.apostrophecms.org/reference/modules/apostrophe-images/#apostrophe-images');
    }

    const fileImages = self.apos.attachments.fileGroups
      .find((group) => group.name === 'images');

    options.addFilters = [
      ...options.addFilters || [],
      {
        name: 'fileType',
        choices: fileImages.extensions.map((ext) => ({
          value: ext,
          label: ext.charAt(0).toUpperCase() + ext.slice(1)
        })),
        def: null
      }
    ];

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
