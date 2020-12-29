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
        let fromPage = options.page - (Math.floor(options.shown / 2));

        if (fromPage > options.total - options.shown) {
          fromPage = options.total - options.shown;
        }

        if (fromPage < 2) {
          fromPage = 2;
        }

        for (let pg = fromPage; pg < fromPage + options.shown; pg++) {
          if (pg < options.total) {
            pages.push(pg);
          }
        }
        return pages;
      },
      showHeadGap: function (options) {
        if (options.shown % 2 === 0) {
          return ((options.page - (Math.floor(options.shown / 2))) > 2)
            && options.page > (options.shown - Math.floor(options.shown / 2));
        } else {
          return ((options.page - (Math.floor(options.shown / 2))) > 2)
            && (options.page >= (options.shown - Math.floor(options.shown / 2)));
        }
      },
      showTailGap(options) {
        if (options.shown % 2 === 0) {
          return options.page < (options.total - (options.shown - 2));
        } else {
          return options.page <= (options.total - (options.shown - 2));
        }
      }
    };
  }
};
