module.exports = {

  afterConstruct: function(self) {
    self.pushAssets();
    self.pushCreateSingleton();
    self.addFieldType();
    self.addHelpers({
      typeGroup: self.typeGroup,
      independentGroup: self.independentGroup,
      presentation: function() {
        return self.presentation;
      },
      typeGroupPrologue: self.typeGroupPrologue
    });
  },

  construct: function(self, options) {

    require('./lib/browser')(self, options);

    // The permissions are output in this order. The default order is:
    // all independent permissions not marked as part of the `last` group,
    // followed by all doctype-specific permissions, followed by all
    // permissions in the `last` group. The workflow module overrides
    // this array to output things a bit differently.

    self.presentation = [
      {
        type: 'independent',
        name: 'default',
        label: 'Overall'
      },
      {
        type: 'typed',
        name: 'all',
        label: 'Document Type Permissions'
      },
      {
        type: 'independent',
        name: 'last',
        label: 'Permissions Usually Implied by Others'
      }
    ];

    self.addFieldType = function() {
      self.apos.schemas.addFieldType({
        name: 'permissions',
        partial: self.fieldTypePartial,
        converters: self.converters
      });
    };

    self.fieldTypePartial = function(data) {
      var _data = Object.assign({}, data, {
        presentation: self.presentation
      });
      return self.partial('permissions', _data);
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

    // Default implementation pays no mind to `group`, returns information
    // about all permissions for doc types. The `group` parameter makes room for
    // extension by workflow

    self.typeGroup = function(field, group) {
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

    // Returns information about a particular group of non-doctype-related permissions.
    // By default the `overall` and `last` groups exist
    self.independentGroup = function(field, name) {
      return self.apos.permissions.permissions.filter(function(permission) {
        var matches = permission.value.match(/^\w+\-(.*)$/);
        if (matches) {
          if ((name === 'default') && (matches[1] === 'apostrophe-global')) {
            return true;
          } else if (!self.apos.docs.getManager(matches[1])) {
            return ((name === permission.group) || ((name === 'default') && (!permission.group)));
          }
          return false;
        } else {
          return ((name === permission.group) || ((name === 'default') && (!permission.group)));
        }
      });
    };

    // Extensibility for custom UI, overridden by workflow
    self.typeGroupPrologue = function(field, typeGroup) {
      return '';
    };

  }

};
