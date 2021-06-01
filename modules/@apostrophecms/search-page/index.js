// Implement a sitewide search page for Apostrophe. Provides the
// `@apostrophecms/search-page` page type for the `/search` page, which
// you should include in your "parked pages" if you wish
// to have one (see [@apostrophecms/page](../@apostrophecms/page/index.html)).
//
// Search is powered by the `search` query builder of Apostrophe, which relies
// on MongoDB full-text search.
//
// ## Options
//
// ### `perPage`: search results per results page. Defaults to 10.
//
// ### `types`: an array of page and piece doc type names allowed to be included
// in search results. If not present, this is determined programmatically.
// In the latter case, this module emits the `determineTypes` promise event.
// Handlers receive an array argument and may push new type names onto it.
// `@apostrophecms/piece-type` and `@apostrophecms-page-type` modules monitor this
// and add their name, or do not, based on their `searchable` option.
//
// `filters`: an array of filters to be offered to the user, each of which
// is an object with a `name` property and a `label` property. `name` must
// be a document type name. The user is able to select multiple filters. When
// no filters are selected, all matches are shown.
//
// If no entry has the name `__else`, an "Everything Else" filter is automatically
// added. This is because there are always page types and piece types that
// are edge cases not common enough to explicitly offer a filter for, but
// which should nevertheless be included in results.

const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/page-type',
  options: {
    perPage: 10
  },
  init(self) {

    self.perPage = self.options.perPage;
    self.dispatchAll();
    self.enableFilters();
  },

  handlers(self) {

    return {
      'apostrophe:modulesReady': {
        determineTypes() {
          self.types = self.options.types || _.map(self.apos.page.typeChoices, 'name');
          if (self.options.types) {
            // Explicit configuration was chosen
            return;
          }
          // A chance to rewrite the array
          return self.emit('determineTypes', self.types);
        }
      }
    };

  },

  methods(self) {
    return {
      enableFilters() {
        if (self.options.filters) {
          self.filters = self.options.filters;
          if (!_.find(self.filters, { name: '__else' })) {
            self.filters = self.options.filters.concat([ {
              label: 'Everything Else',
              name: '__else'
            } ]);
          }
        }
      },

      // This method implements the search results page. It populates `req.data.docs`
      // and provides pagination via `req.data.currentPage` and `req.data.totalPages`,
      // not to be confused with `req.data.totalDocs` which is the total number of
      // documents matching the search. The filters configured for the module are
      // respected.

      async indexPage(req) {

        // Finesse so we can use applyBuildersSafely but we still support q, which is
        // a common expectation/preference
        req.query.search = req.query.search || req.query.q;

        // Cope with filters
        let allowedTypes;

        let defaultingToAll = false;

        const query = self.apos.doc.find(req, {}).applyBuildersSafely(req.query).perPage(self.perPage);
        if (self.filters) {
          const filterTypes = _.filter(_.map(self.filters, 'name'), function (name) {
            return name !== '__else';
          });
          allowedTypes = _.filter(self.types, function (name) {
            return _.has(req.query, name);
          });
          if (req.query.__else) {
            allowedTypes = allowedTypes.concat(_.difference(self.types, filterTypes));
          }
          if (!allowedTypes.length) {
            // Default is everything
            defaultingToAll = true;
            allowedTypes = self.types;
          }
        } else {
          allowedTypes = self.types;
        }
        query.and({ type: { $in: allowedTypes } });

        if (self.filters) {
          req.data.filters = _.cloneDeep(self.filters);

          _.each(req.data.filters, function (filter) {
            if (defaultingToAll || req.query[filter.name]) {
              filter.value = true;
            }
          });
        }

        const count = await query.toCount();
        if (query.get('page') > query.get('totalPages')) {
          req.notFound = true;
          return;
        }
        req.data.totalDocs = count;
        req.data.totalPages = query.get('totalPages');

        const docs = await findDocs();

        self.setTemplate(req, 'index');

        req.data.currentPage = query.get('page');
        req.data.docs = docs;

        return self.emit('beforeIndex', req);

        async function findDocs() {

          // Polymorphic find: fetch just the ids at first, then go back
          // and fetch them via their own type managers so that we get the
          // expected relationships and urls and suchlike.

          const idsAndTypes = await query.project({
            _id: 1,
            type: 1
          }).toArray();
          const byType = _.groupBy(idsAndTypes, 'type');
          let docs = [];

          for (const type in byType) {
            await getDocsOfType(type);
          }
          // Restore the intended order ($in doesn't respect it and neither does
          // fetching them all by type). ACHTUNG: without this search quality goes
          // right out the window. -Tom
          return self.apos.util.orderById(_.map(idsAndTypes, '_id'), docs);

          async function getDocsOfType(type) {
            const manager = self.apos.doc.getManager(type);
            if (!manager) {
              return;
            }
            docs = docs.concat(await manager.find(req, {
              type: type,
              _id: { $in: _.map(byType[type], '_id') }
            }).toArray());
          }
        }
      },

      dispatchAll() {
        self.dispatch('/', self.indexPage);
      }

    };
  }

};
