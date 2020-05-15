// `apostrophe-pieces-widgets` provides widgets that display display pieces of a
// particular type around the site.
//
// You will `extend` this module in new modules corresponding to your modules
// that extend `apostrophe-pieces`.
//
// To learn more and see complete examples, see:
//
// [Reusable content with pieces](/core-concepts/reusable-content-pieces)
//
// ## options
//
// ### `loadManyById`
//
// If `true` (the default), Apostrophe will take all the widgets passed to the `load` method for which pieces
// were chosen "by id", i.e. manually in a join, and do a single query to fetch them. This is usually more efficient,
// however if you have customized the `loadOne` method you may not wish to use it.
//
// ### `limitByAll`
//
// Integer that sets the widget cursor limit when all pieces are fetched.
// If this option is not set, editors will be presented with the usual
// `Maximum Displayed` schema field to set this number manually
//
// ### `limitByTag`
//
// Integer that sets the widget cursor limit when pieces are fetched by tag.
// If this option is not set, editors will be presented with the usual
// `Maximum Displayed` schema field to set this number manually
//
// ### `limitById`
//
// Integer that sets the widget cursor limit for fetching
// pieces individually

var _ = require('@sailshq/lodash');
var async = require('async');

module.exports = {

  extend: 'apostrophe-widgets',

  loadManyById: true,
  limitByAll: null,
  limitByTag: null,
  limitById: null,

  // cursor filters to apply when loading pieces for this widget type. A common
  // case is to restrict the `projection` filter to improve performance
  filters: {},

  beforeConstruct: function(self, options) {
    self.piecesModuleName = options.piecesModuleName || self.__meta.name.replace(/-widgets$/, '');

    self.pieces = options.apos.modules[self.piecesModuleName];
    if (!self.pieces) {
      if (!options.piecesModuleName) {
        throw new Error('The module ' + self.__meta.name + ' extends apostrophe-pieces-widgets, but the piecesModuleName option is not set, and we can\'t guess it from the name of your module.');
      } else {
        throw new Error('The module ' + self.__meta.name + ' has a piecesModuleName option that does not match any existing module.');
      }
    }
    options.label = options.label || self.pieces.pluralLabel;
    // A pieces widget generally doesn't edit things when you click "Edit,"
    // it selects things (although you can create and select things, or
    // edit and then select things)
    self.editLabel = options.editLabel || 'Select ' + options.label;
    var by;
    if (options.by) {
      by = options.by;
    } else {
      by = [ 'all', 'id' ];
      if (_.find(self.pieces.schema, function(field) {
        return (field.type === 'tags') && (field.name === 'tags');
      })) {
        by.push('tag');
      }
    }

    var addFields = [];

    var byChoicesInfo = {
      id: {
        value: 'id',
        label: 'Individually',
        showFields: [ '_pieces' ]
      },
      all: {
        value: 'all',
        label: options.byAllLabel || 'All',
        showFields: options.limitByAll ? undefined : [ 'limitByAll' ]
      },
      tag: {
        value: 'tag',
        label: options.byTagLabel || 'By Tag',
        showFields: [ 'tags' ].concat(options.limitByTag ? [] : [ 'limitByTag' ])
      }
    };

    var byChoices = _.map(_.filter(by, function(source) {
      return _.has(byChoicesInfo, source);
    }), function(source) {
      return byChoicesInfo[source];
    });

    addFields.push({
      type: 'select',
      name: 'by',
      // This just keeps the words "id", "all" and "tag" from cluttering
      // up the search index. It has NO impact on the searchability
      // of the pieces. -Tom
      searchable: false,
      label: 'Select...',
      def: byChoices[0] && byChoices[0].value,
      choices: byChoices,
      contextual: byChoices.length <= 1
    });

    if (_.contains(by, 'all') && !options.limitByAll) {
      addFields.push({
        type: 'integer',
        name: 'limitByAll',
        label: 'Maximum displayed',
        def: 5
      });
    }

    if (_.contains(by, 'id')) {
      var piecesField = {
        type: 'joinByArray',
        name: '_pieces',
        label: (byChoices.length > 1) ? 'Individually' : 'Select...',
        idsField: 'pieceIds',
        withType: self.pieces.name
      };
      if (options.limitById) {
        piecesField.limit = options.limitById;
      }
      addFields.push(piecesField);
    }

    if (_.contains(by, 'tag')) {
      addFields.push({
        type: 'tags',
        name: 'tags',
        label: 'By Tag'
      });

      if (!options.limitByTag) {
        addFields.push({
          type: 'integer',
          name: 'limitByTag',
          label: 'Maximum displayed',
          def: 5
        });
      }
    }

    var arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [
          'by',
          '_pieces',
          'limitByAll',
          'tags',
          'limitByTag'
        ]
      }
    ];

    options.addFields = addFields.concat(options.addFields || []);

    options.arrangeFields = arrangeFields.concat(options.arrangeFields || []);

    options.browser = _.defaults(options.browser || {}, {
      piecesModuleName: self.piecesModuleName
    });
  },

  construct: function(self, options) {

    self.filters = options.filters;

    // Load the appropriate pieces for each widget in the array. Apostrophe will try to feed
    // us as many at once as it can to cut down on database queries. We'll take all the
    // widgets for which pieces were chosen "by id" and do a single query, via
    // self.loadManyById. For everything we'll call self.loadOne individually, via
    // self.loadOthersOneAtATime. But in ALL cases, we invoke self.afterLoadOne for
    // each widget, allowing an opportunity to do custom work without thinking
    // about all this.
    //
    // Also in all cases, joins found in the schema other than the `_pieces` join
    // are loaded in the normal way for each widget.

    self.load = function(req, widgets, callback) {
      // Since we are overriding the default load method of `apostrophe-widgets`, make
      // sure we still implement the `scene` option for assets

      if (self.options.scene) {
        req.scene = self.options.scene;
      }

      if (!self.options.loadManyById) {
        // Carrying out one big query for all widgets that select pieces by id has been
        // disabled for this module
        return self.loadOthersOneAtATime(req, widgets, callback);
      }
      var byId = _.filter(widgets, { by: 'id' });
      var byOther = _.difference(widgets, byId);
      return async.series([
        _.partial(self.loadManyById, req, byId),
        _.partial(self.loadOthersOneAtATime, req, byOther),
        _.partial(self.loadOtherJoins, req, widgets)
      ], callback);
    };

    // Load many widgets, all of which were set to choose pieces "by id." This allows
    // Apostrophe to work efficiently when a page contains many pieces widgets in an
    // array, etc. This method is called by self.load, you don't need to call it yourself.
    //
    // This method still calls afterLoadOne for each widget, so there is still a simple
    // way to go beyond this if you need to do something fancy after a widget has been
    // through the normal loading process.

    self.loadManyById = function(req, widgets, callback) {

      // scatter-gather thing, then...
      var ids = _.reduce(widgets, function(ids, widget) {
        return ids.concat(widget.pieceIds || []);
      }, []);

      var widgetsByPieceId = {};

      _.each(widgets, function(widget) {
        widget._pieces = [];
        widget._piecesById = {};
        _.each(widget.pieceIds || [], function(_id) {
          if (!_.has(widgetsByPieceId, _id)) {
            widgetsByPieceId[_id] = [];
          }
          widgetsByPieceId[_id].push(widget);
        });
      });

      var cursor = self.widgetCursor(req, { _id: { $in: ids } });

      return cursor.toArray(function(err, pieces) {
        if (err) {
          return callback(err);
        }
        _.each(pieces, function(piece) {
          if (_.has(widgetsByPieceId, piece._id)) {
            _.each(widgetsByPieceId[piece._id], function(widget) {
              if (!_.has(widget._piecesById, piece._id)) {
                self.pushPieceForWidget(widget, piece);
                widget._piecesById[piece._id] = true;
              }
            });
          }
        });

        // Make sure pieces are returned in the order they appear in the list chosen by the user
        _.each(widgets, function(widget) {
          self.orderPiecesForWidget(widget);
        });
        // Give every widget a chance to have special sauce in its afterLoadOne method
        return async.eachSeries(widgets, _.partial(self.afterLoadOne, req), callback);
      });

    };

    // Load widgets that were NOT set to choose pieces "by id." Feeds them all
    // through self.loadOne and self.afterLoadOne. You don't have to call this,
    // self.load calls it for you.

    self.loadOthersOneAtATime = function(req, widgets, callback) {

      return async.eachSeries(widgets, function(widget, callback) {
        return async.series([ _.partial(self.loadOne, req, widget), _.partial(self.afterLoadOne, req, widget) ], callback);
      }, callback);
    };

    // Load related content for a single widget. This method is invoked only
    // if the `loadManyById` option has been set to `false` for your subclass.
    // Doing so has performance costs when widgets are numerous.

    self.loadOne = function(req, widget, callback) {
      // Go get stuff by tag / by all, with limit, attach to widget, then...
      var cursor = self.widgetCursor(req, {});
      if (widget.by === 'tag') {
        cursor.and({ tags: { $in: widget.tags } });
        cursor.limit(self.options.limitByTag || widget.limitByTag || 5);
      } else if (widget.by === 'all') {
        // We are interested in everything
        cursor.limit(self.options.limitByAll || widget.limitByAll || 5);
      } else if (widget.by === 'id') {
        // By default, "by id" goes through a separate path, but support it here
        // so that the loadOne method can be used directly and naively to load
        // a widget, no matter how it is set up. Also useful if the loadManyById
        // option is disabled
        cursor.and({ _id: { $in: widget.pieceIds || [] } });
      }
      return cursor.toArray(function(err, pieces) {
        if (err) {
          return callback(err);
        }
        self.attachPiecesToWidget(widget, pieces);
        return callback(null);
      });
    };

    self.loadOtherJoins = function(req, widgets, callback) {
      var schema = _.filter(self.schema, function(field) {
        return field.type.match(/^join/) && (field.name !== '_pieces');
      });
      return self.apos.schemas.join(req, schema, widgets, undefined, callback);
    };

    // Given an array of pieces, this method attaches them to the widget
    // as the _pieces property correctly with pushPiecesToWidget, and
    // orders them correctly if the user chose them in a specific order

    self.attachPiecesToWidget = function(widget, pieces) {
      widget._pieces = [];
      _.each(pieces, function(piece) {
        self.pushPieceForWidget(widget, piece);
      });
      self.orderPiecesForWidget(widget);
    };

    var superComposeSchema = self.composeSchema;

    // Extend `composeSchema` to capture the join field
    // as `self.joinById`.
    self.composeSchema = function() {
      superComposeSchema();
      self.joinById = _.find(self.schema, { name: '_pieces' });
    };

    // A utility method that puts the pieces loaded for the widget in the
    // order requested by the user. widget._pieces should already be loaded
    // at this point. Called for you by the widget loader methods; useful
    // if you are overriding loadOne and disabling loadManyById

    self.orderPiecesForWidget = function(widget) {
      if (widget.by !== 'id') {
        return;
      }
      var key = self.joinById.relationship ? 'item._id' : '_id';
      widget._pieces = self.apos.utils.orderById(widget.pieceIds, widget._pieces, key);
    };

    // A utility method to append a piece to the ._pieces array for the given widget correctly,
    // whether the join has relationship properties or not.

    self.pushPieceForWidget = function(widget, piece) {
      if (self.joinById && self.joinById.relationship && (widget.by === 'id')) {
        widget._pieces.push({
          item: piece,
          relationship: (widget[self.joinById.relationshipsField] || {})[piece._id]
        });
      } else {
        widget._pieces.push(piece);
      }
    };

    // This ALWAYS gets called, so you can do special handling here no matter what.
    // Whether your widgets were loaded en masse "by id" or one at a time, this method
    // always gets called for each.

    self.afterLoadOne = function(req, widget, callback) {
      return setImmediate(callback);
    };

    // Hook to modify cursor before the load method is invoked. Applies the filters
    // specified for the join.

    self.widgetCursor = function(req, criteria) {
      var filters = self.filters || (self.joinById && self.joinById.filters);
      return self.pieces.find(req, criteria).applyFilters(filters);
    };

    // Returns true if the widget is considered empty

    self.isEmpty = function(widget) {
      if (widget._pieces) {
        return (!widget._pieces.length);
      }
      return false;
    };

  }
};
