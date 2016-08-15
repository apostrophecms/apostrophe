var _ = require('lodash');

module.exports = {

  alias: 'groups',
  extend: 'apostrophe-pieces',
  name: 'apostrophe-group',
  label: 'Group',
  pluralLabel: 'Groups',
  // Means not included in public sitewide search. -Tom
  searchable: false,
  // You can't give someone permission to edit groups because that
  // allows them to make themselves an admin. -Tom
  adminOnly: true,
  addFields: [
    {
      type: 'joinByArrayReverse',
      name: '_users',
      label: 'Users',
      idsField: 'groupIds',
      withType: 'apostrophe-user',
      ifOnlyOne: true
    },
    {
      type: 'checkboxes',
      name: 'permissions',
      label: 'Permissions',
      // This gets patched at modulesReady time
      choices: []
    }
  ],

  beforeConstruct: function(self, options) {
    options.removeFields = (options.minimumRemoved || [ 'published' ])
      .concat(options.removeFields || []);

    options.removeFilters = [ 'published' ]
      .concat(options.removeFilters || []);
  },

  construct: function(self, options) {
    self.apos.define('apostrophe-groups-cursor', require('./lib/cursor.js'));

    self.modulesReady = function() {
      self.setPermissionsChoices();
      self.addToAdminBarIfSuitable();
    };

    self.setPermissionsChoices = function() {
      var permissions = _.find(self.schema, { name: 'permissions' });
      if (!permissions) {
        return;
      }
      permissions.choices = self.apos.permissions.getChoices();
    };

    self.addToAdminBar = function() {};

    self.addToAdminBarIfSuitable = function() {
      if (self.apos.users.options.groups) {
        // Using the simplified group choice menu, so
        // there is no managing of groups by the end user
      } else {
        self.apos.adminBar.add(self.__meta.name, self.pluralLabel, self.isAdminOnly() ? 'admin' : ('edit-' + self.name), { after: 'apostrophe-users' });
      }
    };

  }

}
