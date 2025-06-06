// Methods here should be of short, of universal utility, and not
// clearly in the domain of any other module. If you don't wish
// it was standard in JavaScript, it probably doesn't belong here.
// Many methods are simple wrappers for [lodash](https://npmjs.org/package/lodash) methods.

// ## Options
//
// ### `logger` (LEGACY)
//
// A function which accepts `apos` and returns an object with
// at least `info`, `debug`, `warn` and `error` methods. These methods should
// support placeholders (see `util.format`). If this option is
// not supplied, logs are simply written to the Node.js `console`.
// A `log` method may also be supplied; if it is not, `info`
// is called in its place. Calls to `apos.util.log`,
// `apos.util.error`, etc. are routed through this object
// by Apostrophe. This provides compatibility out of
// the box with many popular logging modules, including `winston`.
// NOTE: this option is deprecated, you should configure `@apostrophecms/log`
// module instead. This option will still work for BC reasons, but switching
// to structured logging and module `self.logInfo()`, `self.logError()`, etc
// is highly recommended.
// Read more in the`@apostrophecms/log` module documentation.

const _ = require('lodash');
const he = require('he');
_.str = require('underscore.string');
const XRegExp = require('xregexp').XRegExp;
const crypto = require('crypto');
const { createId } = require('@paralleldrive/cuid2');
const fs = require('fs');
const now = require('performance-now');
const Promise = require('bluebird');
const util = require('util');
const { stripIndent } = require('common-tags');
const glob = require('../../../lib/glob.js');

