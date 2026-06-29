// @apostrophecms/font-size
//
// Adds a free-form "size" tool to the ApostropheCMS rich text editor toolbar,
// letting editors set the font size (in pixels) of selected text. It is
// delivered by *improving* the core `@apostrophecms/rich-text-widget` module
// rather than shipping in core, so the feature can be installed only in the
// products that want it.
//
// The improve does three things:
//   - registers the `size` editor tool (Vue component + tiptap extension),
//   - adds it to the rich text default toolbar (unless
//     `addFontSizeToDefaultToolbar` is false),
//   - extends the widget's server-side sanitize-html allowlists so the
//     resulting `<span style="font-size: ...px">` markup survives sanitizing,
//     but only for areas where the `size` tool is actually enabled.

// Only a number (integer or decimal) followed by `px` is permitted as a
// font-size value. This is the server-side gatekeeper for the tool's output.
const fontSizePattern = /^\d*\.?\d+px$/i;

module.exports = {
  improve: '@apostrophecms/rich-text-widget',
  i18n: {
    aposFontSize: {
      browser: true
    }
  },
  // NOTE: because this module *improves* @apostrophecms/rich-text-widget, the
  // options below become options of THAT module — this improvement has no
  // separate existence and cannot be configured on its own. Project-level
  // configuration must therefore be set on `@apostrophecms/rich-text-widget`,
  // and the option names are deliberately specific (e.g.
  // `addFontSizeToDefaultToolbar`) so they do not collide with options
  // introduced by other modules that may also improve the rich text widget.
  options: {
    // Preset pixel sizes offered by the "size" tool. The amount remains
    // free-form; these are simply quick choices. Set to an empty array to
    // offer only the free-form input.
    fontSizes: [ 12, 14, 16, 18, 24, 32, 48 ],
    // By default the tool is added to the rich text default toolbar so it
    // works as soon as the module is installed. Set to false to leave it out
    // and opt in per area via the `toolbar` option instead.
    addFontSizeToDefaultToolbar: true
  },
  icons: {
    'format-size-icon': 'FormatSize'
  },
  beforeSuperClass(self) {
    // Register the toolbar tool alongside the core tools.
    self.options.editorTools = {
      ...self.options.editorTools,
      size: {
        component: 'AposTiptapFontSize',
        label: 'aposFontSize:fontSize',
        command: 'setFontSize'
      }
    };
  },
  init(self) {
    // Make the tool available in the default toolbar out of the box. By this
    // point the core module's beforeSuperClass has composed `defaultOptions`.
    if (self.options.addFontSizeToDefaultToolbar === false) {
      return;
    }
    const toolbar = self.options.defaultOptions && self.options.defaultOptions.toolbar;
    if (Array.isArray(toolbar) && !toolbar.includes('size')) {
      self.options.defaultOptions.toolbar = [ ...toolbar, 'size' ];
    }
  },
  extendMethods(self) {
    return {
      // Expose the configured presets to the editor UI.
      getBrowserData(_super, req) {
        const data = _super(req);
        data.fontSizes = self.options.fontSizes;
        return data;
      },
      // The next three methods extend the rich text widget's sanitize-html
      // allowlists so a `<span style="font-size: ...">` survives, but only
      // when the `size` tool is enabled for the area being sanitized.
      toolbarToAllowedTags(_super, options) {
        const tags = _super(options);
        if (self.combinedItems(options).includes('size') && !tags.includes('span')) {
          tags.push('span');
        }
        return tags;
      },
      toolbarToAllowedAttributes(_super, options) {
        const attributes = _super(options);
        if (self.combinedItems(options).includes('size')) {
          attributes['*'] = attributes['*'] || [];
          if (!attributes['*'].includes('style')) {
            attributes['*'].push('style');
          }
        }
        return attributes;
      },
      toolbarToAllowedStyles(_super, options) {
        const styles = _super(options);
        if (self.combinedItems(options).includes('size')) {
          styles['*'] = styles['*'] || {};
          styles['*']['font-size'] = (styles['*']['font-size'] || [])
            .concat([ fontSizePattern ]);
        }
        return styles;
      }
    };
  }
};
