
var _ = require('lodash');

module.exports = function(self, options) {

  self.newInstance = function() {
    return self.apos.schemas.newInstance(self.schema);
  };

  self.find = function(req, criteria, projection) {
    var cursor = self.apos.docs.find(req, criteria, projection);
    require('./cursor.js')(self, cursor);
    return cursor;
  };

  var whitelist = [ 'and', 'projection', 'sort', 'skip', 'limit' ];

  self.addFilters = function(req, filters, cursor) {

    _.each(filters, function(value, name) {
      if(_.contains(whitelist, name) && cursor[name]) {
        var launder = cursor[name].launder || self.apos.launder.string;
        cursor[name](launder(value));
      }
    });
    // two whitelists, one for manage views, one for normal views

  };

  // middleware for JSON API routes that expect the ID of
  // an existing piece at req.body._id
  self.requirePiece = function(req, res, next) {
    return self.find(req, { _id: req.body._id }).permission('edit').toObject(function(err, _piece) {
      if (err) {
        return self.apiResponse(res, err);
      }
      if (!piece) {
        return self.apiResponse(res, 'notfound');
      }
      req.piece = _piece;
      return next();
    });
  };

  self.list = function(req, pieces, callback) {
    var cursor = self.find(req);
    var filters = req.body || [];
    self.addFilters(req, filters, cursor);

    cursor.toArray(function(err, pieces) {
      return callback();
    });
  };

  self.insert = function(req, piece, callback) {
    self.apos.docs.insert(req, piece, callback);
  };

  self.update = function(req, piece, callback) {
    self.apos.docs.update(req, piece, callback);
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

  self.beforeList = function(req, pieces, callback) {
    return setImmediate(callback);
  };

  self.afterList = function(req, pieces, callback) {
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

};
