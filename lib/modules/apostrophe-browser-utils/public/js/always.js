apos.define('apostrophe-browser-utils', {
  construct: function(self, options) {
    self.options = options;
    apos.utils = self;

    // If the current page in the browser is https:, make this
    // URL https: too.
    self.sslIfNeeded = function(url) {
      var ssl = ('https:' === document.location.protocol);
      if (ssl) {
        if (url.match(/^http:/)) {
          url = url.replace(/^http:/, 'https:');
        }
      }
      return url;
    },

    // Locate the element matching the given selector
    // which also has the apos-template class. Clone it,
    // remove the apos-template class from the clone, and
    // return the clone.

    fromTemplate: function(sel, options) {
      options = options || {};

      var $item = $(sel).filter('.apos-template:first').clone();
      $item.removeClass('apos-template');
      return $item;
    },

    // Enhance a plaintext date field with a nice jquery ui date widget.
    // Just pass a jquery object referring to the text element as the
    // first argument.
    //
    // Uses the YYYY-MM-DD format we use on the back end.
    //
    // If $minFor is set, any date selected for $el becomes the
    // minimum date for $minFor. For instance, start_date should be the
    // minimum date for the end_date field.
    //
    // Similarly, if $maxFor is set, any date selected for $el becomes the maximum
    // date for $maxFor.

    enhanceDate: function($el, options) {
      if (!options) {
        options = {};
      }
      $el.datepicker({
        defaultDate: "+0w",
        dateFormat: 'yy-mm-dd',
        changeMonth: true,
        numberOfMonths: 1,
        onClose: function(selectedDate) {
          if (options.$minFor) {
            options.$minFor.datepicker( "option", "minDate", selectedDate);
          }
          if (options.$maxFor) {
            options.$maxFor.datepicker( "option", "maxDate", selectedDate);
          }
        }
      });
    },

    // Accepts a time in 24-hour HH:MM:SS format and returns a time
    // in the user's preferred format as determined by apos.data.timeFormat,
    // which may be either 24 or 12. Useful to allow 12-hour format editing
    // of times previously saved in the 24-hour format (always used on the back end).
    // Seconds are not included in the returned value unless options.seconds is
    // explicitly true. If options.timeFormat is set to 24 or 12, that format is
    // used, otherwise apos.data.timeFormat is consulted, which allows the format
    // to be pushed to the browser via apos.pushGlobalData on the server side
    //
    // For convenience, the values null, undefined and empty string are returned as
    // themselves rather than throwing an exception. This is useful when the absence of any
    // setting is an acceptable value.
    formatTime: function(time, options) {
      if ((time === null) || (time === undefined) || (time === '')) {
        return time;
      }
      if (!options) {
        options = {};
      }
      var timeFormat = options.timeFormat || apos.data.timeFormat || 12;
      var showSeconds = options.seconds || false;
      var matches, hours, minutes, seconds, tail;
      if (apos.data.timeFormat === 24) {
        if (showSeconds) {
          return time;
        } else {
          matches = time.match(/^(\d+):(\d+)(:(\d+))?$/);
          return matches[1] + ':' + matches[2];
        }
      } else {
        matches = time.match(/^(\d+):(\d+)(:(\d+))?$/);
        hours = parseInt(matches[1], 10);
        minutes = matches[2];
        seconds = matches[3];
        tail = minutes;
        if (showSeconds) {
          tail += ':' + seconds;
        }
        if (hours < 1) {
          return '12:' + tail + 'am';
        }
        if (hours < 12) {
          return apos.padInteger(hours, 2) + ':' + tail + 'am';
        }
        if (hours === 12) {
          return '12:' + tail + 'pm';
        }
        hours -= 12;
        return apos.padInteger(hours, 2) + ':' + tail + 'pm';
      }
    },

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

    camelName: function(s) {
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
    },

    // Convert everything else to a hyphenated css name. Not especially fast,
    // hopefully you only do this during initialization and remember the result
    // KEEP IN SYNC WITH SERVER SIDE VERSION in apostrophe.js
    cssName: function(camel) {
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
    },

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

    eventName: function() {
      var args = Array.prototype.slice.call(arguments, 0);
      return apos.camelName(args.join('-'));
    },

    // Widget ids should be valid names for javascript variables, just in case
    // we find that useful, so avoid hyphens

    generateId: function() {
      return 'w' + Math.floor(Math.random() * 1000000000) + Math.floor(Math.random() * 1000000000);
    },

    // mustache.js solution to escaping HTML (not URLs)
    entityMap: {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': '&quot;',
      "'": '&#39;',
      "/": '&#x2F;'
    },

    escapeHtml: function(string) {
      return String(string).replace(/[&<>"'\/]/g, function (s) {
        return apos.entityMap[s];
      });
    },

    // String.replace does NOT do this
    // Regexps can but they can't be trusted with unicode ):
    // Keep in sync with server side version

    globalReplace: function(haystack, needle, replacement) {
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
    },

    // pad an integer with leading zeroes, creating a string
    padInteger: function(i, places) {
      var s = i + '';
      while (s.length < places) {
        s = '0' + s;
      }
      return s;
    },

    /**
     * Capitalize the first letter of a string
     */
    capitalizeFirst: function(s) {
      return s.charAt(0).toUpperCase() + s.substr(1);
    },

    // Status of the shift key. Automatically updated.
    shiftActive: false;

  }
});
