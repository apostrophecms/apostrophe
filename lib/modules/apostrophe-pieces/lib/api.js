
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
  // an existing piece this user is allowed to edit at req.body._id

  self.requirePieceEditorView = function(req, res, next) {
    var id = self.apos.launder.id(req.body._id);

    if (!self.apos.permissions.can(req, 'edit-' + self.name)) {
      return self.apiResponse(res, 'forbidden');
    }

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

  // User must have some editing privileges for this type
  self.requireEditor = function(req, res, next) {
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

      populateFilters: function(callback) {

        // Populate manage view filters by the same technique used
        // for the `piecesFilters` option of `apostrophe-pieces-pages`

        var allowedFilters = filters.chooser ? _.filter(self.filters, function(item) {
          return item.allowedInChooser !== false;
        }) : self.filters;
        results.filters = {
          options: [],
          q: filters.search,
          choices: {}
        };

        return async.eachSeries(allowedFilters, function(filter, callback) {
          // The choices for each filter should reflect the effect of all filters
          // except this one (filtering by topic pares down the list of categories and
          // vice versa)
          var value = cursor.get(filter);
          var _cursor = cursor.clone();
          // The default might not be good for our purposes. Set it to
          // `null`, which appropriate filters, like `trash`, understand to mean
          // "I am interested in things that are ignored by default and also live things"
          _cursor[filter.name](null);
          return _cursor.toChoices(filter.name, { legacyFilterChoices: true }, function(err, choices) {
            if (err) {
              return callback(err);
            }
            // Array of all filter objects allowed in this context:
            //
            // results.filters.options = [ { name: 'published', choices: [ ... usual ... ], def: ... } ]
            //
            // Single object with a property containing the PRESENT value of EACH filter:
            // 
            // results.filters.choices = {
            //   published: true
            // }
            var _filter = _.clone(filter);
            var legacyChoices = _filter.choices;
            results.filters.options.push(_.assign(_filter, { choices: choices }));
            // These are the "choices you have made," not the "choices you can make."
            results.filters.choices[_filter.name] = filters[_filter.name];
            return callback(null);
          });
        }, callback);

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

  // Insert a piece. Also invokes the `beforeInsert`, `beforeSave`, `afterInsert` and
  // `afterSave` methods of this module.
  //
  // You may omit the `options` argument completely.
  //
  // If `options.permissions` is explicitly set to `false`, permissions are
  // not checked. Otherwise the user must have the appropriate permissions to
  // insert the piece.

  self.insert = function(req, piece, options, callback) {

    if (arguments.length === 3) {
      callback = options;
      options = {};
    }

    piece.type = self.name;

    if ((options.permissions !== false) &&
      (!self.apos.permissions.can(req, 'admin-' + self.name))) {
      // If we are not an admin for this type and we just created something,
      // make sure we wind up on the list of people who can edit it. Note that
      // permissions will still keep us from actually inserting it, and thus
      // making this change, if we're not cool enough to create one. However if
      // we are ignoring permissions via `permissions: false` do not do this
      // (leave it up to the developer to decide if anybody gets permission to
      // edit later).
      if (req.user) {
        piece.editUsersIds = (piece.editUsersIds || []).concat([ req.user._id ]);
        piece.docPermissions = (piece.docPermissions || []).concat([ 'edit-' + req.user._id ]);
      }
    }

    return async.series([
      beforeInsert,
      beforeSave,
      insert,
      afterInsert,
      afterSave
    ], callback);

    function beforeInsert(callback) {
      return self.beforeInsert(req, piece, options, callback);
    }

    function beforeSave(callback) {
      return self.beforeSave(req, piece, options, callback);
    }

    function insert(callback) {
      self.apos.docs.insert(req, piece, options, callback);
    }

    function afterInsert(callback) {
      return self.afterInsert(req, piece, options, callback);
    }

    function afterSave(callback) {
      return self.afterSave(req, piece, options, callback);
    }

  };

  // Update a piece. Also invokes the `beforeUpdate`, `beforeSave`, `afterUpdate` and
  // `afterSave` methods of this module.
  //
  // You may omit the `options` argument completely.
  //
  // If `options.permissions` is explicitly set to `false`, permissions are
  // not checked. Otherwise the user must have the appropriate permissions to
  // insert the piece.

  self.update = function(req, piece, options, callback) {
    if (arguments.length === 3) {
      callback = options;
      options = {};
    }
    piece.type = self.name;

    return async.series([
      beforeUpdate,
      beforeSave,
      update,
      afterUpdate,
      afterSave
    ], callback);

    function beforeUpdate(callback) {
      return self.beforeUpdate(req, piece, options, callback);
    }

    function beforeSave(callback) {
      return self.beforeSave(req, piece, options, callback);
    }

    function update(callback) {
      self.apos.docs.update(req, piece, options, callback);
    }

    function afterUpdate(callback) {
      return self.afterUpdate(req, piece, options, callback);
    }

    function afterSave(callback) {
      return self.afterSave(req, piece, options, callback);
    }

  };

  // Move a piece to the trash by id.

  self.trash = function(req, id, callback) {
    var permission = 'edit-doc';
    if (self.apos.permissions.can(req, 'admin-' + self.name)) {
      // This user has blanket permission for this piece type
      permission = false;
    }
    return self.apos.docs.trash(req, id, {
      permission: permission
    }, function(err, piece) {
      if (err) {
        return callback(err);
      }
      return self.deduplicateTrash(req, piece, callback);
    });
  };

  // Rescue a piece from the trash by id.

  self.rescue = function(req, id, callback) {
    var permission = 'edit-doc';
    if (self.apos.permissions.can(req, 'admin-' + self.name)) {
      // Blanket permission for this piece type
      permission = false;
    }
    return self.apos.docs.rescue(req, id, {
      permission: permission
    }, function(err, piece) {
      if (err) {
        return callback(err);
      }
      return self.deduplicateRescue(req, piece, callback);
    });
  };

  // Convert the data supplied in `req.body` via the schema and
  // update the piece object accordingly.

  self.convert = function(req, piece, callback) {
    return self.apos.schemas.convert(req, self.allowedSchema(req), 'form', req.body, piece, callback);
  };

  // Invoked after apos.schemas.convert by the `insert` and
  // `update` routes

  self.afterConvert = function(req, piece, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.insert`. Does nothing by default; convenient extension point

  self.beforeInsert = function(req, piece, options, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.insert` and `self.update`. Does nothing by default; convenient extension point

  self.beforeSave = function(req, piece, options, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.insert`. Does nothing by default; convenient extension point

  self.afterInsert = function(req, piece, options, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.insert` and `self.update`. Does nothing by default; convenient extension point

  self.afterSave = function(req, piece, options, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.update`. Does nothing by default; convenient extension point

  self.beforeUpdate = function(req, piece, options, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.update`. Does nothing by default; convenient extension point

  self.afterUpdate = function(req, piece, options, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.trash`. Does nothing by default; convenient extension point

  self.beforeTrash = function(req, id, callback) {
    return setImmediate(callback);
  };

  // Invoked by `self.trash`. Does nothing by default; convenient extension point

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

  // Add `._url` properties to the given pieces, if possible.
  // The default implementation does nothing, however
  // [apostrophe-pieces-pages](../apostrophe-pieces-pages/index.html) will
  // call `setAddUrls` to point to [its own `addUrlsToPieces` method](../apostrophe-pieces-pages/index.html#addUrlsToPieces).

  self.addUrls = function(req, pieces, callback) {
    return setImmediate(callback);

  };

  // Called by [apostrophe-pieces-pages](../apostrophe-pieces-pages/index.html) to
  // replace the default `addUrls` method with one that assigns `._url`
  // properties to pieces based on the most suitable pages of that type.
  // See [the `addUrlsToPieces` method of `apostrophe-pieces-pages`](../apostrophe-pieces-pages/index.html#addUrlsToPieces).

  self.setAddUrls = function(fn) {
    self.addUrls = fn;
  };
  
  self.composeBatchOperations = function() {
    // We took care of addBatchOperations and removeBatchOperations in beforeConstruct
    self.options.batchOperations = _.filter(self.options.batchOperations, function(batchOperation) {
      if (batchOperation.requiredField && (!_.find(self.schema, { name: batchOperation.requiredField }))) {
        return false;
      }
      return true;
    });
  };

  // Implements a simple batch operation like publish or unpublish.
  // Pass `req`, the `name` of a configurated batch operation, and
  // and a function that accepts (req, piece, data, callback),
  // performs the modification on that one piece (including calling
  // `update` if appropriate), and invokes its callback.
  //
  // `data` is an object containing any schema fields specified
  // for the batch operation. If there is no schema it will be
  // an empty object.
  //
  // Replies to the request with { status: 'ok', data: piece }
  // on success. If `ids` rather than `_id` were specified,
  // `data` is an empty object.
  //
  // To avoid RAM issues with very large selections and ensure that
  // lifecycle callbacks like beforeUpdate, etc. are invoked, the current
  // implementation processes the pieces in series.

  self.batchSimpleRoute = function(req, name, change) {
    var batchOperation = _.find(self.options.batchOperations, { name: name });
    var schema = batchOperation.schema || [];
    var query;
    var singlePiece;
    var res = req.res;
    var data;
    if (req.body._id) {
      ids = [ self.apos.launder.id(req.body._id) ];
    } else if (req.body.ids) {
      ids = self.apos.launder.ids(req.body.ids);
    } else {
      return self.apiResponse(res, 'invalid');
    }
    return async.series([
      convert,
      run
    ], function(err) {
      if (err) {
        console.error(err);
        return self.apiResponse(res, 'error');
      } else {
        return self.updateResponse(req, res, null, singlePiece || {});
      }
    });

    function convert(callback) {
      data = self.apos.schemas.newInstance(schema);
      return self.apos.schemas.convert(req, schema, 'form', req.body, data, callback);
    }
    
    function run(callback) {
      return async.eachSeries(ids, function(id, callback) {
        return self.findForEditing(req, { _id: id })
          .toObject(function(err, piece) {
            if (err) {
              return callback(err);
            }
            if (!piece) {
              // Don't flag the whole thing if something no longer exists
              return callback(null);
            }
            if (req.body._id && (!singlePiece)) {
              singlePiece = piece;
            }
            return change(req, piece, data, callback);
          }
        );
      }, callback); 
    }

  };

};
