var _ = require('underscore');
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

  // Sanitize a URL via apos.fixUrl, which can figure out how to fix
  // a variety of URLs.

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
};

