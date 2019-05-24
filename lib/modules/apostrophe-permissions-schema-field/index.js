const _ = require('lodash');

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
        label: 'Other'
      }
    ];

    self.addFieldType = function() {
      self.apos.schemas.addFieldType({
        name: 'permissions',
        partial: self.fieldTypePartial,
        converters: self.converters,
        getDefault: function() {
          const def = _.map(
            _.filter(
              self.apos.permissions.permissions || [],
              function(p) {
                return p.def;
              }
            ),
            function(p) {
              return p.value;
            }
          );
          return def;
        }
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
        var output = [];
        if (input.indexOf('admin') !== -1) {
          // preempts all other permissions
          output = [ 'admin' ];
        } else {
          self.apos.permissions.permissions.forEach(function(p) {
            if (input.indexOf(p.value) !== -1) {
              output.push(p.value);
            }
          });
        }
        object[name] = output;
        return setImmediate(callback);
      }
    };

    // Default implementation pays no mind to `group`, returns information
    // about all permissions for doc types. The `group` parameter makes room for
    // extension by workflow

    self.typeGroup = function(field, group) {
      return self.types(field);
    };

    // Returns information about all permissions for doc types
    self.types = function(field) {
      var types = Object.keys(self.apos.docs.managers);
      types = types.map(function(type) {
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
        if (manager.options.permissionsEditor === false) {
          return false;
        }
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
