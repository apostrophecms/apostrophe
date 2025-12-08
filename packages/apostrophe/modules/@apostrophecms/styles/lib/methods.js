const { createId } = require('@paralleldrive/cuid2');
const _ = require('lodash');

module.exports = (self) => {
  return {
    stylesheet(req) {
      // Stylesheet node should be created only for logged in users.
      if (!req.data.global) {
        return;
      }

      const nodes = [];
      // Only guests can't view drafts. This test is commonly used to
      // distinguish potential editors who might use breakpoint preview
      // and similar features from those who should just get the link tag
      const hasLink = !self.apos.permission.can(req, 'view-draft');
      if (req.data.global.stylesStylesheet && hasLink) {
        const href = `${self.action}/stylesheet?version=${req.data.global.stylesStylesheetVersion}&aposLocale=${req.locale}:${req.mode}`;
        nodes.push({
          name: 'link',
          attrs: {
            rel: 'stylesheet',
            href
          }
        });
      }
      nodes.push({
        name: 'style',
        attrs: {
          id: 'apos-styles-stylesheet'
        },
        body: [
          {
            text: req.data.global.stylesStylesheet
          }
        ]
      });
      return nodes;
    },
    ui(req) {
      return [
        {
          name: 'div',
          attrs: {
            id: 'apos-styles'
          }
        }
      ];
    },
    getStylesheet(doc) {
      return self.stylesheetRender(self.schema, doc);
    },
    addToAdminBar() {
      self.apos.adminBar.add(
        '@apostrophecms/styles',
        'apostrophe:stylesToggle',
        {
          action: 'edit',
          type: '@apostrophecms/styles'
        },
        {
          icon: 'palette-icon',
          contextUtility: true,
          tooltip: 'apostrophe:stylesOpen'
          // To put back when we support confirmation modal
          /* toggle: true */
          /* tooltip: { */
          /*   activate: 'apostrophe:stylesOpen' */
          /*   deactivate: 'apostrophe:stylesClose' */
          /* } */
        }
      );
    },
    addMigrations() {
      self.apos.migration.add('remove duplicate palettes', self.removeDuplicatePalettesMigration);
      self.apos.migration.add('migrate legacy global palette fields', () => {
        self.shouldMigrateLegacyGlobalPaletteFields = true;
      });
      self.apos.migration.add('migrate palette into styles', self.migratePaletteIntoStyles);
    },
    async removeDuplicatePalettesMigration() {
      // There was formerly a bug that permitted a profusion of palettes
      // to pop up with each startup
      const palettes = await self.apos.doc.db.find({
        type: '@apostrophecms-pro/palette'
      }).sort({ createdAt: -1 }).toArray();
      const newest = {};
      for (const palette of palettes) {
        if (!newest[palette.aposLocale]) {
          newest[palette.aposLocale] = palette;
        }
      }
      const keep = Object.values(newest).map(value => value._id);
      if (keep.length) {
        await self.apos.doc.db.removeMany({
          _id: {
            $nin: keep
          },
          type: self.name
        });
      }
    },
    // TODO: test this method:
    // Migrate existing A2 palette fields formerly stored in apostrophe-global pieces
    // (@apostrophecms/global pieces after A2 -> A3 migration)
    // into @apostrophecms/styles ones.
    async migrateLegacyGlobalPaletteFields() {
      const locales = Object.keys(self.apos.i18n.locales);
      const aposLocales = [
        ...locales.map(locale => `${locale}:draft`),
        ...locales.map(locale => `${locale}:published`)
      ].sort();

      const nonStylesFields = [
        'archived',
        ...Object.values(self.fieldsGroups)
          .flatMap(fieldsGroup => fieldsGroup.fields || [])
      ];

      const stylesFields = _.difference(Object.keys(self.fields), nonStylesFields);

      if (!stylesFields.length) {
        return;
      }

      const stylesFieldsProjection = stylesFields.reduce((memo, cur) => ({
        ...memo,
        [cur]: 1
      }), {});

      for (const aposLocale of aposLocales) {
        const [ globalDoc ] = await self.apos.doc.db
          .find({
            type: '@apostrophecms/global',
            aposLocale
          })
          .project(stylesFieldsProjection)
          .toArray();

        const { _id: globalDocId, ...a2GlobalPaletteFields } = globalDoc;

        if (!Object.keys(a2GlobalPaletteFields).length) {
          continue;
        }

        await self.apos.doc.db.updateOne(
          {
            type: self.name,
            aposLocale
          },
          { $set: a2GlobalPaletteFields }
        );

        const $set = {
          stylesStylesheet: await self.getStylesheet(globalDoc),
          stylesStylesheetVersion: createId()
        };

        // mirror the stylesheet to @apostrophecms/global
        await self.apos.doc.db.updateOne({ _id: globalDocId }, { $set });
      }
    },
    async migratePaletteIntoStyles() {
      await self.apos.doc.db.updateMany(
        { type: '@apostrophecms-pro/palette' },
        {
          $set: {
            type: '@apostrophecms/styles',
            slug: self.slug,
            title: 'styles'
          }
        }
      );
    }
  };
};
