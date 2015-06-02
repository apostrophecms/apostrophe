module.exports = function(self, options) {

  self.create = function() {
    return self.apos.schemas.newInstance(self.schema);
  },

  self.find = function(req, criteria, projection) {
    var cursor = self.apos.docs.find(req, criteria, projection);
    require('./cursor.js')(self, cursor);
    return cursor;
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

  self.beforeInsert = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.afterInsert = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.beforeUpdate = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.afterUpdate = function(req, piece, callback) {
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
