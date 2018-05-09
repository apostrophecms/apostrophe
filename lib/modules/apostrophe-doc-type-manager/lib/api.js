var _ = require('lodash');

module.exports = function(self, options) {

  // Returns the minimum permission name that should be checked for
  // to determine if this user has some edit privileges for
  // this doc type (not necessarily every instance of it),
  // for example the ability to create one. Determines
  // admin bar menu item visibility

  self.getEditPermissionName = function() {
    return self.isAdminOnly() ? 'admin' : ('edit-' + self.name);
  };

  // Returns the minimum permission name that should be checked for
  // to determine if this user has full admin privileges for
  // this doc type

  self.getAdminPermissionName = function() {
    return self.isAdminOnly() ? 'admin' : ('admin-' + self.name);
  };

  // Define the related type "cursor", so that all of our subclasses
  // automatically have a cursor type too, and it is autoloaded from
  // ./lib/cursor.js if that exists, otherwise given an empty
  // definition.

  self.defineCursor = function() {
    self.defineRelatedType('cursor', {
      stop: 'apostrophe-doc-type-manager'
    });
  };

  // Returns a cursor that will only yield docs of the appropriate type
  // as determined by the `name` option of the module. Returns a cursor of
  // the appropriate type for the current module, even if it is a subclass.

  // Returns a cursor for use in finding docs. See cursor.js for chainable
  // filters, and also yielders that actually deliver the docs to you.

  self.find = function(req, criteria, projection) {
    return self.createRelatedType('cursor', {
      apos: self.apos,
      module: self,
      req: req,
      criteria: criteria,
      projection: projection
    });
  };

  // Returns a new instance of the doc type, with the appropriate default
  // values for each schema field.

  self.newInstance = function() {
    var doc = self.apos.schemas.newInstance(self.schema);
    doc.type = self.name;
    return doc;
  };

  // Returns a MongoDB projection object to be used when querying
  // for this type if all that is needed is a title for display
  // in an autocomplete menu. Default behavior is to
  // return only the `title`, `_id` and `slug` properties.
  // Removing any of these three is not recommended.
  //
  // `query.field` will contain the schema field definition for
  // the join the user is attempting to match titles from.

  self.getAutocompleteProjection = function(query) {
    return {
      title: 1,
      _id: 1,
      slug: 1
    };
  };

  // Returns a string to represent the given `doc` in an
  // autocomplete menu. `doc` will contain only the fields returned
  // by `getAutocompleteProjection`. `query.field` will contain
  // the schema field definition for the join the user is attempting
  // to match titles from. The default behavior is to return
  // the `title` property. This is sometimes extended to include
  // event start dates and similar information that helps the
  // user distinguish between docs.

  self.getAutocompleteTitle = function(doc, query) {
    return doc.title;
  };

  // Used by `apostrophe-versions` to label changes that
  // are made to joins by ID. Set `change.text` to the
  // desired text.

  self.decorateChange = function(doc, change) {
    change.text = doc.title;
  };

  // Returns true if only admins are allowed to edit this type.
  // Respected by the pieces module when deciding whether to
  // enumerate more specific permissions as choices for this
  // module.

  self.isAdminOnly = function() {
    return false;
  };

  // Return a new schema containing only fields for which the
  // current user has the permission specified by the `permission`
  // property of the schema field, or there is no `permission` property for the field.

  self.allowedSchema = function(req) {
    var disabled;
    var type;
    var schema = _.filter(self.schema, function(field) {
      return (!field.permission) || self.apos.permissions.can(req, field.permission);
    });
    var typeIndex = _.findIndex(schema, { name: 'type' });
    if (typeIndex !== -1) {
      // This option exists so that the
      // apostrophe-option-overrides and apostrophe-workflow modules,
      // if present, can be used together to disable various types based
      // on locale settings
      disabled = self.apos.pages.getOption(req, 'disabledTypes');
      if (disabled) {
        // Take care to clone so we don't wind up modifying
        // the original schema, the allowed schema is only
        // a shallow clone of the array so far
        type = _.cloneDeep(schema[typeIndex]);
        type.choices = _.filter(type.choices, function(choice) {
          return !_.contains(disabled, choice.value);
        });
        // Make sure the allowed schema refers to the clone,
        // not the original
        schema[typeIndex] = type;
      }
    }
    return schema;
  };

  self.composeSchema = function() {

    // If a type is adminOnly remove the fields relating to permissions editing
    if (self.isAdminOnly()) {
      options.removeFields = (options.removeFields || []).concat([
        'loginRequired',
        '_viewUsers',
        '_viewGroups',
        '_editUsers',
        '_editGroups'
      ]);
    }

    self.schema = self.apos.schemas.compose(self.options);

    // Extend `composeSchema` to flag the use of field names
    // that are forbidden or nonfunctional in all doc types, i.e.
    // properties that will be overwritten by non-schema-driven
    // logic, such as `_id` or `docPermissions`

    const forbiddenFields = [ '_id', 'docPermissions', 'type', 'titleSortified', 'highSearchText', 'highSearchWords', 'lowSearchText', 'searchSummary' ];
    _.each(self.schema, function(field) {
      if (_.contains(forbiddenFields, field.name)) {
        throw new Error('Doc type ' + self.name + ': the field name ' + field.name + ' is forbidden');
      }
    });

    self.patchAdminPermissionInSchema();
  };

  // In the schema, `_editUsers` and `_editGroups` are
  // initially locked down to sitewide admins. Now that
  // we've constructed the module completely, take advantage
  // of `getAdminPermissionName` to specify a more nuanced permission,
  // such as the admin permission for this piece type, or for pages

  self.patchAdminPermissionInSchema = function() {
    var fieldNames = [ '_editUsers', '_editGroups' ];
    _.each(fieldNames, function(fieldName) {
      var field = _.find(self.schema, { name: fieldName });
      if (field) {
        field.permission = self.getAdminPermissionName();
      }
    });
  };

  // This method provides the back end of /autocomplete routes.
  // For the implementation of the autocomplete() filter see autocomplete.js.
  //
  // "query" must contain a "field" property which is the schema join field
  // that describes the relationship we're adding items to.
  //
  // "query" must also contain a "term" property, which is a partial
  // string to be autocompleted; otherwise an empty array is delivered
  // to the callback.
  //
  // We don't launder the input here, see the 'autocomplete' route.

  self.autocomplete = function(req, query, callback) {
    var cursor = self.find(req, {}, {}).sort('search');
    if (self.extendAutocompleteCursor) {
      self.extendAutocompleteCursor(cursor);
    }

    cursor.projection(self.getAutocompleteProjection(), query);

    // Try harder not to call autocomplete with something that doesn't
    // result in a search
    if (query.term && query.term.toString && query.term.toString().length) {
      var term = self.apos.launder.string(query.term);
      cursor.autocomplete(term);
    } else {
      return callback(null, []);
    }

    if (!(query.filters && query.filters.limit)) {
      cursor.limit(10);
    }

    // This is the big payoff of blessing join fields: we can apply their
    // filters in API calls like this one, knowing that the field definition
    // the browser sent us is one the developer created
    cursor.queryToFilters(query.field.filters || {});

    // Format it as value & id properties for compatibility with jquery UI autocomplete
    cursor.toArray(function(err, docs) {
      if (err) {
        return callback(err);
      }
      // Put the snippets in id order
      if (query.values) {
        docs = self.apos.utils.orderById(query.values, docs);
      }
      var results = _.map(docs, function(doc) {
        var response = {
          // jquery ui autocomplete demands label and value
          label: self.getAutocompleteTitle(doc, query),
          value: doc._id
        };
        _.defaults(response, _.omit(doc, 'title', '_id'));
        return response;
      });
      return callback(null, results);
    });
  };

  // Adds a listener for the `docSearchIndex` Apostrophe event, pointing to the
  // `searchIndexListener` method.

  self.addSearchIndexListener = function() {
    self.apos.on('docSearchIndex', self.searchIndexListener);
  };

  // Invoked when a `docSearchIndex` event takes place, this method adds
  // additional search texts to the `texts` array (modify it in place by
  // pushing new objects to it). These texts influence search results.
  // The default behavior is quite useful, so you won't often need to
  // override this.
  //
  // Each "text" is an *object* and must have at least `weight` and `text` properties.
  // If `weight` is >= 10, the text will be included in autocomplete searches and
  // given higher priority in full-text searches. Otherwise it will be included
  // only in full-text searches.
  //
  // If `silent` is `true`, the `searchSummary` property will not contain
  // the text.
  //
  // By default this method invokes `schemas.indexFields`, which will push
  // texts for all of the schema fields that support this unless they are
  // explicitly set `searchable: false`.
  //
  // In any case, the text of rich text widgets is always included as
  // lower-priority search text.

  self.searchIndexListener = function(doc, texts) {
    if (doc.type !== self.name) {
      return;
    }
    self.apos.schemas.indexFields(self.schema, doc, texts);
  };

  // Fields required to compute the `_url` property.
  // Used to implement a "projection" for `_url` if
  // requested by the developer
  self.getUrlFields = function() {
    return [ 'type', 'slug', 'tags' ];
  };

};
