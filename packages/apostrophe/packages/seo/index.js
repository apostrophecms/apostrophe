const fs = require('fs');
const path = require('path');
const {
  getMetaHead, getTagManagerHead, getTagManagerBody
} = require('./lib/nodes');

module.exports = {
  options: {
    alias: 'seo',
    i18n: {
      ns: 'aposSeo',
      browser: true
    }
  },
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  init(self) {
    self.prependNodes('head', 'metaHead');
    self.appendNodes('head', 'tagManagerHead');
    self.prependNodes('body', 'tagManagerBody');
  },
  methods(self, options) {
    return {
      metaHead(req) {
        return getMetaHead(req.data, {
          ...options,
          buildPaginationUrl(data, pageNum) {
            const { page, filters = [] } = data;
            const baseUrl = page?._url || '/';

            // Find active filter
            for (const filter of filters) {
              const activeChoice = filter.choices?.find(c => c.active);
              if (activeChoice) {
                if (pageNum <= 1) {
                  return activeChoice._url;
                }
                return baseUrl + self.apos.url.getChoiceFilter(
                  filter.name, activeChoice.value, pageNum
                );
              }
            }

            if (pageNum <= 1) {
              return baseUrl;
            }
            return baseUrl + self.apos.url.getPageFilter(pageNum);
          }
        });
      },
      tagManagerHead(req) {
        return getTagManagerHead(req.data);
      },
      tagManagerBody(req) {
        return getTagManagerBody(req.data);
      },
      // Register a custom JSON-LD schema generator
      // schemaType: string - the schema type name (e.g., 'Book', 'SoftwareApplication')
      // schemaGenerator: function(data) - function that returns a schema object or null
      registerSchema(schemaType, schemaGenerator) {
        if (!self.customSchemas) {
          self.customSchemas = {};
        }
        self.customSchemas[schemaType] = schemaGenerator;
      },
      // Get all registered custom schemas
      getCustomSchemas() {
        return self.customSchemas || {};
      }
    };
  }
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}
