
var _ = require('lodash');
var async = require('async');

module.exports = function(self, options) {
  self.createRoutes = function() {
    self.route('post', 'manager', self.routes.manager);
    self.route('post', 'list', self.routes.list);
    self.route('post', 'add', self.routes.add);
    self.route('post', 'edit', self.routes.edit);
    self.route('post', 'trash', self.routes.trash);
    self.route('all', 'autocomplete', self.routes.autocomplete);
  };

  self.routes = {};

  self.routes.list = function(req, res) {
    var data = {};
    return async.series({
      before: function(callback) {
        return self.beforeList(req, callback);
      },
      list: function(callback) {
        return self.list(req, function(err, results) {
          if (err) {
            return callback(err);
          }
          data.results = results;
          return callback();
        });
      },
      after: function(callback) {
        return self.afterList(req, callback);
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

  self.routes.add = function(req, res) {
    return res.send({ status: 'ok' });
  };

  self.routes.edit = function(req, res) {
    return async.series({
      before: function(callback) {
        return self.beforeEdit(req, callback);
      },
      trash: function(callback) {
        return self.edit(req, callback);
      },
      after: function(callback) {
        return self.afterEdit(req, callback);
      }
    }, function(err) {
      if (err) {
        return res.send({ status: 'error' });
      }
      return res.send({ status: 'ok' });
    });
  };

  self.routes.trash = function(req, res) {
    return async.series({
      before: function(callback) {
        return self.beforeTrash(req, callback);
      },
      trash: function(callback) {
        return self.trash(req, callback);
      },
      after: function(callback) {
        return self.afterTrash(req, callback);
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
