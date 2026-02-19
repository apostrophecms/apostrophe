const { createId } = require('@paralleldrive/cuid2');

module.exports = self => {
  return {
    'apostrophe:modulesRegistered': {
      warnDeprecatedPalette() {
        const paletteModule = self.apos.modules['@apostrophecms-pro/palette'];
        if (paletteModule && !paletteModule?.tasks?.['migrate-to-styles']) {
          self.apos.util.warn(
            `
                       🎨
⚠️ @apostrophecms-pro/palette has been deprecated.
Please install the latest version of @apostrophecms-pro/palette and run the following migration task:

node app @apostrophecms-pro/palette:migrate-to-styles
                       🎨

`
          );
        }
      }
    },
    afterSave: {
      async mirrorToGlobal(req, doc, options) {
        // mirror the stylesheet to @apostrophecms/global
        const { css, classes } = self.getStylesheet(doc);
        const $set = {
          stylesStylesheet: css,
          stylesClasses: classes,
          stylesStylesheetVersion: createId()
        };
        return self.apos.doc.db.updateOne({
          type: '@apostrophecms/global',
          aposLocale: doc.aposLocale
        }, {
          $set
        });
      }
    },
    '@apostrophecms/page:beforeSend': {
      async addBodyClasses(req) {
        const classes = req.data.global?.stylesClasses || [];
        if (!classes.length) {
          return;
        }
        self.apos.template.addBodyClass(req, classes.join(' '));
      }
    },
    '@apostrophecms/url:getAllUrlMetadata': {
      // Provide a literal content entry so static builds
      // can include the dynamically generated stylesheet
      addStylesheetUrl(req, results) {
        if (!req.data.global?.stylesStylesheet) {
          return;
        }
        results.push({
          url: `${self.action}/stylesheet?version=${req.data.global.stylesStylesheetVersion}&aposLocale=${req.locale}:${req.mode}`,
          contentType: 'text/css',
          i18nId: '@apostrophecms/styles:stylesheet',
          sitemap: false
        });
      }
    }
  };
};
