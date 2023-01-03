const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    name: '@apostrophecms/polymorphic-type',
    showPermissions: false
  },
  init(self) {
    self.removePolymorphicTypeAliasMigration();
  },
  methods(self) {
    return {
      removePolymorphicTypeAliasMigration() {
        self.apos.migration.add('remove-polymorphic-type-alias', () => {
          return self.apos.doc.db.updateMany({
            type: '@apostrophecms/polymorphic'
          }, {
            $set: {
              type: '@apostrophecms/polymorphic-type'
            }
          });
        });
      }
    };
  },
  routes(self) {
    return {
      post: {
        polymorphicChooserModal(req, res) {
          const limit = self.apos.launder.integer(req.body.limit);
          const field = req.body.field;
          const types = _.map(field.withType, function (name) {
            return self.apos.doc.getManager(name);
          });
          return self.send(req, 'chooserModal', {
            options: self.options,
            limit: limit,
            types: types
          });
        }
      }
    };
  }
};
