// Implement sitewide search for Apostrophe. Provides the
// `@apostrophecms/search` page type for the `/search` page, which
// you should include in your "parked pages" if you wish
// to have one (see [@apostrophecms/page](../@apostrophecms/page/index.html)).
//
// Search is powered by the full-text search features of MongoDB.
//
// ## Options
//
// ### `perPage`: search results per results page. Defaults to 10.
//
// ### `suggestions`: if `suggestions` is `true`, and the `notFound.html`
// template of `@apostrophecms/page` contains this element:
//
// `<div data-apos-notfound-search-results></div>`
//
// Apostrophe will attempt to locate relevant pages by feeding the component
// words of the URL to the search engine, and display those suggestions.
//
// If `suggestions` is explicitly `false`, this does not happen.
//
// If `suggestions` is an object, this feature is enabled and the `limit`
// suboption may optionally be changed to a value other than `10`.
//
// For legacy reasons, if `suggestions` is not set at all, the feature
// still operates but attempts to obtain suggestions from `/search`. This
// will work adequately if you have an Apostrophe sitewide search page
// at that URL, but we recommend you set `suggestions: true` instead.
// This allows you to override `suggest.html` to customize the behavior,
// and also improves performance by using a simpler query for the 404
// suggestions.
//
// `types`: an array of page and piece doc type names allowed to be included
// in search results. If not present, this is determined programmatically.
// In the latter case, the `searchDetermineTypes` callAll method and the
// `determineTypes` promise event are fired. Implementations of these
// take an array argument and push new type names on it. `@apostrophecms/piece-type` modules
// monitor this and add their `name`, or do not, based on their `searchable` option.
//
// `filters`: an array of filters to be offered to the user, each of which
// is an object with a `name` property and a `label` property. If no
// entry has the name `__else`, an "Everything Else" filter is automatically
// added. This is because there are always page types and piece types that
// are edge cases not relevant enough to explicitly offer a filter for, but
// which should nevertheless be included in results.

