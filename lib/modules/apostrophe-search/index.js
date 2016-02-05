var _ = require('lodash');

module.exports = {
  alias: 'search',

  construct: function(self, options) {
    self.docBeforeSave = function(req, doc) {
      var page;
      var prior;

      // Index the doc
      var texts = self.getSearchTexts(doc);
      // These texts have a weight property so they are ideal for feeding
      // to something better, but for now we'll prep for a dumb, simple regex search
      // via mongo that is not aware of the weight of fields. This is pretty
      // slow on big corpuses but it does have the advantage of being compatible
      // with the presence of other criteria. Our workaround for the lack of
      // really good weighting is to make separate texts available for searches
      // based on high-weight fields and searches based on everything

      // Make sure our texts aren't empty before we try to jam them into anything
      _.each(texts, function(text){
        if(text.text === undefined) {
          text.text = '';
        }
      });

      // Individual widget types play with weights a little, but the really
      // big numbers are reserved for metadata fields. Look for those
      var highTexts = _.filter(texts, function(text) {
        return text.weight > 10;
      });

      var searchSummary = _.map(_.filter(texts, function(text) { return !text.silent; } ), function(text) { return text.text; }).join(" ");
      var highText = self.boilTexts(highTexts);
      var lowText = self.boilTexts(texts);
      var titleSortified = self.apos.utils.sortify(doc.title);
      var highWords = _.uniq(highText.split(/ /));

      // merge our doc with its various search texts
      _.assign(doc, {
        titleSortified: titleSortified,
        highSearchText: highText,
        highSearchWords: highWords,
        lowSearchText: lowText,
        searchSummary: searchSummary
      });
    }

    // Returns texts which are a reasonable basis for
    // generating search results for this page. Should return
    // an array in which each entry is an object with
    // 'weight' and 'text' properties. 'weight' is a measure
    // of relative importance. 'text' is the text associated
    // with that chunk of content.

    self.getSearchTexts = function(doc) {
      var texts = [];
      // Shown separately, so don't include it in the summary
      texts.push({ weight: 100, text: doc.title, silent: true });
      // Usually redundant to the text of the page, so don't
      // show it in the description, but it's highly-weighted stuff
      // because we use it as the summary in a google search
      // result
      texts.push({ weight: 100, text: doc.seoDescription, silent: true });
      // The slug often reveals more useful search-targeting information
      texts.push({ weight: 100, text: doc.slug, silent: true });
      // Not great to include in the summary either
      texts.push({ weight: 100, text: (doc.tags || []).join("\n"), silent: true });

      // This event is an opportunity to add custom texts for
      // various types of pages
      self.apos.emit('docSearchIndex', doc, texts);

      // Areas can be schemaless so find them automatically
      self.apos.areas.walk(doc, function(area, dotPath) {
        // Do not examine areas accessed via temporarily
        // joined information, such as snippets in a snippet
        // widget. Allow those items to be found on their
        // own as search results, and avoid bloating the
        // search text up to the 16MB limit as happened on DR
        if (dotPath.match(/\._\w/)) {
          return;
        }
        _.each(area.items, function(item) {
          var manager = self.apos.areas.getWidgetManager(item.type);
          if (!manager) {
            console.error('item has no type or manager for type ' + item.type + ' does not exist, giving up on indexing it for search');
            return;
          }
          if (manager.addSearchTexts) {
            manager.addSearchTexts(item, texts);
          }
        });
      });

      return texts;
    };

    self.boilTexts = function(texts) {
      var text = _.reduce(texts, function(memo, text) {
        return memo + ' ' + text.text;
      }, '');
      text = self.apos.utils.sortify(text);
      return text;
    };

    // Invoked by the apostrophe-versions module.
    // Identify fields that should never be rolled back

    self.docUnversionedFields = function(req, doc, fields) {
      // Moves in the tree have knock-on effects on other
      // pages, they are not suitable for rollback
      fields.push('titleSortified', 'highSearchText', 'highSearchWords', 'lowSearchText', 'searchSummary');
    };

  }
}
