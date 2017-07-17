var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  self.createRoutes = function() {

    self.route('post', 'insert', self.requireEditor, self.routes.insert);
    self.route('post', 'retrieve', self.requirePieceEditorView, self.routes.retrieve);
    self.route('post', 'list', self.routes.list);
    self.route('post', 'update', self.requirePiece, self.routes.update);
    self.route('post', 'publish', self.routes.publish);
    self.route('post', 'unpublish', self.routes.unpublish);
    self.route('post', 'tag', self.routes.tag);
    self.route('post', 'untag', self.routes.untag);
    self.route('post', 'manager-modal', self.requireEditor, self.routes.managerModal);
    self.route('post', 'chooser-modal', self.requireEditor, self.routes.chooserModal);
    self.route('post', 'editor-modal', self.requireEditor, self.routes.editorModal);
    self.route('post', 'create-modal', self.requireEditor, self.routes.createModal);
    self.route('post', 'trash', self.routes.trash);
    self.route('post', 'rescue', self.routes.rescue);
    self.route('post', 'insert-via-upload', self.apos.attachments.middleware.canUpload, self.apos.middleware.files, self.routes.insertViaUpload);
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
      insert: function(callback) {
        return self.insert(req, piece, callback);
      },
      refresh: function(callback) {
        return self.findForEditing(req, { _id: piece._id }).toObject(function(err, _piece) {
          if (err) {
            return callback(err);
          }
          piece = _piece;
          return callback(null);
        });
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
      update: function(callback) {
        return self.update(req, req.piece, callback);
      },
      refetch: function(callback) {
        // Refetch the piece so that joins and properties like `_parentUrl` and
        // `_url` are updated to reflect changes
        return self.findForEditing(req, { _id: req.piece._id }).toObject(function(err, piece) {
          if (err) {
            return callback(err);
          }
          if (!piece) {
            return callback(new Error('removed'));
          }
          req.piece = piece;
          return callback(null);
        });
      }
    }, function(err) {
      return self.updateResponse(req, res, err, req.piece);
    });
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

  self.routes.managerModal = function(req, res) {
    // We could be more selective about passing
    // self.options, but that would make this code
    // more brittle as new options are added in subclasses
    return res.send(self.render(req, 'managerModal', { options: self.options, schema: self.schema }));
  };

  self.routes.chooserModal = function(req, res) {
    var limit = self.apos.launder.integer(req.body.limit);
    return res.send(self.render(req, 'chooserModal', { options: self.options, limit: limit, schema: self.schema, chooser: true }));
  };

  self.routes.editorModal = function(req, res) {
    var schema = self.allowedSchema(req);
    self.apos.schemas.bless(req, schema);
    return res.send(self.render(req, 'editorModal', { options: self.options, schema: schema }));
  };

  self.routes.createModal = function(req, res) {
    var schema = self.allowedSchema(req);
    self.apos.schemas.bless(req, schema);
    return res.send(self.render(req, 'createModal', { options: self.options, schema: schema }));
  };

  // Trash one piece (via req.body._id) or many (via req.body.ids).

  self.routes.trash = function(req, res) {
    var ids;
    if (Array.isArray(req.body.ids)) {
      ids = self.apos.launder.ids(req.body.ids);
    } else {
      ids = [ self.apos.launder.id(req.body._id) ];
    }
    return async.eachSeries(ids, function(id, callback) {
      return async.series({
        before: function(callback) {
          return self.beforeTrash(req, id, callback);
        },
        trash: function(callback) {
          return self.trash(req, id, callback);
        },
        after: function(callback) {
          return self.afterTrash(req, id, callback)
        }
      }, callback);
    }, function(err) {
      return self.trashResponse(req, res, err, {});
    });
  };

  // Rescue one piece (via req.body._id) or many (via req.body.ids).

  self.routes.rescue = function(req, res) {
    var ids;
    if (Array.isArray(req.body.ids)) {
      ids = self.apos.launder.ids(req.body.ids);
    } else {
      ids = [ self.apos.launder.id(req.body._id) ];
    }
    return async.eachSeries(ids, function(id, callback) {
      return async.series({
        before: function(callback) {
          return self.beforeRescue(req, id, callback);
        },
        rescue: function(callback) {
          return self.rescue(req, id, callback);
        },
        after: function(callback) {
          return self.afterRescue(req, id, callback)
        }
      }, callback);
    }, function(err) {
      return self.rescueResponse(req, res, err, {});
    });
  };
  
  // Create one new piece via file upload, without the completion of other
  // form fields. Applicable only when the `insertViaUpload` option is set
  // for a particular piece type. The first schema field of type attachment is
  // populated.

  self.routes.insertViaUpload  = function(req, res) {
    if (!self.options.insertViaUpload) {
      res.statusCode = 404;
      return res.send('notfound');
    }
    var field = _.find(self.schema, { type: 'attachment' });
    if (!field) {
      console.error('The pieces module ' + self.options.__meta.name + ' has insertViaUpload turned on but the schema does not contain a field of type attachment.');
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
      return self.apos.attachments.accept(req, file, function(err, _attachment) {
        if (err) {
          return callback(err);
        }
        attachment = _attachment;
        return callback(null);
      });
    }

    function insertPiece(callback) {
      if (!attachment) {
        return callback(null);
      }
      piece = self.newInstance();
      piece[field.name] = attachment;
      piece.title = attachment.title;
      piece.slug = attachment.name;
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
      if (err) {
        console.error(err);
        return res.send({ status: (typeof(err) === 'string') ? err : 'error' });
      }
      return res.send({ status: 'ok', piece: piece });
    };

  };

};
