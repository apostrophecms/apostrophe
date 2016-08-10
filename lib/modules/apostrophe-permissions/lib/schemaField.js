var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {

  self.addFieldType = function() {
    self._schemas.addFieldType({
      name: 'a2Permissions',
      render: function(field) {
        return self.render('field', field);
      },
      converters: {
        form: function(req, data, name, object, field, callback) {
          return self.apply(
            req,
            data,
            object,
            undefined,
            _.pick(field, 'editorsCanChangeEditPermissions'),
            callback
          );
        },
        csv: function(req, data, name, snippet, field, callback) {
          // Might be nice to support person and group names, but
          // they can be ambiguous
          return callback(null);
        }
      }
    });
  };

}
