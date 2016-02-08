var _ = require('lodash');
var async = require('async');
var extend = require('extend');
var jsDiff = require('diff');
var wordwrap = require('wordwrap');
var util = require('util');

/**
 * pages
 * @augments Augments the apos object with methods which store and
 * retrieve pages. A page is a MongoDB document
 * with a title, a slug, and an areas property containing zero or more
 * named area properties. Pages are stored in the aposPages collection.
 * See also the pages module and the snippets module, which augment this
 * idea in different ways.
 *
 * @see areas for methods that read and write single areas within a
 * page.
 */

module.exports = function(self) {
  // An internal function for locating a page by slug or recognizing that
  // it is already a page object. This function does NOT check permissions
  // or call loaders. It is useful in migrations and versioning.

  function findByPageOrSlug(pageOrSlug, callback) {
    var finder;
    if (typeof(pageOrSlug) === 'string') {
      finder = function(pageOrSlug, callback) {
        return self.pages.findOne({ slug: pageOrSlug }, callback);
      };
    } else {
      finder = function(pageOrSlug, callback) {
        return callback(null, pageOrSlug);
      };
    }
    finder(pageOrSlug, function(err, page) {
      if (err) {
        return callback(err);
      }
      return callback(null, page);
    });
  }

  // Given a request object (for permissions), a page object, and a version
  // object (an old version of the page from the versions collection), roll
  // back the page to the content in the version object. This method does not
  // roll back changes to the slug property, or to the rank or path property of
  // any page with a slug beginning with /, because these are part
  // of the page's relationship to other pages which may not be rolling back and
  // could lead to an unusable page tree and/or conflicting slugs and paths

  self.rollBackPage = function(req, page, version, callback) {
    var slug = page.slug;
    var path = page.path;
    var rank = page.rank;
    delete version.diff;
    delete version.author;
    delete version.createdAt;
    extend(true, page, version);
    page.slug = slug;
    if (slug.chart(0) === '/') {
      page.path = path;
      page.rank = rank;
    }
    return self.putPage(req, page.slug, page, callback);
  };

  // Save a copy of the specified page so that it can be rolled back to
  // at any time. The req object is needed to identify the author of
  // the change. Typically called only from self.putPage

  self.versionPage = function(req, page, callback) {
    var now = new Date();

    function addVersion(callback) {
      // Turn the page object we fetched into a version object.
      // But don't modify the page object!
      var version = _.cloneDeep(page);
      version.createdAt = now;
      version.pageId = version._id;
      version.author = (req && req.user && req.user.username) ? req.user.username : 'unknown';
      version._id = self.generateId();
      delete version.searchText;
      return self.versions.insert(version, callback);
    }

    function pruneVersions(callback) {
      // This is a process meant to continue in the background,
      // intentionally. Thus we immediately trigger our callback
      // but go on executing code. On purpose. Really.
      callback(null);

      // THIS CODE RUNS INDEPENDENTLY EVEN AFTER THE REQUEST IF NEEDED
      // Strategy: if a version's time difference relative to the previous
      // version is less than 1/24th the time difference from the latest
      // version, that version can be removed. Thus versions become more
      // sparse as we move back through time. However if two consecutive
      // versions have different authors we never discard them because
      // we don't want to create a false audit trail. -Tom

      var last = null;
      var cursor = self.versions.find({ createdAt: { $lt: now }, pageId: page._id }, { createdAt: 1, _id: 1 }).sort({ createdAt: -1 });
      return cursor.nextObject(iterator);

      function iterator(err, version) {
        if (err) {
          // We are running independently, it is too late to fail the request, just log it
          console.error('An error occurred while pruning versions.');
          console.error(err);
          return;
        }
        if (version === null) {
          // We're done
          return;
        }
        var age = now.getTime() - version.createdAt.getTime();
        var difference;
        var remove = false;
        if (last) {
          if (last.author === version.author) {
            difference = last.createdAt.getTime() - version.createdAt.getTime();
            if (difference < (age / 24)) {
              remove = true;
            }
          }
        }
        if (!remove) {
          last = version;
          return cursor.nextObject(iterator);
        }
        return self.versions.remove({ _id: version._id }, function(err) {
          if (err) {
            console.error('An error occurred while pruning versions (remove)');
            console.error(err);
          }
          return cursor.nextObject(iterator);
        });
      }
    }

    return async.series([ addVersion, pruneVersions], callback);
  };

  self.diffPages = function(page1, page2) {
    var lines1 = self.diffPageLines(page1);
    var lines2 = self.diffPageLines(page2);
    var results = jsDiff.diffLines(lines1.join("\n"), lines2.join("\n"));
    // We're not interested in what stayed the same
    return _.filter(results, function(result) { return result.added || result.removed; });
  };

  // Returns a list of lines of text which, when diffed against the
  // results for another version of the page, will result in a reasonable
  // summary of what has changed
  self.diffPageLines = function(page) {
    var lines = [];
    lines.push('title: ' + page.title);
    lines.push('type: ' + page.type);
    if (page.tags) {
      lines.push('tags: ' + page.tags.join(','));
    }

    self.emit('diff', page, lines);

    self.walkAreas(page, function(area, dotPath) {
      _.each(area.items, function(item) {
        lines.push(dotPath + ': ' + item.type);
        var itemType = self.itemTypes[item.type];
        if (itemType) {
          if (itemType.addDiffLines) {
            itemType.addDiffLines(item, lines);
          }
        }
      });
    });
    return lines;
  };

  // Given some plaintext, add diff-friendly lines to the lines array
  // based on its contents

  self.addDiffLinesForText = function(text, lines) {
    var wrapper = wordwrap(0, 60);
    var rawLines = text.split("\n");
    _.each(rawLines, function(line) {
      line = wrapper(line);
      _.each(line.split("\n"), function(finalLine) {
        if (!finalLine.length) {
          return;
        }
        lines.push(finalLine);
      });
    });
  };

  // Index the page for search purposes.

  self.indexPage = function(req, pageOrSlug, callback) {
    var page;
    var prior;

    function findPage(callback) {
      var finder;
      if (typeof(pageOrSlug) === 'string') {
        finder = function(pageOrSlug, callback) {
          return self.pages.findOne({ slug: pageOrSlug }, callback);
        };
      } else {
        finder = function(pageOrSlug, callback) {
          return callback(null, pageOrSlug);
        };
      }
      finder(pageOrSlug, function(err, pageArg) {
        if (err) {
          return callback(err);
        }
        page = pageArg;
        return callback(null);
      });
    }

    function index(callback) {
      // Index the page
      var texts = self.getSearchTextsForPage(page);
      // These texts have a weight property so they are ideal for feeding
      // to something better, but for now we'll prep for a dumb, simple regex search
      // via mongo that is not aware of the weight of fields. This is pretty
      // slow on big corpuses but it does have the advantage of being compatible
      // with the presence of other criteria. Our workaround for the lack of
      // really good weighting is to make separate texts available for searches
      // based on high-weight fields and searches based on everything

      // Individual widget types play with weights a little, but the really
      // big numbers are reserved for metadata fields. Look for those
      var highTexts = _.filter(texts, function(text) {
        return text.weight > 10;
      });

      function boilTexts(texts) {
        var text = _.reduce(texts, function(memo, text) {
          return memo + ' ' + text.text;
        }, '');
        text = self.sortify(text);
        return text;
      }

      var searchSummary = _.map(_.filter(texts, function(text) { return !text.silent; } ), function(text) { return text.text; }).join(" ");
      var highText = boilTexts(highTexts);
      var lowText = boilTexts(texts);
      var sortTitle = self.sortify(page.title);
      var highWords = _.uniq(highText.split(/ /));

      return self.pages.update({ slug: page.slug }, { $set: { sortTitle: sortTitle, highSearchText: highText, highSearchWords: highWords, lowSearchText: lowText, searchSummary: searchSummary } }, callback);
    }

    return async.series([findPage, index], callback);
  };

  // Returns texts which are a reasonable basis for
  // generating search results for this page. Should return
  // an array in which each entry is an object with
  // 'weight' and 'text' properties. 'weight' is a measure
  // of relative importance. 'text' is the text associated
  // with that chunk of content.

  self.getSearchTextsForPage = function(page) {
    var texts = [];
    // Shown separately, so don't include it in the summary
    texts.push({ weight: 100, text: page.title, silent: true });
    // Usually redundant to the text of the page, so don't
    // show it in the description, but it's highly-weighted stuff
    // because we use it as the summary in a google search
    // result
    texts.push({ weight: 100, text: page.seoDescription, silent: true });
    // The slug often reveals more useful search-targeting information
    texts.push({ weight: 100, text: page.slug, silent: true });
    // Not great to include in the summary either
    texts.push({ weight: 100, text: (page.tags || []).join("\n"), silent: true });

    // This event is an opportunity to add custom texts for
    // various types of pages
    self.emit('index', page, texts);

    // Areas can be schemaless so find them automatically
    self.walkAreas(page, function(area, dotPath) {
      // Do not examine areas accessed via temporarily
      // joined information, such as snippets in a snippet
      // widget. Allow those items to be found on their
      // own as search results, and avoid bloating the
      // search text up to the 16MB limit as happened on DR
      if (dotPath.match(/\._\w/)) {
        return;
      }
      _.each(area.items, function(item) {
        var itemType = self.itemTypes[item.type];
        if (itemType) {
          if (itemType.addSearchTexts) {
            itemType.addSearchTexts(item, texts);
          }
        }
      });
    });

    return texts;
  };

  // Given some plaintext, add diff-friendly lines to the lines array
  // based on its contents

  self.addDiffLinesForText = function(text, lines) {
    var wrapper = wordwrap(0, 60);
    var rawLines = text.split("\n");
    _.each(rawLines, function(line) {
      line = wrapper(line);
      _.each(line.split("\n"), function(finalLine) {
        if (!finalLine.length) {
          return;
        }
        lines.push(finalLine);
      });
    });
  };

  // apos.get delivers pages that the current user is permitted to
  // view, with areas fully populated and ready to render if
  // they are present.
  //
  // Pages are also marked with a ._edit property if they are editable
  // by this user.
  //
  // The results are delivered as the second argument of the callback
  // if there is no error. The results object will have a `pages` property
  // containing 0 or more pages. The results object will also have a
  // `criteria` property containing the final MongoDB criteria used to
  // actually fetch the pages. This criteria can be reused for direct
  // MongoDB queries, for instance `distinct` queries to identify
  // unique tags relevant to the pages returned.
  //
  // WHO SHOULD USE THIS METHOD
  //
  // Developers who need something different from a simple fetch of one
  // page (use `apos.getPage`), fetch of ancestors, descendants, etc. of
  // tree pages (use `pages.getAncestors`, `pages.getDescendants`, etc.),
  // or fetch of snippets of some type such as blog posts or events
  // (use `snippets.get`, `blog.get`, etc). All of these methods are
  // built on this method.
  //
  // WARNING
  //
  // This function doesn't care if a page is a "tree page" (slug starting
  // with a `/`) or not. If you are only interested in tree pages and you
  // are not filtering by page type, consider setting
  // `criteria.slug` to a regular expression matching a leading /.
  //
  // CRITERIA
  //
  // A `criteria` object can be, and almost always is, passed
  // as the second argument.
  //
  // The `criteria` object is included in the MongoDB query made by
  // this method to fetch pages. This object can contain any
  // MongoDB criteria you wish. For instance, { type: 'default' }
  // would fetch only pages of that type. Other criteria, such as
  // permissions, are automatically applied as well via MongoDB's
  // `$and` keyword so that you are not restricted in what you can
  // do in your own criteria object.
  //
  // OPTIONS
  //
  // An options object can be passed as the third argument.
  //
  // If `options.editable` is true, only pages the current user can
  // edit are returned. If `options.permission` is true, only pages
  // with that specific permission (such as `edit-page`) are
  // returned. Otherwise pages the user can see are returned.
  //
  // If `options.sort` is present, it is passed as the argument to the
  // MongoDB sort() function. The default sort is by title, on the
  // `sortTitle` property which is always lowercase for case insensitive
  // results.
  //
  // `options.limit` indicates the maximum number of results to return.
  // `options.skip` indicates the number of results to skip. These can
  // be used to implement pagination.
  //
  // If `options.fields` is present it is used to limit the fields
  // returned by MongoDB for performance reasons (the second argument
  // to MongoDB's find()). To generate valid links, make sure you include
  // `slug` in the fields you ask for. It may be easiest to ask
  // NOT to get the properties that are areas: { body: 0, thumbnail: 0},
  // for instance.
  //
  // If `options.areas` is explicitly set to false, no areas are returned.
  // If `options.areas` is set to an array then only those areas are returned.
  // The `options.areas` array may use dot notation. `options.areas` does
  // not have as large a performance benefit as `options.fields` but
  // it is less fussy to work with.
  //
  // `options.search` searches for the given text, and allows
  // the use of quotation marks for intact phrases and "-" for negation
  // in the same way that Google does. `options.search` is best for
  // a thorough, well-ranked search of documents. `options.search` is
  // not suited for autocomplete because it cannot match on partial words.
  //
  // `options.autocomplete` searches for a partial match based on what
  // the user as has typed so far. It can handle partial words well, but
  // matches only titles, tags and other important metadata, not the
  // full text of a document.
  //
  // `options.q` is accepted as a synonym for `search`, and
  // `options.titleSearch` is accepted as a synonym for `autocomplete`.
  //
  //
  // `options.published` indicates whether to return only published pages
  // ('1' or true), return only unpublished pages (`0` or false), or
  // return both ('any' or null). It defaults to 'any', allowing suitable
  // users to preview unpublished pages.
  //
  // `options.trash` indicates whether to return only pages in the
  // trashcan the trashcan ('1' or true), return only pages not in the
  // trashcan ('0' or false), or return both ('any' or null). It defaults
  // to '0'.
  //
  // `options.orphan` indicates whether to return only pages that are
  // accessible yet hidden from normal navigation links ('1' or true),
  // never return such orphans ('0' or false), or return both
  // ('any' or null). It defaults to 'any' to ensure such pages
  // are reachable.
  //
  // `options.tags` is a convenient way to find content that has
  // at least one of the given array of tags. `options.notTags`
  // does the reverse: it excludes content that has at least one
  // of the given array of tags.
  //
  // `options.draft` returns the latest unapproved draft of the
  // page if Apostrophe was configured with `workflow: true`.
  // Otherwise the latest live version of the page is returned.
  //
  // In any case the user's identity limits what they can see.
  // Permissions are checked according to the Apostrophe permissions
  // model (see permissions.js).
  //
  // You may disable permissions entirely by setting `options.permissions`
  // to `false`. This can make sense when you are using pages as storage
  // in a context where Apostrophe's permissions model is not relevant.
  //
  // If `options.getDistinctTags` is true, an array of distinct tags
  // matching the current criteria is delivered in lieu of the usual
  // results object. Alternatively, if `options.getDistinct` is set to a
  // property name, then distinct values for that property are delivered.
  // This is useful when implementing filters.
  //
  // `options.lateCriteria`
  //
  // Unfortunately at least one MongoDB operator, `$near`, cannot be
  // combined with other operators using `$and` as this method normally
  // does to combine permissions checks with other criteria. You may
  // place such operators in `options.lateCriteria`, a MongoDB criteria
  // object which is merged into the query at the last possible moment.
  // This object must not contain an `$and` clause at the top level.
  // See https://jira.mongodb.org/browse/SERVER-4572 for more information.
  // The `criteria` and `options` arguments may be skipped.
  // (Getting everything is a bit unusual, but it's not forbidden.)
  //

  self.get = function(req, userCriteria, options, mainCallback) {
    req.traceIn('get');
    if (arguments.length === 2) {
      mainCallback = userCriteria;
      userCriteria = {};
      options = {};
    } else if (arguments.length === 3) {
      mainCallback = options;
      options = {};
    }
    var superMainCallback = mainCallback;
    mainCallback = function() {
      req.traceOut('get');
      return superMainCallback.apply(null, arguments);
    };

    function time(fn, name) {
      return function(callback) {
        req.traceIn(name);
        return fn(function(err) {
          req.traceOut();
          return callback(err);
        });
      };
    }

    // Second criteria object based on our processing of `options`
    var filterCriteria = {};

    var permission = options.permission || (options.editable && 'edit-page') || 'view-page';

    var search = options.search || options.q;

    var autocomplete = options.autocomplete || options.titleSearch;

    if (autocomplete) {
      var _options = _.cloneDeep(options);
      var words;
      _options.getDistinct = 'highSearchWords';
      delete _options.autocomplete;
      delete _options.titleSearch;

      autocomplete = self.sortify(autocomplete);

      if (autocomplete.length) {
        words = autocomplete.split(/ /);
        // Use an indexed collection of words to optimize the query.
        // Use rooted regexes to take advantage of the index.
        filterCriteria.$and = _.map(words, function(word) {
          return { highSearchWords: self.searchify(word, true) };
        });
        // Then use a regex so that multiple word matches
        // are still required when the user types multiple words
        filterCriteria.highSearchText = self.searchify(autocomplete);
      }

      var autocompleteCriteria = {
        $and: [ userCriteria, filterCriteria ]
      };

      return self.get(req, autocompleteCriteria, _options, function(err, results) {

        if (err) {
          return mainCallback(err);
        }

        // This will be ALL the distinct high search words for
        // the matched documents, so we need to filter out those
        // that don't actually match one of the words in the
        // autocomplete phrase

        results = _.filter(results, function(result) {
          return _.some(words, function(word) {
            if (result.substr(0, word.length) === word) {
              return true;
            }
          });
        });

        // If we match nothing, return nothing. Don't assume
        // we know what kind of query it was though.

        if (!results.length) {
          delete _options.getDistinct;
          return self.get(req, { _thisWillNeverHappen: true }, _options, mainCallback);
        }

        // Set up a recursive call using MongoDB
        // full text search

        delete _options.getDistinct;
        _options.search = results.join(' ');
        return self.get(req, userCriteria, _options, function(err, results) {
          if (err) {
            return mainCallback(err);
          }
          if (!results.pages) {
            return mainCallback(err, results);
          }
          if (results.pages.length) {
            return mainCallback(err, results);
          }
          // fallback if mongodb index text search "stop words" prevent us
          // from getting any useful results. This is not as good as
          // full text search, but it gives us a chance of getting what
          // we wanted in a search for "About". -Tom

          delete _options.search;

          return self.get(req, autocompleteCriteria, _options, function(err, results) {
            return mainCallback(err, results);
          });
        });
      });
    }

    var sort = options.sort;

    if (sort === false) {
      // OK, you really truly don't want a sort
      // (for instance, you are relying on the
      // implicit sort of $near)
    } else if (search) {
      // Text search is in the picture. If they don't
      // specify a sort or specify sort: 'q' or
      // sort: 'search', sort by search result quality
      if ((!sort) || (sort === 'q') || (sort === 'search')) {
        sort = { textScore: { $meta: 'textScore' } };
      }
    } else if (!sort) {
      // A reasonable default sorting behavior
      sort = { sortTitle: 1 };
    }

    var limit = options.limit || undefined;

    var skip = options.skip || undefined;

    var fields = options.fields || undefined;

    var areas = (options.areas === undefined) ? true : options.areas;

    var tags = options.tags || undefined;

    var notTags = options.notTags || undefined;

    var permissions = (options.permissions === false) ? false : true;

    var lateCriteria = options.lateCriteria || undefined;

    self.convertBooleanFilterCriteria('trash', options, filterCriteria, '0');
    self.convertBooleanFilterCriteria('orphan', options, filterCriteria, 'any');
    self.convertBooleanFilterCriteria('published', options, filterCriteria);
    if (tags || notTags) {
      filterCriteria.tags = { };
      if (tags) {
        filterCriteria.tags.$in = tags;
      }
      if (notTags) {
        filterCriteria.tags.$nin = notTags;
      }
    }

    if (search) {
      // Set up MongoDB text index search
      filterCriteria.$text = { $search: search };
    }

    var projection = _.cloneDeep(fields || {});

    if (search) {
      // MongoDB mandates this if we want to sort on search result quality
      projection.textScore = { $meta: 'textScore' };
    }

    var results = {};

    var combine = [ userCriteria, filterCriteria ];

    if (permissions) {
      combine.push(self.permissions.criteria(req, permission));
    }

    var criteria = {
      $and: combine
    };

    // The lateCriteria option is merged with the criteria option last
    // so that it is not subject to any $and clauses, due to this
    // limitation of MongoDB which prevents the highly useful $near
    // clause from being used otherwise:
    //
    // https://jira.mongodb.org/browse/SERVER-4572

    if (lateCriteria) {
      extend(true, criteria, lateCriteria);
    }

    if (options.getDistinctTags) {
      // This is purely for bc so just modify options
      options.getDistinct = 'tags';
    }

    if (options.getDistinct) {
      if (self._scanCriteriaFor(criteria, { $near: 1 })) {
        // There is a MongoDB bug as of 2.6.1 that causes crashes
        // if $near is combined with "distinct". Work around it by
        // getting all the IDs and doing a "distinct" on those.
        // It's not great, but it's not a crash. -Tom
        return self.pages.find(criteria, { _id: 1 }).toArray(function(err, results) {
          if (err) {
            return mainCallback(err);
          }
          var ids = _.pluck(results, '_id');
          return self.pages.distinct(options.getDistinct, { _id: { $in: ids } }, mainCallback);
        });
      }
      // Just return distinct values for some field matching the current criteria,
      // rather than the normal results. This is a bit of a hack, we need
      // to consider refactoring all of 'fetchMetadata' here
      return self.pages.distinct(options.getDistinct, criteria, mainCallback);
    }

    if (!options.hint) {
      options.hint = self.hintGetCriteria(criteria);
      // console.log(JSON.stringify(options.hint) + ': ' + JSON.stringify(criteria));
    }

    var findOptions = {};
    // If a sort is present, we must let
    // mongodb use the matching index or
    // we'll get the dreaded:
    // https://jira.mongodb.org/browse/SERVER-15231
    if (options.hint && (!sort)) {
      findOptions.hint = options.hint;
      // console.log('we have a hint for ' + JSON.stringify(criteria));
    }

    // var start = (new Date()).getTime();

    async.series([time(count, 'count'), time(loadPages, 'loadPages'), time(markPermissions, 'markPermissions'), time(beforeLoadWidgets, 'beforeLoadWidgets'),time(loadWidgets, 'loadWidgets'), time(afterGet, 'afterGet')], done);

    function count(callback) {
      // console.log(util.inspect(criteria, { depth: null }));
      if ((skip === undefined) && (limit === undefined)) {
        // Why query twice if we're getting everything anyway? Especially
        // when count() ignores optimizer hints (until 2.5.5 at least)?
        return callback(null);
      }
      // find() modifies its third argument, so make sure it's a copy
      var o = {};
      extend(true, o, findOptions);
      var start = Date.now();
      self.pages.find(criteria, {}, o).count(function(err, count) {

        if (!req.traceQueries) {
          req.traceQueries = [];
        }
        var query = {
          criteria: util.inspect(criteria, { depth: 10 }),
          projection: 'COUNT',
          time: Date.now() - start,
          hint: findOptions.hint
        };
        req.traceQueries.push(query);

        results.total = count;
        return callback(err);
      });
    }

    function loadPages(callback) {
      // find() modifies its third argument, so make sure it's a copy
      var o = {};
      extend(true, o, findOptions);
      var start = Date.now();
      var q = self.pages.find(criteria, projection, o);
      // At last we can use skip and limit properly thanks to permissions stored
      // in the document
      if (skip !== undefined) {
        q.skip(skip);
      }
      if (limit !== undefined) {
        q.limit(limit);
      }
      if (sort) {
        q.sort(sort);
      }
      q.toArray(function(err, pagesArg) {
        if (err) {
          console.error(err);
          return callback(err);
        }

        if (!req.traceQueries) {
          req.traceQueries = [];
        }
        var query = {
          criteria: util.inspect(criteria, { depth: 10 }),
          projection: util.inspect(projection, { depth: 10 }),
          time: Date.now() - start,
          hint: findOptions.hint,
          sort: sort
        };
        req.traceQueries.push(query);

        // var end = (new Date()).getTime();

        // console.log((end - start) + ': ' + JSON.stringify(criteria));

        results.pages = pagesArg;

        if (results.total === undefined) {
          results.total = results.pages.length;
        }

        // If we are interested in drafts, return the draft content
        // as if it were public, otherwise return the public content

        if (self.options.workflow) {
          var draft = (req.session && (req.session.workflowMode === 'draft'));
          if (draft) {
            // Get the drafts as if they were the pages
            results.pages = self.workflowGetDrafts(results.pages);
          } else {
            // Get the pages without the draft property
            self.workflowCleanPages(results.pages);
          }
        }

        var now = Date.now();
        // Except for ._id, no property beginning with a _ should be
        // loaded from the database. These are reserved for dynamically
        // determined properties like permissions and joins
        _.each(results.pages, function(page) {
          // If we don't remove these we spend double resources
          // loading them. TODO: a migration soon to eliminate
          // these backups; we trust the results of the 0.5 migrator
          // at this point.
          if (page.preMigrationAreas) {
            delete page.preMigrationAreas;
          }
          self.pruneTemporaryProperties(page);
        });

        if (areas !== true) {
          if (Array.isArray(areas)) {
            _.each(results.pages, function(page) {
              self.walkAreas(page, function(area, dotPath) {
                return (!_.contains(areas, dotPath));
              });
            });
          } else {
            // Removing all areas is simpler
            _.each(results.pages, function(page) {
              self.walkAreas(page, function(area) {
                return true;
              });
            });
          }
        }
        return callback(err);
      });
    }

    function markPermissions(callback) {
      if (options.annotatePermissions !== false) {
        self.permissions.annotate(req, 'edit-page', results.pages);
        self.permissions.annotate(req, 'publish-page', results.pages);
      }
      return callback(null);
    }

    function beforeLoadWidgets(callback) {
      return self.beforeLoadWidgets(req, results, callback);
    }

    function loadWidgets(callback) {
      // Use eachSeries to avoid devoting overwhelming mongodb resources
      // to a single user's request. There could be many snippets on this
      // page, and callLoadersForPage is parallel already
      async.forEachSeries(results.pages, function(page, callback) {
        // Do not crash the stack
        return setImmediate(function() {
          return self.callLoadersForPage(req, page, callback);
        });
      }, function(err) {
        if (err) {
          console.error('error from loadWidgets:');
          console.error(err);
        }
        return callback(err);
      });
    }

    function afterGet(callback) {
      if(typeof self.afterGet === 'function'){
        self.afterGet(req, results, callback);
      } else {
        return callback(null);
      }
    }

    function done(err) {
      return mainCallback(err, results);
    }
  };

  // Identical to apos.get, but delivers only the first
  // page, or null if there is no page matching the
  // criteria.
  //
  // If you use options like getDistinctTags that
  // do not return pages, you will receive the same response
  // you would with self.get.

  self.getOne = function(req, userCriteria, options, callback) {
    return self.get(req, userCriteria, options, function(err, results) {
      if (err) {
        return callback(err);
      }
      if (!results.pages) {
        return callback(null, results);
      }
      if (!results.pages.length) {
        return callback(null, null);
      }
      return callback(null, results.pages[0]);
    });
  };

  // Similar to afterGet, but fired before the widget loaders
  // are called.

  self.beforeLoadWidgets = function(req, results, callback) {
    return callback(null);
  };

  // The afterGet method can be overridden to modify the
  // results of all calls to apos.get easily. Be mindful that
  // the `results` object might not have a pages property at all
  // in cases where only distinct tags (or other distinct properties)
  // were asked for. You can also use the afterGet option when
  // configuring the apostrophe module, and the apostrophe-site
  // module offers an afterGet option which is passed on in that way.

  self.afterGet = function(req, results, callback) {
    return callback(null);
  };

  // Fetch the "page" with the specified slug. As far as
  // apos is concerned, the "page" with the slug /about
  // is expected to be an object with a .about property.
  //
  // A 'req' object is needed to provide a context for permissions.
  // Permissions are checked on the page based on the user's identity.
  // A ._edit property will be set on the page if it is editable by
  // the current user and it will not be returned at all if it is
  // not viewable by the current user.
  //
  // The first callback parameter is an error or null.
  // In the event of an exact slug match, the second parameter
  // to the callback is the matching page object. If there is a
  // partial slug match followed by a / in the URL or an exact
  // slug match, the longest such match is the third parameter.
  // The fourth parameter is the remainder of the URL following
  // the best match, or the empty string in the event of an
  // exact match.
  //
  // If the slug passed does not begin with a leading /,
  // partial matches are never returned.
  //
  // You MAY also store entirely unrelated properties in
  // your "page" objects, via your own mongo code.
  //
  // This allows the composition of objects as
  // different (and similar) as webpages, blog articles,
  // upcoming events, etc. Usually objects other than
  // webpages do not have a leading / on their slugs
  // (and when using the pages module they must not).
  //
  // The `options` parameter may be skipped. If it is not
  // skipped, it is passed on to `apos.get`.

  self.getPage = function(req, slug, optionsArg, callback) {
    if (!callback) {
      callback = optionsArg;
      optionsArg = {};
    }
    if (!optionsArg) {
      optionsArg = {};
    }

    var slugs = [];
    var components;
    // Partial matches. Avoid an unnecessary OR of '/' and '/' for the
    // homepage by checking that slug.length > 1
    if (slug.length && (slug.substr(0, 1) === '/') && (slug.length > 1)) {
      var path = '';
      // homepage is always interesting
      slugs.unshift('/');
      components = slug.substr(1).split('/');
      for (var i = 0; (i < (components.length - 1)); i++) {
        var component = components[i];
        path += '/' + component;
        slugs.unshift(path);
      }
    }    // And of course always consider an exact match. We use unshift to
    // put the exact match first in the query, but we still need to use
    // sort() and limit() to guarantee that the best result wins
    slugs.unshift(slug);

    // Ordering in reverse order by slug gives us the longest match first
    var options = {
      sort: { slug: -1 },
      limit: 1
    };

    extend(true, options, optionsArg);

    self.get(req, { slug: { $in: slugs } }, options, function(err, results) {
      if (err) {
        return callback(err);
      }
      if (results.pages.length) {
        var page = results.pages[0];
        var bestPage = page;
        if (page.slug !== slug) {
          // partial match only
          page = null;
        }

        var remainder = slug.substr(bestPage.slug.length);
        // Strip trailing slashes for consistent results
        remainder = remainder.replace(/\/+$/, '');
        // For consistency, guarantee a leading / if the remainder
        // is not empty. This way parsing remainders attached to the
        // home page (the slug of which is '/') is not a special case
        if (remainder.length && (remainder.charAt(0) !== '/')) {
          remainder = '/' + remainder;
        }
        return callback(err, page, bestPage, remainder);
      } else {
        // Nonexistence is not an error
        return callback(null, null);
      }
    });
  };

  // Return an object to be passed as the hint option to MongoDB,
  // or undefined if we can't make any clever suggestions. This method
  // is called by apos.get because the MongoDB query optimizer is
  // sometimes not bright enough to spot the smartest indexes to use
  // with Apostrophe queries. If we get this wrong Apostrophe is very
  // slow on sites with tends of thousands of pages

  self.hintGetCriteria = function(criteria) {

    // If a query mentions $text at any point, hinting is forbidden
    // (cue Master Shake)
    if (self._scanCriteriaFor(criteria, { $text: 1, $near: 1 })) {
      return undefined;
    }

    // If a query mentions "path" or "slug" at any point, it is likely
    // that we can greatly optimize it by indexing on those fields
    var field = self._scanCriteriaFor(criteria, { 'path': 1, 'slug': 1 });
    if (field) {
      var o = {};
      o[field] = 1;
      return o;
    } else {
      return undefined;
    }
  };

  // Scan a MongoDB criteria object for any mention of
  // particular properties and, if found, return the
  // first such property name. The second argument
  // looks like: { 'path': 1 }
  self._scanCriteriaFor = function(criteria, fields) {
    var p;
    var v;
    var i;
    var result;
    for (p in criteria) {
      if (fields[p]) {
        v = criteria[p];
        if ((p === 'slug') && (v instanceof RegExp) && (v.toString() === '/^\\//')) {
          // This is just a test to rule out non-tree pages.
          // There are typically enough tree pages that this
          // is not an interesting criterion for a hint.
          continue;
        }
        return p;
      }
      v = criteria[p];

      if (typeof(v) === 'object') {
        if (Array.isArray(v)) {
          for (i = 0; (i < v.length); i++) {
            result = self._scanCriteriaFor(v[i], fields);
            if (result) {
              return result;
            }
          }
        } else {
          result = self._scanCriteriaFor(v, fields);
          if (result) {
            return result;
          }
        }
      }
    }
    return undefined;
  };

  // Insert or update an entire page object at once.
  //
  // slug is the existing slug of the page in the database. If page.slug is
  // different then the slug of the page is changed. If page.slug is not defined
  // it is set to the slug parameter for your convenience. The slug of the page,
  // and the path of the page if it is defined, are both automatically made
  // unique through successive addition of random digits if necessary.
  //
  // You MAY add unrelated properties to page objects between calls to
  // getPage and putPage, or directly manipulate page objects with mongodb.
  //
  // You MUST pass the req object for permissions checking.
  //
  // If the page does not already exist this method will create it.
  //
  // A copy of the page is inserted into the versions collection unless you
  // explicitly specify "version: false" as an option. This also bypasses
  // workflow as described below.
  //
  // If Apostrophe's global "workflow" option is true and options.workflow
  // is true, this method will push your updates into a "draft" object
  // property of the page rather than directly updating the live
  // properties of the page.
  //
  // Please let this function generate ._id for you on a new page. This is
  // necessary to allow putPage to distinguish new pages from old when
  // automatically fixing unique slug errors.
  //
  // The options argument may be skipped. If options.permissions is explicitly
  // false, the operation takes place without checking permissions.

  self.putPage = function(req, slug, options, page, callback) {
    // Allow skipping of the options parameter
    if (!callback) {
      callback = page;
      page = options;
      options = {};
    }

    var newPage = false;
    if (!page.slug) {
      page.slug = slug;
    }

    // We identify new pages by whether they already have
    // an ID. However to accommodate rare cases where the ID needs
    // to be determined externally in advance we check for
    // a _newId property before generating one.
    if (!page._id) {
      page._id = page._newId || self.generateId();
      delete page._newId;
      newPage = true;
    }

    page.sortTitle = self.sortify(page.title);

    var workflowApplied = false;

    // Provide the object rather than the slug since we have it and we can
    // avoid extra queries that way and also do meaningful permissions checks
    // on new pages
    function permissions(callback) {
      if (options.permissions === false) {
        return callback(null);
      }
      return callback(self.permissions.can(req, 'edit-page', page) ? null : 'forbidden');
    }

    function beforePutPage(callback) {
      return self.beforePutPage(req, page, callback);
    }

    function save(callback) {
      function afterUpdate(err) {
        if (err && self.isUniqueError(err))
        {
          var num = (Math.floor(Math.random() * 10)).toString();
          if (page.slug === undefined) {
            return callback('page.slug is not set');
          }
          page.slug += num;
          // Path index is sparse, not everything is part of a page tree,
          // don't create materialized paths where none are desired
          // (for instance, blog posts)
          if (page.path) {
            page.path += num;
          }
          // Retry on an existing page must use the OLD slug or it will
          // create unwanted clones. For a new page it must NOT use the old slug
          // or it will keep failing
          return save(callback);
        }
        return callback(err);
      }

      // TODO a safe shallow cloning mechanism would
      // be tricky but faster

      var copy = _.cloneDeep(page);

      self.pruneTemporaryProperties(copy);

      if (newPage) {
        return self.pages.insert(copy, { safe: true }, afterUpdate);
      } else if (self.options.workflow && (options.workflow)) {
        workflowApplied = true;
        return self.workflowUpdatePage(req, copy, options.workflow, afterUpdate);
      } else {
        if (!newPage) {
          // Makes it less likely we'll have a fussy issue with MongoDB thinking
          // we tried to change the ID if someone has a page with an ObjectID rather
          // than a string id (although we emphasize it should be the latter).
          // This is an old issue, probably not current, but for bc keep
          // this in projects not using workflow for now.
          delete copy._id;
        }
        return self.pages.update({ slug: slug }, copy, { safe: true }, afterUpdate);
      }
    }

    function versioning(callback) {
      if (options.version === false) {
        return callback(null);
      }
      return self.versionPage(req, page, callback);
    }

    function indexing(callback) {
      // Search should not be updated if this change is
      // subject to approval
      if (workflowApplied) {
        return setImmediate(callback);
      }
      return self.indexPage(req, page, callback);
    }

    function afterPutPage(callback) {
      return self.afterPutPage(req, page, callback);
    }

    function finish(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, page);
    }
    async.series([ permissions, beforePutPage, save, versioning, indexing, afterPutPage], finish);
  };

  // Invoked when putPage is about to actually
  // store the page. Permissions have already
  // been verified.

  self.beforePutPage = function(req, page, callback) {
    return setImmediate(callback);
  };

  // Invoked when putPage is about to invoke its
  // final callback. Only invoked when putPage was
  // successful.

  self.afterPutPage = function(req, page, callback) {
    return setImmediate(callback);
  };

  // Invoke loaders for any items in any area of the page that have loaders,
  // then invoke `callback`. Loaders implement the fetching of related
  // file objects and other data not stored directly in the page object.
  // Loaders are expected to report failure as appropriate
  // to their needs by setting item properties that their templates can
  // use to display that when relevant, so there is no formal error
  // handling for loaders.

  // This method also updates the "slug" property of each area, which
  // facilitates the use of the edit-area API.

  // The `req` object is available so that loaders can consider permissions
  // and perform appropriate caching for the lifetime of the request.

  // What happens if the loader for a page triggers a load of that same page?
  // To avoid infinite recursion we track the current recursion level for each
  // page id. We tolerate it but only up to a point. This allows some semi-reasonable
  // cases without crashing the site.

  self.callLoadersForPage = function(req, page, callback) {
    self.maxLoaderRecursion = self.options.maxLoaderRecursion || 3;

    if (!req.loaderRecursion) {

      req.loaderRecursion = {};
    }

    if (req.loaderRecursion[page._id]) {
      if (req.loaderRecursion[page._id] === self.maxLoaderRecursion) {
        // Not something we need to warn about, we just don't do it.
        // It's common for users to build widgets that point in
        // a circle. -Tom
        return callback(null);
      }
      req.loaderRecursion[page._id]++;
    } else {
      req.loaderRecursion[page._id] = 1;
    }

    // Call loaders for all areas in a page.

    var areas = [];
    self.walkAreas(page, function(area, dotPath) {
      area.slug = page.slug + ':' + dotPath;
      areas.push(area);
    });

    // We should run area loaders in series so that semaphores
    // in the req object intended to detect recursion behave reasonably.
    // We get plenty of parallelism from multiple users as it is
    async.mapSeries(
      _.values(areas),
      function(area, callback) {
        return setImmediate(function() { self.callLoadersForArea(req, area, callback); });
      }, function(err, results) {
        req.loaderRecursion[page._id]--;
        return callback(err);
      }
    );
  };

  // An easy way to leave automatic redirects behind as things are renamed.
  // Can be used with anything that lives in the pages table - regular pages,
  // blog posts, events, etc. See the pages and blog modules for examples of usage.

  self.updateRedirect = function(originalSlug, slug, callback) {
    if (slug !== originalSlug) {
      return self.redirects.update(
        { from: originalSlug },
        { from: originalSlug, to: slug },
        { upsert: true, safe: true },
        function(err, doc) {
          return callback(err);
        }
      );
    }
    return callback(null);
  };

  // perform a recursive operation on a page. Optionally deletes properties.
  // The second argument must be a function that takes an object, a key, a value
  // and a "dot path" and returns true if that key should be discarded.
  // Remember, keys can be numeric; toString() is your friend.
  //
  // If the original object looks like:
  //
  // { a: { b: 5 } }
  //
  // Then when the callback is invoked for b, the key will be 'b' and the
  // dotPath will be the string 'a.b'.
  //
  // You do not need to pass a _dotPath argument to walkPage itself, that
  // argument is used for recursive invocation.

  self.walkPage = function(page, callback, _dotPath) {
    // We do not use underscore here because of performance issues.
    // Pruning big nested objects is not something we can afford
    // to do slowly. -Tom
    var key;
    var val;
    var __dotPath;
    if (_dotPath !== undefined) {
      _dotPath += '.';
    } else {
      _dotPath = '';
    }
    var remove = [];
    for (key in page) {
      __dotPath = _dotPath + key.toString();
      if (callback(page, key, page[key], __dotPath)) {
        remove.push(key);
      } else {
        val = page[key];
        if (typeof(val) === 'object') {
          self.walkPage(val, callback, __dotPath);
        }
      }
    }
    _.each(remove, function(key) {
      delete page[key];
    });
  };

  // Walk the areas in a page. The callback receives the
  // area object and the dot-notation path to that object. If the
  // callback returns true, the area is *removed* from the page object,
  // otherwise it is left in place.
  self.walkAreas = function(page, callback) {
    return self.walkPage(page, function(o, k, v, dotPath) {
      if (v && (v.type === 'area')) {
        return callback(v, dotPath);
      }
      return false;
    });
  };
};
