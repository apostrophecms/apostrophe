var _ = require('lodash');
var async = require('async');

module.exports = {
  extend: 'apostrophe-widgets',
  addFields: [
    {
      type: 'select',
      name: 'by',
      label: 'Select By...',
      choices: [
        {
          value: 'id',
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
      idsField: 'pieceIds'
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

  beforeConstruct: function(self, options) {
    self.piecesModuleName = options.piecesModuleName || self.__meta.name.replace(/\-widgets$/, '');

    self.pieces = options.apos.modules[self.piecesModuleName];
    options.label = options.label || self.pieces.pluralLabel;
  },

  construct: function(self, options) {


    // Load the appropriate pieces for each widget in the array.

    self.load = function(req, widgets, callback) {

      // For performance, avoid multiple database calls. Instead,
      // create a query that matches all relevant pieces, then
      // scatter them out to the relevant widgets. This takes
      // extra code but the performance win is large. -Tom

      var clauses = [];
      var ids = [];
      var tags = [];
      var criteria = {};
      _.each(widgets, function(widget) {
        if (widget.by === 'id') {
          ids = ids.concat(widget.pieceIds || []);
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
      var cursor = self.pieces.find(req, criteria);
      return cursor.toArray(function(err, pieces) {
        if (err) {
          return callback(err);
        }
        var widgetsByPieceId = {};
        var widgetsByTag = {};
        _.each(widgets, function(widget) {
          widget._pieces = [];
          widget._piecesById = {};
          if (widget.by === 'id') {
            _.each(widget.pieceIds, function(_id) {
              if (!_.has(widgetsByPieceId, _id)) {
                widgetsByPieceId[_id] = [];
              }
              widgetsByPieceId[_id].push(widget);
            });
          } else if (widget.by === 'tag') {}
            _.each(widget.tags, function(tag) {
            if (!_.has(widgetsByTag, tag)) {
              widgetsByTag[tag] = [];
            }
            widgetsByTag[tag].push(widget);
          });
        });
        _.each(pieces, function(piece) {
          if (_.has(widgetsByPieceId, piece._id)) {
            // TODO: where pieces are fetched by title,
            // restore their order (use an insertion sort)
            _.each(widgetsByPieceId[piece._id], function(widget) {
              if (!_.has(widget._piecesById, piece._id)) {
                widget._pieces.push(piece);
                widget._piecesById[piece._id] = true;
              }
            });
          }
          _.each(piece.tags, function(tag) {
            if (_.has(widgetsByTag, tag)) {
              _.each(widgetsByTag[tag], function(widget) {
                if (!_.has(widget._piecesById, piece._id)) {
                  if (widget._pieces.length < widget.limitByTag) {
                    widget._pieces.push(piece);
                  }
                  widget._piecesById[piece._id] = true;
                }
              });
            }
          });
        });

        // Make sure pieces are returned in the order requested
        _.each(widgets, function(widget) {
          if (widget.by === 'id') {
            widget._pieces = self.apos.utils.orderById(widget.pieceIds, widget._pieces);
          }
        });

        return callback(null);
      });
    };
  }
};
