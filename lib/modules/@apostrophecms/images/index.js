let _ = require('lodash');
// A subclass of `@apostrophecms/piece-type`, `@apostrophecms/images` establishes a library
// of uploaded images in formats suitable for use on the web.
//
// Together with [@apostrophecms/images-widgets](../@apostrophecms/images-widgets/index.html),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.
//
// Each `@apostrophecms/image` doc has an `attachment` schema field, implemented
// by the [@apostrophecms/attachments](../@apostrophecms/attachments/index.html) module.

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    name: '@apostrophecms/image',
    label: 'Image',
    alias: 'images',
    perPage: 20,
    manageViews: [
      'grid',
      'list'
    ],
    insertViaUpload: true,
    searchable: false
  },
  beforeSuperClass(self, options) {
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
      },
      {
        type: 'joinByArray',
        name: '_tags',
        label: 'Tags',
        withType: '@apostrophecms/images-tags'
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
      // This method is available as a template helper: apos.images.first
      //
      // Find the first image attachment referenced within an object that may have attachments
      // as properties or sub-properties.
      //
      // For best performance be reasonably specific; don't pass an entire page or piece
      // object if you can pass page.thumbnail to avoid an exhaustive search, especially
      // if the page has many joins.
      //
      // For ease of use, a null or undefined `within` argument is accepted.
      //
      // Note that this method doesn't actually care if the attachment is part of
      // an `@apostrophecms/images` piece or not. It simply checks whether the `group`
      // property is set to `images`.
      //
      // Examples:
      //
      // 1. First image in the body area please
      //
      // apos.images.first(page.body)
      //
      // 2. Must be a GIF
      //
      // apos.images.first(page.body, { extension: 'gif' })
      //
      // (Note Apostrophe always uses .jpg for JPEGs.)
      //
      // OPTIONS:
      //
      // You may specify `extension` or `extensions` (an array of extensions)
      // to filter the results.
      first(within, options) {
        options = options ? _.clone(options) : {};
        options.group = 'images';
        let result = self.apos.attachments.first(within, options);
        return result;
      },
      // This method is available as a template helper: apos.images.all
      //
      // Find all image attachments referenced within an object that may have attachments
      // as properties or sub-properties.
      //
      // For best performance be reasonably specific; don't pass an entire page or piece
      // object if you can pass page.thumbnail to avoid an exhaustive search, especially
      // if the page has many joins.
      //
      // When available, the `_description`, `_credit` and `_creditUrl` are
      // also returned as part of the object.
      //
      // For ease of use, a null or undefined `within` argument is accepted.
      //
      // Note that this method doesn't actually care if the attachment is part of
      // an `@apostrophecms/images` piece or not. It simply checks whether the `group`
      // property is set to `images`.
      //
      // Examples:
      //
      // 1. All images in the body area please
      //
      // apos.images.all(page.body)
      //
      // 2. Must be GIFs
      //
      // apos.images.all(page.body, { extension: 'gif' })
      //
      // (Note Apostrophe always uses .jpg for JPEGs.)
      //
      // OPTIONS:
      //
      // You may specify `extension` or `extensions` (an array of extensions)
      // to filter the results.
      all(within, options) {
        options = options ? _.clone(options) : {};
        options.group = 'images';
        return self.apos.attachments.all(within, options);
      },
      // This method is available as a template helper: apos.images.srcset
      //
      // Given an image attachment, return a string that can be used as the value
      // of a `srcset` HTML attribute.
      srcset(attachment, cropRelationship) {
        if (!self.apos.attachments.isSized(attachment)) {
          return '';
        }
        // Since images are never scaled up once uploaded, we only need to include a
        // single image size that's larger than the original image (if such an image
        // size exists) to cover as many bases as possible
        let includedOriginalWidth = false;
        let sources = self.apos.attachments.imageSizes.filter(function (imageSize) {
          if (imageSize.width < attachment.width) {
            return true;
          } else if (!includedOriginalWidth) {
            includedOriginalWidth = true;
            return true;
          }
        }).map(function (imageSize) {
          let src = self.apos.attachments.url(attachment, {
            size: imageSize.name,
            crop: cropRelationship
          });
          let width = Math.min(imageSize.width, attachment.width);
          return src + ' ' + width + 'w';
        });
        return sources.join(', ');
      },
      isCroppable(image) {
        return image && self.apos.attachments.isCroppable(image.attachment);
      },
      // Make the minimum size, if any, accessible to the templates
      afterList(req, results) {
        if (req.body.minSize) {
          results.minSize = [
            self.apos.launder.integer(req.body.minSize[0]),
            self.apos.launder.integer(req.body.minSize[1])
          ];
        }
      }
    };
  },
  helpers: [
    'first',
    'all',
    'srcset',
    'isCroppable'
  ],
  queries(self, query) {
    return {
      builders: {
        minSize: {
          finalize() {
            const minSize = query.get('minSize');
            if (!minSize) {
              return;
            }
            const $nin = Object.keys(self.apos.attachments.sized).filter(key => self.apos.attachments.sized[key]);
            const criteria = {
              $or: [
                {
                  'attachment.extension': { $nin: $nin }
                },
                {
                  'attachment.width': { $gte: minSize[0] },
                  'attachment.height': { $gte: minSize[1] }
                }
              ]
            };
            query.and(criteria);
          },
          launder(a) {
            if (!Array.isArray(a)) {
              return undefined;
            }
            if (a.length !== 2) {
              return undefined;
            }
            return [ self.apos.launder.integer(a[0]), self.apos.launder.integer(a[1]) ];
          }
        }
      }
    };
  }
};
