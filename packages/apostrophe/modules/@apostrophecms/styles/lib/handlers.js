const { createId } = require('@paralleldrive/cuid2');

module.exports = self => {
  return {
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
