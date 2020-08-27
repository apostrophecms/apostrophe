const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: { name: '@apostrophecms/polymorphic' },
  routes(self, options) {
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
