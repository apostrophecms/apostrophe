
var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {
  self.createRoutes = function() {
    self.route('post', 'manager', self.routes.manager);
    self.route('post', 'listTags', self.routes.listTags);
    self.route('post', 'addTag', self.routes.addTag);
    self.route('post', 'renameTag', self.routes.renameTag);
    self.route('post', 'deleteTag', self.routes.deleteTag);
    self.route('all', 'autocomplete', self.routes.autocomplete);
  };

  self.routes = {};

  self.routes.listTags = function(req, res) {
    var data = {};
    return async.series({
      before: function(callback) {
        return self.beforeListTags(req, callback);
      },
      list: function(callback) {
        return self.listTags(req, function(err, results) {
          if (err) {
            return callback(err);
          }
          data.results = results;
          return callback();
        });
      },
      after: function(callback) {
        return self.afterListTags(req, callback);
      }
    }, function(err) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok', data: {
        results: self.render(req, 'manageList', data)
      } });
    });
  };

  self.routes.addTag = function(req, res) {
    return async.series({
      before: function(callback) {
        return self.beforeAddTag(req, callback);
      },
      add: function(callback) {
        return self.addTag(req, callback);
      },
      after: function(callback) {
        return self.afterAddTag(req, callback);
      }
    }, function(err) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok' });
    });
  };

  self.routes.renameTag = function(req, res) {
    return async.series({
      before: function(callback) {
        return self.beforeRenameTag(req, callback);
      },
      trash: function(callback) {
        return self.renameTag(req, callback);
      },
      after: function(callback) {
        return self.afterRenameTag(req, callback);
      }
    }, function(err) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok' });
    });
  };

  self.routes.deleteTag = function(req, res) {
    var piece;
    return async.series({
      before: function(callback) {
        return self.beforeDeleteTag(req, tag, callback);
      },
      delete: function(callback) {
        return self.deleteTag(req, tag, callback);
      },
      findPiece: function(callback) {
        return self.find(req, { type: self.name, slug: tag })
          .toObject(function (err, result) {
            if (err) {
              return callback(err);
            }
            piece = result;
            return callback();
          }
        );
      },
      trashPiece: function(callback) {
        if (!piece) {
          return setImmediate(callback);
        }
        return self.trash(req, piece._id, callback);
      },
      after: function(callback) {
        return self.afterDeleteTag(req, tag, callback);
      }
    }, function(err) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok' });
    });
  };

  self.routes.manager = function(req, res) {
    return res.send(self.render(req, 'manager', { options: self.options }));
  };

  // localhost:XXXX/modules/apostrophe-tags/autocomplete
  self.routes.autocomplete = function(req, res) {
    var data = (req.method === 'POST') ? req.body : req.query;

    // Special case: selective is asking for complete objects with
    // label and value properties for existing values. For tags these
    // are one and the same so just do a map call

    if (data.values) {
      return res.send(_.map(data.values, function(value) {
        return { value: value, label: value };
      }));
    }

    var criteria = {}
    if(data.prefix) {
      criteria = { prefix: data.term };
    } else {
      criteria = { contains: data.term };
    }

    return self.get(req, criteria, function(err, tags) {
      if (err) {
        return callback(err);
      }
      tags = _.map(tags, function(tag) {
        return { value: tag, label: tag };
      });
      if (tags.length > 100) {
        tags = tags.slice(0, 100);
      }
      return res.send(tags);
    });
  };

};
