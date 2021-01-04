// A subclass of `apostrophe-pieces`, `apostrophe-images` establishes a library
// of uploaded images in formats suitable for use on the web.
//
// Together with [apostrophe-images-widgets](/reference/modules/apostrophe-images-widgets),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.
//
// Each `apostrophe-image` doc has an `attachment` schema field, implemented
// by the [apostrophe-attachments](/reference/modules/apostrophe-attachments) module.

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

    const fileImages = self.apos.attachments.fileGroups
      .find((group) => group.name === 'images');

    self.addFilters = [
      {
        name: 'fileType',
        choices: fileImages.extensions.map((ext) => ({
          value: ext,
          label: ext.charAt(0).toUpperCase() + ext.slice(1)
        })),
        def: null
      }
    ];

    // self.addFilters = [
    //   {
    //     name: 'mediaSources',
    //     choices: [
    //       {
    //         label: 'toto',
    //         value: 'tta'
    //       },
    //       {
    //         label: 'tutu',
    //         value: 'ttaaa'
    //       }
    //     ],
    //     def: null
    //   }
    // ];

    // self.on('apostrophe:modulesReady', 'getMediaSourcesModules', () => {
    //   const mediaSourcesOptions = Object.values(self.apos.modules)
    //     .reduce((mediaSources, {options: moduleOptions}) => {
    //       if (!moduleOptions.mediaSourceConnector) {
    //         return mediaSources;
    //       }

    //       const mediaSourceName = moduleOptions.name.replace('apostrophe-media-sources-', '');

    //       return [
    //         ...mediaSources,
    //         {
    //           value: moduleOptions.name,
    //           label: mediaSourceName.charAt(0).toUpperCase() + mediaSourceName.slice(1)
    //         }
    //       ];
    //     }, [{value: 'apostrophe', label: 'Apostrophe'}]);

    //   if (mediaSourcesOptions.length > 1) {
    //     self.addFilters = [
    //       {
    //         name: 'mediaSources',
    //         choices: mediaSourcesOptions,
    //         def: null
    //       }
    //     ];
    //   }
    // });

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
