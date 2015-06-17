module.exports = {
  extend: 'apostrophe-widgets',
  addFields: [
    {
      type: 'select',
      name: 'by',
      label: 'Select By...',
      choices: [
        {
          value: '_id',
          label: 'Title',
          showFields: [ '_pieces' ]
        },
        {
          value: 'tag',
          label: 'Tag',
          showFields: [ 'tags', 'limitByTag' ]
        }
      ]
    },
    {
      type: 'joinByArray',
      name: '_pieces',
      label: 'Select by Title',
      idsField: 'piecesIds'
    },
    {
      type: 'tags',
      name: 'tags',
      label: 'Select by Tag'
    },
    {
      type: 'integer',
      name: 'limitByTag',
      label: 'Maximum displayed',
      def: 5
    },
  ],
  self.load = function(req, widgets, callback) {
    var clauses = [];
    var ids = [];
    var tags = [];
    var criteria = {};
    _.each(widgets, function(widget) {
      if (widget.by === '_id') {
        ids = ids.concat(widget.piecesIds || []);
      } else {
        tags = tags.concat(widget.tags || []);
      }
    });
    if (ids.length) {
      clauses.push({ _id: { $in: ids } });
      clauses.push({ tags: { $in: tags } });
    }
    if (!clauses.length) {
      criteria = {};
    } else {
      criteria = { $or: clauses };
    }
    return self.apos.schemas.join(req, self.schema, widgets, undefined, callback);
  };
};
