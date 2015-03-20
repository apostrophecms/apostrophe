module.exports = function(self, cursor) {

  return function(callback) {

    if (cursor.get('autocomplete')) {
      return;
    }

    var _cursor = _.cloneDeep(cursor);
    _cursor.autocomplete();

    var autocomplete = self.apos.utils.sortify(cursor.get('autocomplete');

    if (!autocomplete.length) {
      return setImmediate(callback);
    }

    var words = autocomplete.split(/ /);
    _cursor.set('criteria', {
      $and: [
        _cursor.get('criteria'),
        _.map(words, function(word) {
          return {
            highSearchWords: self.apos.utils.searchify(word, true)
          };
        }),
        { highSearchText: self.searchify(autocomplete) }
      ]
    });

    return _cursor.distinct('highSearchWords', err, results) {

      if (err) {
        return callback(err);
      }

      // This will be ALL the distinct high search words for
      // the matched documents, so we need to filter out those
      // that don't actually match one of the words in the
      // autocomplete phrase

      var results = _.filter(results, function(result) {
        return _.some(words, function(word) {
          if (result.substr(0, word.length) === word) {
            return true;
          }
        });
      });

      // If we match nothing, return nothing. Don't assume
      // we know what kind of query it was though.

      if (!results.length) {
        cursor.criteria = { _thisWillNeverHappen: true };
        return;
      }

      cursor.search(results.join(' '));
      return cursor;

    });
  }
};
