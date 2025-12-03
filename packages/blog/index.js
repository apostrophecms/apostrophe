const dayjs = require('dayjs');
const queries = require('./queries');

module.exports = {
  extend: '@apostrophecms/piece-type',
  bundle: {
    directory: 'modules',
    modules: [ '@apostrophecms/blog-page' ]
  },
  options: {
    label: 'aposBlog:label',
    pluralLabel: 'aposBlog:pluralLabel',
    sort: {
      publishedAt: -1,
      createdAt: -1
    },
    i18n: {
      ns: 'aposBlog',
      browser: true
    }
  },
  columns: {
    add: {
      publishedAt: {
        label: 'aposBlog:publishedAt'
      }
    }
  },
  fields: {
    add: {
      publishedAt: {
        label: 'aposBlog:publishedAt',
        type: 'date',
        required: true
      }
    },
    group: {
      basics: {
        fields: [ 'publishedAt' ]
      }
    }
  },
  filters: {
    add: {
      future: {
        label: 'aposBlog:futureArticles',
        def: null
      },
      year: {
        label: 'aposBlog:filterYear',
        def: null
      },
      month: {
        label: 'aposBlog:filterMonth',
        def: null
      },
      day: {
        label: 'aposBlog:filterDay',
        def: null
      }
    }
  },
  queries,
  extendMethods(self) {
    return {
      newInstance(_super) {
        const instance = _super();
        if (!instance.publishedAt) {
          instance.publishedAt = dayjs().format('YYYY-MM-DD');
        }

        return instance;
      }
    };
  }
};
