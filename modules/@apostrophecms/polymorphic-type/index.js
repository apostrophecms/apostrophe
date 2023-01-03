const _ = require('lodash');
const migrations = require('./lib/migrations.js');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    name: '@apostrophecms/polymorphic-type',
    showPermissions: false
  },
  init(self) {
    self.addMigrations();
  },
  methods(self) {
    return {
      ...migrations(self)
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
