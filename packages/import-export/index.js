const fs = require('node:fs');
const path = require('node:path');
const handlers = require('./lib/handlers.js');
const methods = require('./lib/methods/index.js');
const apiRoutes = require('./lib/apiRoutes.js');
const formats = require('./lib/formats/index.js');

module.exports = {
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  icons: {
    'database-import-icon': 'DatabaseImport'
  },
  options: {
    name: '@apostrophecms/import-export',
    i18n: {
      ns: 'aposImportExport',
      browser: true
    },
    preventUpdateAssets: false,
    importDraftsOnlyDefault: false
  },
  init(self) {
    self.formats = {
      ...formats,
      ...self.options.formats || {}
    };

    self.enableBrowserData();
    self.timeoutIds = {};
  },
  handlers,
  methods,
  apiRoutes
};

function getBundleModuleNames() {
  const source = path.join(__dirname, './modules/@apostrophecms');
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`);
}
