module.exports = {

  afterConstruct: function(self) {
    self.pushAssets();
    self.pushCreateSingleton();
    self.addFieldType();
  },

  construct: function(self, options) {

    require('./lib/browser')(self, options);

    self.addFieldType = function() {
      self.apos.schemas.addFieldType({
        name: 'permissions',
        partial: self.fieldTypePartial,
        converters: self.converters
      });
    };

    self.fieldTypePartial = function(data) {
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
        var types = self.types();
        var output = [];
        types.forEach(function(type) {
          var permissions = [ 'insert-' + type.name, 'update-' + type.name, 'updateany-' + type.name, 'trash-' + type.name, 'admin-' + type.name ];
          if (type.name === 'apostrophe-page') {
            permissions.push('move-' + type.name);
          }
          manager = self.apos.docs.getManager(type.name);
          if (manager.options.permissionsFields) {
            permissions.push('grant-' + type.name);
          }
          permissions.forEach(function(p) {
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
      types = types.map(function(type) {
        if (type === 'apostrophe-global') {
          // A single hardcoded checkbox in the overall section handles this more gracefully
          return false;
        }
        // Make sure at least one permission was registered for this
        // type name. This excludes adminOnly types and any other type that
        // might make a similar implementation decision
        var permission = self.apos.permissions.permissions.find(function(permission) {
          var matches = permission.value.match(/^\w+\-(.*)$/);
          if (matches) {
            if (matches[1] === type) {
              return true;
            }
          }
        });
        if (!permission) {
          return false;
        }
        manager = self.apos.docs.getManager(type);
        if (self.apos.instanceOf(manager, 'apostrophe-custom-pages')) {
          // There is just one entry for all pages
          return false;
        }
        if (manager.isAdminOnly()) {
          return false;
        }
        return {
          name: manager.name,
          pluralLabel: manager.pluralLabel,
          permissionsFields: manager.options.permissionsFields
        };
      }).filter(function(type) {
        // Keep the truthy ones
        return !!type;
      });
      return types;
    };

    self.addHelpers({
      types: self.types
    });

  }

};
