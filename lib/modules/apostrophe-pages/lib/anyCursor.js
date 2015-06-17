var _ = require('lodash');

// Add a pageUrl filter to *all* cursors by implicitly
// subclassing apostrophe-cursor. This way all pages
// get a ._url property when loaded, unless explicitly
// shut off, even if they are mixed with docs that
// are not pages

module.exports = {
  construct: function(self, options) {
    self.addFilter('pageUrl', {
      def: true,
      after: function(results) {
        _.each(results, function(result) {
          if (result.slug && (result.slug.match(/^\//))) {
            result._url = self.apos.prefix + result.slug;
          }
        });
      }
    });
  }
};