module.exports = {
  options: {
    alias: 'util',
    // No more than 50 combined levels deep in:
    // * relationship fetches
    // * widget loaders
    // * async components
    stackLimit: 50
  },
  init(self) {
    // An id for this particular Apostrophe instance that should be
    // unique even in a multiple server environment.
    self.apos.pid = self.generateId();
    self.regExpQuote = require('regexp-quote');
    self.warnedDev = {};
    return self.enableLogger();
  },
  handlers(self) {
    return {
      'apostrophe:destroy': {
        async destroyLogger() {
          if (self.logger.destroy) {
            await self.logger.destroy();
          }
        }
      }
    };
  },
  methods(self) {
    return {
      // generate a unique identifier for a new page or other object.
      // IDs are generated with the cuid2 module which prevents
      // collisions and easy guessing of another's ID.
      generateId() {
        return createId();
      },
      // Globally replace a string with another string.
      // Regular `String.replace` does NOT offer global replace, except
      // when using regular expressions, which are great but
      // problematic when UTF8 characters may be present.
      globalReplace(haystack, needle, replacement) {
        let result = '';
        while (true) {
          if (!haystack.length) {
            return result;
          }
          const index = haystack.indexOf(needle);
          if (index === -1) {
            result += haystack;
            return result;
          }
          result += haystack.substr(0, index);
          result += replacement;
          haystack = haystack.substr(index + needle.length);
        }
      },
      // Truncate a plaintext string at the specified number of
      // characters without breaking words if possible, see
      // underscore.string's prune function, of which this is
      // a copy (but replacing RegExp with XRegExp for
      // better UTF-8 support)
      //
      truncatePlaintext(str, length, pruneStr) {
        if (str == null) {
          return '';
        }
        str = String(str);
        length = ~~length;
        pruneStr = pruneStr != null ? String(pruneStr) : '...';
        if (str.length <= length) {
          return str;
        }
        // XRegExp is different.
        // eslint-disable-next-line no-useless-escape
        const r = '.(?=W*w*$)';
        const regex = new XRegExp(r, 'g');
        function tmpl(c) {
          return c.toUpperCase() !== c.toLowerCase() ? 'A' : ' ';
        }
        ;
        let template = str.slice(0, length + 1);
        template = XRegExp.replace(template, regex, tmpl);
        // 'Hello, world' -> 'HellAA AAAAA'
        if (template.slice(template.length - 2).match(/\w\w/)) {
          template = template.replace(/\s*\S+$/, '');
        } else {
          template = _.str.rtrim(template.slice(0, template.length - 1));
        }
        return (template + pruneStr).length > str.length
          ? str
          : str.slice(0, template.length) + pruneStr;
      },
      // Escape a plaintext string correctly for use in HTML.
      // If `{ pretty: true }` is in the options object,
      // newlines become br tags, and URLs become links to
      // those URLs. Otherwise we just do basic escaping.
      //
      // If `{ single: true }` is in the options object,
      // single-quotes are escaped, otherwise double-quotes
      // are escaped.
      //
      // For bc, if the second argument is truthy and not an
      // object, `{ pretty: true }` is assumed.
      escapeHtml(s, options) {
        // for bc
        if (options && typeof options !== 'object') {
          options = { pretty: true };
        }
        options = options || {};
        if (s === 'undefined') {
          s = '';
        }
        if (typeof s !== 'string') {
          s = s + '';
        }
        s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (options.single) {
          s = s.replace(/'/g, '&#39;');
        } else {
          s = s.replace(/"/g, '&#34;');
        }
        if (options.pretty) {
          s = s.replace(/\r?\n/g, '<br />');
          // URLs to links. Careful, newlines are already <br /> at this point
          s = s.replace(/https?:[^\s<]+/g, function (match) {
            match = match.trim();
            return '<a href="' + self.escapeHtml(match) + '">' + match + '</a>';
          });
        }
        return s;
      },
      // Convert HTML to true plaintext, with all entities decoded.
      htmlToPlaintext(html) {
        // The awesomest HTML renderer ever (look out webkit):
        // block element opening tags = newlines, closing tags and
        // non-container tags just gone
        html = html.replace(/<\/.*?>/g, '');
        html = html.replace(/<(h1|h2|h3|h4|h5|h6|p|br|blockquote|li|article|address|footer|pre|header|table|tr|td|th|tfoot|thead|div|dl|dt|dd).*?>/gi, '\n');
        html = html.replace(/<.*?>/g, '');
        return he.decode(html);
      },
      // Capitalize the first letter of a string.
      capitalizeFirst(s) {
        return s.charAt(0).toUpperCase() + s.substr(1);
      },
      // Convert other name formats such as underscore and camelCase to a
      // hyphenated css-style name.
      cssName(camel) {
        // Keep in sync with client side version
        let i;
        let css = '';
        let dash = false;
        for (i = 0; i < camel.length; i++) {
          let c = camel.charAt(i);
          const lower = c >= 'a' && c <= 'z';
          const upper = c >= 'A' && c <= 'Z';
          const digit = c >= '0' && c <= '9';
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
            // Preserve double dash if they were literal dashes.
            // This is common in modern CSS patterns
            if (i >= 2 && camel.substr(i - 2, 2) === '--') {
              css += '-';
            }
            dash = false;
          }
          css += c;
        }
        return css;
      },
      // Convert a name to camel case.
      //
      // Useful in converting CSV with friendly headings into sensible property
      // names.
      //
      // Only digits and ASCII letters remain.
      //
      // Anything that isn't a digit or an ASCII letter prompts the next
      // character to be uppercase. Existing uppercase letters also trigger
      // uppercase, unless they are the first character; this preserves existing
      // camelCase names.
      camelName(s) {
        // Keep in sync with client side version
        let i;
        let n = '';
        let nextUp = false;
        for (i = 0; i < s.length; i++) {
          const c = s.charAt(i);
          // If the next character is already uppercase, preserve that, unless
          // it is the first character
          if (i > 0 && c.match(/[A-Z]/)) {
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
      },
      // Add a slash to a path, but only if it does not already end in a slash.
      addSlashIfNeeded(path) {
        path += '/';
        path = path.replace(/\/\/$/, '/');
        return path;
      },
      // Perform an md5 checksum on a string. Returns hex string.
      md5(s) {
        const md5 = crypto.createHash('md5');
        md5.update(s);
        return md5.digest('hex');
      },
      // perform an md5 checksum on a file. Async. Returns a hex string.
      async md5File(filename) {
        return new Promise(function (resolve, reject) {
          const md5 = crypto.createHash('md5');
          const s = fs.ReadStream(filename);
          s.on('data', function (d) {
            md5.update(d);
          });
          s.on('error', function (err) {
            return reject(err);
          });
          s.on('end', function () {
            const d = md5.digest('hex');
            return resolve(d);
          });
        });
      },
      // Get file size in bytes. Async. Returns size.
      async fileLength(filename) {
        const stat = await Promise.promisify(function (name, cb) {
          return fs.stat(name, cb);
        })(filename);
        return stat.size;
      },
      // Turn the provided string into a string suitable for use as a slug.
      // ONE punctuation character normally forbidden in slugs may
      // optionally be permitted by specifying it via options.allow.
      // The separator may be changed via options.separator.
      slugify(s, options) {
        return require('sluggo')(s, options);
      },
      // Returns a string that, when used for indexes, behaves
      // similarly to MySQL's default behavior for sorting, plus a little
      // extra tolerance of punctuation and whitespace differences. This is
      // in contrast to MongoDB's default "absolute match with same case only"
      // behavior which is no good for most practical purposes involving text.
      //
      // The use of this method to create sortable properties like
      // "titleSortified" is encouraged. It should not be used for full text
      // search, as MongoDB full text search is now available (see the
      // "search" option to apos.get and everything layered on top of it).
      // It is however used as part of our "autocomplete" search implementation.
      sortify(s) {
        return self.slugify(s, { separator: ' ' });
      },
      // Turns a user-entered search query into a regular expression.
      // If the string contains multiple words, at least one space is
      // required between them in matching documents, but additional words
      // may also be skipped between them, up to a reasonable limit to
      // preserve performance and avoid useless strings.
      //
      // Although we now have MongoDB full text search this is still
      // a highly useful method, for instance to locate autocomplete
      // candidates via highSearchWords.
      //
      // If the prefix flag is true the search matches only at the start.
      searchify(q, prefix) {
        q = self.sortify(q);
        if (prefix) {
          q = '^' + q;
        }
        q = q.replace(/ /g, ' .{0,20}?');
        q = new RegExp(q);
        return q;
      },
      // Clone the given object recursively, discarding all
      // properties whose names begin with `_` except
      // for `_id`. Returns the clone.
      //
      // This removes the output of relationships and
      // other dynamic loaders, so that dynamically available
      // content is not stored redundantly in MongoDB.
      //
      // If the object is an array, the clone is also an array.
      //
      // Date objects are cloned as such. All other non-JSON
      // objects are cloned as plain JSON objects.
      //
      // If `keepScalars` is true, properties beginning with `_`
      // are kept as long as they are not objects. This is useful
      // when using `clonePermanent` to limit JSON inserted into
      // browser attributes, rather than filtering for the database.
      // Preserving simple string properties like `._url` is usually
      // a good thing in the former case.
      //
      // Arrays are cloned as such only if they are true arrays
      // (Array.isArray returns true). Otherwise all objects with
      // a length property would be treated as arrays, which is
      // an unrealistic restriction on apostrophe doc schemas.
      clonePermanent(o, keepScalars) {
        let c;
        const isArray = Array.isArray(o);
        if (isArray) {
          c = [];
        } else {
          c = {};
        }
        function iterator(val, key) {
          // careful, don't crash on numeric keys
          if (typeof key === 'string') {
            if (key.charAt(0) === '_' && key !== '_id') {
              if (!keepScalars || typeof val === 'object') {
                return;
              }
            }
          }
          if (val === null || val === undefined) {
            // typeof(null) is object, sigh
            c[key] = null;
          } else if (typeof val !== 'object') {
            c[key] = val;
          } else if (val instanceof Date) {
            c[key] = new Date(val);
          } else {
            c[key] = self.clonePermanent(val, keepScalars);
          }
        }
        if (isArray) {
          _.each(o, iterator);
        } else {
          _.forOwn(o, iterator);
        }
        return c;
      },
      // `ids` should be an array of mongodb IDs. The elements of the `items`
      // array, which should be the result of a mongodb query, are returned in
      // the order specified by `ids`. This is useful after performing an `$in`
      // query with MongoDB (note that `$in` does NOT sort its strings in the
      // order given).
      //
      // Any IDs that do not actually exist for an item in the `items` array
      // are not returned, and vice versa. You should not assume the result will
      // have the same length as either array.
      //
      // Optionally you may specify a property name other than _id as the third
      // argument. You may use dot notation in this argument.
      orderById(ids, items, idProperty) {
        if (idProperty === undefined) {
          idProperty = '_id';
        }
        const byId = {};
        _.each(items, function (item) {
          let value = item;
          const keys = idProperty.split('.');
          _.each(keys, function (key) {
            value = value[key];
          });
          byId[value] = item;
        });
        items = [];
        _.each(ids, function (_id) {
          if (_.has(byId, _id)) {
            items.push(byId[_id]);
          }
        });
        return items;
      },
      // Return true if `req` is an AJAX request (`req.xhr` is set, or
      // `req.query.xhr` is set to emulate it) and Apostrophe's
      // main content area refresh mechanism is not in play.
      isAjaxRequest(req) {
        return (req.xhr || req.query.xhr) && (req.query.aposRefresh !== '1');
      },
      // Sort the given array of strings in place, comparing strings in a
      // case-insensitive way.
      insensitiveSort(strings) {
        strings.sort(self.insensitiveSortCompare);
      },
      // Sort the given array of objects in place, based on the value of the
      // given property of each object, in a case-insensitive way.
      insensitiveSortByProperty(objects, property) {
        objects.sort(function (a, b) {
          return self.insensitiveSortCompare(a[property], b[property]);
        });
      },
      // Compare two strings in a case-insensitive way, returning -1, 0 or 1,
      // suitable for use with sort(). If the two strings represent numbers,
      // compare them as numbers for a natural sort order when comparing strings
      // like '4' and '10'.
      insensitiveSortCompare(a, b) {
        let na, nb;
        if (a && a.toString().toLowerCase()) {
          a = a.toString().toLowerCase();
        }
        if (b && b.toString().toLowerCase()) {
          b = b.toString().toLowerCase();
        }
        // Sort naturally when comparing two numbers,
        // so the relative order of 10 and 2 makes sense
        if (a.match(/^[\d.]+$/) && b.match(/^[\d.]+/)) {
          na = parseFloat(a);
          nb = parseFloat(b);
          if (!(isNaN(na) || isNaN(nb))) {
            a = na;
            b = nb;
          }
        }
        if (a < b) {
          return -1;
        } else if (a > b) {
          return 1;
        } else {
          return 0;
        }
      },
      // Within the given object (typically a doc or widget),
      // find a subobject with the given `_id` property.
      // Can be nested at any depth.
      //
      // Useful to locate a specific widget within a doc.
      findNestedObjectById(object, _id, { ignoreDynamicProperties = false } = {}) {
        let key;
        let val;
        let result;
        for (key in object) {
          if (ignoreDynamicProperties && (key.charAt(0) === '_')) {
            continue;
          }
          val = object[key];
          if (val && typeof val === 'object') {
            if (val._id === _id) {
              return val;
            }
            result = self.findNestedObjectById(val, _id);
            if (result) {
              return result;
            }
          }
        }
      },
      // Within the given object (typically a doc or widget),
      // find a subobject with the given `_id` property.
      // Can be nested at any depth.
      //
      // Useful to locate a specific widget within a doc.
      //
      // Returns an object like this: `{ object: { ... }, dotPath:
      // 'dot.path.of.object' }`
      //
      // Ignore the `_dotPath` argument to this method; it is used for
      // recursion.
      findNestedObjectAndDotPathById(
        object,
        id,
        { ignoreDynamicProperties = false } = {},
        _dotPath
      ) {
        let key;
        let val;
        let result;
        let subPath;
        _dotPath = _dotPath || [];
        for (key in object) {
          if (ignoreDynamicProperties && (key.charAt(0) === '_')) {
            continue;
          }
          val = object[key];
          if (val && typeof val === 'object') {
            subPath = _dotPath.concat(key);
            if (val._id === id) {
              return {
                object: val,
                dotPath: subPath.join('.')
              };
            }
            result = self.findNestedObjectAndDotPathById(
              val,
              id,
              { ignoreDynamicProperties },
              subPath
            );
            if (result) {
              return result;
            }
          }
        }
      },
      enableLogger() {
        // Legacy, configured via this module.
        if (self.options.logger) {
          self.logger = self.options.logger(self.apos);
          return;
        }
        // New, configured via the `log` module.
        const logOpts = self.apos.structuredLog.options;
        if (logOpts.logger) {
          self.logger = typeof logOpts.logger === 'function'
            ? logOpts.logger(self.apos)
            : logOpts.logger;
          return;
        }
        self.logger = require('./lib/logger.js')(self.apos);
      },
      // Log a message. The default
      // implementation wraps `console.log` and passes on
      // all arguments, so substitution strings may be used.
      //
      // Overrides should be written with support for
      // substitution strings in mind. See the
      // `console.log` documentation.
      //
      // If the logger has no `log` method, the `info` method
      // is used. This allows an instance of `bole` or similar
      // to be used directly.
      log(...args) {
        // kept for bc
        if (!self.logger.log) {
          return self.logger.info(...self.convertLegacyLogPayload(args));
        }
        self.logger.log(...self.convertLegacyLogPayload(args));
      },
      // Log an informational message. The default
      // implementation wraps `console.info` and passes on
      // all arguments, so substitution strings may be used.
      //
      // Overrides should be written with support for
      // substitution strings in mind. See the
      // `console.log` documentation.
      info(...args) {
        self.logger.info(...self.convertLegacyLogPayload(args));
      },
      // Log a debug message. The default implementation wraps
      // `console.debug` if available, otherwise `console.log`,
      // and passes on all arguments, so substitution strings may be used.
      //
      // Overrides should be written with support for
      // substitution strings in mind. See the
      // `console.warn` documentation.
      debug(...args) {
        self.logger.debug(...self.convertLegacyLogPayload(args));
      },
      // Log a warning. The default implementation wraps
      // `console.warn` and passes on all arguments,
      // so substitution strings may be used.
      //
      // Overrides should be written with support for
      // substitution strings in mind. See the
      // `console.warn` documentation.
      //
      // The intention is that `apos.util.warn` should be
      // called for situations less dire than
      // `apos.util.error`.
      warn(...args) {
        self.logger.warn(...self.convertLegacyLogPayload(args));
      },

      // Identical to `apos.util.warn`, except that (1) the warning is
      // not displayed if `process.env.NODE_ENV` is `production`, and
      // (2) if the warning's first argument is a message it is
      // automatically prefixed with a warning icon.
      //
      // Also see `warnDevOnce` which is less likely to irritate
      // the developer until they stop paying attention.

      warnDev(...args) {
        if (process.env.NODE_ENV === 'production') {
          return;
        }
        const m = args[0];
        if ((typeof m) === 'string') {
          args[0] = `⚠️  ${m}`;
        }
        self.warn(...args);
      },

      // Identical to `apos.util.warnDev`, except that the warning is
      // only displayed once per `name` unless the command line
      // option `--all-[name]` is present. Nothing appears if
      // `process.env.NODE_ENV` is `production`, unless
      // `--all-[name]` is present on the command line. You can
      // also suppress these with `--ignore-[name]`.

      warnDevOnce(name, ...args) {
        const always = self.apos.argv[`all-${name}`];
        const hide = self.apos.argv[`ignore-${name}`];
        if (hide) {
          return;
        }
        if ((process.env.NODE_ENV === 'production') && (!always)) {
          return;
        }
        if (always || (!self.warnedDev[name])) {
          self.warnDev(...args);
          if (!always) {
            self.warnedDev[name] = true;
            self.info(stripIndent`
              This warning appears only once to save space. Pass --all-${name}
              on the command line to see the warning for all cases.
            ` + '\n');
          }
        }
      },

      // Log an error message. The default implementation
      // wraps `console.error` and passes on all arguments,
      // so substitution strings may be used.
      //
      // Overrides should be written with support for
      // substitution strings in mind. See the
      // `console.error` documentation.
      error(...args) {
        self.logger.error(...self.convertLegacyLogPayload(args));
      },
      // Performance profiling method. At the start of the operation you want
      // to profile, call with req (may be null or omitted entirely) and a
      // dot-namespaced key. A function is returned. Call that function
      // with no arguments at the end of your operation.
      //
      // Alternatively, you may pass the duration in milliseconds yourself as
      // the third argument. In this case no function is returned. This is
      // useful if you are already gathering timing information for other
      // purposes.
      //
      // Profiler modules such as `@apostrophecms/profiler` override this
      // method to provide detailed performance analysis. Note that they must
      // support both calling syntaxes. The default implementation does nothing.
      //
      // If the dot-separated key looks like
      // `callAll.pageBeforeSend.module-name`, time is tracked to `callAll`,
      // `callAll.pageBeforeSend`, and `callAll.pageBeforeSend.module-name` as
      // categories. Note that the most general category should come first.
      //
      // To avoid overhead and bloat in the core, the default implementation
      // does nothing. Also most core modules and methods do not invoke this
      // method. However, the `@apostrophecms/profiler` module extends them to
      // invoke it, for performance reasons: the profiler itself can have a
      // performance overhead.
      profile(req, key, optionalDuration) {
        if (typeof req === 'string') {
          // Called without a `req`
          if (arguments.length === 2) {
            return self.profile(null, arguments[0], arguments[1]);
          } else {
            return self.profile(null, arguments[0]);
          }
        }
        if (arguments.length === 2) {
          // You did not supply duration so we return a function
          // for you to call at the end
          return function () {
          };
        }
      },
      // Returns time since the start of the process in milliseconds,
      // with high-resolution accuracy. Used by apos.util.profile.
      // See: https://www.npmjs.com/package/performance-now
      now() {
        return now();
      },
      // Given a widget or doc, return the appropriate manager module.
      getManagerOf(object) {
        if (object.metaType === 'doc') {
          return self.apos.doc.getManager(object.type);
        } else if (object.metaType === 'widget') {
          return self.apos.area.getWidgetManager(object.type);
        } else if (object.metaType === 'arrayItem') {
          return self.apos.schema.getArrayManager(object.scopedArrayName);
        } else if (object.metaType === 'object') {
          return self.apos.schema.getObjectManager(object.scopedObjectName);
        } else {
          throw new Error(`Unsupported metaType in getManagerOf: ${object.metaType}`);
        }
      },
      // fetch the value at the given path from the object or
      // array `o`. `path` supports dot notation like MongoDB, and
      // in addition if the first component begins with `@xyz` the
      // sub-object within `o` with an `_id` property equal to `xyz`.
      // is found and returned, no matter how deeply nested it is.
      get(o, path) {
        let i;
        path = path.split('.');
        for (i = 0; (i < path.length); i++) {
          const p = path[i];
          if ((i === 0) && (p.charAt(0) === '@')) {
            o = self.apos.util.findNestedObjectById(o, p.substring(1));
          } else {
            o = o[p];
          }
        }
        return o;
      },

      // Returns `path` with any @ reference present resolved to a full
      // dot path. If the reference cannot be resolved the @ reference
      // remains in the returned value.
      resolveAtReference(o, path) {
        path = path.split('.');
        if (path[0] && (path[0].charAt(0) === '@')) {
          const info = self.apos.util
            .findNestedObjectAndDotPathById(o, path[0].substring(1));
          if (!info) {
            return path.join('.');
          }
          if (path.length > 1) {
            return info.dotPath + '.' + (path.slice(1).join('.'));
          } else {
            return info.dotPath;
          }
        } else {
          return path.join('.');
        }
      },

      // set the value at the given path within the object or
      // array `o`. `path` supports dot notation like MongoDB. In
      // addition if the first component begins with `@xyz` the
      // sub-object within `o` with an `_id` property equal to `xyz`.
      // is located, no matter how deeply nested it is. If that is
      // the only component of the path the sub-object is replaced
      // with v. If there are further components via dot notation,
      // they are honored to locate the final location for `v`.
      //
      // The `@` syntax works only for locating sub-objects. You may
      // not pass `@abc` where `abc` is the `_id` of `o` itself.
      set(o, path, v) {
        let i;
        let p;
        let matches;
        if (path.charAt(0) === '@') {
          matches = path.match(/^@([^.]+)(.*)$/);
          if (!matches) {
            throw new Error(`@ syntax used without an id: ${path}`);
          }
          const found = self.apos.util.findNestedObjectAndDotPathById(
            o,
            matches[1],
            { ignoreDynamicProperties: true }
          );
          if (found) {
            if (matches[2].length) {
              o = found.object;
              path = matches[2].substring(1);
            } else {
              path = found.dotPath;
            }
          } else {
            return;
          }
        }
        path = path.split('.');
        for (i = 0; (i < (path.length - 1)); i++) {
          p = path[i];
          o = o[p];
        }
        p = path[i];
        o[p] = v;
      },
      // Pushes the given label onto `req.aposStack` before awaiting the given
      // function; then pops the label off the stack and returns the result of
      // the function. If the stack limit is reached, a warning which includes
      // the stack itself is printed to assist in debugging, and the return
      // value is `undefined`. Code that calls this function should be prepared
      // not to crash if `undefined` is returned.

      async recursionGuard(req, label, fn) {
        req.aposStack.push(label);
        if (req.aposStack.length === self.options.stackLimit) {
          self.apos.util.warn(stripIndent`
            WARNING: reached the maximum depth of Apostrophe's asynchronous stack.
            This is usually because widget loaders, async components, and/or relationships
            are causing an infinite loop.

            Please review the stack to find the problem:

            ${req.aposStack.join('\n')}

            Suggested fixes:
            * For each relationship, set "areas: false" or configure a projection with
              "project".
            * Use the "neverLoad" option in your widget modules to block them from loading
              particular widget types recursively.
            * Do not use "neverLoadSelf: false" for any widget type unless you can guarantee
              it will never cause an infinite loop.
            * Make sure your async components do not call themselves recursively in a way
              that will never terminate.
          `);
          req.aposStack.pop();
          return;
        }
        const result = await fn();
        req.aposStack.pop();
        return result;
      },
      // Returns a new `req` object with the properties of the original plus any
      // in the optional `properties` parameter. Used when a request object
      // with one change is desired, such as `mode: 'published'`. Avoids
      // the need to push and pop properties of the original `req`.
      // Also available as `req.clone(properties = {})`.
      cloneReq(req, properties = {}) {
        // Express and Node.js offer no official constructor for a req object.
        // But a plain object "clone" only takes us so far because we need
        // access to things like `req.get`. Solution: ask `Object.create` to
        // create a new object with the same prototype as `req`, then copy the
        // own properties of `req` into the new object.
        const result = Object.assign(
          Object.create(Object.getPrototypeOf(req)), req, properties
        );
        self.apos.i18n.setPrefixUrls(result);
        // Must have its own clone function or we can't clone two levels deep
        result.clone = (properties = {}) => {
          return self.apos.util.cloneReq(result, properties);
        };
        return result;
      },
      pipe: (...functions) => (initial) => functions
        .reduce((accumulator, current) => current(accumulator), initial),
      merge(...objects) {
        const concatArrays = (objValue, srcValue) => {
          if (Array.isArray(objValue)) {
            return objValue.concat(srcValue);
          }
        };

        return _.mergeWith({}, ...objects, concatArrays);
      },
      omit(source, keys) {
        return _.omit(source, keys);
      },
      // A wrapper for glob 10.x with the sorting semantics of glob
      // 8.x, as a drop-in replacement to avoid introducing bc issues
      // in existing Apostrophe logic. Not guaranteed to cover
      // every difference between glob 8.x and 10.x, just those
      // that break Apostrophe startup
      glob(pattern, options = {}) {
        return glob(pattern, options);
      },
      // Internal method. Attempt to convert the log payload to an object
      // for legacy calls and when `@apostrophecms/log` has been configured
      // with `messageAs: 'someKey'`.
      // This change is backwards compatible with the previous behavior because
      // `messageAs` is a newly introduced option. Custom loggers should adapt
      // to this change when using `messageAs`.
      // `args` is the argument array passed to the any log method.
      // The result (when required) is an array with a single object.
      // First string argument (if available) is used as `message`.
      // First object argument is used as result object.
      // All other arguments are passed as `args` property of the result object.
      convertLegacyLogPayload(args) {
        const messageAs = self.apos.structuredLog.options.messageAs;
        if (!messageAs || args.length === 0) {
          return args;
        }
        // Already formatted by the structured log module. Nothing we can do if
        // not.
        if (args.length === 1 && _.isPlainObject(args[0])) {
          return args;
        }

        // Should also handle apos.util.warnDev() calls.
        const messageIndex = args
          .findIndex(arg => typeof arg === 'string' && arg.trim() && arg !== '\n⚠️ ');
        const firstObjectIndex = args.findIndex(arg => _.isPlainObject(arg));
        const message = messageIndex !== -1 ? args[messageIndex] : null;
        const firstObject = firstObjectIndex !== -1 ? { ...args[firstObjectIndex] } : {};

        if (message) {
          firstObject[messageAs] = message;
        }
        const rest = args
          .filter((arg, index) => ![ messageIndex, firstObjectIndex ].includes(index));
        if (rest.length) {
          firstObject.args = rest;
        }

        return [ firstObject ];
      }
    };
  },
  helpers(self) {
    return {

      // Turn the provided string into a string suitable for use as a slug.
      // ONE punctuation character normally forbidden in slugs may
      // optionally be permitted by specifying it via options.allow.
      // The separator may be changed via options.separator.

      slugify: function(string, options) {
        return self.slugify(string, options);
      },

      // Log a message from a Nunjucks template. Great for debugging.
      // Outputs nothing to the template. Invokes apos.util.log,
      // which by default invokes console.log.
      log: function(msg) {
        self.log.apply(self.apos, arguments);
        return '';
      },

      // Log the properties of the given object in detail.
      // Invokes `util.inspect` on the given object, down to a
      // depth of 10. Outputs nothing to the template.
      inspect: function(o) {
        self.log(util.inspect(o, { depth: 10 }));
        return '';
      },

      // Generate a globally unique ID
      generateId: function() {
        return self.generateId();
      },

      // Test whether the specified date object refers to a date in the current
      // year. The events module utilizes this

      isCurrentYear: function(date) {
        const now = new Date();
        return date.getYear() === now.getYear();
      },

      // check if something is properly undefined
      isUndefined: function(o) {
        return (o === undefined);
      },

      // check if something is strictly equal to false
      isFalse: function(o) {
        return (o === false);
      },

      // Convert string to start case (make default labels out of camelCase
      // property names)
      startCase: function(o) {
        return _.startCase(o);
      },

      // check if something is a function (as opposed to property)
      isFunction: function(o) {
        return (typeof o === 'function');
      },

      // make up for lack of triple equals
      eqStrict: function(a, b) {
        return (a === b);
      },

      // Returns true if the list contains the specified value.
      // If value is an array, returns true if the list contains
      // *any of* the specified values
      contains: function(list, value) {
        if (_.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const valueItem = value[i];
            if (_.includes(list, valueItem)) {
              return true;
            }
          }
          return false;
        } else {
          return _.includes(list, value);
        }
      },

      // Returns true if the list contains at least one
      // object with the named property.

      // The first parameter may also be a single object, in
      // which case this function returns true if that object
      // has the named property.

      containsProperty: function(list, property) {
        if (_.isArray(list)) {
          return _.some(list, function(item) {
            return _.has(item, property);
          });
        } else {
          return _.has(list, property);
        }
      },

      // Reverses the order of the array. This MODIFIES the array
      // in addition to returning it
      reverse: function(array) {
        return array.reverse();
      },

      // If the `list` argument is a string, returns true if it begins
      // with `value`. If the `list` argument is an array, returns
      // true if at least one of its elements begins with `value`.
      beginsWith: function(list, value) {
        if (_.isArray(list)) {
          for (let i = 0; i < list.length; i++) {
            const listItem = list[i];
            if (listItem.indexOf(value) === 0) {
              return true;
            }
          }
        } else {
          if (list.indexOf(value) === 0) {
            return true;
          }
        }
        return false;
      },

      // Find the first array element, if any, that has the specified value for
      // the specified property.

      find: function(arr, property, value) {
        return _.find(arr, function(item) {
          return (item[property] === value);
        });
      },

      // Find all the array elements, if any, that have the specified value for
      // the specified property.

      filter: function(arr, property, value) {
        return _.filter(arr, function(item) {
          return (item[property] === value);
        });
      },

      // Reject array elements that have the specified value for
      // the specified property.

      reject: function(arr, property, value) {
        return _.reject(arr, function(item) {
          return (item[property] === value);
        });
      },

      // Find all the array elements, if any, for which the specified property
      // is truthy.

      filterNonempty: function(arr, property) {
        return _.filter(arr, function(item) {
          return (item[property]);
        });
      },

      // Find all the array elements, if any, for which the specified property
      // is not truthy.

      filterEmpty: function(arr, property) {
        return _.filter(arr, function(item) {
          return (!item[property]);
        });
      },

      // Returns true if the specified array or object is considered empty.
      // Objects are empty if they have no own enumerable properties.
      // Arrays are considered empty if they have a length of 0.

      isEmpty: function(item) {
        return _.isEmpty(item);
      },

      // Given an array of objects with the given property, return an array with
      // the value of that property for each object.

      pluck: function(arr, property) {
        return _.map(arr, property);
      },

      // Given an object, return an object without
      // the named properties or array of named
      // properties (see _.omit()).

      omit: function(object, property /* , property... */) {
        return _.omit.apply(_, arguments);
      },

      // Given the arrays `array` and `without`, return
      // only the elements of `array` that do not occur
      // in `without`. If `without` is not an array it is
      // treated as an empty array.
      //
      // If `property` is present, then that property of
      // each element of array is compared to elements
      // of `without`. This is useful when `array` contains
      // full-blown choices with a `value` property, while
      // `without `just contains actual values.
      //
      // A deep comparison is performed with `_.isEqual`.

      difference: function(array, without, property) {
        return _.filter(Array.isArray(array) ? array : [], function(item) {
          return !_.find(without || [], function(other) {
            if (property) {
              return _.isEqual(item[property], other);
            } else {
              return _.isEqual(item, other);
            }
          });
        });
      },

      // Concatenate all of the given arrays and/or values
      // into a single array. If an argument is an array, all
      // of its elements are individually added to the
      // resulting array. If an argument is a value, it is
      // added directly to the array.

      concat: function(arrOrObj1, arrOrObj2 /* , ... */) {
        // I tried to implement this with call() but I kept
        // getting arrays in my values. We still get the
        // benefit of concat() and its built-in support for
        // treating arrays and scalar values differently. -Tom
        let result = [];
        let i;
        for (i = 0; (i < arguments.length); i++) {
          result = result.concat(arguments[i]);
        }
        return result;
      },

      // Groups by the property named by 'key' on each of the values.
      // If the property referred to by the string 'key' is found to be
      // an array property of the first object, apos.util.groupByArray is
      // called.
      //
      // Usage: {{ apos.util.groupBy(people, 'age') }} or {{
      // apos.util.groupBy(items, 'colors') }}
      groupBy: function(items, key) {
        if (items.length && Array.isArray(items[0][key])) {
          return groupByArray(items, key);
        }
        return _.groupBy(items, key);

        function groupByArray(items, arrayName) {
          const results = {};
          // looping over each item in the original array
          _.each(items, function(item) {
            // looping over each item in the array within the top level item
            _.each(item[arrayName] || [], function(inner) {
              if (!results[inner]) {
                results[inner] = [];
              }
              // grouping top level items on the sub properties
              results[inner].push(item);
            });
          });

          return results;
        }

      },

      // Given a series of alternating keys and values, this
      // function returns an object with those values for
      // those keys. For instance, apos.util.object('name', 'bob')
      // returns { name: 'bob' }. This is useful because
      // Nunjucks does not allow you to create an object with
      // a property whose name is unknown at the time the
      // template is written.
      object: function(/* key, value, ... */) {
        const o = {};
        let i = 0;
        while (i < arguments.length) {
          o[arguments[i]] = arguments[i + 1];
          i += 2;
        }
        return o;
      },

      // Pass as many objects as you want; they will get merged via
      // `_.merge` into a new object, without modifying any of them, and
      // the resulting object will be returned. If several objects have
      // a property, the last object wins.
      //
      // This is useful to add one more option to an options object
      // which was passed to you.
      //
      // If any argument is null, it is skipped gracefully. This allows
      // you to pass in an options object without checking if it is null.

      merge: function() {
        let result = {};
        let i;
        for (i = 0; (i < arguments.length); i++) {
          if (!arguments[i]) {
            continue;
          }
          result = _.merge(result, arguments[i]);
        }
        return result;
      }
    };
  }
};
