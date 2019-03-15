// Implement sitewide search for Apostrophe. Provides the
// `apostrophe-search` page type for the `/search` page, which
// you should include in your "parked pages" if you wish
// to have one (see [apostrophe-pages](../apostrophe-pages/index.html)).
//
// Search is powered by the full-text search features of MongoDB.
//
// ## Options
//
// ### `perPage`: search results per results page. Defaults to 10.
//
// ### `suggestions`: if `suggestions` is `true`, and the `notFound.html`
// template of `apostrophe-pages` contains this element:
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
// take an array argument and push new type names on it. `apostrophe-pieces` modules
// monitor this and add their `name`, or do not, based on their `searchable` option.
//
// `filters`: an array of filters to be offered to the user, each of which
// is an object with a `name` property and a `label` property. If no
// entry has the name `__else`, an "Everything Else" filter is automatically
// added. This is because there are always page types and piece types that
// are edge cases not relevant enough to explicitly offer a filter for, but
// which should nevertheless be included in results.

const _ = require('lodash');

module.exports = {

  alias: 'search',

  extend: 'apostrophe-custom-pages',

  name: 'apostrophe-search',

  perPage: 10,

  afterConstruct: function(self) {
    self.dispatchAll();
    self.enableFilters();
    self.apos.tasks.add(self.__meta.name, 'index', self.indexTask);
  },

  construct: function(self, options) {

    self.perPage = options.perPage;

    if (options.suggestions === undefined) {
      // bc fallback, not great
      options.suggestions = {
        url: '/search'
      };
    } else if (options.suggestions === true) {
      // will catch the new, better standard route URL
      options.suggestions = {};
    } else {
      // already an object
    }
    options.suggestions.url = options.suggestions.url || self.action + '/suggest';

    require('./lib/browser.js')(self, options);

    self.on('apostrophe:modulesReady', 'determineTypes', function() {
      self.types = self.options.types || _.map(self.apos.pages.typeChoices, 'name');
      if (self.options.types) {
        // Explicit configuration was chosen
        return;
      }
      // A chance to rewrite the array
      return self.emit('determineTypes', self.types);
    });

    self.enableFilters = function() {
      if (self.options.filters) {
        self.filters = self.options.filters;
        if (!_.find(self.filters, { name: '__else' })) {
          self.filters = self.options.filters.concat(
            [
              {
                label: "Everything Else",
                name: "__else"
              }
            ]
          );
        }
      }
    };

    self.route('get', 'suggest', async function(req, res) {
      try {
        const docs = await self.suggest(req, self.apos.launder.string(req.query.q));
      } catch (err) {
        self.apos.utils.error(err);
        return res.status(500).send('<span></span>');
      }
    });

    self.suggest = function(req, q) {
      return self.apos.docs.find(req, {}, { _url: 1, title: 1 })
        .limit((self.options.suggestions && self.options.suggestions.limit) || 10)
        .search(q)
        .toArray();
    };

    // This method implements the search results page. It populates `req.data.docs`
    // and provides pagination via `req.data.currentPage` and `req.data.totalPages`,
    // not to be confused with `req.data.totalDocs` which is the total number of
    // documents matching the search. The filters configured for the module are
    // respected.

    self.indexPage = async function(req) {

      // Finesse so we can use queryToFilters but we still support q, which is
      // a common expectation/preference
      req.query.search = req.query.search || req.query.q;

      // Cope with filters
      let allowedTypes;

      let defaultingToAll = false;

      const cursor = self.apos.docs.find(req, {})
        .queryToFilters(req.query, 'public')
        .perPage(self.perPage);
      if (self.filters) {
        let filterTypes = _.filter(
          _.map(self.filters, 'name'),
          function(name) {
            return name !== '__else';
          }
        );
        allowedTypes = _.filter(self.types, function(name) {
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
      cursor.and({ type: { $in: allowedTypes } });

      if (self.filters) {
        req.data.filters = _.cloneDeep(self.filters);

        _.each(req.data.filters, function(filter) {
          if (defaultingToAll || req.query[filter.name]) {
            filter.value = true;
          }
        });
      }

      count = await cursor.toCount();
      if (cursor.get('page') > cursor.get('totalPages')) {
        req.notFound = true;
        return;
      }
      req.data.totalDocs = count;
      req.data.totalPages = cursor.get('totalPages');

      docs = await findDocs();

      if (self.apos.utils.isAjaxRequest(req)) {
        req.template = self.renderer('indexAjax');
      } else {
        req.template = self.renderer('index');
      }
      req.data.currentPage = cursor.get('page');
      req.data.docs = docs;

      return self.emit('beforeIndex', req);

      async function findDocs() {

        // Polymorphic find: fetch just the ids at first, then go back
        // and fetch them via their own type managers so that we get the
        // expected joins and urls and suchlike.

        const idsAndTypes = await cursor.projection({ _id: 1, type: 1 }).toArray();
        const byType = _.groupBy(idsAndTypes, 'type');
        const docs = [];

        for (const type in byType) {
          await getDocsOfType(type);
        }
        // Restore the intended order ($in doesn't respect it and neither does
        // fetching them all by type). ACHTUNG: without this search quality goes
        // right out the window. -Tom
        return self.apos.utils.orderById(_.map(idsAndTypes, '_id'), docs);

        async function getDocsOfType(type) {
          const manager = self.apos.docs.getManager(type);
          if (!manager) {
            return;
          }
          docs = docs.concat(await manager.find(req,
            {
              type: type,
              _id: {
                $in: _.map(byType[type], '_id')
              }
            }
          ).toArray());
        }

      }

    };

    self.dispatchAll = function() {
      self.dispatch('/', self.indexPage);
    };

    self.on('apostrophe-doc-type-manager:beforeSave', 'indexDoc');

    // Implementation of search indexing as documents are saved.

    self.indexDoc = function(req, doc) {

      const texts = self.getSearchTexts(doc);

      _.each(texts, function(text) {
        if (text.text === undefined) {
          text.text = '';
        }
      });

      let highTexts = _.filter(texts, function(text) {
        return text.weight > 10;
      });

      let searchSummary = _.map(_.filter(texts, function(text) { return !text.silent; }), function(text) { return text.text; }).join(" ");
      let highText = self.boilTexts(highTexts);
      let lowText = self.boilTexts(texts);
      let titleSortified = self.apos.utils.sortify(doc.title);
      let highWords = _.uniq(highText.split(/ /));

      // merge our doc with its various search texts
      _.assign(doc, {
        titleSortified: titleSortified,
        highSearchText: highText,
        highSearchWords: highWords,
        lowSearchText: lowText,
        searchSummary: searchSummary
      });
    };

    // Implements the `apostrophe-search:index` task, which re-indexes all pages.
    // This should only be needed if you have changed your mind about the
    // `searchable` property for various schema fields. Indexing is automatic
    // every time a doc is saved

    self.indexTask = async function(apos, argv) {
      let req = self.apos.tasks.getReq();
      return self.apos.migrations.eachDoc({}, _.partial(self.indexTaskOne, req));
    };

    // Indexes just one document as part of the implementation of the
    // `apostrophe-search:index` task. This isn't the method you want to
    // override. See `indexDoc` and `getSearchTexts`

    self.indexTaskOne = async function(req, doc) {
      self.indexDoc(req, doc);
      return self.apos.docs.db.update({ _id: doc._id }, doc);
    };

    // Returns texts which are a reasonable basis for
    // generating search results for this page. Should return
    // an array in which each entry is an object with
    // 'weight' and 'text' properties. 'weight' is a measure
    // of relative importance. 'text' is the text associated
    // with that chunk of content.

    self.getSearchTexts = function(doc) {
      const texts = [];
      // Shown separately, so don't include it in the summary
      texts.push({ weight: 100, text: doc.title, silent: true });
      // Usually redundant to the text of the page, so don't
      // show it in the description, but it's highly-weighted stuff
      // because we use it as the summary in a google search
      // result
      texts.push({ weight: 100, text: doc.seoDescription, silent: true });
      // The slug often reveals more useful search-targeting information
      texts.push({ weight: 100, text: doc.slug, silent: true });
      // Not great to include in the summary either
      texts.push({ weight: 100, text: (doc.tags || []).join("\n"), silent: true });

      // Areas can be schemaless so find them automatically
      self.apos.areas.walk(doc, function(area, dotPath) {
        // Do not examine areas accessed via temporarily
        // joined information, such as snippets in a snippet
        // widget. Allow those items to be found on their
        // own as search results, and avoid bloating the
        // search text up to the 16MB limit as happened on DR
        if (dotPath.match(/\._\w/)) {
          return;
        }
        _.each(area.items, function(item) {
          let manager = self.apos.areas.getWidgetManager(item.type);
          if (!manager) {
            self.apos.areas.warnMissingWidgetType(item.type);
            return;
          }
          if (manager.addSearchTexts) {
            manager.addSearchTexts(item, texts);
          }
        });
      });

      return texts;
    };

    // Reduces array of texts to a single space-separated string, passes the result
    // through apos.utils.sortify to eliminate unwanted characters and case differences

    self.boilTexts = function(texts) {
      let text = _.reduce(texts, function(memo, text) {
        return memo + ' ' + text.text;
      }, '');
      text = self.apos.utils.sortify(text);
      return text;
    };

    // Invoked by the apostrophe-versions module.
    // Identify fields that should never be rolled back

    self.docUnversionedFields = function(req, doc, fields) {
      fields.push('titleSortified', 'highSearchText', 'highSearchWords', 'lowSearchText', 'searchSummary');
    };

  }
};
