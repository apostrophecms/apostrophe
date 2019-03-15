var _ = require('lodash');

module.exports = function(self) {

  return async function() {

    // Happens in 3 phases:
    // 1. Clone cursor and do a distinct query for
    // the proper words.
    // 2. Add a search query, remove the
    // autocomplete query, and return.
    // 3. Search query completes (we are out of the
    // picture at this point).

    let autocomplete = self.get('autocomplete');

    if (!autocomplete) {
      return;
    }

    autocomplete = self.apos.utils.sortify(autocomplete);

    if (!autocomplete.length) {
      return;
    }

    var words = autocomplete.split(/ /);
    if (!words.length) {
      return;
    }

    self.autocomplete(undefined);

    var cursor = self.clone();

    var clauses = [];

    if (self.get('criteria')) {
      clauses.push(self.get('criteria'));
    }

    clauses = clauses.concat(
      words.map(word => {
        return {
          highSearchWords: self.apos.utils.searchify(word, true)
        };
      })
    );

    clauses.push(
      { highSearchText: self.apos.utils.searchify(autocomplete) }
    );

    cursor.criteria({ $and: clauses });

    let results = await cursor.toDistinct('highSearchWords');

    // This will be ALL the distinct high search words for
    // the matched documents, so we need to filter out those
    // that don't actually match one of the words in the
    // autocomplete phrase

    results = _.filter(results, function(result) {
      return _.some(words, function(word) {
        if (result.substr(0, word.length) === word) {
          return true;
        }
      });
    });

    // If we match nothing, return nothing. Don't assume
    // we know what kind of query it was though.

    if (!results.length) {
      self.set('criteria', { _id: '__thisWillNeverMatcha9h3r9238hraaegw' });
      return;
    }

    self.search(results.join(' '));
    self.autocomplete(undefined);
  };
};
