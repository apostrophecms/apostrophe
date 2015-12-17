var _ = require('lodash');
var async = require('async');
var extend = require('extend');
var sanitizeHtml = require('sanitize-html');
var deep = require('deep-get-set');

/**
 * areas
 * @augments Augments the apos object with methods which store,
 * retrieve and manipulate areas. An area is a series of zero or more content items,
 * which may be rich text blocks or widgets. Areas are always stored within pages.
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
  // within the page object with the slug /cats/about. That
  // object is fetched from the pages collection and the relevant area,
  // if present, is delivered.
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
  //
  // The use of dot notation in the area slug is permitted. Dot notation
  // is used to access areas nested in array schema fields.

  self.getArea = function(req, slug, options, callback) {
    if (typeof(options) === 'function') {
      callback = options;
      options = {};
    }
    if (options.load === undefined) {
      options.load = true;
    }
    // Allow dot notation to access areas in array fields
    var matches = slug.match(/^(.*?)\:((\w+)(\.\w+)*)$/);
    if (!matches) {
      console.error(slug);
      return callback('All area slugs must now be page-based: page-slug:areaname');
    }
    // This area is part of a page
    var pageSlug = matches[1];
    var areaSlug = matches[2];
    var area;
    // Retrieve only the desired area
    var projection = {};
    projection[areaSlug] = 1;
    self.get(req, { slug: pageSlug }, { editable: options.editable, fields: projection }, function (err, results) {
      if (err) {
        return callback(err);
      }
      var page = results.pages[0];
      area = page && deep(page, areaSlug);
      if (area) {
        // What is stored in the db might be lagging behind the reality
        // if the slug of the page has changed. Always return it in an
        // up to date form
        area.slug = pageSlug + ':' + areaSlug;
        return loadersThenCallback(area);
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

  var forbiddenAreaNames = {
    pagePermissions: 1,
    permissions: 1,
    slug: 1,
    path: 1,
    tags: 1,
    level: 1,
    title: 1,

    // Legacy, migration could turn them into pagePermissions
    viewPersonIds: 1,
    editPersonIds: 1,
    viewGroupIds: 1,
    editGroupIds: 1

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
  // within the page object with the slug /cats/about.
  // If the page object was previously empty it now looks like:
  //
  // {
  //   slug: '/cats/about',
  //     sidebar: {
  //       slug: '/cats/about/:sidebar',
  //       items: 'whatever your area.items property was'
  //       type: 'area'
  //     }
  //   }
  // }
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
  // Dot notation is permitted in area slugs. 
  //
  // The req argument is required for permissions checking.
  //
  // This method is implemeneted via getPage and putPage to ensure
  // consistent behavior. A simple update() is tempting but would
  // not implement versioning, workflow, etc. correctly.
  //
  // If workflow is in effect, the area is stored in
  // the draft property of the page.

  self.putArea = function(req, slug, area, callback) {
    var pageOrSlug;
    // Allow dot notation to access areas in array fields
    var matches = slug.match(/^(.*?)\:((\w+)(\.\w+)*)$/);
    if (!matches) {
      console.error(slug);
      return callback('Area slugs now must be page-based: page-slug:areaname');
    }
    var pageSlug = matches[1];
    var areaSlug = matches[2];

    if (forbiddenAreaNames[areaSlug]) {
      return callback('forbidden area name, conflicts with core property: ' + areaSlug);
    }

    var page;

    return async.series({
      get: function(callback) {
        // Get it without permissions so we're sure if it exists,
        // then we'll do permissions checks as needed
        return self.getPage(req, pageSlug, { workflow: true, permissions: false }, function(err, result) {
          if (err) {
            return callback(err);
          }
          page = result;
          if (!page) {
            // If it is a tree page it must be created first before
            // any areas can be stored in it
            if (pageSlug.substr(0, 1) === '/') {
              return callback('notfound');
            }
            // OK to make virtual pages on the fly if we're allowed to
            // create pages
            return callback(self.permissions.can(req, 'edit-page') ? null : 'forbidden');
          }
          if (!self.permissions.can(req, 'edit-page', page)) {
            return callback('forbidden');
          }
          var existing = deep(page, areaSlug);
          if (existing && (existing['type'] !== 'area')) {
            return callback('area name conflicts with non-area property: ' + areaSlug);
          }
          return callback(null);
        }, callback);
      },
      put: function(callback) {
        if (!page) {
          page = {
            slug: pageSlug
          };
        }
        try {
          deep(page, areaSlug, area);
        } catch (e) {
          return callback(new Error('dot notation used to store area under nonexistent parent key: ' + areaSlug));
        }
        return self.putPage(req, pageSlug, { workflow: [ areaSlug ] }, page, callback);
      }
    }, callback);
  };

  // Invoke loaders for any items in this area that have loaders, then
  // invoke callback. Loaders are expected to report failure as appropriate
  // to their needs by setting item properties that their templates can
  // use to display that when relevant, so there is no formal error
  // handling for loaders

  // The req object is available so that loaders can consider permissions
  // and perform appropriate caching for the lifetime of the request.

  self.callLoadersForArea = function(req, area, callback) {
    // Run loaders in series so that we can use semaphores
    // in the req object safely. You'll get all the parallelism
    // you could possibly want from simultaneous users.
    async.mapSeries(area.items, function(item, callback) {
      if (!self.itemTypes[item.type]) {
        console.error('WARNING: unrecognized item type ' + item.type + ' encountered in area, URL was ' + req.url);
        return setImmediate(callback);
      }
      if (self.itemTypes[item.type].load) {
        req.traceIn('load-' + item.type);
        return self.itemTypes[item.type].load(req, item, function(err) {
          req.traceOut();
          return callback(err);
        });
      } else {
        return setImmediate(callback);
      }
    }, function(err) {
      return callback(err);
    });
  };

  // Convert an area to plaintext. This will only contain text
  // for items that clearly have an appropriate plaintext
  // representation for the public, so most widgets will not want
  // to be represented as they have no reasonable plaintext
  // equivalent, but you can define the 'getPlaintext' method
  // for any widget to return one (see self.itemTypes for the
  // richText example).
  //
  // Plaintext means truly plain, so if you want to output the
  // text with nunjucks, be sure to use the "e" filter.
  //
  // If the truncate option is present, it is used as a character
  // limit. The plaintext is cut at the closest word boundary
  // before that length. If this cannot be done a hard cutoff is
  // applied so that the result is never longer than
  // options.truncate characters.
  //
  // You may call with the page, areaName, options syntax:
  //
  // {{ apos.getAreaPlaintext(page, 'body', { truncate: 200 }) }}
  //
  // Or a single options object:
  //
  // {{ apos.getAreaPlaintext({ area: page.body, truncate: 200 }) }}

  self.getAreaPlaintext = function(page, name, options) {
    if (arguments.length === 1) {
      options = page;
    } else {
      options.area = page[name];
    }
    var area = options.area;
    if (!area) {
      return '';
    }
    var t = '';
    _.each(area.items, function(item) {
      // Do not crash if an unsupported item is present in an area
      if (!self.itemTypes[item.type]) {
        return;
      }
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


  self.getAreaRichtext = function(page, name, options) {
    if (arguments.length === 1) {
      options = page;
    } else {
      options.area = page[name];
    }
    var area = options.area;
    if (!area) {
      return '';
    }
    var t = '';
    _.each(area.items, function(item) {
      // Do not crash if an unsupported item is present in an area
      if (!self.itemTypes[item.type]) {
        return;
      }
      if (self.itemTypes[item.type].getRichtext) {
        if (t.length) {
          t += "\n";
        }
        t += self.itemTypes[item.type].getRichtext(item);
      }
    });
    return t;
  };


  // Very handy for imports of all kinds: convert plaintext to an area with
  // one rich text item if it is not blank, otherwise an empty area. null and
  // undefined are tolerated and converted to empty areas.
  self.textToArea = function(text) {
    var area = { type: 'area', items: [], type: 'area' };
    if ((typeof(text) === 'string') && text.length) {
      area.items.push({
        type: 'richText',
        content: self.escapeHtml(text, true)
      });
    }
    return area;
  };

  // Convert HTML to an area with a single richText element. Passes it
  // through sanitizeHtml.
  self.htmlToArea = function(html) {
    html = sanitizeHtml(html || '');
    var area = {
      type: 'area',
      items: [
        {
          type: 'richText',
          content: html
        }
      ]
    };
    return area;
  };

  // Convert either plaintext or HTML to an area with a single richText element.
  // Makes its best guess as to which one it's dealing with. Also tolerates
  // null or undefined, resulting in an initially empty richText.
  self.mixedToArea = function(s) {
    s = s || '';
    // If it smells like HTML treat it as such otherwise treat it as plaintext.
    // They have both. It's crazypants. -Tom
    if (s.match(/<[A-Za-z]/)) {
      return self.htmlToArea(s);
    } else {
      return self.textToArea(s);
    }
  };
};
