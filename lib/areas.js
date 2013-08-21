var _ = require('underscore');
var async = require('async');
var extend = require('extend');

/**
 * areas
 * @augments Augments the apos object with methods which store,
 * retrieve and manipulate areas. An area is a series of zero or more content items,
 * which may be rich text blocks or widgets. Areas are always stored within pages.
 * pages and areas within pages in the aposPages collection.
 * @see pages
 */

module.exports = function(self) {

  // getArea retrieves an area from MongoDB. All areas must be part
  // of a page, thus the slug must look like: my-page-slug:areaname
  //
  // Invokes the callback with an error if any, and if no error,
  // the area object requested if it exists. If the area does not
  // exist, both parameters to the callback are null.
  //
  // A 'req' object is needed to provide a context for permissions.
  // If the user does not have permission to view the page on which
  // the area resides an error is reported. If the `editable` option
  // is true then an error is reported unless the user has permission
  // to edit the page on which the area resides.
  //
  // If it exists, the area object is guaranteed to have `slug` and
  // `content` properties. The `content` property contains rich content
  // markup ready to display in the browser.
  //
  // If 'slug' matches the following pattern:
  //
  // /cats/about:sidebar
  //
  // Then 'sidebar' is assumed to be the name of an area stored
  // within the areas property of the page object with the slug /cats/about. That
  // object is fetched from the pages collection and the relevant area
  // from its areas property, if present, is delivered.
  //
  // This is an efficient way to store related areas
  // that are usually desired at the same time, because the getPage method
  // returns the entire page object, including all of its areas.
  //
  // You may skip the "options" parameter.
  //
  // By default, if an area contains items that have load functions, those
  // load functions are invoked and the callback is not called until they
  // complete. This means that items that require storage outside of
  // the area collection, or data from APIs, can load that data at the time
  // they are fetched. Set the 'load' option to false if you do not want this.

  self.getArea = function(req, slug, options, callback) {
    if (typeof(options) === 'function') {
      callback = options;
      options = {};
    }
    if (options.load === undefined) {
      options.load = true;
    }
    var matches = slug.match(/^(.*?)\:(\w+)$/);
    if (!matches) {
      return callback('All area slugs must now be page-based: page-slug:areaname');
    }
    // This area is part of a page
    var pageSlug = matches[1];
    var areaSlug = matches[2];
    // Retrieve only the desired area
    var projection = {};
    projection['areas.' + areaSlug] = 1;
    self.get(req, { slug: pageSlug }, { editable: options.editable, fields: projection }, function (err, results) {
      if (err) {
        return callback(err);
      }
      var page = results.pages[0];
      if (page && page.areas && page.areas[areaSlug]) {
        // What is stored in the db might be lagging behind the reality
        // if the slug of the page has changed. Always return it in an
        // up to date form
        page.areas[areaSlug].slug = pageSlug + ':' + areaSlug;
        return loadersThenCallback(page.areas[areaSlug]);
      }
      // Nonexistence isn't an error, it's just nonexistence
      return callback(err, null);
    });

    function loadersThenCallback(area) {
      if (!area) {
        // Careful, this is not an error, don't crash
        return callback(null, null);
      }
      function after() {
        return callback(null, area);
      }
      if (options.load) {
        return self.callLoadersForArea(req, area, after);
      } else {
        return after();
      }
    }
  };

  // putArea stores an area in a page.
  //
  // Invokes the callback with an error if any, and if no error,
  // the area object with its slug property set to the slug under
  // which it was stored with putArea.
  //
  // The slug must match the following pattern:
  //
  // /cats/about:sidebar
  //
  // 'sidebar' is assumed to be the name of an area stored
  // within the areas property of the page object with the slug /cats/about.
  // If the page object was previously empty it now looks like:
  //
  // {
  //   slug: '/cats/about',
  //   areas: {
  //     sidebar: {
  //       slug: '/cats/about/:sidebar',
  //       items: 'whatever your area.items property was'
  //     }
  //   }
  // }
  //
  // Page objects are stored in the 'pages' collection.
  //
  // If a page does not exist, the user has permission to create pages,
  // and the slug does not start with /, this method will create it,
  // as a page with no `type` property. If the page has a type property or
  // resides in the page tree you should create it with putPage rather
  // than using this method.
  //
  // This create-on-demand behavior is intended for
  // simple virtual pages used to hold things like a
  // global footer area.
  //
  // A copy of the page is inserted into the versions collection.
  //
  // The req argument is required for permissions checking.

  self.putArea = function(req, slug, area, callback) {
    var pageOrSlug;

    var matches = slug.match(/^(.*?)\:(\w+)$/);
    if (!matches) {
      return callback('Area slugs now must be page-based: page-slug:areaname');
    }
    var pageSlug = matches[1];
    var areaSlug = matches[2];

    // To check the permissions properly we're best off just getting the page
    // as the user, however we can specify that we don't need the properties
    // returned to speed that up
    function permissions(callback) {
      return self.get(req, { slug: pageSlug }, { editable: true, fields: { _id: 1 } }, function(err, results) {
        if (err) {
          return callback(err);
        }
        if (!results.pages.length) {
          // If it REALLY doesn't exist, but we have the edit-page permission,
          // and the slug has no leading /, we are allowed to create it.

          // If it is a tree page it must be created via putPage
          if (pageSlug.substr(0, 1) === '/') {
            return callback('notfound');
          }

          // Otherwise it is OK to create it provided it truly does
          // not exist yet. Check MongoDB to distinguish between not
          // finding it due to permissions and not finding it
          // due to nonexistence
          return self.pages.findOne({ slug: pageSlug }, { _id: 1 }, function(err, page) {
            if (err) {
              return callback(err);
            }
            if (!page) {
              // OK, it's really new
              return callback(null);
            }
            // OK if we have permission to create pages
            return self.permissions(req, 'edit-page', null, callback);
          });
        }
        return callback(null);
      });
    }

    function update(callback) {
      area.slug = slug;
      var set = {};
      set.slug = pageSlug;
      // Use MongoDB's dot notation to update just the area in question
      set['areas.' + areaSlug] = area;
      self.pages.update(
        { slug: pageSlug },
        { $set: set },
        { safe: true },
        function(err, count) {
          if ((!err) && (count === 0)) {
            // The page doesn't exist yet. We'll need to create it. Use
            // an insert without retry, so we fail politely if someone else creates
            // it first or it already existed and mongo just didn't find it somehow.
            // This tactic only makes sense for typeless virtual pages, like the
            // 'global' page often used to hold footers. Other virtual pages should
            // be created before they are used so they have the right type.
            var page = {
              id: self.generateId(),
              slug: pageSlug,
              areas: {}
            };
            page.areas[areaSlug] = area;
            return self.pages.insert(page, { safe: true }, function(err, page) {
              if (err) {
                return callback(err);
              }
              pageOrSlug = page;
              return callback(null);
            });
          }
          if (err) {
            return callback(err);
          }
          pageOrSlug = pageSlug;
          return callback(null);
        }
      );
    }

    // We've updated or inserted a page, now save a copy in the versions collection.
    // We might already have a page object or, if we did an update, we might have
    // to go fetch it
    function versioning(callback) {
      return self.versionPage(req, pageOrSlug, callback);
    }

    function indexing(callback) {
      return self.indexPage(req, pageOrSlug, callback);
    }

    function finish(err) {
      return callback(err, area);
    }

    async.series([permissions, update, versioning, indexing], finish);
  };

  // Invoke loaders for any items in this area that have loaders, then
  // invoke callback. Loaders are expected to report failure as appropriate
  // to their needs by setting item properties that their templates can
  // use to display that when relevant, so there is no formal error
  // handling for loaders

  // The req object is available so that loaders can consider permissions
  // and perform appropriate caching for the lifetime of the request.

  self.callLoadersForArea = function(req, area, callback) {
    // Even more async.map goodness
    async.map(area.items, function(item, callback) {
      if (!self.itemTypes[item.type]) {
        console.error('WARNING: unrecognized item type ' + item.type + ' encountered in area, URL was ' + req.url);
        return callback();
      }
      if (self.itemTypes[item.type].load) {
        return self.itemTypes[item.type].load(req, item, callback);
      } else {
        return callback();
      }
    }, function(err, results) {
      return callback(err);
    });
  };

  self.getAreaPlaintext = function(options) {
    var area = options.area;
    if (!area) {
      return '';
    }
    var t = '';
    _.each(area.items, function(item) {
      if (self.itemTypes[item.type].getPlaintext) {
        if (t.length) {
          t += "\n";
        }
        t += self.itemTypes[item.type].getPlaintext(item);
      }
    });
    if (options.truncate) {
      t = self.truncatePlaintext(t, options.truncate);
    }
    return t;
  };
};
