var async = require('async');
var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

module.exports = function(self, options) {
  self.finalizeControls = function() {
    self.createControls = self.options.createControls || [
      {
        type: 'dropdown',
        label: 'More',
        items: [
          {label: 'Copy', action: 'copy'},
          {label: 'Trash', action: 'trash'}
        ],
        dropdownOptions: {
          direction: 'down'
        }
      },
      {
        type: 'minor',
        action: 'cancel',
        label: 'Cancel'
      },
      {
        type: 'major',
        action: 'save',
        label: 'Save ' + self.label
      }
    ];

    self.editControls = self.options.editControls || [
      {
        type: 'dropdown',
        label: 'More',
        // For reliable test automation
        name: 'more',
        items: [
          { label: 'Versions', action: 'versions' },
          { label: 'Copy', action: 'copy' },
          // js shows and hides these two browser side
          { label: 'Trash', action: 'trash' },
          { label: 'Rescue', action: 'rescue' }
        ],
        dropdownOptions: {
          direction: 'down'
        }
      },
      {
        type: 'minor',
        action: 'cancel',
        label: 'Cancel'
      },
      {
        type: 'major',
        action: 'save',
        label: 'Save ' + self.label
      }
    ];
  };

  // Returns a cursor that finds docs the current user can edit. Unlike
  // find(), this cursor defaults to including unpublished docs. Subclasses
  // of apostrophe-pieces often extend this to remove more default filters

  self.findForEditing = function(req, criteria, projection) {
    var cursor = self.find(req, criteria, projection)
      .permission('edit')
      .published(null);
    if (criteria && criteria._id && ((typeof criteria._id) === 'string')) {
      cursor.sort(false);
    }
    if (self.options.canEditTrash) {
      cursor.trash(null);
    }
    return cursor;
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
      });
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
      });
  };

  // User must have some editing privileges for this type
  self.requireEditor = function(req, res, next) {
    if (!self.apos.permissions.can(req, 'edit-' + self.name)) {
      return self.apiResponse(res, 'forbidden');
    }
    return next();
  };

  // options.filters can contain cursor filters. `options.chooser`, `options.format` and
  // `options.manageView` are also implemented. For bc, if `options.filters` does not exist,
  // all properties of options are treated as cursor filters.

  self.list = function(req, options, callback) {
    var cursor;
    var filters = options.filters || options;
    if (options.chooser) {
      cursor = self.find(req);
    } else {
      cursor = self.findForEditing(req);
    }
    if (options.format === 'allIds') {
      cursor.projection({ _id: 1 });
    } else {
      self.setListProjection(req, cursor);
      cursor.perPage(self.options.perPage || 10);
    }

    if (options.filters && options.filters.sortColumn) {
      // Column sort is not a regular cursor filter because the
      // columns are specific to the manage view and have no meaning
      // outside of it; implement it here
      var name = options.filters.sortColumn.column;
      var direction = self.apos.launder.select(options.filters.sortColumn.direction, [ '1', '-1', '1' ]);
      var column = _.find(self.columns, function(column) {
        return (column.name === name) && column.sort;
      });
      if (column) {
        var sort = {};
        _.each(Object.keys(column.sort), function(key) {
          sort[key] = (direction === "1") ? 1 : -1;
        });
        cursor.sort(sort);
      }
    }
    cursor.queryToFilters(filters);

    var results = {};

    return async.series({

      toCount: function(callback) {
        if (options.format === 'allIds') {
          return callback(null);
        }
        return cursor
          .toCount(function(err, count) {
            if (err) {
              return callback(err);
            }
            results.total = count;
            results.totalPages = cursor.get('totalPages');
            return callback(null);
          });
      },

      populateFilters: function(callback) {
        if (options.format === 'allIds') {
          return callback(null);
        }

        // Populate manage view filters by the same technique used
        // for the `piecesFilters` option of `apostrophe-pieces-pages`

        var allowedFilters = options.chooser ? _.filter(self.filters, function(item) {
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
            if (options.format === 'allIds') {
              results.ids = _.pluck(pieces, '_id');
              return callback(null);
            }
            results.skip = cursor.get('skip');
            results.limit = cursor.get('limit');
            results.page = cursor.get('page');
            results.pieces = pieces;
            return callback(null);
          });
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

  // Used to fetch the projection used for the /modules/yourmodulename/list route to avoid disclosing
  // excessive information. By default, returns the `listProjection` option. A good extension point;
  // be sure to apply the `super` pattern to get the benefit of extensions in other modules,
  // like workflow.

  self.getListProjection = function(req) {
    return Object.assign({}, self.options.listProjection, self.options.addToListProjection);
  };

  // Implements setting the projection for the list route, see getListProjection.
  self.setListProjection = function(req, cursor) {
    cursor.projection(self.getListProjection(req));
  };

  // Insert a piece. Also invokes the `beforeInsert`, `beforeSave`, `afterInsert` and
  // `afterSave` methods of this module.
  //
  // You may omit the `options` argument completely.
  //
  // If `options.permissions` is explicitly set to `false`, permissions are
  // not checked. Otherwise the user must have the appropriate permissions to
  // insert the piece.
  //
  // For convenience, the piece is passed to the callback as the second argument.
  // It's the same piece object, with some new properties.
  //
  // If no callback is passed, returns a promise.

  self.insert = function(req, piece, options, callback) {

    if ((typeof arguments[2]) !== 'object') {
      callback = options;
      options = {};
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }

    function body(callback) {
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
      ], function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, piece);
      });

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
  //
  // For convenience, the piece is passed to the callback as the second argument.
  // It's the same piece object you passed, likely with modifications such as
  // the `updatedAt` property.

  self.update = function(req, piece, options, callback) {
    if ((typeof arguments[2]) !== 'object') {
      callback = options;
      options = {};
    }
    if (callback) {
      return body(callback);
    } else {
      return Promise.promisify(body)();
    }

    function body(callback) {
      piece.type = self.name;

      return async.series([
        beforeUpdate,
        beforeSave,
        update,
        afterUpdate,
        afterSave
      ], function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, piece);
      });

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
    }

  };

  // Move a piece to the trash by id. If `callback` is omitted,
  // a promise is returned.

  self.trash = function(req, id, callback) {
    var permission = 'edit-doc';

    if (arguments.length === 2) {
      return Promise.promisify(body)();
    } else {
      return body(callback);
    }
    function body(callback) {
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
    }
  };

  // Rescue a piece from the trash by id. If `callback` is omitted,
  // a promise is returned.

  self.rescue = function(req, id, callback) {
    var permission = 'edit-doc';

    if (arguments.length === 2) {
      return Promise.promisify(body)();
    } else {
      return body(callback);
    }

    function body(callback) {
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
    }
  };

  // Convert the data supplied in `req.body` via the schema and
  // update the piece object accordingly. If `req.convertOnlyTheseFields`
  // is present, touch only the fields present in that array.

  self.convert = function(req, piece, callback) {
    var schema = self.allowedSchema(req);
    if (req.convertOnlyTheseFields) {
      schema = self.apos.schemas.subset(schema, req.convertOnlyTheseFields);
    }
    return self.apos.schemas.convert(req, schema, 'form', req.body, piece, callback);
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

  // For legacy reasons, pieces have their own apiResponse method which is just a wrapper
  // for the newer apiResponder.

  self.apiResponse = function(res, err, data) {
    return self.apiResponder(res.req, err, {
      data: data
    });
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
      _.each(self.columns, function(column) {
        self.options.listProjection[column.name] = 1;
        if (column.sort) {
          column.defaultSortDirection = _.values(column.sort)[0];
          _.each(_.keys(column.sort), function(property) {
            self.options.listProjection[property] = 1;
          });
        }
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
    self.apos.adminBar.add(self.__meta.name, self.pluralLabel, self.getEditPermissionName());
  };

  // Add `._url` properties to the given pieces, if possible.
  // The default implementation does nothing, however
  // [apostrophe-pieces-pages](/reference/modules/apostrophe-pieces-pages) will
  // call `setAddUrls` to point to [its own `addUrlsToPieces` method](/reference/modules/apostrophe-pieces-pages#addurlstopieces-req-results-callback).

  self.addUrls = function(req, pieces, callback) {
    return setImmediate(callback);

  };

  // Called by [apostrophe-pieces-pages](/reference/modules/apostrophe-pieces-pages) to
  // replace the default `addUrls` method with one that assigns `._url`
  // properties to pieces based on the most suitable pages of that type.
  // See [the `addUrlsToPieces` method of `apostrophe-pieces-pages`](/reference/modules/apostrophe-pieces-pages#addurlstopieces-req-results-callback).

  self.setAddUrls = function(fn) {
    self.addUrls = fn;
  };

  self.composeBatchOperations = function() {
    // We took care of addBatchOperations and removeBatchOperations in beforeConstruct
    self.options.batchOperations = _.filter(self.options.batchOperations, function(batchOperation) {
      if (batchOperation.requiredField && (!_.find(self.schema, { name: batchOperation.requiredField }))) {
        return false;
      }
      if (batchOperation.onlyIf) {
        if (!batchOperation.onlyIf(self.name)) {
          return false;
        }
      }
      return true;
    });
  };

  // Implements a simple batch operation like publish or unpublish.
  // Pass `req`, the `name` of a configured batch operation, and
  // and a function that accepts (req, piece, data, callback),
  // performs the modification on that one piece (including calling
  // `update` if appropriate), and invokes its callback.
  //
  // `data` is an object containing any schema fields specified
  // for the batch operation. If there is no schema it will be
  // an empty object.
  //
  // If `req.body.job` is truthy, replies immediately to the request with
  // `{ status: 'ok', jobId: 'cxxxx' }`. The `jobId` can then
  // be passed to `apos.modules['apostrophe-jobs'].start()` on the rowser side to
  // monitor progress.
  //
  // Otherwise, replies to the request with { status: 'ok', data: piece }
  // on success. If `ids` rather than `_id` were specified,
  // `data` is an empty object.
  //
  // To avoid RAM issues with very large selections and ensure that
  // lifecycle callbacks like beforeUpdate, etc. are invoked, the current
  // implementation processes the pieces in series.

  self.batchSimpleRoute = function(req, name, change) {
    var batchOperation = _.find(self.options.batchOperations, { name: name });
    var schema = batchOperation.schema || [];

    var data = self.apos.schemas.newInstance(schema);
    return self.apos.schemas.convert(req, schema, 'form', req.body, data, function(err) {
      if (err) {
        return self.logError(req, err);
      }
      return runJob();
    });

    function runJob() {
      return self.apos.modules['apostrophe-jobs'].run(req, one, {
        labels: {
          title: batchOperation.progressLabel || batchOperation.buttonLabel || batchOperation.label
        }
      });
    }

    function one(req, id, callback) {
      return self.findForEditing(req, { _id: id }).toObject(function(err, piece) {
        if (err) {
          return callback(err);
        }
        if (!piece) {
          return callback('notfound');
        }
        return change(req, piece, data, callback);
      });
    }

  };

  // Accept a piece found at `req.body`, via
  // schema-based convert mechanisms, then
  // invoke `responder` with `req, res, err, piece`.
  // Implements `self.routes.insert`. Also used
  // by the optional `apostrophe-pieces-rest-api` module.
  //
  // If `req.piece` has a `_copyingId` property, fetch that
  // piece and, if we have permission to edit, copy its
  // non-schema-based top level areas into the new piece.
  // This accounts for content editor-modal.js doesn't know about.

  self.convertInsertAndRefresh = function(req, responder) {
    var piece = self.newInstance();
    var copyingId = req.body._copyingId;
    return async.series({
      // hint: a partial object, or even passing no fields
      // at this point, is OK
      convert: function(callback) {
        return self.convert(req, piece, callback);
      },
      afterConvert: function(callback) {
        return self.afterConvert(req, piece, callback);
      },
      copy: function(callback) {
        var copyOf;
        if (!copyingId) {
          return callback(null);
        }
        return async.series([
          fetch,
          copyExtraAreas,
          copyExtras
        ], callback);
        function fetch(callback) {
          return self.findForEditing(req, { _id: copyingId }).toObject(function(err, _copyOf) {
            if (err) {
              return callback(err);
            }
            if (!_copyOf) {
              return callback('notfound');
            }
            copyOf = _copyOf;
            return callback(null);
          });
        }
        function copyExtraAreas(callback) {
          return self.copyExtraAreas(req, copyOf, piece, callback);
        }
        function copyExtras(callback) {
          return self.copyExtras(req, copyOf, piece, callback);
        }
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
      }
    }, function(err) {
      if (err) {
        // Distinguish routine "no you can't do that"
        // errors from interesting "our fault" errors
        if (err.toString() !== 'Error: forbidden') {
          self.apos.utils.error(err);
        }
      }
      return responder(req, req.res, err, piece);
    });
  };

  // Update the piece object at `req.piece`
  // (usually populated via the requirePiece middleware
  // or by the insert route) based on `req.body`, fetch the updated piece
  // and invoke `responder` with `req, res, err, piece`.
  // Implements the back end of the `update` route, also used
  // by the optional `apostrophe-pieces-rest-api` module.

  self.convertUpdateAndRefresh = function(req, responder) {
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
      return responder(req, req.res, err, req.piece);
    });
  };

  // Copy top-level areas present in `copyFrom` to `piece`,
  // leaving any that are already present in `piece` alone.
  // The copy mechanism in the piece editor modal only
  // knows about noncontextual schema fields, this method is called on the
  // server side to copy contextual and undeclared areas too

  self.copyExtraAreas = function(req, copyFrom, piece, callback) {
    var extraAreas = _.filter(_.keys(copyFrom), function(key) {
      return copyFrom[key] && (copyFrom[key].type === 'area') && (!_.has(piece, key));
    });
    _.each(extraAreas, function(key) {
      piece[key] = copyFrom[key];
    });
    return callback(null);
  };

  // An empty stub you may override to copy extra properties
  // not visible to the schema when the user carries out a
  // "copy piece" operation. At this point schema fields and
  // top level extra areas have already been copied

  self.copyExtras = function(req, copyFrom, piece, callback) {
    return callback(null);
  };

  self.getCreateControls = function(req) {
    var controls = _.cloneDeep(self.createControls);
    return controls;
  };

  self.getEditControls = function(req) {
    var controls = _.cloneDeep(self.editControls);
    return controls;
  };

  self.getChooserControls = function(req) {
    return [
      {
        type: 'minor',
        label: 'Cancel',
        action: 'cancel'
      },
      {
        type: 'major',
        label: 'New ' + self.options.label,
        action: self.options.insertViaUpload ? ('upload-' + self.options.name) : ('create-' + self.options.name),
        uploadable: self.options.insertViaUpload
      },
      {
        type: 'major',
        label: 'Save Choices',
        action: 'save'
      }
    ];
  };

  self.getManagerControls = function(req) {
    return [
      {
        type: 'minor',
        label: 'Finished',
        action: 'cancel'
      },
      {
        type: 'major',
        label: 'Add ' + self.options.label,
        action: self.options.insertViaUpload ? ('upload-' + self.options.name) : ('create-' + self.options.name),
        uploadable: self.options.insertViaUpload
      }
    ];
  };

  // Generate a sample piece of this type. The `i` counter
  // is used to distinguish it from other samples. Useful
  // for things like testing pagination, see the
  // `your-piece-type:generate` task.

  self.generate = function(i) {
    var piece = self.newInstance();
    piece.title = 'Generated #' + (i + 1);
    piece.published = true;
    return piece;
  };

  self.modulesReady = function() {
    // We delay this until late so it is easier for third party
    // modules to have a say
    self.composeBatchOperations();
  };

};
