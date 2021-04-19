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
      // If present, `mode` overrides `req.mode` for purposes
      // of determining permissions. This is useful to decide whether
      // a user should get access to the manage view of articles even
      // though they are technically in published mode on the page.

      can(req, action, docOrType, mode) {
        mode = mode || req.mode;
        const role = req.user && req.user.role;
        if (role === 'admin') {
          return true;
        }
        const type = docOrType && (docOrType.type || docOrType);
        const doc = (docOrType && docOrType._id) ? docOrType : null;
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
        } else if (action === 'view-draft') {
          // Checked at the middleware level to determine if req.mode should
          // be allowed to be set to draft at all
          return (role === 'contributor') || (role === 'editor');
        } else if (action === 'edit') {
          if (manager && manager.isAdminOnly()) {
            return false;
          } else if (mode === 'draft') {
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
        } else if (action === 'upload-attachment') {
          if ((role === 'contributor') || (role === 'editor')) {
            return true;
          } else {
            return false;
          }
        } else if (action === 'delete') {
          if (doc && !doc.lastPublishedAt) {
            return self.can(req, 'edit', doc);
          } else {
            return self.can(req, 'publish', doc);
          }
        } else {
          throw self.apos.error('invalid', 'That action is not implemented');
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
              _id: null
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
              _id: null
            };
          }
        } else {
          throw self.apos.error('invalid', `The action ${action} is not implemented for apos.permission.criteria`);
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
      describePermissionSet(req, module, options = {}) {
        const permissionSet = {
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
            value: self.can(req, 'edit', module.name)
          });
        }
        permissions.push({
          name: 'edit',
          label: module.options.singleton ? 'Modify' : 'Modify / Delete',
          value: self.can(req, 'edit', module.name)
        });
        permissions.push({
          name: 'publish',
          label: 'Publish',
          value: self.can(req, 'publish', module.name)
        });
        permissionSet.permissions = permissions;
        return permissionSet;
      },
      // Receives the types for the permission grid (see the grid route) and
      // reduces the set to those considered interesting and those that
      // do not match the typical permissions, in an intuitive order
      presentPermissionSets(permissionSets) {
        let newPermissionSets = permissionSets.filter(permissionSet => self.options.interestingTypes.includes(permissionSet.name));
        newPermissionSets = [
          ...newPermissionSets,
          permissionSets.filter(permissionSet => !newPermissionSets.includes(permissionSet) && !self.matchTypicalPieceType(permissionSet)),
          permissionSets.find(permissionSet => permissionSet.page)
        ];
        const typicalPieceType = permissionSets.find(self.matchTypicalPieceType);
        if (typicalPieceType) {
          newPermissionSets.push({
            ...typicalPieceType,
            name: '@apostrophecms/piece-type',
            label: 'Piece Content',
            tooltip: permissionSets.filter(permissionSet => self.matchTypicalPieceType(permissionSet) && !newPermissionSets.includes(permissionSet)).map(permissionSet => permissionSet.label).join(', ')
          });
        }
        return newPermissionSets;
      },
      matchTypicalPieceType(permissionSet) {
        return permissionSet.piece && !permissionSet.adminOnly && !self.options.interestingTypes.includes(permissionSet.name);
      }
    };
  },
  apiRoutes(self) {
    return {
      get: {
        async grid(req) {
          if (!self.apos.permission.can(req, 'edit', '@apostrophecms/user')) {
            throw self.apos.error('forbidden');
          }
          const permissionSets = [];
          const effectiveRole = self.apos.launder.select(req.query.role, [ 'guest', 'contributor', 'editor', 'admin' ]);
          if (!effectiveRole) {
            throw self.apos.error('invalid', { role: effectiveRole });
          }
          const _req = self.apos.task.getReq({
            role: effectiveRole,
            mode: 'draft'
          });
          for (const module of Object.values(self.apos.modules)) {
            if (self.apos.synth.instanceOf(module, '@apostrophecms/piece-type')) {
              permissionSets.push(self.describePermissionSet(_req, module, { piece: true }));
            }
          }
          permissionSets.push(self.describePermissionSet(_req, self.apos.modules['@apostrophecms/any-page-type']));
          return {
            permissionSets: self.presentPermissionSets(permissionSets)
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
