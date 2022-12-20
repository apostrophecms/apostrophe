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
    label: 'apostrophe:image',
    pluralLabel: 'apostrophe:images',
    alias: 'image',
    perPage: 31,
    sort: { createdAt: -1 },
    quickCreate: false,
    insertViaUpload: true,
    searchable: false,
    slugPrefix: 'image-',
    autopublish: true,
    editRole: 'editor',
    publishRole: 'editor',
    showPermissions: true,
    // Images should by default be considered "related documents" when localizing
    // another document that references them
    relatedDocument: true,
    relationshipEditor: 'AposImageRelationshipEditor',
    relationshipEditorLabel: 'apostrophe:editImageAdjustments',
    relationshipEditorIcon: 'image-edit-outline',
    relationshipFields: {
      add: {
        top: {
          type: 'integer'
        },
        left: {
          type: 'integer'
        },
        width: {
          type: 'integer'
        },
        height: {
          type: 'integer'
        },
        x: {
          type: 'integer'
        },
        y: {
          type: 'integer'
        }
      }
    },
    relationshipPostprocessor: 'autocrop'
  },
  fields: {
    remove: [ 'visibility' ],
    add: {
      slug: {
        type: 'slug',
        label: 'apostrophe:slug',
        prefix: 'image',
        required: true,
        following: [ 'title', 'archived' ]
      },
      attachment: {
        type: 'attachment',
        label: 'apostrophe:imageFile',
        fileGroup: 'images',
        required: true
      },
      alt: {
        type: 'string',
        label: 'apostrophe:altText',
        help: 'apostrophe:altTextHelp'
      },
      credit: {
        type: 'string',
        label: 'apostrophe:credit'
      },
      creditUrl: {
        type: 'url',
        label: 'apostrophe:creditUrl'
      },
      _tags: {
        type: 'relationship',
        label: 'apostrophe:tags',
        withType: '@apostrophecms/image-tag',
        modifiers: [ 'no-search' ]
      }
    },
    group: {
      // The image editor has only one group.
      basics: {
        label: 'apostrophe:basics',
        fields: [
          'attachment',
          'title',
          'alt',
          '_tags',
          'credit',
          'creditUrl',
          'slug',
          'archived'
        ]
      }
    }
  },
  filters: {
    remove: [ 'visibility' ],
    add: {
      _tags: {
        label: 'apostrophe:tags'
      }
    }
  },
  commands(self) {
    return {
      remove: [
        `${self.__meta.name}:archive-selected`
      ]
    };
  },
  extendRestApiRoutes: (self) => ({
    async getAll (_super, req) {
      const pieces = await _super(req);

      self.apos.attachment.all(pieces, {
        annotate: true
      });

      return pieces;
    }
  }),
  apiRoutes: (self) => ({
    post: {
      async autocrop(req) {
        if (!self.apos.permission.can(req, 'upload-attachment')) {
          throw self.apos.error('forbidden');
        }
        const widgetOptions = sanitizeOptions(req.body.widgetOptions);
        if (!widgetOptions.aspectRatio) {
          return {
            // This is OK because there will be further sanitization
            // when we actually save the relationship. At this stage
            // we only need to sanitize if we're going to autocrop
            relationship: req.body.relationship
          };
        }
        const relationship = await sanitizeRelationship(req.body.relationship);
        for (const image of relationship) {
          if (!closeEnough(image) && self.apos.attachment.isCroppable(image.attachment)) {
            await autocrop(image, widgetOptions);
          }
        }
        return {
          relationship
        };

        async function sanitizeRelationship(input) {
          const output = [];
          if (!Array.isArray(input)) {
            return output;
          }
          for (const inputImage of input) {
            const outputImage = await sanitizeImage(inputImage);
            if (!outputImage) {
              continue;
            }
            outputImage._fields = sanitizeFields(inputImage);
            output.push(outputImage);
          }
          return output;
        }
        function sanitizeOptions(input) {
          if (input == null) {
            return {};
          }
          if ((typeof input) !== 'object') {
            return {};
          }
          if (!input.aspectRatio) {
            return {};
          }
          if (!Array.isArray(input.aspectRatio)) {
            return {};
          }
          const w = self.apos.launder.float(input.aspectRatio[0], 0);
          const h = self.apos.launder.float(input.aspectRatio[1], 0);
          if ((w <= 0) || (h <= 0)) {
            return {};
          }
          return {
            aspectRatio: [ w, h ]
          };
        }
        function sanitizeFields(inputImage) {
          const input = inputImage._fields;
          const output = {};
          if ((input == null) || ((typeof input) !== 'object')) {
            return output;
          }
          const props = [ 'top', 'left', 'width', 'height', 'x', 'y' ];
          for (const prop of props) {
            if ((typeof input[prop]) === 'number') {
              output[prop] = self.apos.launder.integer(input[prop]);
              if (output[prop] < 0) {
                return {};
              }
            }
          }
          const mandatory = [ 'top', 'left', 'width', 'height' ];
          for (const prop of mandatory) {
            if (!_.has(output, prop)) {
              return {};
            }
          }
          if (output.width === 0) {
            return {};
          }
          if (output.height === 0) {
            return {};
          }
          if (output.left + output.width > inputImage.attachment.width) {
            // An older crop that does not work with a new attachment file
            return {};
          }
          if (output.top + output.height > inputImage.attachment.height) {
            // An older crop that does not work with a new attachment file
            return {};
          }
          return output;
        }
        function sanitizeImage(input) {
          if (!input) {
            return null;
          }
          return self.find(req, {
            _id: self.apos.launder.id(input._id)
          }).toObject();
        }
        function closeEnough(image) {
          const testRatio = image._fields ? (image._fields.width / image._fields.height)
            : (image.attachment.width / image.attachment.height);
          const configuredRatio = widgetOptions.aspectRatio[0] / widgetOptions.aspectRatio[1];
          return withinOnePercent(testRatio, configuredRatio);
        }
        async function autocrop(image, widgetOptions) {
          const nativeRatio = image.attachment.width / image.attachment.height;
          const configuredRatio = widgetOptions.aspectRatio[0] / widgetOptions.aspectRatio[1];
          let crop;
          if (configuredRatio >= nativeRatio) {
            const height = image.attachment.width / configuredRatio;
            crop = {
              top: Math.floor((image.attachment.height - height) / 2),
              left: 0,
              width: image.attachment.width,
              height: Math.floor(height)
            };
          } else {
            const width = image.attachment.height * configuredRatio;
            crop = {
              top: 0,
              left: Math.floor((image.attachment.width - width) / 2),
              width: Math.floor(width),
              height: image.attachment.height
            };
          }
          await self.apos.attachment.crop(req, image.attachment._id, crop);
          image._fields = crop;
          // For ease of testing send back the cropped image URLs now
          image._crop = crop;
          await self.all(image, {
            crop,
            annotate: true
          });
        }
        // Compare two ratios and decide if they are within 1% of the
        // largest of the two
        function withinOnePercent(a, b) {
          const max = Math.max(a, b);
          a = a * 100 / max;
          b = b * 100 / max;
          return Math.abs(a - b) < 1;
        }
      }
    }
  }),
  methods(self) {
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
        // Since images are never scaled up once uploaded, we only need to
        // include a single image size that's larger than the original image
        // (if such an image size exists) to cover as many bases as possible
        let includedOriginalWidth = false;
        const sources = self.apos.attachment.imageSizes.filter(function (imageSize) {
          if (imageSize.width < attachment.width) {
            return true;
          } else if (!includedOriginalWidth) {
            includedOriginalWidth = true;
            return true;
          } else {
            return false;
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
  extendMethods(self) {
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
