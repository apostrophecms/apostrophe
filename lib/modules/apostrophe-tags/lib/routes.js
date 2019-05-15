
var _ = require('@sailshq/lodash');
var async = require('async');

module.exports = function(self, options) {
  self.createRoutes = function() {
    self.route('post', 'manager', self.routes.manager);
    self.route('post', 'listTags', self.routes.listTags);
    self.route('post', 'addTag', self.routes.addTag);
    self.route('post', 'renameTag', self.routes.renameTag);
    self.route('post', 'deleteTag', self.routes.deleteTag);
    self.route('post', 'autocomplete', self.routes.autocomplete);
  };

  self.routes = {};

  self.routes.listTags = function(req, res) {
    var options = {
      contains: self.launder(req.body.contains),
      prefix: self.launder(req.body.prefix),
      tags: self.apos.launder.tags(req.body.tags),
      all: self.apos.launder.boolean(req.body.all)
    };
    var data = {};
    return async.series({
      before: function(callback) {
        return self.beforeListTags(req, options, callback);
      },
      list: function(callback) {
        return self.listTags(req, options, function(err, results) {
          if (err) {
            return callback(err);
          }
          data.results = results;
          return callback();
        });
      },
      after: function(callback) {
        return self.afterListTags(req, options, callback);
      }
    }, function(err) {
      if (err) {
        return self.apiResponder(req, err);
      }
      return self.apiResponder(req, null, {
        data: {
          results: self.render(req, 'manageList', data)
        }
      });
    });
  };

  self.routes.addTag = function(req, res) {
    var tag = self.launder(req.body.tag);
    if (!tag.length) {
      return res.send({ status: 'error' });
    }
    return async.series({
      before: function(callback) {
        return self.beforeAddTag(req, tag, callback);
      },
      add: function(callback) {
        return self.addTag(req, tag, callback);
      },
      after: function(callback) {
        return self.afterAddTag(req, tag, callback);
      }
    }, function(err) {
      return self.apiResponder(req, err);
    });
  };

  self.routes.renameTag = function(req, res) {
    var tag = self.launder(req.body.tag);
    var newTag = self.launder(req.body.newTag);
    if (!tag.length || !newTag.length) {
      return res.send({ status: 'error' });
    }
    return async.series({
      before: function(callback) {
        return self.beforeRenameTag(req, tag, newTag, callback);
      },
      trash: function(callback) {
        return self.renameTag(req, tag, newTag, callback);
      },
      after: function(callback) {
        return self.afterRenameTag(req, tag, newTag, callback);
      }
    }, function(err) {
      return self.apiResponder(req, err);
    });
  };

  self.routes.deleteTag = function(req, res) {
    var tag = self.launder(req.body.tag);
    if (!tag.length) {
      return res.send({ status: 'error' });
    }
    return async.series({
      before: function(callback) {
        return self.beforeDeleteTag(req, tag, callback);
      },
      delete: function(callback) {
        return self.deleteTag(req, tag, callback);
      },
      after: function(callback) {
        return self.afterDeleteTag(req, tag, callback);
      }
    }, function(err) {
      return self.apiResponder(req, err);
    });
  };

  self.routes.manager = function(req, res) {
    return self.renderAndSend(req, 'manager', { options: self.options });
  };

  // localhost:XXXX/modules/apostrophe-tags/autocomplete
  self.routes.autocomplete = function(req, res) {
    var data = req.body;

    // Special case: selective is asking for complete objects with
    // label and value properties for existing values. For tags these
    // are one and the same so just do a map call

    if (data.values) {
      return res.send(_.map(data.values, function(value) {
        return { value: value, label: value };
      }));
    }

    var criteria = {};
    if (data.prefix) {
      criteria = { prefix: self.launder(data.term) };
    } else {
      criteria = { contains: self.launder(data.term) };
    }

    return self.listTags(req, criteria, function(err, tags) {
      if (err) {
        return self.apiResponder(req, err);
      }
      tags = _.map(tags, function(tag) {
        return { value: tag, label: tag };
      });
      if (tags.length > 100) {
        tags = tags.slice(0, 100);
      }
      return self.apiResponder(req, null, tags);
    });
  };

};
