
var async = require('async');

module.exports = function(self, options) {

  self.createRoutes = function() {

    self.route('post', 'insert', self.routes.insert);
    self.route('post', 'retrieve', self.requirePiece, self.routes.retrieve);
    self.route('post', 'list', self.routes.list);
    self.route('post', 'update', self.requirePiece, self.routes.update);
    self.route('get', 'manage', self.requireEditor, function(req, res) {
      // We could be more selective about passing
      // self.options, but that would make this code
      // more brittle as new options are added in subclasses
      return res.send(self.render(req, 'manage', self.options));
    });

    self.route('post', 'trash', self.requirePiece, self.routes.trash);
  };

  self.routes = {};

  self.routes.insert = function(req, res) {
    var piece = self.newInstance();

    return async.series({
      // hint: a partial object, or even passing no fields
      // at this point, is OK
      convert: function(callback) {
        return self.apos.schemas.convert(req, self.schema, 'form', req.body, piece, callback);
      },
      before: function(callback) {
        return self.beforeCreate(req, piece, callback);
      },
      insert: function(callback) {
        return self.insert(req, piece, callback);
      },
      after: function(callback) {
        return self.afterCreate(req, piece, callback);
      }
    }, function(err) {
      return self.apiResponse(res, err, piece);
    });
  };

  self.routes.retrieve = function(req, res) {
    return self.apiResponse(res, null, req.piece);
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
      if ((!err) && (req.body.format === 'manage-page')) {
        results = {
          list: self.render(req, 'managePage', results),
          pager: self.render(req, 'pager', results)
        };
      }
      return self.apiResponse(res, err, results);
    });
  };

  self.routes.update = function(req, res) {
    var schema = self.schema;
    return async.series({
      convert: function(callback) {
        return self.apos.schemas.convert(req, self.schema, 'form', req.body, req.piece, callback);
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
      return self.apiResponse(res, err, req.piece);
    });
  };

  self.routes.trash = function(req, res) {
    // TODO implement
    res.send();
  };

};
