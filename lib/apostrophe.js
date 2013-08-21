/* jshint undef: true */
var request = require('request');
var async = require('async');
var sanitize = require('validator').sanitize;
var fs = require('fs');
var _ = require('underscore');
_.str = require('underscore.string');
var nunjucks = require('nunjucks');
var async = require('async');
var path = require('path');
// provides quality date/time formatting which we make available in templates
var moment = require('moment');
// Query string parser/generator
var qs = require('qs');
var extend = require('extend');
var jsDiff = require('diff');
var wordwrap = require('wordwrap');
var ent = require('ent');
var argv = require('optimist').argv;
var qs = require('qs');
var joinr = require('joinr');

// Needed for A1.5 bc implementation of authentication, normally
// we go through appy's passwordHash wrapper
var crypto = require('crypto');
var passwordHash = require('password-hash');

// MongoDB prefix queries are painful without this
RegExp.quote = require("regexp-quote");

function Apos() {
  var self = this;

  self.tasks = {};

  // Apostrophe is an event emitter/receiver
  require('events').EventEmitter.call(self);

  require('./templates.js')(self);

  require('./pages.js')(self);

  require('./areas.js')(self);

  require('./permissions.js')(self);

  self.fail = function(req, res) {
    res.statusCode = 500;
    res.send('500 error, URL was ' + req.url);
  };

  self.forbid = function(res) {
    res.statusCode = 403;
    res.send('Forbidden');
  };

  self.notfound = function(req, res) {
    res.statusCode = 404;
    res.send('404 not found error, URL was ' + req.url);
  };

  self.generateId = function() {
    // TODO use something better, although this is not meant to be
    // ultra cryptographically secure
    return Math.floor(Math.random() * 1000000000) + '' + Math.floor(Math.random() * 1000000000);
  };

  var assets = require('./assets.js');
  assets.construct(self);

  // Functionality related to the content area editor
  var editor = require('./editor.js');
  editor.construct(self);
  // We add the rest during init via editor.init(self)

  self.init = function(options, callback) {

    self.app = options.app;

    assets.init(self);

    require('./files.js')(self);

    self.fileGroups = options.fileGroups || self.fileGroups;

    self.uploadfs = options.uploadfs;

    // TODO this option isn't a great idea since the need for compatibility with
    // other methods in permissions.js is not clear
    if (options.permissions) {
      self.permissions = options.permissions;
    }

    // An id for this particular process that should be unique
    // even in a multiple server environment
    self._pid = self.generateId();

    function setupPages(callback) {
      self.db.collection('aposPages', function(err, collection) {
        function indexSlug(callback) {
          self.pages.ensureIndex({ slug: 1 }, { safe: true, unique: true }, callback);
        }
        function indexTags(callback) {
          self.pages.ensureIndex({ tags: 1 }, { safe: true }, callback);
        }
        self.pages = collection;
        async.series([indexSlug, indexTags], callback);
        // ... more index functions
      });
    }

    // Each time a page or area is updated with putArea or putPage, a new version
    // object is also created. Regardless of whether putArea or putPage is called,
    // if the area is in the context of a page it is the entire page that is
    // versioned. A pageId or areaId property is added, which is a non-unique index
    // allowing us to fetch prior versions of any page or independently stored
    // area. Also createdAt and author. Author is a string to avoid issues with
    // references to deleted users.
    //
    // Note that this also provides full versioning for types built upon pages, such as
    // blog posts and snippets.

    function setupVersions(callback) {
      self.db.collection('aposVersions', function(err, collection) {
        function index(callback) {
          self.versions.ensureIndex({ pageId: 1, createdAt: -1 }, { safe: true }, callback);
        }
        self.versions = collection;
        async.series([index], callback);
        // ... more index functions
      });
    }

    function setupFiles(callback) {
      self.db.collection('aposFiles', function(err, collection) {
        self.files = collection;
        return callback(err);
      });
    }

    function setupVideos(callback) {
      self.db.collection('aposVideos', function(err, collection) {
        function searchIndex(callback) {
          self.videos.ensureIndex({ searchText: 1 }, { safe: true }, callback);
        }
        // Index the URLs
        function videoIndex(callback) {
          self.videos.ensureIndex({ video: 1 }, { safe: true }, callback);
        }
        self.videos = collection;
        return async.series([searchIndex, videoIndex], callback);
      });
    }

    function setupRedirects(callback) {
      self.db.collection('aposRedirects', function(err, collection) {
        self.redirects = collection;
        collection.ensureIndex({ from: 1 }, { safe: true, unique: true }, function(err) {
          return callback(err);
        });
      });
    }

    function afterDb(callback) {

      if (options.controls) {
        self.defaultControls = options.controls;
      }

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

      // Truncate a plaintext string at the character count expressed
      // by the limit argument, which defaults to 200. NOT FOR HTML/RICH TEXT!
      // self.truncatePlaintext = function(t, limit) {
      //   limit = limit || 200;
      //   if (t.length <= limit) {
      //     return t;
      //   }
      //   // Leave room for the ellipsis unicode character
      //   // (-2 instead of -1 for the last offset we look at)
      //   var p = limit - 2;
      //   while (p >= 0) {
      //     var c = t.charAt(p);
      //     if ((c === ' ') || (c === "\n")) {
      //       return t.substr(0, p).replace(/,$/, '') + '…';
      //     }
      //     p--;
      //   }
      //   // Saving words failed, do a hard crop
      //   return t.substr(0, limit - 1) + '…';
      // };

      // self.truncatePlaintext = function(t, limit) {
      //   return _.str.prune(t, limit);
      // }

      self.truncatePlaintext = _.str.prune;

      // In addition to making these available in self.app.locals we also
      // make them available in our own partials later.
      _.extend(self.app.locals, self._aposLocals);

      require('./videos.js')(self);
      require('./tags.js')(self);

      // All routes must begin with /apos!
      self.app.get('/apos/pager', function(req, res) {
        return res.send(self.partial('pager', req.query));
      });

      // Middleware
      function validId(req, res, next) {
        var id = req.params.id;
        if (!id.match(/^[\w\-\d]+$/)) {
          return self.fail(req, res);
        }
        next();
      }

      if (self.uploadfs) {
        self.pushGlobalData({
          uploadsUrl: self.uploadfs.getUrl()
        });
      }

      // Must be AFTER any other /apos/ routes are registered
      self.app.get('/apos/*', self.static(__dirname + '/../public'));

      return callback(null);
    }

    self.options = options;

    self.db = options.db;

    // Functionality relating to pushing data and js calls to the browser
    require('./push.js')(self);

    editor.init(self);

    // Set up standard local functions for Express in self._aposLocals
    require('./aposLocals.js')(self);

    if (options.locals) {
      _.extend(self._aposLocals, options.locals);
    }

    async.series([setupPages, setupVersions, setupFiles, setupVideos, setupRedirects, afterDb], callback);
  };

  require('./static.js')(self);

  // Except for ._id, no property beginning with a _ should be
  // loaded from the database. These are reserved for dynamically
  // determined properties like permissions and joins
  self.pruneTemporaryProperties = function(page) {
    var remove = [];
    _.each(page, function(val, key) {
      if ((key.substr(0, 1) === '_') && (key !== '_id')) {
        remove.push(key);
      } else {
        if ((typeof(val) === 'object') && (!Array.isArray(val))) {
          self.pruneTemporaryProperties(val);
        }
      }
    });
    _.each(remove, function(key) {
      delete page[key];
    });
  };

  require('./permissions.js')(self);

  // String.replace does NOT do this
  // Regexps can but they can't be trusted with UTF8 ):

  function globalReplace(haystack, needle, replacement) {
    var result = '';
    while (true) {
      if (!haystack.length) {
        return result;
      }
      var index = haystack.indexOf(needle);
      if (index === -1) {
        result += haystack;
        return result;
      }
      result += haystack.substr(0, index);
      result += replacement;
      haystack = haystack.substr(index + needle.length);
    }
  }

  // TODO MAKE ME AN NPM MODULE
  //
  // Add and modify query parameters of a url. data is an object whose properties
  // become new query parameters. These parameters override any existing
  // parameters of the same name in the URL. If you pass a property with
  // a value of undefined, null or an empty string, that parameter is removed from the
  // URL if already present (note that the number 0 does not do this). This is very
  // useful for maintaining filter parameters in a query string without redundant code.
  //
  // PRETTY URLS
  //
  // If the optional `path` argument is present, it must be an array. (You
  // may skip this argument if you are just adding query parameters.) Any
  // properties of `data` whose names appear in `path` are concatenated
  // to the URL directly, separated by slashes, in the order they appear in that
  // array. The first missing or empty value for a property in `path` stops
  // this process to prevent an ambiguous URL.
  //
  // Note that there is no automatic detection that this has
  // already happened in an existing URL, so you can't override existing
  // components of the path. Typically this is used with a snippet index page,
  // on which the URL of the page is available as a starting point for
  // building the next URL.
  //
  // If a property's value is not equal to the slugification of itself
  // (apos.slugify), then a query parameter is set instead. This ensures your
  // URLs are not rejected by the browser. If you don't want to handle a
  // property as a query parameter, make sure it is always slug-safe.
  //
  // OVERRIDES: MULTIPLE DATA OBJECTS
  //
  // You may pass additional data objects. The last one wins, so you can
  // pass your existing parameters first and pass new parameters you are changing
  // as a second data object.

  self.build = function(url, path, data) {
    // Sometimes necessary with nunjucks, we may otherwise be
    // exposed to a SafeString object and throw an exception. Not
    // able to boil this down to a simple test case for jlongster so far
    url = url.toString();
    var qat = url.indexOf('?');
    var base = url;
    var dataObjects = [];
    var pathKeys;
    var original;
    var query = {};

    if (qat !== -1) {
      original = qs.parse(url.substr(qat + 1));
      base = url.substr(0, qat);
    }
    var dataStart = 1;
    if (path && Array.isArray(path)) {
      pathKeys = path;
      dataStart = 2;
    } else {
      pathKeys = [];
    }
    // Process data objects in reverse order so the last override wins
    for (var i = arguments.length - 1; (i >= dataStart); i--) {
      dataObjects.push(arguments[i]);
    }
    if (original) {
      dataObjects.push(original);
    }
    var done = {};
    var stop = false;
    _.every(pathKeys, function(key) {
      return _.some(dataObjects, function(dataObject) {
        if (stop) {
          return false;
        }
        if (dataObject.hasOwnProperty(key)) {
          var value = dataObject[key];
          // If we hit an empty value we need to stop all path processing to avoid
          // ambiguous URLs
          if ((value === undefined) || (value === null) || (value === '')) {
            done[key] = true;
            stop = true;
            return true;
          }
          // If the value is an object it can't be stored in the path,
          // so stop path processing, but don't mark this key 'done'
          // because we can still store it as a query parameter
          if (typeof(value) === 'object') {
            stop = true;
            return true;
          }
          var s = dataObject[key].toString();
          if (s === self.slugify(s)) {
            // Don't append double /
            if (base !== '/') {
              base += '/';
            }
            base += s;
            done[key] = true;
            return true;
          }
        }
        return false;
      });
    });
    _.each(dataObjects, function(data) {
      _.each(data, function(value, key) {
        if (done[key]) {
          return;
        }
        done[key] = true;
        if ((value === undefined) || (value === null) || (value === '')) {
          delete query[key];
        } else {
          query[key] = value;
        }
      });
    });
    if (_.size(query)) {
      return base + '?' + qs.stringify(query);
    } else {
      return base;
    }
  };

  self.escapeHtml = function(s) {
    if (s === 'undefined') {
      s = '';
    }
    if (typeof(s) !== 'string') {
      s = s + '';
    }
    return s.replace(/\&/g, '&amp;').replace(/</g, '&lt;').replace(/\>/g, '&gt;').replace(/\"/g, '&quot;');
  };

  // Convert HTML to true plaintext, with all entities decoded
  self.htmlToPlaintext = function(html) {
    // The awesomest HTML renderer ever (look out webkit):
    // block element opening tags = newlines, closing tags and non-container tags just gone
    html = html.replace(/<\/.*?\>/g, '');
    html = html.replace(/<(h1|h2|h3|h4|h5|h6|p|br|blockquote).*?\>/gi, '\n');
    html = html.replace(/<.*?\>/g, '');
    return ent.decode(html);
  };

  // Note: you'll need to use xregexp instead if you need non-Latin character
  // support in slugs. KEEP IN SYNC WITH BROWSER SIDE IMPLEMENTATION in editor.js
  self.slugify = function(s, options) {
    // Trim and deal with wacky cases like an array coming in without crashing
    s = self.sanitizeString(s);

    // By default everything not a letter or number becomes a dash.
    // You can add additional allowed characters via options.allow and
    // change the separator with options.separator

    if (!options) {
      options = {};
    }

    if (!options.allow) {
      options.allow = '';
    }

    if (!options.separator) {
      options.separator = '-';
    }

    var r = "[^A-Za-z0-9" + RegExp.quote(options.allow) + "]";
    var regex = new RegExp(r, 'g');
    s = s.replace(regex, options.separator);
    // Consecutive dashes become one dash
    var consecRegex = new RegExp(RegExp.quote(options.separator) + '+', 'g');
    s = s.replace(consecRegex, options.separator);
    // Leading dashes go away
    var leadingRegex = new RegExp('^' + RegExp.quote(options.separator));
    s = s.replace(leadingRegex, '');
    // Trailing dashes go away
    var trailingRegex = new RegExp(RegExp.quote(options.separator) + '$');
    s = s.replace(trailingRegex, '');
    // If the string is empty, supply something so that routes still match
    if (!s.length)
    {
      s = 'none';
    }
    s = s.toLowerCase();
    return s;
  };

  // Returns a string that, when used for searches and indexes, behaves
  // similarly to MySQL's default behavior for string matching, plus a little
  // extra tolerance of punctuation and whitespace differences. This is
  // in contrast to MongoDB's default "absolute match with same case only"
  // behavior which is no good for most searches
  self.sortify = function(s) {
    return self.slugify(s, { separator: ' ' });
  };

  // Turn a user-entered search query into a regular expression, suitable
  // for filtering on the highSearchText or lowSearchText property
  self.searchify = function(q) {
    q = self.sortify(q);
    q = q.replace(/ /g, '.*?');
    q = new RegExp(q);
    return q;
  };

  // For convenience when configuring uploadfs. We recommend always configuring
  // these sizes and adding more if you wish
  self.defaultImageSizes = [
    {
      name: 'full',
      width: 1140,
      height: 1140
    },
    {
      name: 'two-thirds',
      width: 760,
      height: 760
    },
    {
      name: 'one-half',
      width: 570,
      height: 700
    },
    {
      name: 'one-third',
      width: 380,
      height: 700
    },
    // Handy for thumbnailing
    {
      name: 'one-sixth',
      width: 190,
      height: 350
    }
  ];

  // Is this MongoDB error related to uniqueness? Great for retrying on duplicates.
  // Used heavily by the pages module and no doubt will be by other things.
  //
  // There are three error codes for this: 13596 ("cannot change _id of a document")
  // and 11000 and 11001 which specifically relate to the uniqueness of an index.
  // 13596 can arise on an upsert operation, especially when the _id is assigned
  // by the caller rather than by MongoDB.
  //
  // IMPORTANT: you are responsible for making sure ALL of your unique indexes
  // are accounted for before retrying... otherwise an infinite loop will
  // likely result.

  self.isUniqueError = function(err) {
    if (!err) {
      return false;
    }
    if (err.code === 13596) {
      return true;
    }
    return ((err.code === 13596) || (err.code === 11000) || (err.code === 11001));
  };

  // An easy way to leave automatic redirects behind as things are renamed.
  // Can be used with anything that lives in the pages table - regular pages,
  // blog posts, events, etc. See the pages and blog modules for examples of usage.

  self.updateRedirect = function(originalSlug, slug, callback) {
    if (slug !== originalSlug) {
      self.redirects.update(
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

  // The browser already submits tags as a nice array, but make sure
  // that's really what we got.
  self.sanitizeTags = function(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    tags = _.map(tags, function(tag) {
      if (typeof(tag) === 'number') {
        tag += '';
      }
      return tag;
    });
    tags = _.filter(tags, function(tag) {
      return (typeof(tag) === 'string');
    });
    return tags;
  };

  // STRING UTILITIES
  self.capitalizeFirst = function(s) {
    return s.charAt(0).toUpperCase() + s.substr(1);
  };

  // Convert everything else to a hyphenated css name. Not especially fast,
  // hopefully you only do this during initialization and remember the result
  // KEEP IN SYNC WITH BROWSER SIDE VERSION in content.js
  self.cssName = function(camel) {
    var i;
    var css = '';
    var dash = false;
    for (i = 0; (i < camel.length); i++) {
      var c = camel.charAt(i);
      var lower = ((c >= 'a') && (c <= 'z'));
      var upper = ((c >= 'A') && (c <= 'Z'));
      var digit = ((c >= '0') && (c <= '9'));
      if (!(lower || upper || digit)) {
        dash = true;
        continue;
      }
      if (upper) {
        if (i > 0) {
          dash = true;
        }
        c = c.toLowerCase();
      }
      if (dash) {
        css += '-';
        dash = false;
      }
      css += c;
    }
    return css;
  };

  // Accepts a camel-case type name such as blog and returns a browser-side
  // constructor function name such as AposBlog

  self.constructorName = function(camel) {
    return 'Apos' + camel.charAt(0).toUpperCase() + camel.substring(1);
  };

  // Simple string sanitization so junk submissions can't crash the app
  self.sanitizeString = function(s, def) {
    if (typeof(s) !== 'string') {
      if (typeof(s) === 'number') {
        s += '';
      } else {
        s = '';
      }
    }
    s = s.trim();
    if (def !== undefined) {
      if (s === '') {
        s = def;
      }
    }
    return s;
  };

  self.sanitizeUrl = function(s, def) {
    s = self.sanitizeString(s, def);
    // Allow the default to be undefined, null, false, etc.
    if (s === def) {
      return s;
    }
    s = self.fixUrl(s);
    if (s === null) {
      return def;
    }
    return s;
  };

  // Fix lame URLs. If we can't fix the URL, return null.
  //
  // Accepts valid URLs and relative URLs. If the URL smells like
  // it starts with a domain name, supplies an http:// prefix.
  //
  // KEEP IN SYNC WITH editor.js BROWSER SIDE VERSION

  self.fixUrl = function(href) {
    if (href.match(/^(((https?|ftp)\:\/\/)|mailto\:|\#|([^\/\.]+)?\/|[^\/\.]+$)/)) {
      // All good - no change required
      return href;
    } else if (href.match(/^[^\/\.]+\.[^\/\.]+/)) {
      // Smells like a domain name. Educated guess: they left off http://
      return 'http://' + href;
    } else {
      return null;
    }
  };

  // Sanitize a select element
  self.sanitizeSelect = function(s, choices, def) {
    if (!_.contains(choices, s)) {
      return def;
    }
    return s;
  };

  // Accepts true, 'true', 't', '1', 1 as true
  // Accepts everything else as false
  // If nothing is submitted the default (def) is returned
  // If def is undefined the default is false
  self.sanitizeBoolean = function(b, def) {
    if (b === true) {
      return true;
    }
    if (b === false) {
      return false;
    }
    b = self.sanitizeString(b, def);
    if (b === def) {
      if (b === undefined) {
        return false;
      }
      return b;
    }
    b = b.toLowerCase().charAt(0);
    if (b === '') {
      return false;
    }
    if ((b === 't') || (b === 'y') || (b === '1')) {
      return true;
    }
    return false;
  };

  // Given an `options` object in which options[name] is a string
  // set to '0', '1', or 'any', this method adds mongodb criteria
  // to the `criteria` object.
  //
  // false, true and null are accepted as synonyms for '0', '1' and 'any'.
  //
  // '0' or false means "the property must be false or absent," '1' or true
  // means "the property must be true," and 'any' or null means "we don't care
  // what the property is."
  //
  // An empty string is considered equivalent to '0'.
  //
  // This is not the same as apos.sanitizeBoolean which is concerned only with
  // true or false and does not address "any."
  //
  // def defaults to `any`.
  //
  // This method is most often used with REST API parameters and forms.

  self.convertBooleanFilterCriteria = function(name, options, criteria, def) {
    if (def === undefined) {
      def = 'any';
    }
    // Consume special options then remove them, turning the rest into mongo criteria

    if (def === undefined) {
      def = 'any';
    }
    var value = (options[name] === undefined) ? def : options[name];

    if ((value === 'any') || (value === null)) {
      // Don't care, show all
    } else if ((!value) || (value === '0')) {
      // Must be absent or false. Hooray for $ne
      criteria[name] = { $ne: true };
    } else {
      // Must be true
      criteria[name] = true;
    }
  };

  self.sanitizeInteger = function(i, def, min, max) {
    if (def === undefined) {
      def = 0;
    }
    if (typeof(i) === 'number') {
      i = Math.floor(i);
    }
    else
    {
      try {
        i = parseInt(i, 10);
        if (isNaN(i)) {
          i = def;
        }
      } catch (e) {
        i = def;
      }
    }
    if ((min !== undefined) && (i < min)) {
      i = min;
    }
    if ((max !== undefined) && (i > max)) {
      i = max;
    }
    return i;
  };

  // pad an integer with leading zeroes, creating a string
  self.padInteger = function(i, places) {
    var s = i + '';
    while (s.length < places) {
      s = '0' + s;
    }
    return s;
  };

  // Accept a user-entered string in YYYY-MM-DD, MM/DD, MM/DD/YY, or MM/DD/YYYY format
  // (tolerates missing leading zeroes on MM and DD). Also accepts a Date object.
  // Returns YYYY-MM-DD.
  //
  // The current year is assumed when MM/DD is used. If there is no explicit default
  // any unparseable date is returned as today's date.

  self.sanitizeDate = function(date, def) {
    var components;

    function returnDefault() {
      if (def === undefined) {
        def = moment().format('YYYY-MM-DD');
      }
      return def;
    }

    if (typeof(date) === 'string') {
      if (date.match(/\//)) {
        components = date.split('/');
        if (components.length === 2) {
          // Convert mm/dd to yyyy-mm-dd
          return self.padInteger(new Date().getYear() + 1900, 4) + '-' + self.padInteger(components[0], 2) + '-' + self.padInteger(components[1], 2);
        } else if (components.length === 3) {
          // Convert mm/dd/yyyy to yyyy-mm-dd
          if (components[2] < 100) {
            components[2] += 1000;
          }
          return self.padInteger(components[2], 4) + '-' + self.padInteger(components[0], 2) + '-' + self.padInteger(components[1], 2);
        } else {
          return returnDefault();
        }
      } else if (date.match(/\-/)) {
        components = date.split('-');
        if (components.length === 2) {
          // Convert mm-dd to yyyy-mm-dd
          return self.padInteger(new Date().getYear() + 1900, 4) + '-' + self.padInteger(components[0], 2) + '-' + self.padInteger(components[1], 2);
        } else if (components.length === 3) {
          // Convert yyyy-mm-dd (with questionable padding) to yyyy-mm-dd
          return self.padInteger(components[0], 4) + '-' + self.padInteger(components[1], 2) + '-' + self.padInteger(components[2], 2);
        } else {
          return returnDefault();
        }
      }
    }
    try {
      date = new Date(date);
      if (isNaN(date.getTime())) {
        return returnDefault();
      }
      return self.padInteger(date.getYear() + 1900, 4) + '-' + self.padInteger(date.getMonth() + 1, 2) + '-' + self.padInteger(date.getDay(), 2);
    } catch (e) {
      return returnDefault();
    }
  };

  // Given a jQuery date object, return a date string in
  // Apostrophe's preferred sortable, comparable, JSON-able format.
  // If 'date' is missing the current date is used
  self.formatDate = function(date) {
    return moment(date).format('YYYY-MM-DD');
  };

  // Accept a user-entered string in 12-hour or 24-hour time and returns a string
  // in 24-hour time. Seconds are not supported. If def is not set the default
  // is the current time

  self.sanitizeTime = function(time, def) {
    time = self.sanitizeString(time).toLowerCase();
    time = time.trim();
    var components = time.match(/^(\d+)(:(\d+))?(:(\d+))?\s*(am|pm)?$/);
    if (components) {
      var hours = parseInt(components[1], 10);
      var minutes = (components[3] !== undefined) ? parseInt(components[3], 10) : 0;
      var seconds = (components[5] !== undefined) ? parseInt(components[5], 10) : 0;
      var ampm = components[6];
      if ((hours === 12) && (ampm === 'am')) {
        hours -= 12;
      } else if ((hours === 12) && (ampm === 'pm')) {
        // Leave it be
      } else if (ampm === 'pm') {
        hours += 12;
      }
      if ((hours === 24) || (hours === '24')) {
        hours = 0;
      }
      return self.padInteger(hours, 2) + ':' + self.padInteger(minutes, 2) + ':' + self.padInteger(seconds, 2);
    } else {
      if (def !== undefined) {
        return def;
      }
      return moment().format('HH:mm');
    }
  };

  // Requires a time in HH:MM or HH:MM:ss format. Returns
  // an object with hours, minutes and seconds properties.
  // See sanitizeTime for an easy way to get a time into the
  // appropriate input format.

  self.parseTime = function(time) {
    var components = time.match(/^(\d\d):(\d\d)(:(\d\d))$/);
    return {
      hours: time[1],
      minutes: time[2],
      seconds: time[3] || 0
    };
  };

  // Given a jQuery date object, return a time string in
  // Apostrophe's preferred sortable, comparable, JSON-able format:
  // 24-hour time, with seconds.
  //
  // If 'date' is missing the current time is used

  self.formatTime = function(date) {
    return moment(date).format('HH:mm:ss');
  };

  // Date and time tests
  // console.log(self.padInteger(4, 2));
  // console.log(self.padInteger(12, 2));
  // console.log(self.sanitizeDate('04/01/2013'));
  // console.log(self.sanitizeDate('2013-04-01'));
  // console.log(self.sanitizeDate('04/01'));
  // console.log(self.sanitizeDate(new Date()));
  // console.log(self.sanitizeTime('23:35'));
  // console.log(self.sanitizeTime('11pm'));

  // KEEP IN SYNC WITH CLIENT SIDE VERSION IN content.js
  //
  // Convert a name to camel case.
  //
  // Useful in converting CSV with friendly headings into sensible property names.
  //
  // Only digits and ASCII letters remain.
  //
  // Anything that isn't a digit or an ASCII letter prompts the next character
  // to be uppercase. Existing uppercase letters also trigger uppercase, unless
  // they are the first character; this preserves existing camelCase names.

  self.camelName = function(s) {
    var i;
    var n = '';
    var nextUp = false;
    for (i = 0; (i < s.length); i++) {
      var c = s.charAt(i);
      // If the next character is already uppercase, preserve that, unless
      // it is the first character
      if ((i > 0) && c.match(/[A-Z]/)) {
        nextUp = true;
      }
      if (c.match(/[A-Za-z0-9]/)) {
        if (nextUp) {
          n += c.toUpperCase();
          nextUp = false;
        } else {
          n += c.toLowerCase();
        }
      } else {
        nextUp = true;
      }
    }
    return n;
  };

  // MONGO HELPERS

  // 'ids' should be an array of mongodb IDs. The elements of the 'items' array are
  // returned in the order specified by 'ids'. This is useful after performing an
  // $in query with MongoDB (note that $in does NOT sort its results in the order given).
  //
  // Any IDs that do not actually exist for an item in the 'items' array are not returned,
  // and vice versa. You should not assume the result will have the same length as
  // either array.

  self.orderById = function(ids, items) {
    var byId = {};
    _.each(items, function(item) {
      byId[item._id] = item;
    });
    items = [];
    _.each(ids, function(_id) {
      if (byId.hasOwnProperty(_id)) {
        items.push(byId[_id]);
      }
    });
    return items;
  };

  // Wrappers for conveniently invoking joinr. See the
  // joinr module for more information about joins.
  //
  // Apostrophe-specific features:
  //
  // If options.get is not set, apos.get is used; otherwise
  // it is usually the get method of a snippet subclass.
  // Looks for the returned documents in results.snippets,
  // then results.pages, then results itself. Additional
  // criteria for the getter can be passed via
  // options.getCriteria, and options to the getter can be
  // passed via options.getOptions (often used to prevent
  // infinite recursion when joining).

  self.joinByOne = function(req, items, idField, objectField, options, callback) {
    return self.join(joinr.byOne, false, req, items, idField, objectField, options, callback);
  };

  self.joinByOneReverse = function(req, items, idField, objectField, options, callback) {
    return self.join(joinr.byOneReverse, true, req, items, idField, objectField, options, callback);
  };

  self.joinByArray = function(req, items, idsField, objectsField, options, callback) {
    return self.join(joinr.byArray, false, req, items, idsField, objectsField, options, callback);
  };

  self.joinByArrayReverse = function(req, items, idsField, objectsField, options, callback) {
    return self.join(joinr.byArrayReverse, true, req, items, idsField, objectsField, options, callback);
  };

  // Driver for the above
  self.join = function(method, reverse, req, items, idField, objectField, options, callback) {
    if (!callback) {
      callback = options;
      options = {};
    }
    var getter = options.get || self.get;
    var getOptions = options.getOptions || {};
    var getCriteria = options.getCriteria || {};
    return method(items, idField, objectField, function(ids, callback) {
      var idsCriteria = {};
      if (reverse) {
        idsCriteria[idField] = { $in: ids };
      } else {
        idsCriteria._id = { $in: ids };
      }
      var criteria = { $and: [ getCriteria, idsCriteria ] };
      return getter(req, criteria, getOptions, function(err, results) {
        if (err) {
          return callback(err);
        }
        return callback(null, results.snippets || results.pages || results);
      });
    }, callback);
  };

  // FILE HELPERS

  // http://nodejs.org/api/crypto.html
  self.md5File = function(filename, callback) {
    var crypto = require('crypto');
    var fs = require('fs');

    var md5 = crypto.createHash('md5');

    var s = fs.ReadStream(filename);

    s.on('data', function(d) {
      md5.update(d);
    });

    s.on('error', function(err) {
      return callback(err);
    });

    s.on('end', function() {
      var d = md5.digest('hex');
      return callback(null, d);
    });
  };

  require('./tasks.js')(self);

  // Iterate over ALL page objects. This is pricey; it should be used in
  // migrations, not everyday operations if you can possibly avoid it.
  // Note this will fetch virtual pages that are not part of the tree, the
  // trash page, etc. if you don't set criteria to the contrary. The simplest
  // possible criteria is {} which will get everything, including the
  // trash page. Consider using criteria on type and slug.
  //
  // Your 'each' function is called with a page object and a callback for each
  // page. Your 'callback' function is called at the end with an error if any.

  self.forEachPage = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.pages, criteria, each, callback);
  };

  // Iterates over files in the aposFiles collection. Note denormalized copies
  // of this information already exist in widgets (see self.forEachFileInAnyWidget)

  self.forEachFile = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.files, criteria, each, callback);
  };

  self.forEachVideo = function(criteria, each, callback) {
    return self.forEachDocumentInCollection(self.videos, criteria, each, callback);
  };

  // Iterate over every area on every page on the entire site! Not fast. Definitely for
  // major migrations only. Iterator receives page object, area name, area object and
  // callback.
  //
  // The area object refers to the same object as page.areas[name], so updating the one
  // does update the other

  self.forEachArea = function(each, callback) {
    return self.forEachPage({}, function(page, callback) {
      var areaNames = Object.keys(page.areas || {});
      return async.forEachSeries(areaNames, function(name, callback) {
        // Make sure we don't crash the stack if 'each' invokes 'callback' directly
        // for many consecutive invocations
        return setImmediate(function() {
          return each(page, name, page.areas[name], callback);
        });
      }, callback);
    }, callback);
  };

  // Iterate over every Apostrophe item in every area in every page in the universe.
  // iterator receives page object, area name, area object, item offset, item object, callback.
  // Yes, the area and item objects do refer to the same objects you'd reach if you
  // stepped through the properites of the page object, so updating the one does
  // update the other

  self.forEachItem = function(each, callback) {
    return self.forEachArea(function(page, name, area, callback) {
      var n = -1;
      return async.forEachSeries(area.items || [], function(item, callback) {
        n++;
        // Make sure we don't crash the stack if 'each' invokes 'callback' directly
        // for many consecutive invocations
        return setImmediate(function() {
          return each(page, name, area, n, item, callback);
        });
      }, function(err) {
        return callback(err);
      });
    }, function(err) {
      return callback(err);
    });
  };

  self.forEachDocumentInCollection = function(collection, criteria, each, callback) {
    collection.find(criteria, function(err, cursor) {
      if (err) {
        return callback(err);
      }
      var done = false;
      async.whilst(function() { return !done; }, function(callback) {
        return cursor.nextObject(function(err, page) {
          if (err) {
            return callback(err);
          }
          if (!page) {
            done = true;
            return callback(null);
          }
          return each(page, callback);
        });
      }, callback);
    });
  };

  // An internal function for use by migrations that install system pages
  // like trash or search as children of the home page
  self.insertSystemPage = function(page, callback) {
    // Determine rank of the new page, in case we didn't hardcode it, but
    // then check for a hardcoded rank too
    return self.pages.find({ path: /^home\/[\w\-]+$/ }, { rank: 1 }).sort({ rank: -1 }).limit(1).toArray(function(err, pages) {
      if (err) {
        return callback(null);
      }
      if (!page.rank) {
        var rank = 0;
        if (pages.length) {
          rank = pages[0].rank + 1;
        }
        page.rank = rank;
      }
      // System pages are always orphans at level 1
      page.level = 1;
      page.orphan = true;
      return self.pages.insert(page, callback);
    });
  }

  self.tasks.migrate = function(callback) {
    return require('./tasks/migrate.js')(self, callback);
  };

  self.tasks.reset = function(callback) {
    console.log('Resetting the database - removing ALL content');
    var collections = [ self.files, self.pages, self.redirects, self.versions ];
    async.map(collections, function(collection, callback) {
      return collection.remove({}, callback);
    }, function (err) {
      if (err) {
        return callback(err);
      }
      return async.series([ resetMain ], callback);
      function resetMain(callback) {
        return self.pages.insert([{ slug: '/', _id: '4444444444444', path: 'home', title: 'Home', level: 0, type: 'home', published: true }, { slug: '/search', _id: 'search', orphan: true, path: 'home/search', title: 'Search', level: 1, type: 'search', rank: 9998, published: true }, { slug: '/trash', _id: 'trash', path: 'home/trash', title: 'Trash', level: 1, trash: true, type: 'trash', rank: 9999 }], callback);
      }
    });
  };

  self.tasks.index = function(callback) {
    return async.series({
      indexPages: function(callback) {
        console.log('Indexing all pages for search');
        return self.forEachPage({},
          function(page, callback) {
            return self.indexPage({}, page, callback);
          },
          callback);
      },
      indexFiles: function(callback) {
        console.log('Indexing all files for search');
        return self.forEachFile({}, function(file, callback) {
          file.searchText = self.fileSearchText(file);
          self.files.update({ _id: file._id }, file, callback);
        }, callback);
      },
      indexVideos: function(callback) {
        console.log('Indexing all videos for search');
        return self.forEachVideo({}, function(video, callback) {
          video.searchText = self.sortify(video.title);
          self.videos.update({ _id: video._id }, video, callback);
        }, callback);
      }
    }, callback);
  };

  self.tasks.rescale = function(callback) {
    console.log('Rescaling all images with latest uploadfs settings');
    self.files.count(function(err, total) {
      if (err) {
        return callback(err);
      }
      var n = 0;
      self.forEachFile({},
        function(file, fileCallback) {
          if (!_.contains(['jpg', 'png', 'gif'], file.extension)) {
            n++;
            console.log('Skipping a non-image file: ' + file.name + '.' + file.extension);
            return fileCallback(null);
          }
          var tempFile;
          async.series([
            function(callback) {
              var originalFile = '/files/' + file._id + '-' + file.name + '.' + file.extension;
              tempFile = self.uploadfs.getTempPath() + '/' + self.generateId() + '.' + file.extension;
              n++;
              console.log(n + ' of ' + total + ': ' + originalFile);
              async.series([
                function(resumeCallback) {
                  // ACHTUNG: the --resume option will skip any image that
                  // has a one-third size rendering. So it's not very useful
                  // for resuming the addition of an additional size. But
                  // it's pretty handy after a full import. --resume takes
                  // a site URL (no trailing /) to which the relative URL
                  // to files will be appended. If your media are
                  // actually on s3 you can skip that part, it'll figure it out.
                  if (!argv.resume) {
                    return resumeCallback(null);
                  }
                  var url = self.uploadfs.getUrl() + '/files/' + file._id + '-' + file.name + '.one-third.' + file.extension;
                  if (url.substr(0, 1) === '/') {
                    url = argv.resume + url;
                  }
                  console.log('Checking ' + url);
                  return request.head(url, function(err, response, body) {
                    console.log(err);
                    console.log(response.statusCode);
                    if ((!err) && (response.statusCode === 200)) {
                      // Invoke the MAIN callback, skipping this file
                      console.log('exists, skipping');
                      return fileCallback(null);
                    }
                    // Continue the pipeline to rescale this file
                    return resumeCallback(null);
                  });
                },
                function(callback) {
                  self.uploadfs.copyOut(originalFile, tempFile, callback);
                },
                function(callback) {
                  if (!argv['crop-only']) {
                    return self.uploadfs.copyImageIn(tempFile, originalFile, callback);
                  } else {
                    return callback(null);
                  }
                }
              ], callback);
            },
            // Don't forget to recrop as well!
            function(callback) {
              async.forEachSeries(file.crops || [], function(crop, callback) {
                console.log('RECROPPING');
                var originalFile = '/files/' + file._id + '-' + file.name + '.' + crop.left + '.' + crop.top + '.' + crop.width + '.' + crop.height + '.' + file.extension;
                console.log("Cropping " + tempFile + " to " + originalFile);
                self.uploadfs.copyImageIn(tempFile, originalFile, { crop: crop }, callback);
              }, callback);
            },
            function(callback) {
              fs.unlink(tempFile, callback);
            }
          ], fileCallback);
        },
        callback);
    });
  };

  // This is not a migration because it is not mandatory to have search on your site
  self.tasks.search = function(callback) {
    console.log('Adding a search page to the site');
    self.pages.findOne({ type: 'search' }, function (err, search) {
      if (err) {
        return callback(err);
      }
      if (!search) {
        console.log('No search page, adding it');
        return self.insertSystemPage({
            _id: 'search',
            path: 'home/search',
            slug: '/search',
            type: 'search',
            title: 'Search',
            published: true,
            // Max home page direct kids on one site: 1 million. Max special
            // purpose admin pages: 999. That ought to be enough for
            // anybody... I hope!
            rank: 1000998
        }, callback);
      } else {
        console.log('We already have one');
      }
      return callback(null);
    });
  };

  self.tasks.dropTestData = function(callback) {
    console.log('Dropping all test data.');
    return self.pages.remove({ testData: true }, callback);
  };

  // INTEGRATING LOGINS WITH APPY
  //
  // Pass the result of a call to this method as the `auth` option to appy to allow people
  // (as managed via the "people" module) to log in as long as they have the "login" box checked.
  //
  // You must pass your instance of the `pages` module as the `pages` option so that the login
  // dialog can be presented.
  //
  // If the `adminPassword` option is set then an admin user is automatically provided
  // regardless of what is in the database, with the password set as specified.

  self.appyAuth = function(options, user) {
    var users = {};
    if (options.adminPassword) {
      users.admin = {
        type: 'person',
        username: 'admin',
        password: options.adminPassword,
        firstName: 'Ad',
        lastName: 'Min',
        title: 'Admin',
        _id: 'admin',
        // Without this login is forbidden
        login: true,
        permissions: { admin: true }
      };
    }
    return {
      strategy: 'local',
      options: {
        users: users,
        // A user is just a snippet page with username and password properties.
        // (Yes, the password property is hashed and salted.)
        collection: 'aposPages',
        // Render the login page
        template: options.loginPage,
        // Set the redirect for after login passing req.user from Appy l.~208
        redirect: function(user){
          if (options.redirect) {
            return options.redirect(user);
          } else {
            // This feels like overkill, because we're checking in Appy as well.
            return '/';
          }
        },
        verify: function(password, hash) {
          if (hash.match(/^a15/)) {
            // bc with Apostrophe 1.5 hashed passwords. The salt is
            // implemented differently, it's just prepended to the
            // password before hashing. Whatever createHmac is doing
            // in the password-hash module, it's not that. Fortunately
            // it isn't hard to do directly
            var components = hash.split(/\$/);
            if (components.length !== 3) {
              return false;
            }
            // Allow for a variety of algorithms coming over from A1.5
            var hashType = components[0].substr(3);
            var salt = components[1];
            var hashed = components[2];
            try {
              var shasum = crypto.createHash(hashType);
              shasum.update(salt + password);
              var digest = shasum.digest('hex');
              return (digest === hashed);
            } catch (e) {
              console.log(e);
              return false;
            }
          } else {
            return passwordHash.verify(password, hash);
          }
        }
      }
    };
  };

  // Pass this function to appy as the `beforeSignin` option to check for login privileges,
  // then apply the user's permissions obtained via group membership before
  // completing the login process

  self.appyBeforeSignin = function(user, callback) {
    if (user.type !== 'person') {
      // Whaaat the dickens this object is not even a person
      return callback('error');
    }
    if (!user.login) {
      return callback({ message: 'user does not have login privileges' });
    } else {
      user.permissions = user.permissions || {};
      self.pages.find({ type: 'group', _id: { $in: user.groupIds || [] } }).toArray(function(err, groups) {
        if (err) {
          console.log(err);
          return callback(err);
        }
        user._groups = groups;
        _.each(groups, function(group) {
          _.each(group.permissions || [], function(permission) {
            if (!_.contains(user.permissions, permission)) {
              user.permissions[permission] = true;
            }
          });
        });
        // The standard permissions are progressive
        if (user.permissions.admin) {
          user.permissions.edit = true;
        }
        if (user.permissions.edit) {
          user.permissions.guest = true;
        }
        return callback(null);
      });
    }
  };
}

// Required because EventEmitter is built on prototypal inheritance,
// calling the constructor is not enough
require('util').inherits(Apos, require('events').EventEmitter);

module.exports = function() {
  return new Apos();
};

