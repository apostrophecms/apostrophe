// Implements rich text editor widgets. Unlike most widget types, the rich text
// editor does not use a modal; instead you edit in context on the page.

const _ = require('lodash');
const sanitizeHtml = require('sanitize-html');
const jsDiff = require('diff');

module.exports = {
  extend: '@apostrophecms/widget-type',
  options: {
    label: 'Rich Text',
    contextual: true,
    defaultData: { content: '' },
    className: 'apos-rich-text-widget',
    minimumDefaultOptions: {
      toolbar: [
        'styles',
        'bold',
        'italic',
        'strike',
        'link',
        '|',
        'bullet_list',
        'ordered_list',
        'blockquote',
        'code_block',
        '|',
        'horizontal_rule',
        '|',
        'undo',
        'redo'
      ],
      styles: [
        // you may also use a `class` property with these
        {
          tag: 'p',
          label: 'Paragraph (P)'
        },
        {
          tag: 'h2',
          label: 'Heading 2 (H2)'
        },
        {
          tag: 'h3',
          label: 'Heading 3 (H3)'
        },
        {
          tag: 'h4',
          label: 'Heading 4 (H4)'
        }
      ]
    },
    defaultOptions: {},
    browser: {
      components: {
        widgetEditor: 'ApostropheRichTextWidgetEditor',
        widget: 'ApostropheRichTextWidget'
      },
      tools: {
        styles: {
          component: 'ApostropheTiptapStyles',
          label: 'Styles'
        },
        '|': { component: 'ApostropheTiptapDivider' },
        bold: {
          component: 'ApostropheTiptapButton',
          label: 'Bold',
          icon: 'format-bold-icon'
        },
        italic: {
          component: 'ApostropheTiptapButton',
          label: 'Italic',
          icon: 'format-italic-icon'
        },
        horizontal_rule: {
          component: 'ApostropheTiptapButton',
          label: 'Horizontal Rule',
          icon: 'minus-icon'
        },
        link: {
          component: 'ApostropheTiptapLink',
          label: 'Link',
          icon: 'link-icon'
        },
        bullet_list: {
          component: 'ApostropheTiptapButton',
          label: 'Bulleted List',
          icon: 'format-list-bulleted-icon'
        },
        ordered_list: {
          component: 'ApostropheTiptapButton',
          label: 'Ordered List',
          icon: 'format-list-numbered-icon'
        },
        strike: {
          component: 'ApostropheTiptapButton',
          label: 'Strike',
          icon: 'format-strikethrough-variant-icon'
        },
        blockquote: {
          component: 'ApostropheTiptapButton',
          label: 'Blockquote',
          icon: 'format-quote-close-icon'
        },
        code_block: {
          component: 'ApostropheTiptapButton',
          label: 'Code Block',
          icon: 'code-tags-icon'
        },
        undo: {
          component: 'ApostropheTiptapButton',
          label: 'Undo',
          icon: 'undo-icon'
        },
        redo: {
          component: 'ApostropheTiptapButton',
          label: 'Redo',
          icon: 'redo-icon'
        }
      }
    }
  },
  beforeSuperClass(self, options) {
    options.defaultOptions = {
      ...options.minimumDefaultOptions,
      ...options.defaultOptions
    };
  },
  methods(self, options) {
    return {

      // Return just the rich text of the widget, which may be undefined or null if it has not yet been edited

      getRichText(widget) {
        return widget.content;
      },

      async load(req, widgets) {
      },

      // Convert template-level options (including defaults for this widget
      // type) into a valid sanitize-html configuration, so that h4 can
      // be legal in one area and illegal in another

      optionsToSanitizeHtml(options) {
        return {
          ...sanitizeHtml.defaultOptions,
          allowedTags: self.toolbarToAllowedTags(options),
          allowedAttributes: self.toolbarToAllowedAttributes(options),
          allowedClasses: self.toolbarToAllowedClasses(options)
        };
      },

      toolbarToAllowedTags(options) {
        const allowedTags = {
          br: true,
          p: true
        };
        const simple = {
          bold: [
            'b',
            'strong'
          ],
          italic: [
            'i',
            'em'
          ],
          strike: [ 's' ],
          link: [ 'a' ],
          horizontal_rule: [ 'hr' ],
          bullet_list: [
            'ul',
            'li'
          ],
          ordered_list: [
            'ol',
            'li'
          ],
          blockquote: [ 'blockquote' ],
          code_block: [
            'pre',
            'code'
          ]
        };
        for (const item of options.toolbar || []) {
          if (simple[item]) {
            for (const tag of simple[item]) {
              allowedTags[tag] = true;
            }
          } else if (item === 'styles') {
            for (const style of options.styles || []) {
              const tag = style.tag;
              allowedTags[tag] = true;
            }
          }
        }
        return Object.keys(allowedTags);
      },

      toolbarToAllowedAttributes(options) {
        const allowedAttributes = {};
        const simple = {
          link: {
            tag: 'a',
            attributes: [
              'href',
              'id',
              'name',
              'target'
            ]
          }
        };
        for (const item of options.toolbar || []) {
          if (simple[item]) {
            for (const attribute of simple[item].attributes) {
              allowedAttributes[simple[item].tag] = allowedAttributes[simple[item].tag] || [];
              allowedAttributes[simple[item].tag].push(attribute);
            }
          }
        }
        return allowedAttributes;
      },

      toolbarToAllowedClasses(options) {
        const allowedClasses = {};
        if ((options.toolbar || []).includes('styles')) {
          for (const style of options.styles || []) {
            const tag = style.tag;
            const classes = self.getStyleClasses(style);
            allowedClasses[tag] = allowedClasses[tag] || {};
            for (const c of classes) {
              allowedClasses[tag][c] = true;
            }
          }
        }
        for (const tag of Object.keys(allowedClasses)) {
          allowedClasses[tag] = Object.keys(allowedClasses[tag]);
        }
        return allowedClasses;
      },

      getStyleClasses(heading) {
        if (!heading.class) {
          return [];
        }
        return heading.class.split(/\s+/);
      },

      // Rich text editor content is found in the
      // div itself as markup, so don't redundantly
      // represent it as a data attribute.
      filterForDataAttribute(widget) {
        return _.omit(widget, 'content');
      },

      addSearchTexts(item, texts) {
        texts.push({
          weight: 10,
          text: self.apos.util.htmlToPlaintext(item.content),
          silent: false
        });
      },

      compare(old, current) {
        let oldContent = old.content;
        if (oldContent === undefined) {
          oldContent = '';
        }
        let currentContent = current.content;
        if (currentContent === undefined) {
          currentContent = '';
        }
        const diff = jsDiff.diffSentences(self.apos.util.htmlToPlaintext(oldContent).replace(/\s+/g, ' '), self.apos.util.htmlToPlaintext(currentContent).replace(/\s+/g, ' '), { ignoreWhitespace: true });

        const changes = _.map(_.filter(diff, function (diffChange) {
          return diffChange.added || diffChange.removed;
        }), function (diffChange) {
          // Convert a jsDiff change object to an
          // apos versions change object
          if (diffChange.removed) {
            return {
              action: 'remove',
              text: diffChange.value,
              field: {
                type: 'string',
                label: 'Content'
              }
            };
          } else {
            return {
              action: 'add',
              text: diffChange.value,
              field: {
                type: 'string',
                label: 'Content'
              }
            };
          }
        });

        if (!changes.length) {
          // Well, something changed! Presumably the formatting.
          return [ {
            action: 'change',
            field: { label: 'Formatting' }
          } ];
        }

        return changes;
      },

      isEmpty(widget) {
        const text = self.apos.util.htmlToPlaintext(widget.content || '');
        return !text.trim().length;
      }
    };
  },
  extendMethods(self, options) {
    return {
      async sanitize(_super, req, input, options) {
        const output = await _super(req, input, options);
        output.content = sanitizeHtml(input.content, self.optionsToSanitizeHtml(options));
        return output;
      }
    };
  }
};
