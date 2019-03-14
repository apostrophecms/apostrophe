module.exports = {

  afterConstruct: function(self) {
    self.pushAssets();
    self.pushCreateSingleton();
    self.addFieldType();
  },

  construct: function(self, options) {

    require('./lib/browser')(self, options);

    self.addFieldType = function() {
      console.log('in addFieldType');
      self.apos.schemas.addFieldType({
        name: 'permissions',
        partial: self.fieldTypePartial,
        converters: self.converters
      });
    };

    self.fieldTypePartial = function(data) {
      console.log('in fieldTypePartial');
      return self.partial('permissions', data);
    };

    self.converters = {
      string: function(req, data, name, object, field, callback) {
        // N/A
        return setImmediate(callback);
      },
      form: function(req, data, name, object, field, callback) {
        var input = data[name];
        if (!Array.isArray(input)) {
          input = [];
        }
        var types = self.apos.permissions.types();
        var output = [];
        types.forEach(function(type) {
          var permissions = [ 'insert-' + type.name, 'update-' + type.name, 'updateany-' + type.name, 'trash-' + type.name ];
          permission.forEach(function(p) {
            if (input.indexOf(p) !== -1) {
              output.push(p);
            }
          });
        });
        object[name] = output;
        return setImmediate(callback);
      }
    };

    self.types = function() {
      var types = Object.keys(self.apos.docs.managers);
      return types.map(function(type) {
        var manager = self.apos.docs.getManager(type);
        if (self.apos.instanceOf(manager, 'apostrophe-custom-pages')) {
          // There is just one entry for all pages
          return false;
        }
        if (manager.isAdminOnly()) {
          return false;
        }
        return {
          name: manager.name,
          label: manager.label || manager.name
        };
      }).filter(function(type) {
        // Keep the truthy ones
        return !!type;
      });
    };

    self.addHelpers({
      types: self.types
    });

  }

};
