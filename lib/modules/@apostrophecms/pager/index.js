// Provides markup, a Nunjucks helper and styles for a simple pager,
// used for pagination both on the front end and the back end.

module.exports = {
  options: { alias: 'pager' },
  helpers(self, options) {
    return {
      // Generate the right range of page numbers to display in the pager.
      // Just a little too much math to be comfortable in pure Nunjucks
      pageRange: function (options) {
        const pages = [];
        let fromPage = options.page - 2;
        if (fromPage < 2) {
          fromPage = 2;
        }
        for (let page = fromPage; page < fromPage + options.shown; page++) {
          pages.push(page);
        }
        return pages;
      }
    };
  }
};
