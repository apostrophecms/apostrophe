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

  construct: function(self, options) {

    options.removeFields = (self.options.minimumRemoved || [ 'published' ])
      .concat(options.removeFields || []);

    options.removeFilters = [ 'published' ]
      .concat(options.removeFilters || []);

    // Since groups are never piublished,
    // if you are deliberately fetching groups,
    // we assume you don't care if they are published.

    var superFind = self.find;
    self.find = function(req, criteria, projection){
      return superFind(req, criteria, projection).published(null);
    };



  }

}
