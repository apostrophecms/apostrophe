var _ = require('@sailshq/lodash');

// Add a pageUrl filter to *all* cursors by implicitly
// subclassing apostrophe-cursor. This way all pages
// get a ._url property when loaded, unless explicitly
// shut off, even if they are mixed with docs that
// are not pages

module.exports = {
  construct: function(self, options) {
    // Filter. All docs that are part of the page tree (they have a slug
    // beginning with a `/`) receive a `._url` property, which takes the
    // sitewide prefix into account if necessary. Always use this property.
    // Never use the slug as a URL.
    //
    // This filter is turned on by default.
    //
    // Note that many type-specific cursors, such as those for `pieces`,
    // also add a `._url` property appropriate to type if a suitable
    // pieces page is available.

    self.addFilter('pageUrl', {
      def: true,
      after: function(results) {
        _.each(results, function(result) {
          if (result.slug && self.apos.pages.isPage(result)) {
            var url = self.apos.pages.getBaseUrl(self.get('req'));
            result._url = url + self.apos.prefix + result.slug;
          }
        });
      }
    });
  }
};
