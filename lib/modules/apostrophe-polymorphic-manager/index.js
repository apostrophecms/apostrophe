let _ = require('lodash');

module.exports = {
  extend: 'apostrophe-doc-type-manager',
  options: { name: 'apostrophe-polymorphic' },
  routes(self, options) {
    return {
      post: {
        polymorphicChooserModal(req, res) {
          let limit = self.apos.launder.integer(req.body.limit);
          let field = req.body.field;
          let types = _.map(field.withType, function (name) {
            return self.apos.docs.getManager(name);
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
