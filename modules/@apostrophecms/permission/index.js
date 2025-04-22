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

const ranks = {
  guest: 0,
  contributor: 1,
  editor: 2,
  admin: 3
};

module.exports = {
  options: {
    alias: 'permission'
  },
  init(self) {
    self.permissionPattern = /^([^-]+)-(.*)$/;
    self.addLegacyMigrations();
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
          self.apos.util.warn('A permission.can() call was made with a type that has no manager:', type);
          return false;
        }

        if (action === 'view') {
          return canView();
        }

        if (action === 'view-draft') {
          // Checked at the middleware level to determine if req.mode should
          // be allowed to be set to draft at all
          return (role === 'contributor') || (role === 'editor');
        }

        if ([ 'edit', 'create' ].includes(action)) {
          return canEdit();
        }

        if (action === 'publish') {
          return canPublish();
        }

        if (action === 'upload-attachment') {
          return (role === 'contributor') || (role === 'editor');
        }

        if (action === 'delete') {
          return canDelete();
        }

        throw self.apos.error('invalid', 'That action is not implemented');

        function checkRoleConfig (permRole) {
          return manager && manager.options[permRole] &&
            (ranks[role] < ranks[manager.options[permRole]]);
        }

        function canView() {
          if (checkRoleConfig('viewRole')) {
            return false;
          }
          if ((typeof docOrType === 'object') && (docOrType.visibility !== 'public')) {
            return (role === 'guest') || (role === 'contributor') || (role === 'editor');
          }
          return true;
        }

        function canEdit() {
          if (checkRoleConfig('editRole')) {
            return false;
          }
          if (mode === 'draft') {
            return (role === 'contributor') || (role === 'editor');
          }
          return role === 'editor';
        }

        function canPublish() {
          if (checkRoleConfig('publishRole')) {
            return false;
          }
          return role === 'editor';
        }

        function canDelete() {
          if (doc && (!doc.lastPublishedAt || doc.aposMode === 'draft')) {
            return self.can(req, 'edit', doc, mode);
          }

          return self.can(req, 'publish', docOrType, mode);
        }
      },

      // Returns a MongoDB criteria object that retrieves only documents
      // the user is allowed to perform `action` on.

      criteria(req, action) {
        const role = req.user && req.user.role;
        if (role === 'admin') {
          return {};
        }

        const restrictedViewTypes = Object.keys(self.apos.doc.managers)
          .filter(name =>
            ranks[self.apos.doc.getManager(name).options.viewRole] > ranks[role]);
        const restrictedEditTypes = Object.keys(self.apos.doc.managers)
          .filter(name =>
            ranks[self.apos.doc.getManager(name).options.editRole] > ranks[role]);
        const restrictedPublishTypes = Object.keys(self.apos.doc.managers)
          .filter(name =>
            ranks[self.apos.doc.getManager(name).options.publishRole] > ranks[role]);
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
                $nin: restrictedViewTypes
              }
            };
          } else if ((role === 'contributor') || (role === 'editor')) {
            return {
              type: {
                $nin: restrictedViewTypes
              }
            };
          } else {
            const query = {
              aposMode: {
                $in: [ null, 'published' ]
              },
              visibility: 'public',
              type: {
                $nin: restrictedViewTypes
              }
            };

            if (self.isShareDraftRequest(req)) {
              const { aposShareId, aposShareKey } = req.query;
              const { aposMode, ...rest } = query;

              return {
                ...rest,
                $or: [
                  { aposMode },
                  {
                    _id: aposShareId,
                    aposShareKey,
                    aposMode: 'draft'
                  }
                ],
                // We do not want the published version of the document
                // in the case where we want to access the draft with a
                // public URL:
                _id: {
                  $ne: aposShareId.replace(':draft', ':published')
                }
              };
            }

            return query;
          }
        } else if ([ 'edit', 'create', 'delete' ].includes(action)) {
          if (role === 'contributor') {
            return {
              aposMode: {
                $in: [ null, 'draft' ]
              },
              type: {
                $nin: restrictedEditTypes
              }
            };
          } else if (role === 'editor') {
            return {
              type: {
                $nin: restrictedEditTypes
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
                $nin: restrictedPublishTypes
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
          // Not appropriate to annotate widgets even if they
          // are being treated as docs to access other "after"
          // handlers
          if (!object._virtual) {
            if (self.can(req, action, object)) {
              object[property] = true;
            }
          }
        }
      },
      addRoleFieldType() {
        self.apos.schema.addFieldType({
          name: 'role',
          extend: 'select'
        });
      },
      // Returns an object with properties describing the permissions associated
      // with the given module, which should be a piece type or the
      // `@apostrophecms/any-page-type` module. Used to populate the permission
      // grid on the front end
      describePermissionSet(req, apostropheModule, options = {}) {
        const permissionSet = {
          label: apostropheModule.options.permissionsLabel ||
            apostropheModule.options.pluralLabel ||
            apostropheModule.options.label,
          name: apostropheModule.__meta.name,
          singleton: apostropheModule.options.singleton,
          page: apostropheModule.__meta.name === '@apostrophecms/any-page-type',
          ...options
        };
        const permissions = [];
        if (!apostropheModule.options.singleton) {
          permissions.push({
            name: 'create',
            label: 'apostrophe:create',
            value: self.can(req, 'create', apostropheModule.name)
          });
        }
        permissions.push({
          name: 'edit',
          label: apostropheModule.options.singleton ? 'apostrophe:modify' : 'apostrophe:modifyOrDelete',
          value: self.can(req, 'edit', apostropheModule.name)
        });
        permissions.push({
          name: 'publish',
          label: 'apostrophe:publish',
          value: self.can(req, 'publish', apostropheModule.name)
        });
        permissionSet.permissions = permissions;
        return permissionSet;
      },
      // Receives the types for the permission grid (see the grid route) and
      // reduces the set to those considered interesting and those that
      // do not match the typical permissions, in an intuitive order
      presentPermissionSets(permissionSets) {
        let newPermissionSets = permissionSets
          .filter(permissionSet => self.matchInterestingType(permissionSet));
        newPermissionSets = [
          ...newPermissionSets,
          ...permissionSets.filter(permissionSet =>
            !newPermissionSets.includes(permissionSet) &&
            !self.matchTypicalPieceType(permissionSet) &&
            !self.neverMentionType(permissionSet))
        ];
        const typicalPieceType = permissionSets.find(self.matchTypicalPieceType);
        if (typicalPieceType) {
          newPermissionSets.push({
            ...typicalPieceType,
            name: '@apostrophecms/piece-type',
            label: 'apostrophe:pieceContent',
            includes: permissionSets
              .filter(permissionSet =>
                self.matchTypicalPieceType(permissionSet) &&
                !newPermissionSets.includes(permissionSet)
              )
              .map(permissionSet => permissionSet.label)
          });
        }
        return newPermissionSets;
      },
      matchTypicalPieceType(permissionSet) {
        const manager = self.apos.doc.getManager(permissionSet.name);
        return permissionSet.piece && (manager.options.viewRole === false) && (manager.options.editRole === 'contributor') && (manager.options.publishRole === 'editor') && !self.matchInterestingType(permissionSet) && !self.neverMentionType(permissionSet);
      },
      neverMentionType(permissionSet) {
        const manager = self.apos.doc.getManager(permissionSet.name);
        return manager.options.showPermissions === false;
      },
      matchInterestingType(permissionSet) {
        const manager = self.apos.doc.getManager(permissionSet.name);
        return manager.options.showPermissions;
      },
      grid(req, role) {
        if (!self.can(req, 'edit', '@apostrophecms/user')) {
          throw self.apos.error('forbidden');
        }
        const permissionSets = [];
        const effectiveRole = self.apos.launder.select(role, [ 'guest', 'contributor', 'editor', 'admin' ]);
        if (!effectiveRole) {
          throw self.apos.error('invalid', { role: effectiveRole });
        }
        const _req = self.apos.task.getReq({
          role: effectiveRole,
          mode: 'draft'
        });
        for (const module of Object.values(self.apos.modules)) {
          if (self.apos.synth.instanceOf(module, '@apostrophecms/piece-type')) {
            permissionSets.push(
              self.describePermissionSet(_req, module, { piece: true })
            );
          }
        }
        permissionSets.push(self.describePermissionSet(_req, self.apos.modules['@apostrophecms/any-page-type']));
        return {
          permissionSets: self.presentPermissionSets(permissionSets)
        };
      },
      ...require('./lib/legacy-migrations')(self)
    };
  },
  apiRoutes(self) {
    return {
      get: {
        async grid(req) {
          return self.grid(req, req.query.role);
        }
      },
      post: {
        async grid(req) {
          return self.grid(req, req.body.role);
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
