var _ = require('lodash');
var extend = require('extend');
var XRegExp = require('xregexp').XRegExp;
_.str = require('underscore.string');

/**
 * search
 * @augments Augments the apos object with methods relating specifically to search.
 *
 * Apostrophe contains simple mechanisms for regex-based search which work surprisingly
 * well on projects up to a certain size. There comes a point where you'll want to
 * swap them out for something else, like elastic search.
 *
 */

module.exports = function(self) {
  // Turn the provided string into a string suitable for use as a slug.
  //
  // KEEP IN SYNC WITH BROWSER SIDE IMPLEMENTATION in user.js
  //
  // ONE punctuation character normally forbidden in slugs may optionally
  // be permitted by specifying it via options.allow. For implementation
  // reasons, this character may not be ʍ (upside sown lowercase m). That
  // character is always stripped out.

  self.slugify = function(s, options) {
    // Trim and deal with wacky cases like an array coming in without crashing
    s = self.sanitizeString(s);

    // Optimize a common case without paying the full performance price of i18n slugify
    if (s.match(/^[A-Za-z0-9]+(-[A-Za-z0-9]+)?$/)) {
      return s.toLowerCase();
    }

    // By default everything that matches the XRegExp groups
    // "Punctuation", "Separator", "Other" and "Symbol" becomes a dash.
    // You can change the separator with options.separator

    if (!options) {
      options = {};
    }

    if (!options.separator) {
      options.separator = '-';
    }

    if (options.allow) {
      // Temporarily convert the allowed punctuation character to ʍ, which is
      // not punctuation and thus won't be removed when we clean out punctuation.
      // If JavaScript had character class subtraction this would not be needed

      // First remove any actual instances of ʍ to avoid unexpected behavior
      s = s.replace(new RegExp(RegExp.quote('ʍ'), 'g'), '');

      // Now / (or whatever options.allow contains) becomes ʍ temporarily
      s = s.replace(new RegExp(RegExp.quote(options.allow), 'g'), 'ʍ');
    }

    var r = '[\\p{Punctuation}\\p{Separator}\\p{Other}\\p{Symbol}]';
    var regex = new XRegExp(r, 'g');
    s = XRegExp.replace(s, regex, options.separator);
    // Turn ʍ back into the allowed character
    if (options.allow) {
      s = s.replace(new RegExp(RegExp.quote('ʍ'), 'g'), options.allow);
    }
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

  // Returns a string that, when used for indexes, behaves
  // similarly to MySQL's default behavior for sorting, plus a little
  // extra tolerance of punctuation and whitespace differences. This is
  // in contrast to MongoDB's default "absolute match with same case only"
  // behavior which is no good for most practical purposes involving text.
  //
  // The use of this method to create sortable properties like
  // "sortTitle" is encouraged. It should not be used for full text
  // search, as MongoDB full text search is now available (see the
  // "search" option to apos.get and everything layered on top of it).
  // It is however used as part of our "autocomplete" search implementation.

  self.sortify = function(s) {
    return self.slugify(s, { separator: ' ' });
  };

  // Turns a user-entered search query into a regular expression, suitable
  // for filtering on the highSearchText property. If the string contains
  // multiple words, at least one space is required between them in matching
  // documents, but additional words may also be skipped between them, up to
  // a reasonable limit to preserve performance and avoid useless results.
  //
  // This method is still a critical part of our autocomplete implementation,
  // although we now use mongodb text indexing for full-text searches.
  // MongoDB text search is not useful for partial word matches.
  //
  // If the prefix flag is true the search matches only at the start.

  self.searchify = function(q, prefix) {
    q = self.sortify(q);
    if (prefix) {
      q = '^' + q;
    }
    q = q.replace(/ /g, ' .{0,20}?');
    q = new RegExp(q);
    return q;
  };

};

