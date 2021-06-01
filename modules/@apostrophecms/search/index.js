// Implement document indexing for ApostropheCMS search. See also
// the `search` query builder of `@apostrophecms/doc-type`, which relies
// on the work done by this module. Search is powered by the full-text
// search features of MongoDB.

const _ = require('lodash');

module.exports = {

  extend: '@apostrophecms/page-type',

  options: {
    alias: 'search'
  },

  handlers(self) {
    return {
      '@apostrophecms/doc-type:beforeSave': {
        indexDoc(req, doc) {
          return self.indexDoc(req, doc);
        }
      }
    };
  },

  methods(self) {
    return {
      // Update the search-related properties of `doc` based on its current
      // content
      indexDoc(req, doc) {
        const texts = self.getSearchTexts(doc);

        _.each(texts, function (text) {
          if (text.text === undefined) {
            text.text = '';
          }
        });

        // Find texts relevant for autocomplete. A compromise to avoid
        // an excessively large highSearchWords array since MongoDB
        // text search cannot do this natively for us
        const highTexts = _.filter(texts, function (text) {
          return text.weight > 10;
        });

        // For display purposes. Not used in the default implementation
        // of the search index page template, but it can be convenient to have
        // all of the search-worthy text in a single string
        const searchSummary = _.map(_.filter(texts, function (text) {
          return !text.silent;
        }), function (text) {
          return text.text;
        }).join(' ');
        const highText = self.boilTexts(highTexts);
        const lowText = self.boilTexts(texts);
        const titleSortified = self.apos.util.sortify(doc.title);
        const highWords = _.uniq(highText.split(/ /));

        // merge our doc with its various search texts
        _.assign(doc, {
          titleSortified: titleSortified,
          highSearchText: highText,
          highSearchWords: highWords,
          lowSearchText: lowText,
          searchSummary: searchSummary
        });
      },

      // Re-indexes just one document as part of the implementation of the
      // `@apostrophecms/search:index` task. This isn't the method you want to
      // override. See `indexDoc` and `getSearchTexts`
      async indexTaskOne(req, doc) {
        self.indexDoc(req, doc);
        return self.apos.doc.db.updateOne({ _id: doc._id }, doc);
      },

      // Returns texts which are a reasonable basis for
      // generating search results for this page. Should return
      // an array in which each entry is an object with
      // 'weight' and 'text' properties. 'weight' is a measure
      // of relative importance. 'text' is the text associated
      // with that chunk of content.

      getSearchTexts(doc) {
        const texts = [];
        // Shown separately, so don't include it in the summary
        texts.push({
          weight: 100,
          text: doc.title,
          silent: true
        });
        // Usually redundant to the text of the page, so don't
        // show it in the description, but it's highly-weighted stuff
        // because we use it as the summary in a google search
        // result
        texts.push({
          weight: 100,
          text: doc.seoDescription,
          silent: true
        });
        // The slug often reveals more useful search-targeting information
        texts.push({
          weight: 100,
          text: doc.slug,
          silent: true
        });
        return texts;
      },

      // Reduces array of texts to a single space-separated string, passes the result
      // through apos.util.sortify to eliminate unwanted characters and case differences

      boilTexts(texts) {
        let text = _.reduce(texts, function (memo, text) {
          return memo + ' ' + text.text;
        }, '');
        text = self.apos.util.sortify(text);
        return text;
      },

      // Invoked by the @apostrophecms/version module.
      // Identify fields that should never be rolled back

      docUnversionedFields(req, doc, fields) {
        fields.push('titleSortified', 'highSearchText', 'highSearchWords', 'lowSearchText', 'searchSummary');
      }
    };
  },
  tasks(self) {
    return {
      index: {
        usage: 'Rebuild the search index. Normally this happens automatically.\nThis should only be needed if you have changed the\n"searchable" property for various fields or types.',
        task(argv) {
          const req = self.apos.task.getReq();
          return self.apos.migration.eachDoc({}, _.partial(self.indexTaskOne, req));
        }
      }
    };
  }
};
