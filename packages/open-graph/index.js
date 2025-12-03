const fs = require('fs');
const path = require('path');
const { getTags } = require('./lib/nodes');

module.exports = {
  options: {
    alias: 'openGraph',
    i18n: {
      ns: 'aposOg',
      browser: true
    }
  },
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  init(self) {
    self.appendNodes('head', 'tags');
    if (!self.apos.baseUrl) {
      self.apos.util.warnDevOnce(
        'aposOgBaseUrl',
        '⚠️ You do not have the `baseUrl` value set for this application. The Open Graph image will not work correctly without this set.'
      );
    }
  },
  methods(self) {
    return {
      tags(req) {
        return getTags(req.data, self.apos);
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
