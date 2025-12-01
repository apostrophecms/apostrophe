const fields = require('./fields');
const queries = require('./queries');
const methods = require('./methods');
const handlers = require('./handlers');

module.exports = {
  extend: '@apostrophecms/piece-type',

  options: {
    label: 'aposI18nStatic:label',
    pluralLabel: 'aposI18nStatic:pluralLabel',
    i18n: {
      ns: 'aposI18nStatic',
      browser: true
    },
    seoFields: false,
    openGraph: false,
    editRole: 'admin',
    publishRole: 'admin',
    excludeNamespaces: [],
    autopublish: true,
    quickCreate: false,
    showCreate: false,
    // Don't pollute project level slug namespace
    slugPrefix: 'i18n-static-'
  },

  filters: {
    add: {
      namespace: {
        label: 'aposI18nStatic:namespace',
        def: null
      }
    }
  },

  columns: {
    add: {
      namespace: {
        label: 'aposI18nStatic:namespace'
      },
      valueSingular: {
        label: 'aposI18nStatic:valueSingular'
      },
      valuePlural: {
        label: 'aposI18nStatic:valuePlural'
      }
    }
  },

  middleware(self) {
    return {
      async updateI18Next(req, res, next) {
        const aposLocale = `${req.locale}:${req.mode}`;
        self.i18nStaticIds = self.i18nStaticIds || {};

        if (self.i18nStaticIds[aposLocale] !== req.data.global.i18nStaticId) {
          const namespaces =
            (await self.apos.cache.get(req.locale, 'i18n-static')) ||
            (await self.findPiecesAndGroupByNamespace(aposLocale));

          for (const namespace of namespaces) {
            const ns = namespace._id;
            const resources = self.formatPieces(namespace.pieces);
            self.apos.i18n.i18next.addResourceBundle(req.locale, ns, resources, true, true);
          }
        }

        self.i18nStaticIds[aposLocale] = req.data.global.i18nStaticId;

        return next();
      }
    };
  },

  fields,
  queries,
  methods,
  handlers
};
