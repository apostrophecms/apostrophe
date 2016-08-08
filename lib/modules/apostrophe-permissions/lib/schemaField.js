var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {

  self.addFieldType = function() {
    schemas.addFieldType({
      name: 'a2Permissions',
      render: function(data) {
        data.permissions = self._permissions;
        return self.render('field', data);
      },
      converters: {
        form: function(req, data, name, snippet, field, callback) {
          snippet.permissions = [];
          _.each(self._permissions, function(permission) {
            if (self._apos.sanitizeBoolean(data[permission.value])) {
              snippet.permissions.push(permission.value);
            }
          });
          return callback(null);
        },
        csv: function(req, data, name, snippet, field, callback) {
          snippet[field.name] = [];
          var received = data[name].split(/,\s*/);
          snippet[field.name] = _.intersection(received, self._permissions);
          return callback(null);
        }
      }
    });
  };

}
