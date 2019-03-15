let async = require('async');
let _ = require('@sailshq/lodash');
let Promise = require('bluebird');

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
          {label: 'Versions', action: 'versions'},
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
  };

  // Returns a cursor that finds docs the current user can edit. Unlike
  // find(), this cursor defaults to including unpublished docs. Subclasses
  // of apostrophe-pieces often extend this to remove more default filters

  self.findForEditing = function(req, criteria, projection) {
    let cursor = self.find(req, criteria, projection)
      .permission('edit')
      .published(null);
    if (self.options.canEditTrash) {
      cursor.trash(null);
    }
    return cursor;
  };

  self.list = async function(req, filters) {
    let cursor;
    if (filters.chooser) {
      cursor = self.find(req);
    } else {
      cursor = self.findForEditing(req);
    }
    if (filters.format === 'allIds') {
      cursor.projection({ _id: 1 });
    } else {
      cursor.perPage(self.options.perPage || 10);
    }
    cursor.queryToFilters(filters);

    const results = {};

    if (filters.format === 'allIds') {
      results.ids = _.map(await cursor.toArray(), '_id');
      return results;
    }
    results.total = await cursor.toCount();
    results.totalPages = cursor.get('totalPages');

    if (filters.format !== 'allIds') {

      // Populate manage view filters by the same technique used
      // for the `piecesFilters` option of `apostrophe-pieces-pages`

      const allowedFilters = filters.chooser ? _.filter(self.filters, function(item) {
        return item.allowedInChooser !== false;
      }) : self.filters;

      results.filters = {
        options: [],
        q: filters.search,
        choices: {}
      };

      for (let filter of allowedFilters) {
        // The choices for each filter should reflect the effect of all filters
        // except this one (filtering by topic pares down the list of categories and
        // vice versa)
        const _cursor = cursor.clone();
        // The default might not be good for our purposes. Set it to
        // `null`, which appropriate filters, like `trash`, understand to mean
        // "I am interested in things that are ignored by default and also live things"
        _cursor[filter.name](null);
        const _filter = _.clone(filter);
        const choices = await _cursor.toChoices(filter.name);
        // Array of all filter objects allowed in this context:
        //
        // results.filters.options = [ { name: 'published', choices: [ ... usual ... ], def: ... } ]
        //
        // Single object with a property containing the PRESENT value of EACH filter:
        //
        // results.filters.choices = {
        //   published: true
        // }
        results.filters.options.push(_.assign(_filter, { choices: choices }));
        // These are the "choices you have made," not the "choices you can make."
        results.filters.choices[_filter.name] = filters[_filter.name];
      }
    }

    const pieces = await cursor.toArray();
    if (filters.format === 'allIds') {
      results.ids = _.map(pieces, '_id');
    } else {
      results.skip = cursor.get('skip');
      results.limit = cursor.get('limit');
      results.page = cursor.get('page');
      results.pieces = pieces;
    }
    // Helps the frontend display the active sort and filter states
    results.cursor = cursor.state;

    return results;
  };

  self.on('beforeInsert', 'ensureTypeAndCreatorPermissions', (req, piece, options) => {
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

  });

  // Insert a piece. Convenience wrapper for `apos.docs.insert`.
  // Returns the piece. `beforeInsert`, `beforeSave`, `afterInsert`
  // and `afterSave` async events are emitted by this module.

  self.insert = async function(req, piece, options) {
    return self.apos.docs.insert(req, piece, options);
  };
  //
  // Update a piece. Convenience wrapper for `apos.docs.insert`.
  // Returns the piece. `beforeInsert`, `beforeSave`, `afterInsert`
  // and `afterSave` async events are emitted by this module.

  self.update = async function(req, piece, options) {
    return self.apos.docs.update(req, piece, options);
  };

  // Move a piece to the trash by id.

  self.trash = async function(req, id) {
    let permission = 'edit-doc';

    if (self.apos.permissions.can(req, 'admin-' + self.name)) {
      // This user has blanket permission for this piece type
      permission = false;
    }
    await self.apos.docs.trash(req, id, {
      permission: permission
    });
    await self.deduplicateTrash(req, piece);
  };

  // Rescue a piece from the trash by id.

  self.rescue = async function(req, id) {
    let permission = 'edit-doc';

    if (self.apos.permissions.can(req, 'admin-' + self.name)) {
      // Blanket permission for this piece type
      permission = false;
    }
    if (self.apos.permissions.can(req, 'admin-' + self.name)) {
      // This user has blanket permission for this piece type
      permission = false;
    }
    await self.apos.docs.rescue(req, id, {
      permission: permission
    });
    await self.deduplicateRescue(req, piece);
  };

  // Convert the data supplied in `req.body` via the schema and
  // update the piece object accordingly.

  self.convert = async function(req, piece) {
    return self.apos.schemas.convert(req, self.allowedSchema(req), 'form', req.body, piece);
  };

  self.apiResponse = function(res, err, data) {
    if (err) {
      // For the most part, we don't want to tell the browser exactly what the error was.
      // An exception: unique key errors, which typically mean the username or email address
      // field was a duplicate or similar
      if (self.apos.docs.isUniqueError(err)) {
        err = 'unique';
      }
      if ((typeof err) !== 'string') {
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
        return !_.includes(options.removeFilters, filter.name);
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
        return !_.includes(options.removeColumns, column.name);
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
  // [apostrophe-pieces-pages](../apostrophe-pieces-pages/index.html) will
  // call `setAddUrls` to point to [its own `addUrlsToPieces` method](../apostrophe-pieces-pages/index.html#addUrlsToPieces).

  self.addUrls = async function(req, pieces) {
    return;
  };

  // Called by [apostrophe-pieces-pages](../apostrophe-pieces-pages/index.html) to
  // replace the default `addUrls` async method with one that assigns `._url`
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
  // and a function that accepts (req, piece, data),
  // and returns a promise to perform the modification on that
  // one piece (including calling`update` if appropriate).
  //
  // `data` is an object containing any schema fields specified
  // for the batch operation. If there is no schema it will be
  // an empty object.
  //
  // Replies immediately to the request with `{ jobId: 'cxxxx' }`.
  // This can then be passed to appropriate browser-side APIs
  // to monitor progress.
  //
  // To avoid RAM issues with very large selections while ensuring
  // that all lifecycle events are fired correctly, the current
  // implementation processes the pieces in series.

  self.batchSimpleRoute = async function(req, name, change) {
    let batchOperation = _.find(self.options.batchOperations, { name: name });
    let schema = batchOperation.schema || [];

    let data = self.apos.schemas.newInstance(schema);
    await self.apos.schemas.convert(req, schema, 'form', req.body, data);

    await self.apos.modules['apostrophe-jobs'].run(req, one, {
      labels: {
        title: batchOperation.progressLabel || batchOperation.buttonLabel || batchOperation.label
      }
    });

    async function one(req, id) {
      const piece = self.findForEditing(req, { _id: id }).toObject();
      if (!piece) {
        throw 'notfound';
      }
      await change(req, piece, data);
    }

  };

  // Accept a piece as untrusted input potentially
  // found in `input` (hint: you can pass `req.body`
  // if your route accepts the piece via POST), using
  // schema-based convert mechanisms.
  //
  // Inserts it into the database, fetches it again to get all
  // joins, and returns the result (note it is an async function).
  //
  // If `piece._copyingId` is present, fetches that
  // piece and, if we have permission to view it, copies its
  // non-schema-based top level areas into the new piece.
  // This accounts for copying areas the schema doesn't know about.
  //
  // Note that it is acceptable to pass just a subset of
  // the full fields as long as there are reasonable
  // defaults in the schema.
  //
  // The module emits the `afterConvert` async event with `(req, input, piece)`
  // before inserting the piece.
  //
  // If copying, the module also emits `copyExtras` with `(req, copyOf, input, piece)`.

  self.convertInsertAndRefresh = async function(req, input) {
    const piece = self.newInstance();
    const copyingId = piece._copyingId;
    await self.convert(req, input);
    await self.emit('afterConvert', req, input, piece);
    await copy();
    await self.insert(req, piece);
    return self.findForEditing(req, { _id: piece._id }).toObject();

    async function copy() {
      let copyOf;
      if (!copyingId) {
        return;
      }
      copyOf = await self.findForEditing(req, { _id: copyingId }).toObject();
      await self.copyExtraAreas(req, copyOf, piece);
      await self.emit('copyExtras', req, copyOf, input, piece);
    }
  };
 
  // Copy top-level areas present in `copyFrom` to `piece`,
  // leaving any that are already present in `piece` alone.
  // The copy mechanism in the piece editor modal only
  // knows about noncontextual schema fields, this method is called on the
  // server side to copy contextual and undeclared areas too

  self.copyExtraAreas = function(req, copyFrom, piece) {
    const extraAreas = _.filter(_.keys(copyFrom), function(key) {
      return copyFrom[key] && (copyFrom[key].type === 'area') && (!_.has(piece, key));
    });
    _.each(extraAreas, function(key) {
      piece[key] = copyFrom[key];
    });
  };

  // Accept piece data as untrusted input potentially
  // found in `input` (hint: you can pass `req.body`
  // if your route accepts the schema form fields via POST), using
  // schema-based convert mechanisms. Update the
  // previously fetched piece in `piece`.
  //
  // Updates that piece in the database, fetches it again to get all
  // joins, and returns the result (note it is an async function).

  self.convertInsertAndRefresh = async function(req, input, piece) {
    await self.convert(req, req.piece);
    await self.afterConvert(req, req.piece);
    await self.update(req, req.piece);
    return self.findForEditing(req, { _id: req.piece._id }).toObject();
  };

  // Copy top-level areas present in `copyFrom` to `piece`,
  // leaving any that are already present in `piece` alone.
  // The copy mechanism in the piece editor modal only
  // knows about noncontextual schema fields, this method is called on the
  // server side to copy contextual and undeclared areas too

  self.copyExtraAreas = function(req, copyFrom, piece) {
    const extraAreas = _.filter(_.keys(copyFrom), function(key) {
      return copyFrom[key] && (copyFrom[key].type === 'area') && (!_.has(piece, key));
    });
    _.each(extraAreas, function(key) {
      piece[key] = copyFrom[key];
    });
  };

  self.getCreateControls = function(req) {
    let controls = _.cloneDeep(self.createControls);
    return controls;
  };

  self.getEditControls = function(req) {
    let controls = _.cloneDeep(self.editControls);
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
    let piece = self.newInstance();
    piece.title = 'Generated #' + (i + 1);
    piece.published = true;
    return piece;
  };

  self.on('apostrophe:modulesReady', 'composeBatchOperations');

};
