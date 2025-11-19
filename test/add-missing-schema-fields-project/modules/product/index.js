export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Product',
    pluralLabel: 'Products'
  },
  fields: {
    add: {
      price: {
        type: 'float',
        label: 'Price',
        required: true
      },
      description: {
        type: 'string',
        label: 'Description',
        textarea: true,
        required: true
      },
      image: {
        label: 'Product photo',
        type: 'area',
        options: {
          max: 1,
          widgets: {
            '@apostrophecms/image': {}
          }
        }
      },
      copyright: {
        type: 'string',
        label: 'Copyright'
      }
    },
    group: {
      basics: {
        label: 'Basics',
        fields: [ 'title', 'price', 'description', 'image', 'copyright' ]
        // 👆 'title' is included here because it is in the default `basics`
        // group for all piece types. Since we are replacing that group, we
        // include it ourselves.
      }
    }
  },
  init(self) {
    self.apos.migration.add('add-first-product', self.addFirstProduct);
    self.apos.migration.add('add-copyright-notice', self.addCopyrightNotice);
  },
  methods(self) {
    return {
      async addFirstProduct() {
        await self.apos.modules.product.insert(
          self.apos.task.getReq(),
          {
            ...self.apos.modules.product.newInstance(),
            title: 'My first product',
            price: 10.00,
            description: 'Product description'
          }
        );
      },
      async addCopyrightNotice() {
        await self.apos.migration.eachDoc({
          type: 'product'
        }, async (doc) => {
          if (doc.copyright === undefined) {
            await self.apos.doc.db.updateOne({
              _id: doc._id
            }, {
              $set: { copyright: '©2024 ApostropheCMS. All rights reserved.' }
            });
          }
        });
      }
    };
  }
};
