const fs = require('fs');
const path = require('path');

module.exports = {
  i18n: {
    aposFavicon: {
      browser: true
    }
  },
  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames()
  },
  init(self) {
    self.appendNodes('head', 'head');
  },
  methods(self) {
    return {
      head(req) {
        const doc = req.data.global;
        const attachment = self.apos.image.first(doc.favicon);
        if (!attachment) {
          return [];
        }
        const href = self.apos.attachment.url(attachment, { size: 'one-third' });
        if (!href) {
          return [];
        }
        return [
          // Android
          {
            name: 'link',
            attrs: {
              rel: 'icon',
              href
            }
          },
          // iOS
          {
            name: 'link',
            attrs: {
              rel: 'apple-touch-icon',
              href
            }
          }
        ];
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
