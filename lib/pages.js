var _ = require('underscore');
var async = require('async');
var extend = require('extend');
var jsDiff = require('diff');
var wordwrap = require('wordwrap');

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
  // at any time. The req object is needed to identify the author of the change.
  // Typically called only from self.putPage and self.putArea

  self.versionPage = function(req, pageOrSlug, callback) {
    var page;
    var prior;

    function findPage(callback) {
      return findByPageOrSlug(pageOrSlug, function(err, pageArg) {
        page = pageArg;
        return callback(err);
      });
    }

    function findPrior(callback) {
      self.versions.find({
        pageId: page._id
      }).sort({
        createdAt: -1
      }).limit(1).toArray(function(err, versions) {
        if (err) {
          return callback(err);
        }
        if (versions.length) {
          prior = versions[0];
        } else {
          // There may indeed be no prior version
          prior = null;
        }
        return callback(null);
      });
    }

    function addVersion(callback) {
      // Turn the page object we fetched into a version object.
      // But don't modify the page object!
      var version = {};
      extend(true, version, page);
      version.createdAt = new Date();
      version.pageId = version._id;
      version.author = (req && req.user && req.user.username) ? req.user.username : 'unknown';
      version._id = self.generateId();
      delete version.searchText;
      if (!prior) {
        version.diff = [ { value: '[NEW]', added: true } ];
      } else {
        version.diff = self.diffPages(prior, version);
      }
      return self.versions.insert(version, callback);
    }

    return async.series([findPage, findPrior, addVersion], callback);
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

    if (page.areas) {
      var names = _.keys(page.areas);
      names.sort();
      _.each(names, function(name) {
        var area = page.areas[name];
        _.each(area.items, function(item) {
          lines.push(name + ': ' + item.type);
          var itemType = self.itemTypes[item.type];
          if (itemType) {
            if (itemType.addDiffLines) {
              itemType.addDiffLines(item, lines);
            }
          }
        });
      });
    }
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

  // Index the page for search purposes. The current implementation is a hack,
  // but a surprisingly tolerable one. We build two texts, one representing
  // only highly-weighted fields and the other including all text in the
  // document, and use a simple regex search on them when the request comes.
  // It's not suitable for huge amounts of content but it's not half bad either.
  // You can, of course, swap this out for a better implementation for
  // higher volume needs. We'll revisit when Mongo's text search is mature.

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

      return self.pages.update({ slug: page.slug }, { $set: { sortTitle: sortTitle, highSearchText: highText, lowSearchText: lowText, searchSummary: searchSummary } }, callback);
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
    // Not great to include in the summary
    texts.push({ weight: 100, text: (page.tags || []).join("\n"), silent: true });

    // This event is an opportunity to add custom texts for
    // various types of pages
    self.emit('index', page, texts);

    if (page.areas) {
      var names = _.keys(page.areas);
      names.sort();
      _.each(names, function(name) {
        var area = page.areas[name];
        _.each(area.items, function(item) {
          var itemType = self.itemTypes[item.type];
          if (itemType) {
            if (itemType.addSearchTexts) {
              itemType.addSearchTexts(item, texts);
            }
          }
        });
      });
    }
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
  // edit are returned. Otherwise pages the user can see are returned.
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
  // to MongoDB's find()). Set `options.fields` to { areas: 0 } to
  // retrieve everything *except* areas. This is usually the best way
  // to limit results.
  //
  // `options.titleSearch` can be used to search the titles of all
  // pages for a particular string using a fairly tolerant algorithm.
  // options.q does the same on the full text.
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
  // return only such orphans ('0' or false), or return both
  // ('any' or null). It defaults to 'any' to ensure such pages
  // are reachable.
  //
  // `options.tags` is a convenient way to find content that has
  // at least one of the given array of tags. `options.notTags`
  // does the reverse: it excludes content that has at least one
  // of the given array of tags.
  //
  // In any case the user's identity limits what they can see.
  // Permissions are checked according to the Apostrophe permissions
  // model. The `admin` permission permits unlimited retrieval.
  // Otherwise the `published`, loginRequired`, `viewGroupIds`,
  // `viewPersonIds`, `editGroupIds` and `editPersonIds` properties
  // of the page are considered.
  //
  // You may disable permissions entirely by setting `options.permissions`
  // to `false`. This can make sense when you are using pages as storage
  // in a context where Apostrophe's permissions model is not relevant.
  //
  // Normally all areas associated with a page are included in the
  // areas property. If `options.areas` is explicitly false, no areas
  // will be returned. If `options.areas` contains an array of area names,
  // only those areas will be returned (if present).
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
    if (arguments.length === 2) {
      mainCallback = userCriteria;
      userCriteria = {};
      options = {};
    } else if (arguments.length === 3) {
      mainCallback = options;
      options = {};
    }

    // Second criteria object based on our processing of `options`
    var filterCriteria = {};

    var editable = options.editable;

    var sort = options.sort;
    // Allow sort to be explicitly false. Otherwise there is no way
    // to get the sorting behavior of the "near" option
    if (sort === undefined) {
      sort = { sortTitle: 1 };
    }

    var limit = options.limit || undefined;

    var skip = options.skip || undefined;

    var fields = options.fields || undefined;

    var titleSearch = options.titleSearch || undefined;

    var areas = options.areas || true;

    var tags = options.tags || undefined;
    var notTags = options.notTags || undefined;

    var permissions = (options.permissions === false) ? false : true;

    var lateCriteria = options.lateCriteria || undefined;

    if (options.titleSearch !== undefined) {
      filterCriteria.sortTitle = self.searchify(titleSearch);
    }
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

    if (options.q && options.q.length) {
      // Crude fulltext search support. It would be better to present
      // highSearchText results before lowSearchText results, but right now
      // we are doing a single query only
      filterCriteria.lowSearchText = self.searchify(options.q);
    }


    var projection = {};
    extend(true, projection, fields || {});
    if (!areas) {
      projection.areas = 0;
    } else if (areas === true) {
      // Great, get them all
    } else {
      // We need to initially get them all, then prune them, as
      // MongoDB is not great at fetching specific properties
      // of subdocuments while still fetching everything else
    }

    var results = {};

    var combine = [ userCriteria, filterCriteria ];

    if (permissions) {
      combine.push(self.getPermissionsCriteria(req, { editable: editable }));
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

    if (options.getDistinct) {
      // Just return distinct values for some field matching the current criteria,
      // rather than the normal results. This is a bit of a hack, we need
      // to consider refactoring all of 'fetchMetadata' here
      return self.pages.distinct(options.getDistinct, criteria, mainCallback);
    }
    if (options.getDistinctTags) {
      // Just return the distinct tags matching the current criteria,
      // rather than the normal results. This is a bit of a hack, we need
      // to consider refactoring all of 'fetchMetadata' here
      return self.pages.distinct("tags", criteria, mainCallback);
    }

    if (!options.hint) {
      options.hint = self.hintGetCriteria(criteria);
      // console.log(JSON.stringify(options.hint) + ': ' + JSON.stringify(criteria));
    }

    var findOptions = {};
    if (options.hint) {
      findOptions.hint = options.hint;
    }

    // var start = (new Date()).getTime();

    async.series([count, loadPages, markPermissions, loadWidgets], done);

    function count(callback) {
      if ((skip === undefined) && (limit === undefined)) {
        // Why query twice if we're getting everything anyway? Especially
        // when count() ignores optimizer hints (until 2.5.5 at least)?
        return callback(null);
      }
      // find() modifies its third argument, so make sure it's a copy
      var o = {};
      extend(true, o, findOptions);
      self.pages.find(criteria, {}, o).count(function(err, count) {
        results.total = count;
        return callback(err);
      });
    }

    function loadPages(callback) {
      // find() modifies its third argument, so make sure it's a copy
      var o = {};
      extend(true, o, findOptions);
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

        // var end = (new Date()).getTime();

        // console.log((end - start) + ': ' + JSON.stringify(criteria));

        results.pages = pagesArg;

        if (results.total === undefined) {
          results.total = results.pages.length;
        }

        // Except for ._id, no property beginning with a _ should be
        // loaded from the database. These are reserved for dynamically
        // determined properties like permissions and joins
        _.each(results.pages, function(page) {
          self.pruneTemporaryProperties(page);
        });

        if (Array.isArray(areas)) {
          // Prune to specific areas only, alas this can't
          // happen in mongoland as near as I can tell. -Tom
          _.each(results.pages, function(page) {
            if (page.areas) {
              page.areas = _.pick(page.areas, areas);
            }
          });
        }
        return callback(err);
      });
    }

    function markPermissions(callback) {
      self.addPermissionsToPages(req, results.pages);
      return callback(null);
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
        return callback(err);
      });
    }

    function done(err) {
      return mainCallback(err, results);
    }
  };

  // Fetch the "page" with the specified slug. As far as
  // apos is concerned, the "page" with the slug /about
  // is expected to be an object with a .areas property. If areas
  // with the slugs /about:main and /about:sidebar have
  // been saved, then the areas property will be an
  // object with properties named main and sidebar.
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
      slugs.unshift(path);
      components = slug.substr(1).split('/');
      for (var i = 0; (i < (components.length - 1)); i++) {
        var component = components[i];
        path += '/' + component;
        slugs.unshift(path);
      }
    }
    // And of course always consider an exact match. We use unshift to
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

        // For convenience guarantee there is a page.areas property
        if (!bestPage.areas) {
          bestPage.areas = {};
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

  self._scanCriteriaFor = function(criteria, fields) {
    var p;
    var v;
    var i;
    var result;
    for (p in criteria) {
      if (fields[p]) {
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
  // explicitly specify "version: false" as an option.
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
    if (!page._id) {
      page._id = self.generateId();
      newPage = true;
    }

    page.sortTitle = self.sortify(page.title);

    // Provide the object rather than the slug since we have it and we can
    // avoid extra queries that way and also do meaningful permissions checks
    // on new pages
    function permissions(callback) {
      if (options.permissions === false) {
        return callback(null);
      }
      return self.permissions(req, 'edit-page', page, callback);
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

      var copy = {};
      extend(true, copy, page);
      self.pruneTemporaryProperties(copy);
      if (!newPage) {
        // Makes it less likely we'll have a fussy issue with MongoDB thinking
        // we tried to change the ID if someone has a page with an ObjectID rather
        // than a string id (although we emphasize it should be the latter)
        delete copy._id;
      }

      if (newPage) {
        self.pages.insert(copy, { safe: true }, afterUpdate);
      } else {
        self.pages.update({ slug: slug }, copy, { safe: true }, afterUpdate);
      }
    }

    function versioning(callback) {
      if (options.version === false) {
        return callback(null);
      }
      return self.versionPage(req, page, callback);
    }

    function indexing(callback) {
      return self.indexPage(req, page, callback);
    }

    function finish(err) {
      if (err) {
        return callback(err);
      }
      return callback(null, page);
    }
    async.series([permissions, save, versioning, indexing], finish);
  };

  // Invoke loaders for any items in any area of the page that have loaders,
  // then invoke `callback`. Loaders implement the fetching of related
  // file objects and other data not stored directly in the page object.
  // Loaders are expected to report failure as appropriate
  // to their needs by setting item properties that their templates can
  // use to display that when relevant, so there is no formal error
  // handling for loaders.

  // The `req` object is available so that loaders can consider permissions
  // and perform appropriate caching for the lifetime of the request.

  // What happens if the loader for a page triggers a load of that same page?
  // To avoid infinite recursion we track the current recursion level for each
  // page id. We tolerate it but only up to a point. This allows some semi-reasonable
  // cases without crashing the site.

  var loaderRecursion = {};
  var maxLoaderRecursion = 3;

  self.callLoadersForPage = function(req, page, callback) {
    // Useful for debugging redundant calls
    // if (page.areas) {
    //   console.log(page.type + ':' + page.slug);
    // }

    if (loaderRecursion[page._id]) {
      if (loaderRecursion[page._id] === maxLoaderRecursion) {
        console.error('max loader recursion reached on ' + page.slug);
        return callback(null);
      }
      loaderRecursion[page._id]++;
    } else {
      loaderRecursion[page._id] = 1;
    }

    // Call loaders for all areas in a page. Wow, async.map is awesome.
    async.map(
      _.values(page.areas),
      function(area, callback) {
        return setImmediate(function() { self.callLoadersForArea(req, area, callback); });
      }, function(err, results) {
        loaderRecursion[page._id]--;
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

};
