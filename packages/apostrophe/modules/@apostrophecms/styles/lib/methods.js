const { createId } = require('@paralleldrive/cuid2');
const _ = require('lodash');
const presets = require('./presets');
const { klona } = require('klona');

module.exports = (self, options) => {
  return {
    // Public APIs

    // Extend this method to register custom presets,
    // Do not call this method directly.
    // Example (improve @apostrophecms/styles from npm package or project level):
    // extendMethods(self) {
    //   return {
    //     registerPresets(_super) {
    //       _super();
    //       self.setPreset('customPreset', { ... })
    //       // OR extend an existing one:
    //       const borderPreset = self.getPreset('border');
    //       borderPreset.fields.add.def = true;
    //       self.setPreset('border', borderPreset);
    //     }
    //   }
    // }
    registerPresets() {
      // noop by default
    },
    // Preset management. Can be called only
    // inside of extended registerPresets() method.
    setPreset(name, preset) {
      if (self.schema) {
        throw new Error(
          `Attempt to set preset ${name} after initialization.` +
          'Presets must be set inside of extended registerPresets() ' +
          'method of @apostrophecms/styles module.'
        );
      }
      self.validatePreset(preset);
      self.presets[name] = preset;
    },
    // Retrieve a preset by name.
    // Call only after presets have been registered.
    getPreset(name) {
      if (!self.presets) {
        throw new Error(
          'Presets have not been initialzed yet. ' +
          'Presets can be retrieved only after registration.'
        );
      }
      return self.presets[name];
    },
    hasPreset(name) {
      return !!self.getPreset(name);
    },
    expandStyles(stylesCascade) {
      const expanded = {};
      for (const [ key, value ] of Object.entries(stylesCascade)) {
        // shorthand, example:
        // border: 'border' -> border: { preset: 'border' }
        if (typeof value === 'string') {
          if (!self.hasPreset(value)) {
            throw new Error(`Unknown preset "${value}" used in styles schema for field "${key}"`);
          }
          expanded[key] = klona(self.getPreset(value));
          continue;
        }

        if (value?.preset) {
          if (!self.hasPreset(value.preset)) {
            throw new Error(`Unknown preset "${value.preset}" used in styles schema for field "${key}"`);
          }
          expanded[key] = Object.assign(
            klona(self.getPreset(value.preset)),
            value
          );
          delete expanded[key].preset;
          continue;
        }

        expanded[key] = value;
      }

      return expanded;
    },
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
    // Returns object with `css` (string) and `classes` (array) properties.
    // `css` contains full stylesheet that should be wrapped in
    // <style> tag.
    // `classes` contains array of class names that should be applied
    // to the <body> element (`class` attribute).
    getStylesheet(doc) {
      return self.stylesheetGlobalRender(self.schema, doc, {
        checkIfConditionsFn: self.styleCheckIfConditions
      });
    },
    // Returns object with `css` (string), `inline` (string) and `classes` (array)
    // properties.
    // `css` contains full stylesheet that should be wrapped in
    // <style> tag.
    // `inline` contains inline styles that should be applied to the
    // widget's wrapper element (`style` attribute).
    // `classes` contains array of class names that should be applied
    // to the widget's wrapper element (`class` attribute).
    // Options:
    // - rootSelector: string - custom root selector for scoped styles
    getWidgetStylesheet(schema, doc, options = {}) {
      return self.stylesheetScopedRender(schema, doc, {
        ...options,
        checkIfConditionsFn: self.styleCheckIfConditions
      });
    },
    // Generate unique ID, Invoke the widget owned `getStylesheet` method
    // and return object:
    // {
    //   css: '...',       // full stylesheet to go in <style> tag
    //   classes: [ ... ], // array of classes to go in wrapper `class` attribute
    //   inline: '...'     // inline styles to go in wrapper `style` attribute
    //   styleId: '...',   // ID for the style element and wrapper `id` attribute
    //   widgetId: '...'   // the widget's _id
    // }
    // It's used directly by @apostrophecms/widget-type module and it's proxied
    // as a styles helper for use in widget templates that opt out of
    // automatic stylesWrapper.
    prepareWidgetStyles(widget) {
      const widgetManager = self.apos.area.getWidgetManager(widget.type);
      if (!widgetManager) {
        return {
          css: '',
          classes: [],
          inline: '',
          styleId: '',
          widgetId: ''
        };
      }
      const styleId = self.apos.util.generateId();
      const styles = widgetManager.getStylesheet(
        widget,
        styleId
      );
      styles.styleId = styleId;
      styles.widgetId = widget._id;

      return styles;
    },
    // Renders style element for use inside widget templates.
    // Expects the result of prepareWidgetStyles() method as input.
    // Proxied as a style helper for use in widget templates that
    // opt out of automatic stylesWrapper.
    getWidgetElements(styles) {
      const { css, styleId } = styles || {};
      if (!css || !styleId) {
        return '';
      }
      return `<style data-apos-widget-style-for="${styleId}">\n` +
        css +
        '\n</style>';
    },
    // Renders attributes string for use inside widget templates.
    // Expects the result of prepareWidgetStyles() method as input.
    // Proxied as a style helper for use in widget templates that
    // opt out of automatic stylesWrapper.
    // Optional second argument `additionalAttrs` is an object with
    // additional attributes to merge. `class` and `style` attributes
    // are merged with the styles values, keeping classes unique.
    getWidgetAttributes(styles, additionalAttrs = {}) {
      const {
        classes, inline, styleId, widgetId
      } = styles || {};
      if (!styleId) {
        return '';
      }

      // Separate class and style from other additional attributes
      const {
        class: additionalClasses,
        style: additionalStyle,
        ...otherAttrs
      } = additionalAttrs;

      const attrs = [ `id="${styleId}"` ];
      attrs.push(
        `data-apos-widget-style-wrapper-for="${widgetId || ''}"`
      );

      // Merge classes, keeping them unique
      const classSet = new Set(classes || []);
      if (additionalClasses) {
        const extraClasses = Array.isArray(additionalClasses)
          ? additionalClasses
          : additionalClasses.split(/\s+/).filter(Boolean);
        extraClasses.forEach(cls => classSet.add(cls));
      }
      if (classSet.size) {
        attrs.push(`class="${[ ...classSet ].join(' ')}"`);
      }

      // Merge inline styles
      const styleParts = [];
      if (inline) {
        // Remove trailing semicolon to avoid double semicolons when joining
        styleParts.push(inline.replace(/;$/, ''));
      }
      if (additionalStyle) {
        // Remove trailing semicolon from additional style as well
        styleParts.push(additionalStyle.replace(/;$/, ''));
      }
      if (styleParts.length) {
        attrs.push(`style="${styleParts.join(';')};"`);
      }

      // Add other additional attributes
      for (const [ key, value ] of Object.entries(otherAttrs)) {
        if (value !== undefined && value !== null) {
          attrs.push(`${key}="${value}"`);
        }
      }

      return attrs.join(' ');
    },

    // Internal APIs

    // Do not call this method directly.
    // Called only once inside of composeSchema() method.
    // Sets up standard presets.
    setStandardPresets() {
      for (const [ name, preset ] of Object.entries(presets(options))) {
        self.setPreset(name, preset);
      }
    },
    ensureNoFields() {
      if (
        Object.keys(self.fields || {}).length &&
        Object.keys(self.styles || {}).length
      ) {
        throw new Error(
          'The @apostrophecms/styles module does not support standard schema ' +
          'fields and style fields at the same time. ' +
          'Remove the "fields" property from the module configuration ' +
          'and use the "styles" configuration only.'
        );
      }
    },
    // basic duck typing to help the developer do the right thing
    validatePreset(preset) {
      if (!preset?.type) {
        throw new Error('Preset must be an object with a "type" property.');
      }
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
          stylesStylesheet: await self.getStylesheet(globalDoc).css,
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
