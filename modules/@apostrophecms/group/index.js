// Provide a way to group [@apostrophecms/user](../@apostrophecms/user/index.html) together
// and assign permissions to them. This module is always active "under the hood," even if
// you take advantage of the `groups` option of `@apostrophecms/user` to skip a separate
// admin bar button for managing groups. **To make an admin bar button available
// for managing groups, do NOT set the `groups` option when configuring the
// `@apostrophecms/user` module. That option configures a hardcoded list of groups
// as a simplified alternative.**
//
// By default the `published` schema field is removed. As a general rule we believe
// that conflating users and groups, who can log into the website, with public directories
// of people most often leads to confusion. Use a separate subclass of pieces to
// represent departments, etc.
//
// If you do add the `published` field back you will need to extend the cursor to make
// `published(true)` the default again.
//
// This module is **not** intended to be extended with new subclass modules, although
// you may implicitly subclass it at project level to change its behavior.

let _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    alias: 'group',
    name: '@apostrophecms/group',
    label: 'Group',
    pluralLabel: 'Groups',
    searchable: false,
    adminOnly: true,
    addFields: [
      {
        type: 'reverseJoin',
        name: '_users',
        label: 'Users',
        idsField: 'groupIds',
        withType: '@apostrophecms/user',
        ifOnlyOne: true
      },
      {
        type: 'checkboxes',
        name: 'permissions',
        label: 'Permissions',
        // This gets patched at modulesReady time
        choices: []
      }
    ]
  },
  beforeSuperClass(self, options) {
    options.removeFields = (options.minimumRemoved || ['published']).concat(options.removeFields || []);

    options.removeFilters = ['published'].concat(options.removeFilters || []);
  },
  init(self, options) {
    self.enableAddGroupTask();
  },
  handlers(self, options) {
    return {
      'apostrophe:modulesReady': {
        setChoicesAndAddToAdminBar() {
          self.setPermissionsChoices();
          self.addToAdminBarIfSuitable();
        }
      }
    };
  },
  methods(self, options) {
    return {

      setPermissionsChoices() {
        const permissions = _.find(self.schema, { name: 'permissions' });
        if (!permissions) {
          return;
        }
        permissions.choices = self.apos.permission.getChoices();
      },

      // Kill off default version of this method so we can add
      // more selectively
      addToAdminBar() {
      },

      // Adds an admin bar button if and only if the `@apostrophecms/user` module
      // is not using its `groups` option for simplified group administration.

      addToAdminBarIfSuitable() {
        if (self.apos.user.options.groups) {
        } else {
          self.apos.adminBar.add(self.__meta.name, self.pluralLabel, self.isAdminOnly() ? 'admin' : 'edit-' + self.name, { after: '@apostrophecms/user' });
        }
      },
      enableAddGroupTask() {
        self.apos.task.add(self.__meta.name, 'add', 'Usage: node app @apostrophecms/group:add groupname permission1 permission2...\n\nTo list available permissions, run:\n\nnode app @apostrophecms/permission:list', async function (apos, argv) {
          const req = self.apos.task.getReq();
          const groupname = argv._[1];
          if (!groupname) {
            throw 'You must specify a group name.';
          }
          const permissions = argv._.slice(2);
          _.each(permissions, function (permission) {
            if (!_.includes(_.map(self.apos.permission.getChoices(), 'value'), permission)) {
              throw 'The permission ' + permission + ' does not exist. Use node app @apostrophecms/permission:list to list available permissions.';
            }
          });
          const exists = await self.find(req, { title: groupname }).toObject();
          if (exists) {
            throw 'Group already exists.';
          }
          await self.insert(req, {
            title: groupname,
            permissions: permissions
          });
        });
      }
    };
  },
  extendMethods(self, options) {
    return {
      find(_super, req, criteria, projection) {
        return _super(req, criteria, projection).published(null);
      }
    };
  }
};
