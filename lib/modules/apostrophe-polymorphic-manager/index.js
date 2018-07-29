var _ = require('@sailshq/lodash');

module.exports = {
  // Not a real doc type name. We won't actually make
  // cursor instances for this manager. Instead it will
  // only be used to implement joins, and most of the
  // logic for making those polymorphic is in the
  // schemas module.
  name: 'apostrophe-polymorphic',
  extend: 'apostrophe-doc-type-manager',
  construct: function(self, options) {
    self.pushAsset('script', 'chooser-modal', { when: 'user' });
    self.pushAsset('stylesheet', 'polymorphic-manager', { when: 'user' });
    self.route('post', 'polymorphic-chooser-modal', function(req, res) {
      var limit = self.apos.launder.integer(req.body.limit);
      var field = req.body.field;
      if (!self.apos.utils.isBlessed(req, _.omit(field, 'hints'), 'join')) {
        res.statusCode = 404;
        return res.send('notfound');
      }
      var types = _.map(field.withType, function(name) {
        return self.apos.docs.getManager(name);
      });
      return res.send(self.render(req, 'chooserModal', { options: self.options, limit: limit, types: types }));
    });
  },
  afterConstruct: function (self) {

  }

};