const { stripIndent } = require('common-tags');
const _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/page-type',
  options: {
    alias: 'search',
    perPage: 10,
    label: 'apostrophe:searchLabel',

    // Default projection for ancestors, used in search results.
    // See `req.aposAncestors` and `req.ancestorsApiProjection`
    // in modules/@apostrophecms/search/index.js and
    // in modules/@apostrophecms/any-page-type/index.js
    ancestorsApiProjection: {
      _id: 1,
      title: 1,
      slug: 1,
      type: 1,
      visibility: 1,
      orphan: 1,
      parkedId: 1,
      parked: 1,
      rank: 1,
      level: 1,
      aposDocId: 1,
      path: 1,
      lastPublishedAt: 1,
      aposLocale: 1,
      aposMode: 1,
      metaType: 1,
      createdAt: 1,
      archived: 1,
      titleSortified: 1,
      updatedAt: 1,
      cacheInvalidatedAt: 1,
      updatedBy: 1,
      highSearchText: 1,
      highSearchWords: 1,
      lowSearchText: 1,
      searchSummary: 1,
      _url: 1
    }
  },
  init(self) {

    self.perPage = self.options.perPage;

    if (self.options.suggestions === undefined) {
      // bc fallback, not great
      self.options.suggestions = { url: '/search' };
    } else {
      // will catch the new, better standard route URL
      self.options.suggestions = {};
    }
    self.options.suggestions.url = self.options.suggestions.url || self.action + '/suggest';
    self.dispatchAll();
    self.enableFilters();
    self.addMigrations();
  },
  routes(self) {
    return {
      get: {
        async suggest(req, res) {
          try {
            const docs = await self.suggest(req, self.apos.launder.string(req.query.q));
            return res.send(docs);
          } catch (err) {
            self.apos.util.error(err);
            return res.status(500).send('error');
          }
        }
      }
    };
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        determineTypes() {
          self.types = self.options.types || _.map(self.apos.page.typeChoices, 'name');
          if (self.options.types) {
            // Explicit configuration was chosen
            return;
          }
          // A chance to rewrite the array
          return self.emit('determineTypes', self.types);
        }
      },
      '@apostrophecms/doc-type:beforeSave': {
        indexDoc(req, doc) {
          self.indexDoc(req, doc);
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
              label: 'apostrophe:everythingElse',
              name: '__else'
            } ]);
          }
        }
      },

      addMigrations() {
        self.addIndexFixMigration();
      },

      addIndexFixMigration() {
        // Search index lacked most text fields, correct that with a one-time migration
        self.apos.migration.add('search-index-fix', async () => {
          return self.indexTask();
        });
      },

      suggest(req, q) {
        return self.apos.doc.find(req).limit(self.options.suggestions && (self.options.suggestions.limit || 10)).search(q).project({
          _url: 1,
          title: 1
        }).toArray();
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

        if (self.apos.util.isAjaxRequest(req)) {
          self.setTemplate(req, 'indexAjax');
        } else {
          self.setTemplate(req, 'index');
        }
        req.data.currentPage = query.get('page');
        req.data.docs = docs;

        return self.emit('beforeIndex', req);

        async function findDocs() {
          req.aposAncestors = true;
          req.aposAncestorsApiProjection = self.options.ancestorsApiProjection;

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
              type,
              _id: { $in: _.map(byType[type], '_id') }
            }).toArray());
          }
        }
      },

      dispatchAll() {
        self.dispatch('/', self.indexPage);
      },

      indexDoc(req, doc) {

        const texts = self.getSearchTexts(doc);
        _.each(texts, function (text) {
          if (text.text === undefined) {
            text.text = '';
          }
        });

        const highTexts = _.filter(texts, function (text) {
          return text.weight > 10;
        });

        const searchSummary = _.map(_.filter(texts, function (text) {
          return !text.silent;
        }), function (text) {
          return text.text;
        }).join(' ');
        const highText = self.boilTexts(highTexts);
        const lowText = self.boilTexts(texts);
        const titleSortified = self.apos.util.sortify(doc.title);
        const highWords = _.uniq(highText.split(/ /));

        // merge our doc with its various search texts
        _.assign(doc, {
          titleSortified,
          highSearchText: highText,
          highSearchWords: highWords,
          lowSearchText: lowText,
          searchSummary
        });
      },

      // Indexes just one document as part of the implementation of the
      // `@apostrophecms/search:index` task. This isn't the method you want to
      // override. See `indexDoc` and `getSearchTexts`

      async indexTaskOne(req, doc) {
        self.indexDoc(req, doc);

        return self.apos.doc.db.updateOne({
          _id: doc._id
        }, {
          $set: {
            titleSortified: doc.titleSortified,
            highSearchText: doc.highSearchText,
            highSearchWords: doc.highSearchWords,
            lowSearchText: doc.lowSearchText,
            searchSummary: doc.searchSummary
          }
        });
      },

      // Returns texts which are a reasonable basis for
      // generating search results for this page. Should return
      // an array in which each entry is an object with
      // 'weight' and 'text' properties. 'weight' is a measure
      // of relative importance. 'text' is the text associated
      // with that chunk of content.

      getSearchTexts(doc) {
        const texts = [];
        // Shown separately, so don't include it in the summary
        texts.push({
          weight: 100,
          text: doc.title,
          silent: true
        });
        // Usually redundant to the text of the page, so don't
        // show it in the description, but it's highly-weighted stuff
        // because we use it as the summary in a google search
        // result
        texts.push({
          weight: 100,
          text: doc.seoDescription,
          silent: true
        });
        // The slug often reveals more useful search-targeting information
        texts.push({
          weight: 100,
          text: doc.slug,
          silent: true
        });
        const manager = self.apos.doc.getManager(doc.type);
        if (manager) {
          const schema = manager.schema;
          self.apos.schema.indexFields(schema, doc, texts);
        }
        return texts;
      },

      // Reduces array of texts to a single space-separated string, passes the result
      // through apos.util.sortify to eliminate unwanted characters and case differences

      boilTexts(texts) {
        let text = _.reduce(texts, function (memo, text) {
          return memo + ' ' + text.text;
        }, '');
        text = self.apos.util.sortify(text);
        return text;
      },

      // Invoked by the @apostrophecms/version module.
      // Identify fields that should never be rolled back

      docUnversionedFields(req, doc, fields) {
        fields.push('titleSortified', 'highSearchText', 'highSearchWords', 'lowSearchText', 'searchSummary');
      },

      async indexTask() {
        const req = self.apos.task.getReq();
        return self.apos.migration.eachDoc({}, doc => {
          return self.indexTaskOne(req, doc);
        });
      }
    };
  },
  tasks(self) {
    return {
      index: {
        usage: stripIndent`
          Rebuild the search index. Normally this happens automatically.
          This should only be needed if you have changed the "searchable" property
          for various fields or types.
        `,
        async task(argv) {
          await self.indexTask();
        }
      }
    };
  }
};
