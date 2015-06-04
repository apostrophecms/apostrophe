module.exports = {
  construct: function(self, options) {
    self.apos.templates.addToApos({
      pager: {
        // Generate the right range of page numbers to display in the pager.
        // Just a little too much math to be comfortable in pure Nunjucks
        pageRange: function(options) {
          var pages = [];
          var fromPage = options.page - 2;
          if (fromPage < 2) {
            fromPage = 2;
          }
          for (var page = fromPage; (page < (fromPage + options.shown)); page++) {
            pages.push(page);
          }
          return pages;
        }
      }
    });
  }
}