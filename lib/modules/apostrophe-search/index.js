// Implement sitewide search for Apostrophe. Provides the
// `apostrophe-search` page type for the `/search` page, which
// you should include in your "parked pages" if you wish
// to have one (see [apostrophe-pages](../apostrophe-pages/index.html)).
//
// Search is powered by the full-text search features of MongoDB.

var _ = require('lodash');
var async = require('async');

module.exports = {

  alias: 'search',

  extend: 'apostrophe-custom-pages',

  name: 'apostrophe-search',

  perPage: 10,

  afterConstruct: function(self) {
    self.dispatchAll();
    self.enableFilters();
    self.pushAssets();
    self.apos.tasks.add(self.__meta.name, 'index', self.indexTask);
  },

  construct: function(self, options) {

    self.perPage = options.perPage;

    require('./lib/browser.js')(self, options);

    self.modulesReady = function(callback) {
      return self.determineTypes(callback);
    };

    self.determineTypes = function(callback) {
      self.types = self.options.types || _.pluck(self.apos.pages.typeChoices, 'name');
      if (self.options.types) {
        // Explicit configuration was chosen
        return setImmediate(callback);
      }
      return self.apos.callAll('searchDetermineTypes', self.types, callback);
    };

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

    // This method implements the search results page. It populates `req.data.docs`
    // and provides pagination via `req.data.currentPage` and `req.data.totalPages`,
    // not to be confused with `req.data.totalDocs` which is the total number of
    // documents matching the search. The filters configured for the module are
    // respected.
    
    self.indexPage = function(req, callback) {

      // Finesse so we can use queryToFilters but we still support q, which is
      // a common expectation/preference
      req.query.search = req.query.search || req.query.q;

      // Cope with filters
      var allowedTypes;

      var defaultingToAll = false;

      var cursor = self.apos.docs.find(req, {})
        .queryToFilters(req.query, 'public')
        .perPage(self.perPage);
      if (self.filters) {
        var filterTypes = _.filter(
          _.pluck(self.filters, 'name'),
          function(name) {
            return name !== '__else';
          }
        );
        var found = false;
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

      var docs = [];

      if (self.filters) {
        req.data.filters = _.cloneDeep(self.filters);

        _.each(req.data.filters, function(filter) {
          if (defaultingToAll || req.query[filter.name]) {
            filter.value = true;
          }
        });
      }

      return async.series([ totalDocs, findDocs ], function(err) {

        if (err) {
          return callback(err);
        }

        if (self.apos.utils.isAjaxRequest(req)) {
          req.template = self.renderer('indexAjax');
        } else {
          req.template = self.renderer('index');
        }
        req.data.currentPage = cursor.get('page');
        req.data.docs = docs;

        return self.beforeIndex(req, callback);
      });

      function totalDocs(callback) {
        return cursor.toCount(function(err, count) {
          if (err) {
            return callback(err);
          }
          if (cursor.get('page') > cursor.get('totalPages')) {
            req.notFound = true;
            return callback(null);
          }
          req.data.totalDocs = count;
          req.data.totalPages = cursor.get('totalPages');
          return callback();
        });
      }

      function findDocs(callback) {

        // Polymorphic find: fetch just the ids at first, then go back
        // and fetch them via their own type managers so that we get the
        // expected joins and urls and suchlike.

        var idsAndTypes;
        var byType;

        return async.series([
          getIdsAndTypes,
          getDocs
        ], callback);

        function getIdsAndTypes(callback) {
          return cursor.projection({ _id: 1, type: 1 }).toArray(function(err, _idsAndTypes) {
            if (err) {
              return callback(err);
            }
            idsAndTypes = _idsAndTypes;
            return callback(null);
          });
        }

        function getDocs(callback) {
          byType = _.groupBy(idsAndTypes, 'type');
          return async.eachSeries(_.keys(byType), getDocsOfType, function(err) {
            if (err) {
              return callback(err);
            }
            // Restore the intended order ($in doesn't respect it and neither does
            // fetching them all by type). ACHTUNG: without this search quality goes
            // right out the window. -Tom
            docs = self.apos.utils.orderById(_.pluck(idsAndTypes, '_id'), docs);
            return callback(null);
          });
        }

        function getDocsOfType(type, callback) {
          var manager = self.apos.docs.getManager(type);
          if (!manager) {
            return setImmediate(callback);
          }
          return manager.find(req,
            {
              type: type,
              _id: {
                $in: _.pluck(byType[type], '_id')
              }
            }
          ).toArray(function(err, docsOfType) {
            if (err) {
              return callback(err);
            }
            docs = docs.concat(docsOfType);
            return callback(null);
          });
        }

      };

    };

    // Called before each page of search results is rendered; override hook

    self.beforeIndex = function(req, callback) {
      return setImmediate(callback);
    };

    self.dispatchAll = function() {
      self.dispatch('/', self.indexPage);
    };

    // Implementation of search indexing as documents are saved. Invoked
    // via callAll by the docs module

    self.docBeforeSave = function(req, doc, options) {
      return self.indexDoc(req, doc);
    };

    // Index one doc for participation in search

    self.indexDoc = function(req, doc) {
      var page;
      var prior;

      var texts = self.getSearchTexts(doc);

      _.each(texts, function(text){
        if(text.text === undefined) {
          text.text = '';
        }
      });

      var highTexts = _.filter(texts, function(text) {
        return text.weight > 10;
      });

      var searchSummary = _.map(_.filter(texts, function(text) { return !text.silent; } ), function(text) { return text.text; }).join(" ");
      var highText = self.boilTexts(highTexts);
      var lowText = self.boilTexts(texts);
      var titleSortified = self.apos.utils.sortify(doc.title);
      var highWords = _.uniq(highText.split(/ /));

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
    
    self.indexTask = function(apos, argv, callback) {
      var req = self.apos.tasks.getReq();
      return self.apos.migrations.eachDoc({}, _.partial(self.indexTaskOne, req), callback);
    };
    
    // Indexes just one document as part of the implementation of the
    // `apostrophe-search:index` task. This isn't the method you want to
    // override. See `indexDoc` and `getSearchTexts`

    self.indexTaskOne = function(req, doc, callback) {
      self.indexDoc(req, doc);
      return self.apos.docs.db.update({ _id: doc._id }, doc, callback);
    };

    // Returns texts which are a reasonable basis for
    // generating search results for this page. Should return
    // an array in which each entry is an object with
    // 'weight' and 'text' properties. 'weight' is a measure
    // of relative importance. 'text' is the text associated
    // with that chunk of content.

    self.getSearchTexts = function(doc) {
      var texts = [];
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

      // This event is an opportunity to add custom texts for
      // various types of pages
      self.apos.emit('docSearchIndex', doc, texts);

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
          var manager = self.apos.areas.getWidgetManager(item.type);
          if (!manager) {
            console.error('item has no type or manager for type ' + item.type + ' does not exist, giving up on indexing it for search');
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
      var text = _.reduce(texts, function(memo, text) {
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
}
