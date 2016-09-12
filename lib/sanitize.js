var _ = require('lodash');
var sanitize = require('validator').sanitize;
var moment = require('moment');

/**
 * sanitize
 * @augments Augments the apos object with methods that sanitize user input,
 * with a strong bias toward supplying a reasonable value. Also related convenience
 * methods which manipulate the results or provide the underpinnings for the
 * sanitization methods and may be used directly.
 */

module.exports = function(self) {
  // Simple string sanitization so junk submissions can't crash the app. Converts numbers to strings.
  // Converts other non-string types to the empty string.
  // Returns the value of `def` if the string is empty.
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

  // Sanitize a URL via apos.fixUrl, which can figure out how to fix
  // a variety of common errors in entering URLs.

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

  // Fix common errors in URLs.
  //
  // Accepts valid http, https and ftp absolute and relative URLs, as well as mailto: URLs. If the URL smells like
  // it starts with a domain name, supplies an http:// prefix.
  //
  // There is a browser-side version in editor.js which is kept in sync.

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

  // Sanitize a select element. If the value is not one of the choices, returns `def`.
  // choices may be either an array of allowable values or an array of objects
  // with `value` properties.
  self.sanitizeSelect = function(s, choices, def) {
    if (!choices.length) {
      return def;
    }
    if (typeof(choices[0]) === 'object') {
      if (_.find(choices, function(choice) {
        return choice.value === s;
      })) {
        return s;
      }
      return def;
    }
    if (!_.contains(choices, s)) {
      return def;
    }
    return s;
  };

  // Sanitize a boolean value:
  //
  // Accepts true, 'true', 't', '1', 1 as `true`.
  //
  // Accepts everything else as false.
  //
  // If nothing is submitted the default (def) is returned.
  //
  // If def is undefined the default is `false`.
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
  // `def` defaults to `any`.
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

  // Sanitize an integer. The value is clamped to be between `min` and `max` if
  // those arguments are not undefined.

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


  // Sanitize a floating point number. The value is clamped to be between `min` and `max` if
  // those arguments are not undefined.

  self.sanitizeFloat = function(i, def, min, max) {
    if (def === undefined) {
      def = 0;
    }
    if (typeof(i) === 'number') {
      if (isNaN(i)) {
        i = def;
      } else {
        // Great
      }
    }
    else
    {
      try {
        i = parseFloat(i, 10);
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

  // Given a date object, return a date string in Apostrophe's preferred sortable, comparable, JSON-able format,
  // which is YYYY-MM-DD. If `date` is undefined the current date is used.
  self.formatDate = function(date) {
    return moment(date).format('YYYY-MM-DD');
  };

  // Accepts a user-entered string in 12-hour or 24-hour time and returns a string
  // in 24-hour time. This method is tolerant of syntax such as `4pm`; minutes and
  // seconds are optional.
  //
  // If `def` is not set the default is the current time.

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
  // See apos.sanitizeTime for an easy way to get a time into the
  // appropriate input format.

  self.parseTime = function(time) {
    var components = time.match(/^(\d\d):(\d\d)(:(\d\d))$/);
    return {
      hours: time[1],
      minutes: time[2],
      seconds: time[3] || 0
    };
  };

  // Given a JavaScript Date object, return a time string in
  // Apostrophe's preferred sortable, comparable, JSON-able format:
  // 24-hour time, with seconds.
  //
  // If `date` is missing the current time is used.

  self.formatTime = function(date) {
    return moment(date).format('HH:mm:ss');
  };

  // Sanitize tags. Tags should be submitted as an array of strings.
  // This method ensures the array is an array and the items in the
  // array are strings. This method may also be used to sanitize
  // an array of IDs.
  //
  // If a filterTag function is passed as an option when initializing
  // Apostrophe, then all tags are passed through it (as individual
  // strings, one per call) and the return value is used instead. This
  // is useful if you wish to force all-uppercase or all-lowercase
  // tags for a particular project. Be sure to update any existing
  // database entries for tags before making such a change.

  self.sanitizeTags = function(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    tags = _.map(tags, function(tag) {
      if (typeof(tag) === 'number') {
        tag = tag.toString();
      }
      return tag;
    });
    tags = _.filter(tags, function(tag) {
      return (typeof(tag) === 'string');
    });
    if (self.filterTag) {
      tags = _.map(tags, self.filterTag);
    }
    return tags;
  };

  // Sanitize an id. IDs must consist solely of upper and lower case
  // letters and numbers, digits, and underscores.
  self.sanitizeId = function(s, def) {
    var id = self.sanitizeString(s, def);
    if (id === def) {
      return id;
    }
    if (!id.match(/^[A-Za-z0-9\_]+$/)) {
      return def;
    }
    return id;
  };

  // Sanitize an array of IDs. IDs must consist solely of upper and lower case
  // letters and numbers, digits, and underscores. Any elements that are not
  // IDs are omitted from the final array.
  self.sanitizeIds = function(ids) {
    if (!Array.isArray(ids)) {
      return [];
    }
    var result = [];
    _.each(ids, function(id) {
      id = self.sanitizeId(id);
      if (id === undefined) {
        return;
      }
      result.push(id);
    });
    return result;
  };

  // Sanitize an array of strings, simply to ensure they are strings.
  // Empty strings are allowed.
  self.sanitizeStrings = function(strings) {
    if (!Array.isArray(strings)) {
      return [];
    }
    return _.map(strings, function(s) {
      return self.sanitizeString(s);
    });
  };
};
