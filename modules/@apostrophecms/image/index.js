const _ = require('lodash');
// A subclass of `@apostrophecms/piece-type`, `@apostrophecms/image` establishes a library
// of uploaded images in formats suitable for use on the web.
//
// Together with [@apostrophecms/image-widget](../@apostrophecms/image-widget/index.html),
// this module provides a simple way to add downloadable PDFs and the like to
// a website, and to manage a library of them for reuse.
//
// Each `@apostrophecms/image` doc has an `attachment` schema field, implemented
// by the [@apostrophecms/attachment](../@apostrophecms/attachment/index.html) module.

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    name: '@apostrophecms/image',
    label: 'Image',
    alias: 'image',
    perPage: 31,
    sort: { createdAt: -1 },
    insertViaUpload: true,
    searchable: false,
    slugPrefix: 'image-'
  },
  fields: {
    add: {
      slug: {
        type: 'slug',
        label: 'Slug',
        prefix: 'image',
        required: true,
        following: 'title'
      },
      attachment: {
        type: 'attachment',
        label: 'Image File',
        fileGroup: 'images',
        required: true
      },
      alt: {
        type: 'string',
        label: 'Alt Text',
        help: 'Image description used for accessibility'
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
        withType: '@apostrophecms/image-tag'
      }
    },
    group: {
      // The image editor has only one group.
      basics: {
        label: 'Basics',
        fields: [
          'attachment',
          'title',
          'alt',
          '_tags',
          'credit',
          'creditUrl',
          'slug',
          'published',
          'trash'
        ]
      }
    }
  },
  filters: {
    add: {
      _tags: {
        label: 'Tags'
      }
    }
  },
  extendRestApiRoutes: (self, options) => ({
    async getAll (_super, req) {
      const pieces = await _super(req);

      self.apos.attachment.all(pieces, {
        annotate: true
      });

      return pieces;
    }
  }),
  methods(self, options) {
    return {
      // This method is available as a template helper: apos.image.first
      //
      // Find the first image attachment referenced within an object that may have attachments
      // as properties or sub-properties.
      //
      // For best performance be reasonably specific; don't pass an entire page or piece
      // object if you can pass page.thumbnail to avoid an exhaustive search, especially
      // if the page has many relationships.
      //
      // For ease of use, a null or undefined `within` argument is accepted.
      //
      // Note that this method doesn't actually care if the attachment is part of
      // an `@apostrophecms/image` piece or not. It simply checks whether the `group`
      // property is set to `images`.
      //
      // Examples:
      //
      // 1. First image in the body area please
      //
      // apos.image.first(page.body)
      //
      // 2. Must be a GIF
      //
      // apos.image.first(page.body, { extension: 'gif' })
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
        const result = self.apos.attachment.first(within, options);
        return result;
      },
      // This method is available as a template helper: apos.image.all
      //
      // Find all image attachments referenced within an object that may have attachments
      // as properties or sub-properties.
      //
      // For best performance be reasonably specific; don't pass an entire page or piece
      // object if you can pass page.thumbnail to avoid an exhaustive search, especially
      // if the page has many relationships.
      //
      // When available, the `_description`, `_credit` and `_creditUrl` are
      // also returned as part of the object.
      //
      // For ease of use, a null or undefined `within` argument is accepted.
      //
      // Note that this method doesn't actually care if the attachment is part of
      // an `@apostrophecms/image` piece or not. It simply checks whether the `group`
      // property is set to `images`.
      //
      // Examples:
      //
      // 1. All images in the body area please
      //
      // apos.image.all(page.body)
      //
      // 2. Must be GIFs
      //
      // apos.image.all(page.body, { extension: 'gif' })
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
        return self.apos.attachment.all(within, options);
      },
      // This method is available as a template helper: apos.image.srcset
      //
      // Given an image attachment, return a string that can be used as the value
      // of a `srcset` HTML attribute.
      srcset(attachment, cropFields) {
        if (!self.apos.attachment.isSized(attachment)) {
          return '';
        }
        // Since images are never scaled up once uploaded, we only need to include a
        // single image size that's larger than the original image (if such an image
        // size exists) to cover as many bases as possible
        let includedOriginalWidth = false;
        const sources = self.apos.attachment.imageSizes.filter(function (imageSize) {
          if (imageSize.width < attachment.width) {
            return true;
          } else if (!includedOriginalWidth) {
            includedOriginalWidth = true;
            return true;
          }
        }).map(function (imageSize) {
          const src = self.apos.attachment.url(attachment, {
            size: imageSize.name,
            crop: cropFields
          });
          const width = Math.min(imageSize.width, attachment.width);
          return src + ' ' + width + 'w';
        });
        return sources.join(', ');
      },
      isCroppable(image) {
        return image && self.apos.attachment.isCroppable(image.attachment);
      },
      // Make the minimum size, if any, accessible to the templates
      afterList(req, results) {
        if (req.body.minSize) {
          results.minSize = [
            self.apos.launder.integer(req.body.minSize[0]),
            self.apos.launder.integer(req.body.minSize[1])
          ];
        }
      },
      addManagerModal() {
        self.apos.modal.add(
          `${self.__meta.name}:manager`,
          self.getComponentName('managerModal', 'AposMediaManager'),
          { moduleName: self.__meta.name }
        );
      }
    };
  },
  extendMethods(self, options) {
    return {
      getBrowserData(_super, req) {
        const data = _super(req);
        data.components.managerModal = 'AposMediaManager';
        return data;
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
            const $nin = Object.keys(self.apos.attachment.sized).filter(key => self.apos.attachment.sized[key]);
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
