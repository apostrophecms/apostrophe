var _ = require('lodash');
var extend = require('extend');
var sluggo = require('sluggo');
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
  // ONE punctuation character normally forbidden in slugs may optionally
  // be permitted by specifying it via options.allow. The separator
  // may be changed via options.separator.

  self.slugify = require('sluggo');

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

