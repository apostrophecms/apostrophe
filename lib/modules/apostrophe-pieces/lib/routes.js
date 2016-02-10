var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  self.createRoutes = function() {

    self.route('post', 'insert', self.routes.insert);
    self.route('post', 'retrieve', self.requirePiece, self.routes.retrieve);
    self.route('post', 'list', self.routes.list);
    self.route('post', 'update', self.requirePiece, self.routes.update);
    self.route('post', 'manage', self.requireEditor, self.routes.manage);
    self.route('post', 'chooser', self.requireEditor, self.routes.chooser);
    self.route('post', 'editor', self.requireEditor, self.routes.editor);
    self.route('post', 'create', self.requireEditor, self.routes.create);


    // TODO consider the following:
    // not using requirePiece for trash route because docs.trash already does
    // query to get the piece. it would be nice if you could pass a piece in
    // place of an id or criteria object so you can manipulate the object
    // earlier without performing additional queries

    // Another option here would be to hook into the docsBeforeTrash and
    // docsAfterTrash callAlls that take place in the trash method of docs
    self.route('post', 'trash', self.routes.trash);
    self.route('post', 'route', self.routes.rescue);
  };

  self.routes = {};

  self.routes.insert = function(req, res) {
    var piece = self.newInstance();

    return async.series({
      // hint: a partial object, or even passing no fields
      // at this point, is OK
      convert: function(callback) {
        return self.convert(req, piece, callback);
      },
      afterConvert: function(callback) {
        return self.afterConvert(req, piece, callback);
      },
      beforeCreate: function(callback) {
        return self.beforeCreate(req, piece, callback);
      },
      beforeSave: function(callback) {
        return self.beforeSave(req, piece, callback);
      },
      insert: function(callback) {
        return self.insert(req, piece, callback);
      },
      afterCreate: function(callback) {
        return self.afterCreate(req, piece, callback);
      },
      afterSave: function(callback) {
        return self.afterSave(req, piece, callback);
      },
    }, function(err) {
      return self.insertResponse(req, res, err, piece);
    });
  };

  self.routes.retrieve = function(req, res) {
    return self.retrieveResponse(req, res, null, req.piece);
  };

  self.routes.list = function(req, res) {
    var results;
    var filters = req.body || {};
    return async.series({
      before: function(callback) {
        return self.beforeList(req, filters, callback);
      },
      list: function(callback) {

        return self.list(req, filters, function(err, _results) {
          if (err) {
            return callback(err);
          }
          results = _results;
          return callback(null);
        });
      },
      after: function(callback) {
        return self.afterList(req, results, callback);
      }
    }, function(err) {
      if ((!err) && (req.body.format === 'managePage')) {
        results.options = results.options || {};
        results.options.name = self.name;
        results.options.label = self.label;
        results.options.pluralLabel = self.pluralLabel;
        results.options.manageViews = self.options.manageViews;
        results.schema = self.schema;
        results.filters = { options: self.filters, choices: filters || {}, q: filters.search };
        results.columns = self.columns;
        results.sorts = self.sorts;
        var actualSort = results.cursor.get('sort');
        _.each(results.sorts, function(sortConfig) {
          if (_.isEqual(sortConfig.sort, actualSort)) {
            results.sort = sortConfig.name;
            return false;
          }
        });
        if (_.contains(self.manageViews, req.body.manageView)) {
          view = req.body.manageView;
        } else {
          view = self.manageViews[0];
        }
        results.options.currentView = view;
        // list -> manageListView, etc.
        var viewTemplate = 'manage' + self.apos.utils.capitalizeFirst(view) + 'View';
        results = {
          filters: self.render(req, 'manageFilters', results),
          view: self.render(req, viewTemplate, results),
          pager: self.render(req, 'pager', results)
        };
      }
      return self.listResponse(req, res, err, results);
    });
  };

  self.routes.update = function(req, res) {
    var schema = self.schema;
    return async.series({
      convert: function(callback) {
        return self.convert(req, req.piece, callback);
      },
      afterConvert: function(callback) {
        return self.afterConvert(req, req.piece, callback);
      },
      before: function(callback) {
        return self.beforeUpdate(req, req.piece, callback);
      },
      update: function(callback) {
        return self.update(req, req.piece, callback);
      },
      after: function(callback) {
        return self.afterUpdate(req, req.piece, callback);
      },
    }, function(err) {
      return self.updateResponse(req, res, err, req.piece);
    });
  };

  self.routes.manage = function(req, res) {
    // We could be more selective about passing
    // self.options, but that would make this code
    // more brittle as new options are added in subclasses
    return res.send(self.render(req, 'manage', { options: self.options, schema: self.schema }));
  };

  self.routes.chooser = function(req, res) {
    return res.send(self.render(req, 'chooser', { options: self.options, schema: self.schema, chooser: true }));
  };

  self.routes.editor = function(req, res) {
    return res.send(self.render(req, 'editor', { options: self.options, schema: self.schema }));
  };

  self.routes.create = function(req, res) {
    return res.send(self.render(req, 'create', { options: self.options, schema: self.schema }));
  };

  self.routes.trash = function(req, res) {
    return async.series({
      before: function(callback) {
        return self.beforeTrash(req, req.body._id, callback);
      },
      trash: function(callback) {
        return self.trash(req, req.body._id, callback);
      },
      after: function(callback) {
        return self.afterTrash(req, req.body._id, callback)
      }
    }, function(err) {
      return self.trashResponse(req, res, err, {});
    });
  };

  self.routes.rescue = function(req, res) {
    return async.series({
      before: function(callback) {
        return self.beforeRescue(req, req.body._id, callback);
      },
      rescue: function(callback) {
        return self.rescue(req, req.body._id, callback);
      },
      after: function(callback) {
        return self.afterRescue(req, req.body._id, callback);
      }
    }, function(err) {
      return self.rescueResponse(req, res, err, {});
    });
  };
};
