const { createId } = require('@paralleldrive/cuid2');

module.exports = self => {
  return {
    'apostrophe:modulesRegistered': {
      warnDeprecatedPalette() {
        const paletteModule = self.apos.modules['@apostrophecms-pro/palette'];
        if (!paletteModule?.tasks?.['migrate-to-styles']) {
          self.apos.util.warn(
            `
                       🎨
⚠️ @apostrophecms-pro/palette has been deprecated.

Please install the latest version of @apostrophecms-pro/palette and run the following migration task to move your existing palette configuration to
@apostrophecms/styles: \`node app @apostrophecms-pro/palette:migrate-to-styles\`.
Then remove @apostrophecms-pro/palette from your project to avoid conflicts.
                       🎨

`
          );
        }
      }
    },
    afterSave: {
      async mirrorToGlobal(req, doc, options) {
        // mirror the stylesheet to @apostrophecms/global
        const stylesheet = self.getStylesheet(doc).css;
        const $set = {
          stylesStylesheet: stylesheet,
          stylesStylesheetVersion: createId()
        };
        return self.apos.doc.db.updateOne({
          type: '@apostrophecms/global',
          aposLocale: doc.aposLocale
        }, {
          $set
        });
      }
    }
  };
};
