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
  options: { alias: 'permission' },
  init(self) {
    self.permissionPattern = /^([^-]+)-(.*)$/;
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
      }
    };
  }
};
