apos.define('apostrophe-browser-utils', {
  construct: function(self, options) {
    self.options = options;

    // If the current page in the browser is https:, make this
    // URL https: too.
    self.sslIfNeeded = function(url) {
      var ssl = (document.location.protocol === 'https:');
      if (ssl) {
        if (url.match(/^http:/)) {
          url = url.replace(/^http:/, 'https:');
        }
      }
      return url;
    };

    // KEEP IN SYNC WITH SERVER SIDE VERSION IN apostrophe.js
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

    // Convert other name formats such as underscore and camelCase to a hyphenated css-style
    // name.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.cssName = function(camel) {
      // Keep in sync with client side version
      var i;
      var css = '';
      var dash = false;
      var start = true;
      for (i = 0; (i < camel.length); i++) {
        var c = camel.charAt(i);
        var lower = ((c >= 'a') && (c <= 'z'));
        var upper = ((c >= 'A') && (c <= 'Z'));
        var digit = ((c >= '0') && (c <= '9'));
        if (!(lower || upper || digit)) {
          if (!start) {
            dash = true;
          }
          continue;
        }
        start = false;
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
          if ((i >= 2) && (camel.substr(i - 2, 2) === '--')) {
            css += '-';
          }
          dash = false;
        }
        css += c;
      }
      return css;
    };

    // Create an event name from one or more strings. The original strings can be
    // CSS names or camelized names, it makes no difference. The end result
    // is always in a consistent format.
    //
    // Examples:
    //
    // apos.eventName('aposChange', 'blog') ---> aposChangeBlog
    // apos.eventName('aposChangeEvents') ---> aposChangeEvents
    // apos.eventName('apos-jump-gleefully') ---> aposJumpGleefully
    //
    // It doesn't matter how many arguments you pass. Each new argument
    // is treated as a word boundary.
    //
    // This method is often useful both when triggering and when listening.
    // No need to remember the correct way to construct an event name.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.eventName = function() {
      var args = Array.prototype.slice.call(arguments, 0);
      return apos.camelName(args.join('-'));
    };

    // Widget ids should be valid names for javascript variables, just in case
    // we find that useful, so avoid hyphens. Prefixed with a `w` so it can
    // always be distinguished from a cuid that came from the server; if we
    // start using cuid in the browser we must keep the `w` prefix
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.generateId = function() {
      return 'w' + Math.floor(Math.random() * 1000000000) + Math.floor(Math.random() * 1000000000);
    };

    self.entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': '&quot;',
      "'": '&#39;',
      "/": '&#x2F;'
    };

    // Escape HTML as plaintext.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.
    self.escapeHtml = function(string) {
      return String(string).replace(/[&<>"'/]/g, function (s) {
        return self.entityMap[s];
      });
    };

    // String.replace does NOT do this
    // Regexps can but they can't be trusted with unicode ):
    // Keep in sync with server side version
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.globalReplace = function(haystack, needle, replacement) {
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
    };

    // pad an integer with leading zeroes, creating a string.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.padInteger = function(i, places) {
      var s = i + '';
      while (s.length < places) {
        s = '0' + s;
      }
      return s;
    };

    // Capitalize the first letter of a string.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.capitalizeFirst = function(s) {
      return s.charAt(0).toUpperCase() + s.substr(1);
    };

    // Turn the provided string into a string suitable for use as a slug.
    // ONE punctuation character normally forbidden in slugs may
    // optionally be permitted by specifying it via options.allow.
    // The separator may be changed via options.separator.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.slugify = function(s, options) {
      return sluggo(s, options);
    };

    // Clone the given object recursively, discarding all
    // properties whose names begin with `_` except
    // for `_id`. Returns the clone.
    //
    // This removes the output of joins and
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
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.clonePermanent = function(o, keepScalars) {
      var c;
      var isArray = Array.isArray(o);
      if (isArray) {
        c = [];
      } else {
        c = {};
      }

      function iterator(val, key) {
        // careful, don't crash on numeric keys
        if (typeof key === 'string') {
          if ((key.charAt(0) === '_') && (key !== '_id')) {
            if ((!keepScalars) || (typeof val === 'object')) {
              return;
            }
          }
        }
        if ((val === null) || (val === undefined)) {
          // typeof(null) is object, sigh
          c[key] = null;
        } else if (typeof (val) !== 'object') {
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
    };

    // Log a message. The default
    // implementation wraps `console.log` and passes on
    // all arguments, so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.log = function(msg) {
      if ((typeof window.console) === 'object') {
        window.console.log.apply(window.console, arguments);
      }
    };

    // Log an informational message. The default
    // implementation invokes
    // `console.info` if available, otherwise
    // an alias for `apos.utils.log`. Note that
    // substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.info = function(msg) {
      if ((typeof window.console) === 'object') {
        if (window.console.info) {
          window.console.info.apply(window.console, arguments);
          return;
        }
      }
      apos.utils.log.apply(apos, arguments);
    };

    // Log an error message. The default implementation
    // wraps `console.error` and passes on all arguments,
    // so substitution strings may be used.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.error = function(msg) {
      if ((typeof window.console) === 'object') {
        window.console.error.apply(window.console, arguments);
      }
    };

    // Log a warning. The default implementation wraps
    // `console.warn` and passes on all arguments,
    // so substitution strings may be used.
    // If `console.warn` does not exist, falls back
    // to `apos.utils.error`.
    //
    // Overrides should be written with support for
    // substitution strings in mind. See the
    // `console.log` documentation.
    //
    // The intention is that `apos.utils.warn` should be
    // called for situations less dire than
    // `apos.utils.error`.
    //
    // NOTE: this method is not available if `lean: true` is active
    // for `apostrophe-assets` and the user is not logged in.

    self.warn = function(msg) {
      if ((typeof window.console) === 'object') {
        if (window.console.warn) {
          window.console.warn.apply(window.console, arguments);
          return;
        }
      }
      apos.utils.error.apply(apos, arguments);
    };

  }
});
