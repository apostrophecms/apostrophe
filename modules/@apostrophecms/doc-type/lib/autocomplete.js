module.exports = function(self, query) {
  return {
    launder(s) {
      return self.apos.launder.string(s);
    },
    async prefinalize() {

      // Happens in 3 phases:
      // 1. Clone query and do a distinct query for
      // the proper words.
      // 2. Add a search query, remove the
      // autocomplete query, and return.
      // 3. Search query completes (we are out of the
      // picture at this point).

      let autocomplete = query.get('autocomplete');

      if (!autocomplete) {
        return;
      }

      autocomplete = self.apos.util.sortify(autocomplete);

      if (!autocomplete.length) {
        return;
      }

      let words = autocomplete.split(/ /);
      if (!words.length) {
        return;
      }

      query.autocomplete(undefined);

      const subquery = query.clone();

      let clauses = [];

      if (query.get('criteria')) {
        clauses.push(query.get('criteria'));
      }

      clauses = clauses.concat(
        words.map(word => {
          return {
            highSearchWords: self.apos.util.searchify(word, true)
          };
        })
      );

      clauses.push(
        { highSearchText: self.apos.util.searchify(autocomplete) }
      );

      subquery.criteria({ $and: clauses });

      let results = await subquery.toDistinct('highSearchWords');

      // This will be ALL the distinct high search words for
      // the matched documents, so we need to filter out those
      // that don't actually match one of the words in the
      // autocomplete phrase

      results = results.filter(result => words.find(word => result.substr(0, word.length) === word));

      // If we match nothing, return nothing. Don't assume
      // we know what kind of query it was though.

      if (!results.length) {
        query.set('criteria', { _id: '__thisWillNeverMatcha9h3r9238hraaegw' });
        return;
      }

      query.search(results.join(' '));
      query.autocomplete(undefined);
    }
  };
};
