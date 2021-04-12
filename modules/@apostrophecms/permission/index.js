// This module manages the permissions of docs in Apostrophe.
//
// A new permissions model is coming in 3.x. For alpha 1, logged-in users
// can do anything, and the public can only view content.
//
// In 3.0 final, users will be subdivided into guests, contributors,
// editors and admins, in ascending order of privilege. In the final
// 3.0 model, guests can view "login required" pages, but have no other
// special privileges. Contributors can create drafts but cannot publish
// them alone. Editors can edit anything except user accounts, and admins
// can edit anything.

module.exports = {
  options: {
    alias: 'permission',
    interestingTypes: [
      '@apostrophecms/user',
      '@apostrophecms/global',
      '@apostrophecms/image',
      '@apostrophecms/file'
    ]
  },
  init(self) {
    self.permissionPattern = /^([^-]+)-(.*)$/;
    self.addRetirePublishedFieldMigration();
    self.addRoleFieldType();
    self.enableBrowserData();
  },
  methods(self) {
    return {
      // Determines whether the active user can carry out the
      // action specified by `action` on the doc or type name
      // specified by `docOrType`. Returns true if the action
      // is permitted, false if not permitted.
      //
      // If `docOrType` is a doc, this method checks whether the user
      // can carry out the specified action on that particular doc. If it is
      // a string, this method checks whether the user can potentially carry out
      // the action on that doc type generally.
      //
      // If a permission is not specific to particular documents,
      // `docOrType` may be omitted.
      //
      // The doc passed need not already exist in the database.
      //
      // See also `criteria` which can be called to build a MongoDB
      // criteria object returning only documents on which the active user
      // can carry out the specified action.
      //
      can(req, action, docOrType) {
        const role = req.user && req.user.role;
        if (role === 'admin') {
          return true;
        }
        if (docOrType && ((typeof docOrType) === 'object') && !docOrType.type) {
          console.log('>>', docOrType);
        }
        const type = docOrType.type || docOrType;
        const manager = type && self.apos.doc.getManager(type);
        if (type && !manager) {
          self.apos.util.warn(`A permission.can() call was made with a type that has no manager: ${type}`);
          return false;
        }
        if (action === 'view') {
          if (manager && manager.isAdminOnly()) {
            return false;
          } else if (((typeof docOrType) === 'object') && (docOrType.visibility !== 'public')) {
            return (role === 'guest') || (role === 'contributor') || (role === 'editor');
          } else {
            return true;
          }
        } else if (action === 'edit') {
          if (manager && manager.isAdminOnly()) {
            return false;
          } else if (req.mode === 'draft') {
            return (role === 'contributor') || (role === 'editor');
          } else {
            return role === 'editor';
          }
        } else if (action === 'publish') {
          if (manager && manager.isAdminOnly()) {
            return false;
          } else {
            return role === 'editor';
          }
        }
      },

      // Returns a MongoDB criteria object that retrieves only documents
      // the user is allowed to perform `action` on.

      criteria(req, action) {
        const role = req.user && req.user.role;
        if (role === 'admin') {
          return {};
        }
        const restrictedTypes = Object.keys(self.apos.doc.managers).filter(name => self.apos.doc.getManager(name).isAdminOnly());
        if (action === 'view') {
          if (role === 'guest') {
            return {
              aposMode: {
                $in: [ null, 'published' ]
              },
              visibility: {
                $in: [ 'public', 'loginRequired' ]
              },
              type: {
                $nin: restrictedTypes
              }
            };
          } else if ((role === 'contributor') || (role === 'editor')) {
            return {
              type: {
                $nin: restrictedTypes
              }
            };
          } else {
            return {
              aposMode: {
                $in: [ null, 'published' ]
              },
              visibility: 'public',
              type: {
                $nin: restrictedTypes
              }
            };
          }
        } else if (action === 'edit') {
          if (role === 'contributor') {
            return {
              aposMode: {
                $in: [ null, 'draft' ]
              },
              type: {
                $nin: restrictedTypes
              }
            };
          } else if (role === 'editor') {
            return {
              type: {
                $nin: restrictedTypes
              }
            };
          } else {
            return {
              _id: 'thisIdWillNeverMatch'
            };
          }
        } else if (action === 'publish') {
          if (role === 'editor') {
            return {
              type: {
                $nin: restrictedTypes
              }
            };
          } else {
            return {
              _id: 'thisIdWillNeverMatch'
            };
          }
        } else {
          // If I don't understand it, I don't allow it
          return {
            _id: 'thisIdWillNeverMatch'
          };
        }
      },

      // For each object in the array, if the user is able to
      // carry out the specified action, a property is added
      // to the object. For instance, if the action is "edit",
      // each doc the user can edit gets a "._edit = true" property.
      //
      // Note the underscore.
      //
      // This is most often used when an array of objects the user
      // can view have been retrieved and we wish to know which ones
      // the user can also edit.

      annotate(req, action, objects) {
        const property = `_${action}`;
        for (const object of objects) {
          if (self.can(req, action, object)) {
            object[property] = true;
          }
        }
      },
      addRoleFieldType() {
        self.apos.schema.addFieldType({
          name: 'role',
          extend: 'select'
        });
      },
      addRetirePublishedFieldMigration() {
        self.apos.migration.add('retire-published-field', async () => {
          await self.apos.migration.eachDoc({}, 5, async (doc) => {
            if (doc.published === true) {
              doc.visibility = 'public';
            } else if (doc.published === false) {
              doc.visibility = 'loginRequired';
            }
            delete doc.published;
            return self.apos.doc.db.replaceOne({
              _id: doc._id
            }, doc);
          });
        });
      },
      // Returns an object with properties describing the permissions associated
      // with the given module, which should be a piece type or the `@apostrophecms/any-page-type`
      // module. Used to populate the permission grid on the front end
      describeType(req, module, options = {}) {
        const typeInfo = {
          label: module.options.permissionsLabel || module.options.pluralLabel || module.options.label,
          name: module.__meta.name,
          adminOnly: module.options.adminOnly,
          singleton: module.options.singleton,
          page: module.__meta.name === '@apostrophecms/any-page-type',
          ...options
        };
        const permissions = [];
        if (!module.options.singleton) {
          permissions.push({
            name: 'create',
            label: 'Create',
            value: self.can(req, 'edit')
          });
        }
        permissions.push({
          name: 'edit',
          label: module.options.singleton ? 'Modify' : 'Modify / Delete',
          value: self.can(req, 'edit')
        });
        permissions.push({
          name: 'publish',
          label: 'Publish',
          value: self.can(req, 'publish')
        });
        typeInfo.permissions = permissions;
        return typeInfo;
      },
      // Receives the types for the permission grid (see the grid route) and
      // reduces the set to those considered interesting and those that
      // do not match the typical permissions, in an intuitive order
      presentTypes(types) {
        let newTypes = types.filter(type => self.options.interestingTypes.includes(type.name));
        newTypes = [
          ...newTypes,
          types.filter(type => !newTypes.includes(type) && !self.matchTypicalPieceType(type)),
          types.find(type => type.page)
        ];
        const typicalPieceType = types.find(self.matchTypicalPieceType);
        if (typicalPieceType) {
          newTypes.push({
            ...typicalPieceType,
            name: '@apostrophecms/piece-type',
            label: 'Piece Content',
            tooltip: types.filter(type => self.matchTypicalPieceType(type) && !newTypes.includes(type)).map(type => type.label).join(', ')
          });
        }
        return newTypes;
      },
      matchTypicalPieceType(type) {
        return type.piece && !type.adminOnly && !self.options.interestingTypes.includes(type.name);
      }
    };
  },
  apiRoutes(self) {
    return {
      get: {
        async grid(req) {
          const types = [];
          for (const module of Object.values(self.apos.modules)) {
            if (self.apos.synth.instanceOf(module, '@apostrophecms/piece-type')) {
              types.push(self.describeType(req, module, { piece: true }));
            }
          }
          types.push(self.describeType(req, self.apos.modules['@apostrophecms/any-page-type']));
          return {
            types: self.presentTypes(types)
          };
        }
      }
    };
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const initialBrowserOptions = _super(req);
        const browserOptions = {
          ...initialBrowserOptions,
          action: self.action
        };
        return browserOptions;
      }
    };
  }
};
