
var async = require('async');
var _ = require('lodash');

module.exports = function(self, options) {

  self.trashPrefixFields = [ 'slug' ];

  self.addTrashPrefixFields = function(fields) {
    self.trashPrefixFields = self.trashPrefixFields.concat(fields);
  };

  // Returns a cursor that finds docs the current user can edit. Unlike
  // find(), this cursor defaults to including unpublished docs. Subclasses
  // of apostrophe-pieces often extend this to remove more default filters

  self.findForEditing = function(req, criteria, projection) {
    return self.find(req, criteria, projection)
      .permission('edit')
      .published(null);
  };

  // middleware for JSON API routes that expect the ID of
  // an existing piece at req.body._id, with editing privileges
  self.requirePiece = function(req, res, next) {
    var id = self.apos.launder.id(req.body._id);

    return self.findForEditing(req, { _id: id })
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

  // middleware for JSON API routes that expect the ID of
  // an existing piece at req.body._id, with privileges sufficient
  // to create items of this type and also to view this particular
  // piece (e.g. good enough to add a crop to an image)
  self.requirePieceEditorView = function(req, res, next) {
    var id = self.apos.launder.id(req.body._id);

    if (!req.user) {
      return self.apiResponse(res, 'forbidden');
    }
    if (!self.apos.permissions.can(req, 'edit-' + self.name)) {
      return self.apiResponse(res, 'forbidden');
    }

    return self.find(req, { _id: id }).published(null)
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
    var cursor;
    if (filters.chooser) {
      cursor = self.find(req);
    } else {
      cursor = self.findForEditing(req);
    }
    cursor.perPage(self.options.perPage || 10);
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
            results.skip = cursor.get('skip');
            results.limit = cursor.get('limit');
            results.page = cursor.get('page');
            results.pieces = pieces;
            return callback(null);
          }
        );
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      // Helps the frontend display the active sort and filter states
      results.cursor = cursor;
      return callback(null, results);
    });
  };

  self.insert = function(req, piece, callback) {
    piece.type = self.name;
    if (!self.apos.permissions.can(req, 'admin-' + self.name)) {
      // If we are not an admin and we just created something,
      // make sure we wind up on the list of people who can edit it. Note that
      // permissions will still keep us from actually inserting it, and thus
      // making this change, if we're not cool enough to create one
      if (req.user) {
        piece.editUsersIds = (piece.editUsersIds || []).concat([ req.user._id ]);
        piece.docPermissions = (piece.docPermissions || []).concat([ 'edit-' + req.user._id ]);
      }
    }
    self.apos.docs.insert(req, piece, callback);
  };

  self.update = function(req, piece, callback) {
    piece.type = self.name;
    self.apos.docs.update(req, piece, callback);
  };

  self.trash = function(req, id, callback) {
    return self.apos.docs.trash(req, id, function(err, piece) {
      if (err) {
        return callback(err);
      }
      return self.deduplicateTrash(req, piece, callback);
    });
  };

  self.rescue = function(req, id, callback) {
    return self.apos.docs.rescue(req, id, function(err, piece) {
      if (err) {
        return callback(err);
      }
      return self.deduplicateRescue(req, piece, callback);
    });
  };

  self.convert = function(req, piece, callback) {
    return self.apos.schemas.convert(req, self.allowedSchema(req), 'form', req.body, piece, callback);
  };

  self.findIfContextual = function(req, piece, callback) {
    if (!self.contextual) {
      return setImmediate(callback);
    }
    return self.findForEditing(req, { _id: piece._id })
      .toObject(function(err, _piece) {
        if (err) {
          return callback(err);
        }
        if (!_piece) {
          return callback('notfound');
        }
        _.assign(piece, _piece);
        return callback(null);
      }
    );
  };

  self.afterConvert = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.beforeCreate = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.beforeSave = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.afterCreate = function(req, piece, callback) {
    return setImmediate(callback);
  };

  self.afterSave = function(req, piece, callback) {
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

  // After moving pieces to the trash, prefix any fields that have
  // unique indexes so that other pieces are allowed to reuse
  // those usernames, email addresses, etc.

  self.deduplicateTrash = function(req, piece, callback) {
    var prefix = 'deduplicate-' + piece._id + '-';
    var $set = {};
    _.each(self.trashPrefixFields, function(name) {
      if (typeof(piece[name]) !== 'string') {
        // Presumably a sparse index
        return;
      }
      if (piece[name].substr(0, prefix.length) !== prefix) {
        $set[name] = prefix + piece[name];
      }
      // So methods called later, or extending this method, see the change in piece
      piece[name] = $set[name];
    });
    if (_.isEmpty($set)) {
      return setImmediate(callback);
    }
    return self.apos.docs.db.update({ _id: piece._id }, { $set: $set }, callback);
  };

  self.beforeRescue = function(req, id, callback) {
    return setImmediate(callback);
  };

  self.afterRescue = function(req, id, callback) {
    return setImmediate(callback);
  };

  // When rescuing pieces from the trash, attempt to un-prefix any fields
  // that have unique indexes. However, if we then find it's been taken
  // in the meanwhile, leave the prefix in place and leave it up to
  // the user to resolve the issue.

  self.deduplicateRescue = function(req, piece, callback) {
    var prefix = 'deduplicate-' + piece._id + '-';
    var $set = {};
    _.each(self.trashPrefixFields, function(name) {
      if (typeof(piece[name]) !== 'string') {
        // Presumably a sparse index
        return;
      }
      $set[name] = piece[name].replace(prefix, '');
    });
    return async.series([
      checkDuplicates,
      update
    ], callback);
    function checkDuplicates(callback) {
      return async.eachSeries(self.trashPrefixFields, checkOne, callback);
    }
    function update(callback) {
      var action = {
        $set: $set
      };
      // So methods called later, or extending this method, see the change in piece
      _.assign(piece, $set);
      if (_.isEmpty($set)) {
        // Nothing to do
        return setImmediate(callback);
      }
      return self.apos.docs.db.update({ _id: piece._id }, action, callback);
    }
    function checkOne(name, callback) {
      var query = { type: self.name, _id: { $ne: piece._id } };
      query[name] = $set[name];
      if ($set[name] === '') {
        // Assume sparse index if empty strings are seen; don't
        // generate lots of weird prefix-only email addresses
        return setImmediate(callback);
      }
      return self.apos.docs.db.findOne(query, { _id: 1 }, function(err, found) {
        if (err) {
          return callback(err);
        }
        if (found) {
          delete $set[name];
        }
        return callback(null);
      });
    }
  };

  self.beforeList = function(req, filters, callback) {
    return setImmediate(callback);
  };

  self.afterList = function(req, results, callback) {
    return setImmediate(callback);
  };

  self.apiResponse = function(res, err, data) {
    if (err) {
      // For the most part, we don't want to tell the browser exactly what the error was.
      // An exception: unique key errors, which typically mean the username or email address
      // field was a duplicate or similar
      if (self.apos.docs.isUniqueError(err)) {
        console.error(err);
        err = 'unique';
      }
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

  self.composeFilters = function() {
    self.filters = options.filters || [];
    if (options.addFilters) {
      _.each(options.addFilters, function(newFilter) {
        // remove it from the filters if we've already added it, last one wins
        self.filters = _.filter(self.filters, function(filter) {
          return filter.name !== newFilter.name;
        });
        // add the new field to the filters
        self.filters.push(newFilter);
      });
    }
    if (options.removeFilters) {
      self.filters = _.filter(self.filters, function(filter) {
        return !_.contains(options.removeFilters, filter.name);
      });
    }
  };

  self.composeColumns = function() {
    self.columns = options.columns || [];
    if (options.addColumns) {
      _.each(options.addColumns, function(newColumn) {
        // remove it from the columns if we've already added it, last one wins
        self.columns = _.filter(self.columns, function(column) {
          return column.name !== newColumn.name;
        });
        // add the new field to the columns
        self.columns.push(newColumn);
      });
    }
    if (options.removeColumns) {
      self.columns = _.filter(self.columns, function(column) {
        return !_.contains(options.removeColumns, column.name);
      });
    }
  };

  // Enable inclusion of this type in sitewide search results
  self.searchDetermineTypes = function(types) {
    if (self.options.searchable !== false) {
      types.push(self.name);
    }
  };

  self.isAdminOnly = function() {
    return self.options.adminOnly;
  };

  self.addPermissions = function() {
    if (!self.isAdminOnly()) {
      self.apos.permissions.add({
        value: 'admin-' + self.name,
        label: 'Admin: ' + self.label
      });
      self.apos.permissions.add({
        value: 'edit-' + self.name,
        label: 'Edit: ' + self.label
      });
      self.apos.permissions.add({
        value: 'submit-' + self.name,
        label: 'Submit: ' + self.label
      });
    }
  };

  self.addToAdminBar = function() {
    self.apos.adminBar.add(self.__meta.name, self.pluralLabel, self.isAdminOnly() ? 'admin' : ('edit-' + self.name));
  };

};
