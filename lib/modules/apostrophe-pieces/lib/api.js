
var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  self.newInstance = function() {
    var piece = self.apos.schemas.newInstance(self.schema);
    piece.type = self.name;
    return piece;
  };

  self.find = function(req, criteria, projection) {
    var cursor = self.apos.docs.find(req, criteria, projection);
    require('./cursor.js')(self, cursor);
    return cursor;
  };


  // middleware for JSON API routes that expect the ID of
  // an existing piece at req.body._id
  self.requirePiece = function(req, res, next) {
    return self.find(req, { _id: req.body._id })
      .permission('edit')
      .published(null)
      .toObject(function(err, _piece) {
        if (err) {
          return self.apiResponse(res, err);
        }
        if (!_piece) {
          return self.apiResponse(res, 'notfound');
        }
        req.piece = _piece;
        return next();
      }
    );
  };

  // User must have some editing privileges for this type
  self.requireEditor = function(req, res, next) {
    if (!req.user) {
      return self.apiResponse(res, 'forbidden');
    }
    if (!self.apos.permissions.can(req, 'edit-' + self.name)) {
      return self.apiResponse(res, 'forbidden');
    }
    return next();
  };

  self.list = function(req, filters, callback) {
    var cursor = self.find(req);
    cursor.published(null);
    cursor.queryToFilters(filters);
    var results = {};
    return async.series({
      toCount: function(callback) {
        return cursor
          .toCount(function(err, count) {
            if (err) {
              return callback(err);
            }
            results.total = count;
            results.skip = cursor.get('skip');
            results.limit = cursor.get('limit');
            results.page = cursor.get('page');
            results.totalPages = cursor.get('totalPages');
            return callback(null);
          }
        );
      },
      toArray: function(callback) {
        return cursor
          .toArray(function(err, pieces) {
            if (err) {
              return callback(err);
            }
            results.pieces = pieces;
            return callback(null);
          }
        );
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, results);
    });
  };

  self.insert = function(req, piece, callback) {
    piece.type = self.name;
    self.apos.docs.insert(req, piece, callback);
  };

  self.update = function(req, piece, callback) {
    piece.type = self.name;
    self.apos.docs.update(req, piece, callback);
  };

  self.trash = function(req, id, callback) {
    self.apos.docs.trash(req, id, function(err, piece) {
      return callback(err);
    });
  };

  self.rescue = function(req, id, callback) {
    self.apos.docs.rescue(req, id, function(err, piece) {
      return callback(err);
    });
  };

  self.beforeCreate = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.afterCreate = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.beforeUpdate = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.afterUpdate = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.beforeTrash = function(req, id, callback) {
    return setImmediate(callback);
  };

  self.afterTrash = function(req, id, callback) {
    return setImmediate(callback);
  };

  self.beforeRescue = function(req, id, callback) {
    return setImmediate(callback);
  };

  self.afterRescue = function(req, id, callback) {
    return setImmediate(callback);
  };

  self.beforeList = function(req, filters, callback) {
    return setImmediate(callback);
  };

  self.afterList = function(req, results, callback) {
    return setImmediate(callback);
  };

  self.apiResponse = function(res, err, data) {
    if (err) {
      if (typeof(err) !== 'string') {
        err = 'error';
      }
      return res.send({ status: err });
    } else {
      return res.send({ status: 'ok', data: data });
    }
  };

  self.insertResponse = function(req, res, err, data) {
    return self.apiResponse(res, err, data);
  };

  self.updateResponse = function(req, res, err, data) {
    return self.apiResponse(res, err, data);
  };

  self.retrieveResponse = function(req, res, err, data) {
    return self.apiResponse(res, err, data);
  };

  self.listResponse = function(req, res, err, data) {
    return self.apiResponse(res, err, data);
  };

  self.trashResponse = function(req, res, err, data) {
    return self.apiResponse(res, err, data);
  };

  self.rescueResponse = function(req, res, err, data) {
    return self.apiResponse(res, err, data);
  };
};
