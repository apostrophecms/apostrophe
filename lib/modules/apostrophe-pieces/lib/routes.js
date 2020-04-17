var async = require('async');
var _ = require('@sailshq/lodash');

module.exports = function(self, options) {

  self.createRoutes = function() {

    self.route('post', 'insert', self.requireEditor, self.routes.insert);
    self.route('post', 'retrieve', self.requirePieceEditorView, self.routes.retrieve);
    self.route('post', 'list', self.apos.docs.requireEditorOfSomething, self.routes.list);
    self.route('post', 'update', self.requirePiece, self.routes.update);
    self.route('post', 'publish', self.requireEditor, self.routes.publish);
    self.route('post', 'unpublish', self.requireEditor, self.routes.unpublish);
    self.route('post', 'tag', self.requireEditor, self.routes.tag);
    self.route('post', 'untag', self.requireEditor, self.routes.untag);
    self.route('post', 'permissions', self.requireEditor, self.routes.permissions);
    self.route('post', 'manager-modal', self.requireEditor, self.routes.managerModal);
    self.route('post', 'chooser-modal', self.requireEditor, self.routes.chooserModal);
    self.route('post', 'editor-modal', self.requireEditor, self.routes.editorModal);
    self.route('post', 'create-modal', self.requireEditor, self.routes.createModal);
    self.route('post', 'batch-permissions-modal', self.requireEditor, self.routes.batchPermissionsModal);
    self.route('post', 'trash', self.requireEditor, self.routes.trash);
    self.route('post', 'rescue', self.requireEditor, self.routes.rescue);
    self.route('post', 'insert-via-upload', self.requireEditor, self.apos.attachments.middleware.canUpload, self.apos.middleware.files, self.routes.insertViaUpload);
  };

  self.routes = {};

  self.routes.insert = function(req, res) {
    return self.convertInsertAndRefresh(req, self.insertResponse);
  };

  self.routes.retrieve = function(req, res) {
    return self.retrieveResponse(req, res, null, req.piece);
  };

  self.routes.list = function(req, res) {
    var results;
    var options = req.body || {};
    var view;
    return async.series({
      before: function(callback) {
        return self.beforeList(req, options, callback);
      },
      list: function(callback) {
        return self.list(req, options, function(err, _results) {
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
      if (err) {
        self.apos.utils.error(err);
        return self.listResponse(req, res, err, results);
      }
      if (options.format === 'managePage') {
        results.options = results.options || {};
        results.options.name = self.name;
        results.options.label = self.label;
        results.options.pluralLabel = self.pluralLabel;
        results.options.manageViews = self.options.manageViews;
        results.schema = self.schema;
        results.columns = self.columns;
        results.canEditTrash = self.options.canEditTrash;
        if (_.contains(self.manageViews, options.manageView)) {
          view = options.manageView;
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
      } else if (options.format === 'allIds') {
        results = {
          ids: results.ids,
          label: req.__ns('apostrophe', 'Select all %s item(s) that match this search', results.ids.length)
        };
      } else {
        results = _.omit(results, 'cursor');
      }
      return self.listResponse(req, res, err, results);
    });
  };

  self.routes.update = function(req, res) {
    return self.convertUpdateAndRefresh(req, self.updateResponse);
  };

  // Implement the publish route, which can publish
  // one piece (via req.body._id) or many (via req.body.ids).
  // The `data` property of the API response will contain the piece
  // only for the `req.body._id` case.

  self.routes.publish = function(req, res) {
    return self.batchSimpleRoute(req, 'publish', function(req, piece, data, callback) {
      piece.published = true;
      return self.update(req, piece, callback);
    });
  };

  // Implement the unpublish route, which can publish
  // one piece (via req.body._id) or many (via req.body.ids).
  // The `data` property of the API response will contain the piece
  // only for the `req.body._id` case.

  self.routes.unpublish = function(req, res) {
    return self.batchSimpleRoute(req, 'unpublish', function(req, piece, data, callback) {
      piece.published = false;
      return self.update(req, piece, callback);
    });
  };

  // Implement the tag route, which can tag
  // one piece (via `req.body._id`) or many (via `req.body.ids`).
  // The tags to be added are in the `req.body.tags` array.

  self.routes.tag = function(req, res) {
    return self.batchSimpleRoute(req, 'tag', function(req, piece, data, callback) {
      if (!piece.tags) {
        piece.tags = [];
      }
      piece.tags = _.uniq(piece.tags.concat(data.tags));
      return self.update(req, piece, callback);
    });
  };

  // Implement the untag route, which can untag
  // one piece (via `req.body._id`) or many (via `req.body.ids`).
  // The tags to be removed are in `req.body.tags`.

  self.routes.untag = function(req, res) {
    return self.batchSimpleRoute(req, 'untag', function(req, piece, data, callback) {
      if (!piece.tags) {
        return setImmediate(callback);
      }
      var removing = data.tags;
      piece.tags = _.filter(piece.tags, function(tag) {
        return !_.contains(removing, tag);
      });
      return self.update(req, piece, callback);
    });
  };

  // Implement the permissions route, which can apply permissions
  // to many pieces via `req.body.ids`. The permissions are
  // also present in `req.body` as `req.body.loginRequired`, etc.

  self.routes.permissions = function(req, res) {
    var schema = self.getBatchPermissionsSchema(req);
    const permissions = {};
    return self.apos.schemas.convert(req, schema, 'form', req.body, permissions, function(err) {
      if (err) {
        self.apos.utils.error(err);
        return res.status(500).send('error');
      }
      return self.batchSimpleRoute(req, 'permissions', function(req, piece, data, callback) {
        _.assign(piece, permissions);
        return self.update(req, piece, callback);
      });
    });
  };

  self.routes.managerModal = function(req, res) {
    // We could be more selective about passing
    // self.options, but that would make this code
    // more brittle as new options are added in subclasses
    return self.renderAndSend(req, 'managerModal', { options: self.options, schema: self.schema });
  };

  self.routes.chooserModal = function(req, res) {
    var limit = self.apos.launder.integer(req.body.limit);
    return self.renderAndSend(req, 'chooserModal', { options: self.options, limit: limit, schema: self.schema, chooser: true });
  };

  self.routes.editorModal = function(req, res) {
    var schema = self.allowedSchema(req);
    self.apos.schemas.bless(req, schema);
    return self.renderAndSend(req, 'editorModal', { options: self.options, schema: schema });
  };

  self.routes.createModal = function(req, res) {
    var schema = self.allowedSchema(req);
    self.apos.schemas.bless(req, schema);
    return self.renderAndSend(req, 'createModal', { options: self.options, schema: schema });
  };

  self.routes.batchPermissionsModal = function(req, res) {
    var schema = self.getBatchPermissionsSchema(req);
    self.apos.schemas.bless(req, schema);
    return self.renderAndSend(req, 'batchPermissionsModal', { options: self.options, schema: schema });
  };

  // Trash one piece (via req.body._id) or many (via req.body.ids).
  // Responds as a job if req.body.job is truthy

  self.routes.trash = function(req, res) {

    var ids;

    if (req.body.job) {
      // New way
      return self.apos.modules['apostrophe-jobs'].run(req, function(req, id, callback) {
        return one(id, callback);
      }, {
        label: {
          title: 'Trash'
        }
      });
    }

    // bc and single id case

    if (Array.isArray(req.body.ids)) {
      ids = self.apos.launder.ids(req.body.ids);
    } else {
      ids = [ self.apos.launder.id(req.body._id) ];
    }

    return async.eachSeries(ids, one, function(err) {
      return self.trashResponse(req, res, err, {});
    });

    function one(id, callback) {
      return async.series({
        before: function(callback) {
          return self.beforeTrash(req, id, callback);
        },
        trash: function(callback) {
          return self.trash(req, id, callback);
        },
        after: function(callback) {
          return self.afterTrash(req, id, callback);
        }
      }, function(err) {
        // Don't pass anything but the error,
        // we don't want a cyclic structure being
        // sent to the browser
        return callback(err);
      });
    }

  };

  // Rescue one piece (via req.body._id) or many (via req.body.ids).
  // Responds as a job if req.body.job is truthy

  self.routes.rescue = function(req, res) {

    var ids;

    if (req.body.job) {
      // New way
      return self.apos.modules['apostrophe-jobs'].run(req, function(req, id, callback) {
        return one(id, callback);
      }, {
        label: {
          title: 'Rescue'
        }
      });
    }

    if (Array.isArray(req.body.ids)) {
      ids = self.apos.launder.ids(req.body.ids);
    } else {
      ids = [ self.apos.launder.id(req.body._id) ];
    }
    return async.eachSeries(ids, one, function(err) {
      return self.rescueResponse(req, res, err, {});
    });

    function one(id, callback) {
      return async.series({
        before: function(callback) {
          return self.beforeRescue(req, id, callback);
        },
        rescue: function(callback) {
          return self.rescue(req, id, callback);
        },
        after: function(callback) {
          return self.afterRescue(req, id, callback);
        }
      }, function(err) {
        // Pass ONLY the error so we don't serialize a big cyclic structure
        return callback(err);
      });
    }

  };

  // Create one new piece via file upload, without the completion of other
  // form fields. Applicable only when the `insertViaUpload` option is set
  // for a particular piece type. The first schema field of type attachment is
  // populated.

  self.routes.insertViaUpload = function(req, res) {
    if (!self.options.insertViaUpload) {
      res.statusCode = 404;
      return res.send('notfound');
    }
    var field = _.find(self.schema, { type: 'attachment' });
    if (!field) {
      self.apos.utils.error('The pieces module ' + self.options.__meta.name + ' has insertViaUpload turned on but the schema does not contain a field of type attachment.');
      res.statusCode = 404;
      return res.send('notfound');
    }

    // Must use text/plain for file upload responses in IE <= 9,
    // doesn't hurt in other browsers. -Tom
    res.header("Content-Type", "text/plain");
    // The name attribute could be anything because of how fileupload
    // controls work; we don't really care.
    var file = _.values(req.files || {})[0];
    var attachment = null;
    var piece;
    return async.series([
      acceptFile,
      insertPiece,
      filter
    ], respond);

    function acceptFile(callback) {
      return self.apos.attachments.insert(req, file, function(err, _attachment) {
        if (err) {
          return callback(err);
        }
        attachment = _attachment;
        if (!self.apos.attachments.acceptableExtension(field, attachment)) {
          return callback('unsuitable');
        }
        return callback(null);
      });
    }

    function insertPiece(callback) {
      if (!attachment) {
        return callback(null);
      }

      piece = self.newInstance();
      piece[field.name] = attachment;

      const properties = [
        'title',
        'description',
        'credit',
        'camera',
        'captureDate'
      ];

      const slugField = _.find(self.schema, { name: 'slug' });
      const prefix = (slugField && slugField.prefix) || '';
      piece.slug = prefix + attachment.name;

      for (const prop of properties) {
        piece[prop] = attachment[prop];
      }

      return self.insert(req, piece, callback);
    }

    function filter(callback) {
      if (!piece) {
        return callback(null);
      }
      // Apply filters that make up the rest of the body properties, such as minSize.
      // Everything was uploaded but not everything may be suitable for the
      // current chooser, if any
      var query;
      try {
        // Because jquery fileupload isn't smart enough to serialize arrays by itself
        query = JSON.parse(req.body.filters);
      } catch (e) {
        query = {};
      }
      // req.files will have one property which is the file upload field —
      // this field is not a filter and should not be treated as such
      _.each(req.files, function(val, key) {
        delete query[key];
      });

      var cursor = self.find(req, { _id: piece._id }, { _id: 1 });

      // Now we can apply filters normally for the rest
      cursor.queryToFilters(query);

      return cursor.toObject(function(err, _piece) {
        if (err) {
          return callback(err);
        }
        if (!_piece) {
          return callback('unsuitable');
        }
        piece = _piece;
        return callback(null);
      });
    }

    function respond(err) {
      return self.apiResponder(req, err, {
        piece: piece
      });
    }

  };

};
