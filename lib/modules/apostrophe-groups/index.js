module.exports = {

  alias: 'groups',
  extend: 'apostrophe-pieces',
  name: 'apostrophe-group',
  label: 'Group',
  pluralLabel: 'Groups',
  addFields: [
    {
      type: 'joinByArrayReverse',
      name: '_users',
      label: 'Users',
      idsField: 'groupIds',
      withType: 'apostrophe-user',
      ifOnlyOne: true
    }
  ],

  beforeConstruct: function(self, options) {
    options.removeFields = (options.minimumRemoved || [ 'published' ])
      .concat(options.removeFields || []);

    options.removeFilters = [ 'published' ]
      .concat(options.removeFilters || []);
  },

  construct: function(self, options) {
    // Since groups are never published,
    // if you are deliberately fetching groups,
    // we assume you don't care if they are published.
    var superFind = self.find;
    self.find = function(req, criteria, projection){
      return superFind(req, criteria, projection).published(null);
    };



  }

}
