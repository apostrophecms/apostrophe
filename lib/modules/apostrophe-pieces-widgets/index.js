var _ = require('lodash');
var async = require('async');

module.exports = {
  extend: 'apostrophe-widgets',

  beforeConstruct: function(self, options) {
    self.piecesModuleName = options.piecesModuleName || self.__meta.name.replace(/\-widgets$/, '');

    self.pieces = options.apos.modules[self.piecesModuleName];
    options.label = options.label || self.pieces.pluralLabel;

    var taggable;

    if (_.isBoolean(options.taggable)) {
      taggable = options.taggable;
    } else {
      taggable = _.find(self.pieces.schema, function(field) {
        return (field.type === 'tags') && (field.name === 'tags');
      });
    }

    var addFields = [];
    if (taggable) {
      addFields.push({
        type: 'select',
        name: 'by',
        label: 'Select...',
        choices: [
          {
            value: 'id',
            label: 'Individually',
            showFields: [ '_pieces' ]
          },
          {
            value: 'tag',
            label: 'By Tag',
            showFields: [ 'tags', 'limitByTag' ]
          }
        ]
      });
    }
    addFields.push({
      type: 'joinByArray',
      name: '_pieces',
      label: 'Individually',
      idsField: 'pieceIds',
      withType: self.pieces.name
    });
    if (taggable) {
      addFields.push({
        type: 'tags',
        name: 'tags',
        label: 'By Tag'
      });
      addFields.push({
        type: 'integer',
        name: 'limitByTag',
        label: 'Maximum displayed',
        def: 5
      });
    }
    options.addFields = addFields.concat(options.addFields || []);
  },

  construct: function(self, options) {

    // Load the appropriate pieces for each widget in the array.

    self.load = function(req, widgets, callback) {

      // For performance, avoid multiple database calls. Instead,
      // create a query that matches all relevant pieces, then
      // scatter them out to the relevant widgets. This takes
      // extra code and duplicates some of the logic for joinByArray
      // and relationships, but the performance win is large. -Tom

      var clauses = [];
      var ids = [];
      var tags = [];
      var criteria = {};
      _.each(widgets, function(widget) {
        if (widget.by === 'tag') {
          tags = tags.concat(widget.tags || []);
        } else {
          ids = ids.concat(widget.pieceIds || []);
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

      var join = _.find(self.schema, { name: '_pieces' });

      return cursor.toArray(function(err, pieces) {
        if (err) {
          return callback(err);
        }
        var widgetsByPieceId = {};
        var widgetsByTag = {};
        _.each(widgets, function(widget) {
          widget._pieces = [];
          widget._piecesById = {};
          if (widget.by === 'tag') {
            _.each(widget.tags, function(tag) {
              if (!_.has(widgetsByTag, tag)) {
                widgetsByTag[tag] = [];
              }
              widgetsByTag[tag].push(widget);
            });
          } else {
            _.each(widget.pieceIds, function(_id) {
              if (!_.has(widgetsByPieceId, _id)) {
                widgetsByPieceId[_id] = [];
              }
              widgetsByPieceId[_id].push(widget);
            });
          }
        });
        _.each(pieces, function(piece) {
          if (_.has(widgetsByPieceId, piece._id)) {
            _.each(widgetsByPieceId[piece._id], function(widget) {
              if (!_.has(widget._piecesById, piece._id)) {
                push(widget, piece);
                widget._piecesById[piece._id] = true;
              }
            });
          }
          _.each(piece.tags, function(tag) {
            if (_.has(widgetsByTag, tag)) {
              _.each(widgetsByTag[tag], function(widget) {
                if (!_.has(widget._piecesById, piece._id)) {
                  if (widget._pieces.length < widget.limitByTag) {
                    push(widget, piece);
                  }
                  widget._piecesById[piece._id] = true;
                }
              });
            }
          });
          function push(widget, piece) {
            if (join.relationship && (widget.by === 'id')) {
              widget._pieces.push({
                item: piece,
                relationship: (widget[join.relationshipsField] || {})[piece._id]
              });
            } else {
              widget._pieces.push(piece);
            }
          }
        });

        // Make sure pieces are returned in the order requested
        _.each(widgets, function(widget) {
          if (widget.by === 'id') {
            var key = join.relationship ? 'item._id' : '_id';
            widget._pieces = self.apos.utils.orderById(widget.pieceIds, widget._pieces, key);
          }
        });

        return callback(null);
      });
    };
  }
};
