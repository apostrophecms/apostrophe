const { createId } = require('@paralleldrive/cuid2');

module.exports = self => {
  return {
    '@apostrophecms/doc:afterReplicate': {
      async migrateLegacyGlobalPaletteFields() {
        if (self.shouldMigrateLegacyGlobalPaletteFields) {
          await self.migrateLegacyGlobalPaletteFields();
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
    }
  };
};
