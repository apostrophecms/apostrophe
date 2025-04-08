// Implements rich text editor widgets. Unlike most widget types, the rich text
// editor does not use a modal; instead you edit in context on the page.

const sanitizeHtml = require('sanitize-html');
const cheerio = require('cheerio');
const { createWriteStream, unlinkSync } = require('fs');
const { Readable, pipeline } = require('stream');
const apiRoutes = require('./lib/apiRoutes');
const util = require('util');

module.exports = {
  extend: '@apostrophecms/widget-type',
  cascades: [ 'linkFields' ],
  linkFields(self, options) {
    const linkWithType = (Array.isArray(options.linkWithType)
      ? options.linkWithType
      : [ options.linkWithType ]);

    // Labels are not available at the time the schema is built,
    // they are added on modulesRegistered.
    const linkWithTypeChoices = linkWithType
      .map(type => ({
        label: type,
        value: type
      }))
      .concat([
        {
          label: 'apostrophe:url',
          value: '_url'
        }
      ]);

    const linkWithTypeFields = linkWithType.reduce((fields, type) => {
      const name = `_${type}`;
      fields[name] = {
        type: 'relationship',
        label: type,
        withType: type,
        required: true,
        max: 1,
        browse: true,
        if: {
          linkTo: type
        }
      };
      return fields;
    }, {});
    linkWithTypeFields.updateTitle = {
      label: 'apostrophe:updateTitle',
      type: 'boolean',
      def: true,
      if: {
        $or: linkWithType.map(type => ({
          linkTo: type
        }))
      }
    };

    return {
      add: {
        linkTo: {
          label: 'apostrophe:linkTo',
          type: 'select',
          choices: linkWithTypeChoices,
          required: true,
          def: linkWithTypeChoices[0].value
        },
        ...linkWithTypeFields,
        href: {
          label: 'apostrophe:url',
          type: 'string',
          required: true,
          if: {
            linkTo: '_url'
          }
        },
        target: {
          label: 'apostrophe:linkTarget',
          type: 'checkboxes',
          htmlAttribute: 'target',
          choices: [
            {
              label: 'apostrophe:openLinkInNewTab',
              value: '_blank'
            }
          ]
        }
      }
    };
  },
  options: {
    icon: 'format-text-icon',
    label: 'apostrophe:richText',
    contextual: true,
    placeholder: true,
    placeholderText: 'apostrophe:richTextPlaceholder',
    placeholderTextWithInsertMenu: 'apostrophe:richTextPlaceholderWithInsertMenu',
    defaultData: { content: '' },
    className: false,
    linkWithType: [ '@apostrophecms/any-page-type' ],
    tableOptions: {
      resizable: true,
      handleWidth: 10,
      cellMinWidth: 100,
      lastColumnResizable: false,
      class: 'apos-rich-text-table'
    },
    // For permalinks and images. For efficiency we make
    // one query
    project: {
      title: 1,
      aposDocId: 1,
      _url: 1,
      attachment: 1,
      alt: 1,
      credit: 1,
      creditUrl: 1
    },
    minimumDefaultOptions: {
      toolbar: [
        'styles',
        'bold',
        'italic',
        'strike',
        'link',
        'anchor',
        'bulletList',
        'orderedList',
        'blockquote'
      ],
      styles: [
        // you may also use a `class` property with these
        {
          tag: 'p',
          label: 'apostrophe:richTextParagraph'
        },
        {
          tag: 'h2',
          label: 'apostrophe:richTextH2'
        },
        {
          tag: 'h3',
          label: 'apostrophe:richTextH3'
        },
        {
          tag: 'h4',
          label: 'apostrophe:richTextH4'
        }
      ]
    },
    defaultOptions: {},
    components: {
      widgetEditor: 'AposRichTextWidgetEditor'
    },
    editorTools: {
      nodes: {
        component: 'AposTiptapStyles',
        label: 'apostrophe:richTextNodeStyles',
        icon: 'format-text-icon'
      },
      marks: {
        component: 'AposTiptapMarks',
        label: 'apostrophe:richTextMarkStyles',
        icon: 'palette-swatch-icon'
      },
      '|': { component: 'AposTiptapDivider' },
      bold: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextBold',
        icon: 'format-bold-icon',
        command: 'toggleBold',
        iconSize: 18
      },
      italic: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextItalic',
        icon: 'format-italic-icon',
        command: 'toggleItalic'
      },
      underline: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextUnderline',
        icon: 'format-underline-icon',
        command: 'toggleUnderline'
      },
      strike: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextStrikethrough',
        icon: 'format-strikethrough-variant-icon',
        command: 'toggleStrike',
        iconSize: 14
      },
      superscript: {
        component: 'AposTiptapButton',
        label: 'apostrophe:superscript',
        icon: 'format-superscript-icon',
        command: 'toggleSuperscript'
      },
      subscript: {
        component: 'AposTiptapButton',
        label: 'apostrophe:subscript',
        icon: 'format-subscript-icon',
        command: 'toggleSubscript'
      },
      horizontalRule: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextHorizontalRule',
        icon: 'minus-icon',
        command: 'setHorizontalRule'
      },
      link: {
        component: 'AposTiptapLink',
        label: 'apostrophe:richTextLink',
        icon: 'link-icon',
        iconSize: 18
      },
      anchor: {
        component: 'AposTiptapAnchor',
        label: 'apostrophe:richTextAnchor',
        icon: 'anchor-icon'
      },
      bulletList: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextBulletedList',
        icon: 'format-list-bulleted-icon',
        command: 'toggleBulletList'
      },
      orderedList: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextOrderedList',
        icon: 'format-list-numbered-icon',
        command: 'toggleOrderedList'
      },
      blockquote: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextBlockquote',
        icon: 'format-quote-close-icon',
        command: 'toggleBlockquote',
        iconSize: 20
      },
      codeBlock: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextCodeBlock',
        icon: 'code-tags-icon',
        command: 'toggleCode'
      },
      undo: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextUndo',
        icon: 'undo-icon'
      },
      redo: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextRedo',
        icon: 'redo-icon'
      },
      alignLeft: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextAlignLeft',
        icon: 'format-align-left-icon',
        command: 'setTextAlign',
        commandParameters: 'left',
        isActive: { textAlign: 'left' }
      },
      alignCenter: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextAlignCenter',
        icon: 'format-align-center-icon',
        command: 'setTextAlign',
        commandParameters: 'center',
        isActive: { textAlign: 'center' }
      },
      alignRight: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextAlignRight',
        icon: 'format-align-right-icon',
        command: 'setTextAlign',
        commandParameters: 'right',
        isActive: { textAlign: 'right' }
      },
      alignJustify: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextAlignJustify',
        icon: 'format-align-justify-icon',
        command: 'setTextAlign',
        commandParameters: 'justify',
        isActive: { textAlign: 'justify' }
      },
      highlight: {
        component: 'AposTiptapButton',
        label: 'apostrophe:richTextHighlight',
        icon: 'format-color-highlight-icon',
        command: 'toggleHighlight'
      },
      image: {
        component: 'AposTiptapImage',
        label: 'apostrophe:image',
        icon: 'image-icon'
      },
      color: {
        component: 'AposTiptapColor',
        label: 'apostrophe:richTextColor',
        command: 'setColor'
      },
      importTable: {
        component: 'AposTiptapImportTable',
        icon: 'cloud-upload-icon',
        label: 'apostrophe:richTextUploadCsvTable'
      }
    },
    editorInsertMenu: {
      table: {
        icon: 'table-icon',
        label: 'apostrophe:table',
        action: 'insertTable',
        description: 'apostrophe:tableDescription'
      },
      image: {
        icon: 'image-icon',
        label: 'apostrophe:image',
        description: 'apostrophe:imageDescription',
        component: 'AposImageControlDialog'
      },
      horizontalRule: {
        icon: 'minus-icon',
        label: 'apostrophe:richTextHorizontalRule',
        action: 'setHorizontalRule'
      },
      importTable: {
        icon: 'cloud-upload-icon',
        label: 'apostrophe:tableImport',
        description: 'apostrophe:richTextUploadCsvTable',
        component: 'AposTiptapImportTable',
        noPopover: true
      }
    },
    // Additional properties used in executing tiptap commands
    // Will be mixed in automatically for developers
    tiptapTextCommands: {
      setNode: [ 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'div' ],
      toggleMark: [
        'b', 'strong', 'code', 'mark', 'em', 'i',
        'a', 's', 'del', 'strike', 'u', 'anchor',
        'superscript', 'subscript'
      ],
      toggleClassOrToggleMark: [ 'span' ],
      wrapIn: [ 'blockquote' ]
    },
    tiptapTypes: {
      heading: [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ],
      paragraph: [ 'p' ],
      code: [ 'code' ],
      bold: [ 'strong', 'b' ],
      strike: [ 's', 'del', 'strike' ],
      italic: [ 'i', 'em' ],
      highlight: [ 'mark' ],
      link: [ 'a' ],
      anchor: [ 'span' ],
      underline: [ 'u' ],
      codeBlock: [ 'pre' ],
      blockquote: [ 'blockquote' ],
      superscript: [ 'sup' ],
      subscript: [ 'sub' ],
      textStyle: [ 'span' ],
      // Generic div type, usually used with classes,
      // and for A2 content migration. Intentionally not
      // given a nicer-sounding name
      div: [ 'div' ]
    }
  },
  beforeSuperClass(self) {
    self.options.defaultOptions = {
      ...self.options.minimumDefaultOptions,
      ...self.options.defaultOptions
    };
  },
  icons: {
    'format-text-icon': 'FormatText',
    'format-color-highlight-icon': 'FormatColorHighlight',
    'table-icon': 'Table',
    'palette-swatch-icon': 'PaletteSwatch',
    'table-row-plus-after-icon': 'TableRowPlusAfter',
    'table-column-plus-after-icon': 'TableColumnPlusAfter',
    'table-column-remove-icon': 'TableColumnRemove',
    'table-row-remove-icon': 'TableRowRemove',
    'table-plus-icon': 'TablePlus',
    'table-minus-icon': 'TableMinus',
    'table-column-icon': 'TableColumn',
    'table-row-icon': 'TableRow',
    'table-split-cell-icon': 'TableSplitCell',
    'table-merge-cells-icon': 'TableMergeCells'
  },
  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        validateAndFixLinkWithTypes() {
          self.validateAndFixLinkWithTypes();
        },
        composeLinkSchema() {
          self.composeLinkSchema();
        }
      }
    };
  },
  apiRoutes,
  methods(self) {
    return {
      // Return just the rich text of the widget, which may be undefined or null if it has not yet been edited

      getRichText(widget) {
        return widget.content;
      },

      // Handle relationships to permalinks and inline images
      async load(req, widgets) {
        try {
          return await self.loadInlineRelationships(req, widgets, [ 'permalinkIds', 'imageIds' ]);
        } catch (e) {
          console.error(e);
          throw e;
        }
      },

      // Load the permalink and image relationships for the given rich text
      // widgets, using a single efficient query. `names` is an array of
      // properties that contain arrays of doc IDs, such as `permalinkIds`.
      // An implementation detail of `load` for this widget. After this method
      // each widget has a `_relatedDocs` property. Note this is a mixed
      // collection of permalink docs and inline image docs
      async loadInlineRelationships(req, widgets, names) {
        const widgetsByDocId = new Map();
        let ids = [];
        for (const widget of widgets) {
          for (const name of names) {
            if (!widget[name]) {
              continue;
            }
            for (const id of widget[name]) {
              const docWidgets = widgetsByDocId.get(id) || [];
              docWidgets.push(widget);
              widgetsByDocId.set(id, docWidgets);
              ids.push(id);
            }
          }
        }
        ids = [ ...new Set(ids) ];
        if (!ids.length) {
          return;
        }
        const docs = await self.apos.doc.find(req, {
          aposDocId: {
            $in: ids
          }
        }).project(self.options.project).toArray();
        for (const doc of docs) {
          const widgets = widgetsByDocId.get(doc.aposDocId) || [];
          for (const widget of widgets) {
            widget._relatedDocs = widget._relatedDocs || [];
            widget._relatedDocs.push(doc);
          }
        }
      },

      // Convert area rich text options into a valid sanitize-html
      // configuration, so that h4 can be legal in one area and illegal in
      // another.

      optionsToSanitizeHtml(options) {
        return {
          ...sanitizeHtml.defaults,
          allowedTags: self.toolbarToAllowedTags(options),
          allowedAttributes: self.toolbarToAllowedAttributes(options),
          allowedClasses: self.toolbarToAllowedClasses(options),
          allowedStyles: self.toolbarToAllowedStyles(options)
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
          horizontalRule: [ 'hr' ],
          bulletList: [
            'ul',
            'li'
          ],
          orderedList: [
            'ol',
            'li'
          ],
          blockquote: [ 'blockquote' ],
          codeBlock: [
            'pre',
            'code'
          ],
          underline: [ 'u' ],
          anchor: [ 'span' ],
          superscript: [ 'sup' ],
          subscript: [ 'sub' ],
          table: [ 'table', 'tr', 'td', 'th', 'colgroup', 'col', 'div' ],
          image: [ 'figure', 'img', 'figcaption' ],
          div: [ 'div' ],
          color: [ 'span' ]
        };
        for (const item of self.combinedItems(options)) {
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
              ...self.linkSchema
                .filter(field => field.htmlAttribute)
                .map(field => field.htmlAttribute)
            ]
          },
          alignLeft: {
            tag: '*',
            attributes: [ 'style' ]
          },
          alignCenter: {
            tag: '*',
            attributes: [ 'style' ]
          },
          alignRight: {
            tag: '*',
            attributes: [ 'style' ]
          },
          alignJustify: {
            tag: '*',
            attributes: [ 'style' ]
          },
          anchor: {
            tag: 'span',
            attributes: [ 'id' ]
          },
          table: [
            {
              tag: 'div',
              attributes: [ 'class' ]
            },
            {
              tag: 'table',
              attributes: [ 'style', 'class' ]
            },
            {
              tag: 'col',
              attributes: [ 'style' ]
            },
            {
              tag: 'td',
              attributes: [ 'colspan', 'rowspan', 'colwidth' ]
            },
            {
              tag: 'th',
              attributes: [ 'colspan', 'rowspan', 'colwidth' ]
            }
          ],
          colgroup: [
            {
              tag: 'col',
              attributes: [ 'style' ]
            }
          ],
          image: [
            {
              tag: 'figure',
              attributes: [ 'class' ]
            },
            {
              tag: 'img',
              attributes: [ 'src', 'alt' ]
            }
          ],
          color: {
            tag: '*',
            attributes: [ 'style' ]
          }
        };
        for (const item of self.combinedItems(options)) {
          if (simple[item]) {
            const entries = Array.isArray(simple[item]) ? simple[item] : [ simple[item] ];
            for (const entry of entries) {
              for (const attribute of entry.attributes) {
                allowedAttributes[entry.tag] = allowedAttributes[entry.tag] || [];
                allowedAttributes[entry.tag].push(attribute);
                allowedAttributes[entry.tag] = [ ...new Set(allowedAttributes[entry.tag]) ];
              }
            }
          }
        }
        return allowedAttributes;
      },

      toolbarToAllowedStyles(options) {
        const allowedStyles = {};
        const simple = {
          alignLeft: {
            selector: '*',
            properties: {
              'text-align': [ /^left$/ ]
            }
          },
          alignCenter: {
            selector: '*',
            properties: {
              'text-align': [ /^center$/ ]
            }
          },
          alignRight: {
            selector: '*',
            properties: {
              'text-align': [ /^right$/ ]
            }
          },
          alignJustify: {
            selector: '*',
            properties: {
              'text-align': [ /^justify$/ ]
            }
          },
          color: {
            selector: '*',
            properties: {
              color: [
                // Hexadecimal colors (3 or 6 digits, optionally with alpha)
                /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{4})$/i,
                // RGB colors
                /^rgb\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}\s*\)$/,
                // RGBA colors
                /^rgba\(\s*(?:\d{1,3}\s*,\s*){3}(?:0?\.\d+|1(?:\.0)?)\s*\)$/,
                // HSL colors
                /^hsl\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/,
                // HSLA colors
                /^hsla\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(?:0?\.\d+|1(?:\.0)?)\s*\)$/,
                // CSS Variable value
                /^var\(--[a-zA-Z0-9-]+\)$/
              ]
            }
          },
          table: {
            selector: '*',
            properties: {
              'min-width': [ /[0-9]{1,4}(px|em|%)/i ],
              'max-width': [ /[0-9]{1,4}(px|em|%)/i ],
              width: [ /[0-9]{1,4}(px|em|%)/i ]
            }
          }
        };
        for (const item of self.combinedItems(options)) {
          if (simple[item]) {
            if (!allowedStyles[simple[item].selector]) {
              allowedStyles[simple[item].selector] = {};
            }
            for (const property in simple[item].properties) {
              if (!allowedStyles[simple[item].selector][property]) {
                allowedStyles[simple[item].selector][property] = [];
              }

              allowedStyles[simple[item].selector][property]
                .push(...simple[item].properties[property]);
            }
          }
        }

        return allowedStyles;
      },

      toolbarToAllowedClasses(options) {
        const allowedClasses = {};
        if (self.combinedItems(options).includes('styles')) {
          for (const style of options.styles || []) {
            const tag = style.tag;
            const classes = self.getStyleClasses(style);

            // Add classes to THIS tag's allowList
            if (tag) {
              allowedClasses[tag] = allowedClasses[tag] || {};
              for (const c of classes) {
                allowedClasses[tag][c] = true;
              }
            }
          }
        }

        if (options.toolbar?.includes('table') || options.insert?.includes('table')) {
          allowedClasses.div = {
            ...(allowedClasses.div || {})
          };

          // If `resizable`, allow the prosemirror wrapper through
          if (self.options.tableOptions?.resizable) {
            allowedClasses.div.tableWrapper = true;
          }

          allowedClasses.table = {
            ...(allowedClasses.table || {})
          };

          // If custom class applied to table
          if (self.options.tableOptions?.class) {
            allowedClasses.table[self.options.tableOptions.class] = true;
          }
        }

        for (const tag of Object.keys(allowedClasses)) {
          allowedClasses[tag] = Object.keys(allowedClasses[tag]);
        }

        return allowedClasses;
      },

      // Returns a combined array of toolbar and insert menu items from the given
      // set of rich text widget options
      combinedItems(options) {
        return [ ...(options.toolbar || []), ...(options.insert || []) ];
      },

      getStyleClasses(heading) {
        if (!heading.class) {
          return [];
        }
        return heading.class.split(/\s+/);
      },

      addSearchTexts(item, texts) {
        texts.push({
          weight: 10,
          text: self.apos.util.htmlToPlaintext(item.content),
          silent: false
        });
      },

      isEmpty(widget) {
        const text = self.apos.util.htmlToPlaintext(widget.content || '');
        return !text.trim().length;
      },

      sanitizeHtml(html, options) {
        html = sanitizeHtml(html, options);
        html = self.sanitizeAnchors(html);
        return html;
      },

      sanitizeAnchors(html) {
        const $ = cheerio.load(html);
        const seen = new Set();
        $('[data-anchor]').each(function() {
          const $el = $(this);
          const anchor = $el.attr('data-anchor');
          if (!self.validateAnchor(anchor)) {
            return;
          }
          // tiptap will apply data-anchor to every tag involved in the selection
          // at any depth. For ids and anchors this doesn't really make sense.
          // Save the id to the first, rootmost tag involved
          if (!seen.has(anchor)) {
            $el.attr('id', anchor);
            seen.add(anchor);
          }
        });
        const result = $('body').html();
        return result;
      },

      validateAnchor(anchor) {
        if ((typeof anchor) !== 'string') {
          return false;
        }
        if (!anchor.length) {
          return false;
        }
        // Don't let them break the editor
        if (anchor.startsWith('apos-')) {
          return false;
        }
        return true;
      },

      // Quickly replaces rich text permalink placeholder URLs with
      // actual, SEO-friendly URLs based on `widget._relatedDocs`.

      linkPermalinks(widget, content) {
        // "Why no regexps?" We need to do this as quickly as we can.
        // indexOf and lastIndexOf are much faster.
        let i;
        for (const doc of (widget._relatedDocs || [])) {
          let offset = 0;
          while (true) {
            i = content.indexOf('apostrophe-permalink-' + doc.aposDocId, offset);
            if (i === -1) {
              break;
            }
            offset = i + ('apostrophe-permalink-' + doc.aposDocId).length;
            let updateTitle = content.indexOf('?updateTitle=1', i);
            if (updateTitle === i + ('apostrophe-permalink-' + doc.aposDocId).length) {
              updateTitle = true;
            } else {
              updateTitle = false;
            }
            // If you can edit the widget, you don't want the link replaced,
            // as that would lose the permalink if you edit the widget
            // (but you may still want the title updated)
            const left = content.lastIndexOf('<', i);
            const href = content.indexOf(' href="', left);
            const close = content.indexOf('"', href + 7);
            if ((left !== -1) && (href !== -1) && (close !== -1)) {
              content = content.substring(0, href + 6) + doc._url + content.substring(close + 1);
            } else {
              // So we don't get stuck in an infinite loop
              break;
            }
            if (!updateTitle) {
              continue;
            }
            const right = content.indexOf('>', left);
            const nextLeft = content.indexOf('<', right);
            if ((right !== -1) && (nextLeft !== -1)) {
              content = content.substring(0, right + 1) + self.apos.util.escapeHtml(doc.title) + content.substring(nextLeft);
            }
          }
        }
        return content;
      },
      // Quickly replaces inline image placeholder URLs with
      // actual, SEO-friendly URLs based on `widget._relatedDocs`.
      linkImages(widget, content) {
        // "Why no regexps?" We need to do this as quickly as we can.
        // indexOf and lastIndexOf are much faster.
        let i;
        for (const doc of (widget._relatedDocs || [])) {
          let offset = 0;
          while (true) {
            const target = `${self.apos.modules['@apostrophecms/image'].action}/${doc.aposDocId}/src`;
            i = content.indexOf(target, offset);
            if (i === -1) {
              break;
            }
            offset = i + target.length;
            // If you can edit the widget, you don't want the link replaced,
            // as that would lose the image if you edit the widget
            const left = content.lastIndexOf('<', i);
            const src = content.indexOf(' src="', left);
            const close = content.indexOf('"', src + 6);
            if ((left !== -1) && (src !== -1) && (close !== -1)) {
              content = content.substring(0, src + 5) + doc.attachment._urls[self.apos.modules['@apostrophecms/image'].getLargestSize()] + content.substring(close + 1);
            } else {
              // So we don't get stuck in an infinite loop
              break;
            }
          }
        }
        return content;
      },
      // Validate the types provided for links, update labels derived from
      // corresponding modules, as they are not available at the time
      // the schema is generated.
      validateAndFixLinkWithTypes() {
        const linkWithType = (Array.isArray(self.options.linkWithType)
          ? self.options.linkWithType
          : [ self.options.linkWithType ]);

        for (const type of linkWithType) {
          if (!self.apos.modules[type]) {
            throw new Error(
              `The linkWithType option of rich text widget "${type}" must be a valid module type`
            );
          }

          self.linkFields[`_${type}`].label = getLabel(type);
          const choice = self.linkFields.linkTo.choices
            .find(choice => choice.value === type);

          choice.label = getLabel(type);
        }

        function getLabel(type) {
          if ([ '@apostrophecms/any-page-type', '@apostrophecms/page' ].includes(type)) {
            return 'apostrophe:page';
          }
          return self.apos.modules[type].options?.label ?? type;
        }
      },
      // Compose and register the link schema.
      composeLinkSchema() {
        self.linkSchema = self.apos.schema.compose({
          addFields: self.apos.schema.fieldsToArray(`Links ${self.__meta.name}`, self.linkFields),
          arrangeFields: self.apos.schema.groupsToArray(self.linkFieldsGroups)
        }, self);

        self.apos.schema.validate(self.linkSchema, {
          type: 'link',
          subtype: self.__meta.name
        });

        // Don't allow htmlAttribute `href`, it's a special case.
        const hrefField = self.linkSchema.find(field => field.htmlAttribute === 'href');
        if (hrefField) {
          throw new Error(`Field "${hrefField.name}" validation error: "htmlAttribute: href" is not allowed.`);
        }
      }
    };
  },
  extendMethods(self) {
    return {
      async sanitize(_super, req, input, options) {
        try {
          const rteOptions = {
            ...self.options.defaultOptions,
            ...options
          };

          const output = await _super(req, input, rteOptions);
          const finalOptions = self.optionsToSanitizeHtml(rteOptions);

          if (input.import?.html) {
            if ((typeof input.import.html) !== 'string') {
              throw self.apos.error('invalid', 'import.html must be a string');
            }
            if (input.import.baseUrl && ((typeof input.import.html) !== 'string')) {
              throw self.apos.error('invalid', 'If present, import.baseUrl must be a string');
            }
            const $ = cheerio.load(input.import.html);
            const $images = $('img');
            // Build an array of cheerio objects because
            // we need to iterate while doing async work,
            // which .each() can't do
            const $$images = [];
            $images.each((i, el) => {
              const $image = $(el);
              $$images.push($image);
            });
            for (const $image of $$images) {
              const src = $image.attr('src');
              const alt = $image.attr('alt') && self.apos.util.escapeHtml($image.attr('alt'));
              const url = new URL(src, input.import.baseUrl || self.apos.baseUrl);
              const res = await fetch(url);
              if (res.status >= 400) {
                self.apos.util.warn(`Error ${res.status} while importing ${src}, ignoring image`);
                continue;
              }
              const id = self.apos.util.generateId();
              const temp = self.apos.attachment.uploadfs.getTempPath() + `/${id}`;
              const matches = src.match(/\/([^/]+\.\w+)$/);
              if (!matches) {
                self.apos.util.warn('img URL has no extension, skipping:', src);
                continue;
              }
              const name = matches[1];
              try {
                await util.promisify(pipeline)(Readable.fromWeb(res.body), createWriteStream(temp));
                const attachment = await self.apos.attachment.insert(req, {
                  name,
                  path: temp
                });
                const image = await self.apos.image.insert(req, {
                  title: name,
                  attachment
                });
                const newSrc = `${self.apos.image.action}/${image.aposDocId}/src`;
                $image.replaceWith(
                  `<figure>
                    <img src="${newSrc}" ${alt && `alt="${alt}"`} />
                    <figcaption></figcaption>
                  </figure>
                  `
                );
              } finally {
                try {
                  unlinkSync(temp);
                } catch (e) {
                  // It's OK if we never created it
                }
              }
            }
            input.content = $.html();
          }

          output.content = self.sanitizeHtml(input.content, finalOptions);

          const permalinkAnchors = output.content.match(/"#apostrophe-permalink-[^"?]*?\?/g);
          output.permalinkIds = (permalinkAnchors && permalinkAnchors.map(anchor => {
            const matches = anchor.match(/apostrophe-permalink-(.*)\?/);
            return matches[1];
          })) || [];
          const quotedAction = self.apos.util.regExpQuote(self.apos.modules['@apostrophecms/image'].action);
          const imageAnchors = output.content.match(new RegExp(`${quotedAction}/([^/]+)/src`, 'g'));
          output.imageIds = (imageAnchors && imageAnchors.map(anchor => {
            const matches = anchor.match(new RegExp(`${quotedAction}/([^/]+)/src`));
            return matches[1];
          })) || [];
          return output;
        } catch (e) {
          // Because the trace for template errors is not very
          // useful, for now we log any error here up front
          // until we improve that or this has been stable for a while
          console.error(e);
          throw e;
        }
      },
      async output(_super, req, widget, options, _with) {
        let content = widget.content || '';
        content = self.linkPermalinks(widget, content);
        content = self.linkImages(widget, content);
        // We never modify the original widget.content because we do not want
        // it to lose its permalinks in the database
        const _widget = {
          ...widget,
          content
        };
        return _super(req, _widget, options, _with);
      },
      // Add on the core default options to use, if needed.
      getBrowserData(_super, req) {
        const initialData = _super(req);
        const finalData = {
          ...initialData,
          tools: self.options.editorTools,
          insertMenu: self.options.editorInsertMenu,
          defaultOptions: self.options.defaultOptions,
          tiptapTextCommands: self.options.tiptapTextCommands,
          tiptapTypes: self.options.tiptapTypes,
          placeholderText: self.options.placeholder && self.options.placeholderText,
          // Not optional in presence of an insert menu, it's not acceptable UX without it
          placeholderTextWithInsertMenu: self.options.placeholderTextWithInsertMenu,
          linkWithType: Array.isArray(self.options.linkWithType) ? self.options.linkWithType : [ self.options.linkWithType ],
          linkSchema: self.linkSchema,
          imageStyles: self.options.imageStyles,
          color: self.options.color,
          tableOptions: self.options.tableOptions
        };
        return finalData;
      }
    };
  },
  tasks(self) {
    const confirm = async (isConfirmed) => {
      if (isConfirmed) {
        return true;
      }

      console.log('This task will perform an update on all existing rich-text widget. You should manually backup your database before running this command in case it becomes necessary to revert the changes. You can add --confirm to the command to skip this message and run the command');

      return false;
    };

    return {
      'remove-empty-paragraph': {
        usage: 'Usage: node app @apostrophecms/rich-text-widget:remove-empty-paragraph --confirm\n\nRemove empty paragraph. If a paragraph contains no visible text or only blank characters, it will be removed.\n',
        task: async (argv) => {
          const iterator = async (doc, widget, dotPath) => {
            if (widget.type !== self.name) {
              return;
            }

            const updates = {};
            if (widget.content.includes('<p>')) {
              const dom = cheerio.load(widget.content);
              const paragraph = dom('body').find('p');

              paragraph.each((index, element) => {
                const isEmpty = /^(\s|&nbsp;)*$/.test(dom(element).text());
                isEmpty && dom(element).remove();

                if (isEmpty) {
                  updates[dotPath] = {
                    ...widget,
                    content: dom('body').html()
                  };
                }
              });
            }

            if (Object.keys(updates).length) {
              await self.apos.doc.db.updateOne(
                { _id: doc._id },
                { $set: updates }
              );
              self.apos.util.log(`Document ${doc._id} rich-texts have been updated`);
            }
          };

          const isConfirmed = await confirm(argv.confirm);

          return isConfirmed && self.apos.migration.eachWidget({}, iterator);
        }
      },
      'lint-fix-figure': {
        usage: 'Usage: node app @apostrophecms/rich-text-widget:lint-fix-figure --confirm\n\nFigure tags is allowed inside paragraph. This task will look for figure tag next to empty paragraph and wrap the text node around inside paragraph.\n',
        task: async (argv) => {
          const blockNodes = [
            'address',
            'article',
            'aside',
            'blockquote',
            'canvas',
            'dd',
            'div',
            'dl',
            'dt',
            'fieldset',
            'figcaption',
            'figure',
            'footer',
            'form',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'header',
            'hr',
            'li',
            'main',
            'nav',
            'noscript',
            'ol',
            'p',
            'pre',
            'section',
            'table',
            'tfoot',
            'ul',
            'video'
          ];
          const append = ({
            dom,
            wrapper,
            element
          }) => {
            return wrapper
              ? wrapper.append(element) && wrapper
              : dom(element).wrap('<p></p>').parent();
          };

          const iterator = async (doc, widget, dotPath) => {
            if (widget.type !== self.name) {
              return;
            }

            const updates = {};
            if (widget.content.includes('<figure')) {
              const dom = cheerio.load(widget.content);
              // reference: https://stackoverflow.com/questions/28855070/css-select-element-without-text-inside
              const figure = dom('body').find('p:not(:has(:not(:empty)))+figure,figure+p:not(:has(:not(:empty)))');
              const parent = figure.parent().contents();

              let wrapper = null;

              parent.each((index, element) => {
                const isFigure = element.type === 'tag' && element.name === 'figure';
                isFigure && (wrapper = null);

                const isNonWhitespaceTextNode = element.type === 'text' && /^\s*$/.test(element.data) === false;
                isNonWhitespaceTextNode && (wrapper = append({
                  dom,
                  wrapper,
                  element
                }));

                const isInlineNode = element.type === 'tag' && blockNodes.includes(element.name) === false;
                isInlineNode && (wrapper = append({
                  dom,
                  wrapper,
                  element
                }));

                const hasUpdate = isNonWhitespaceTextNode || isInlineNode;
                if (hasUpdate) {
                  updates[dotPath] = {
                    ...widget,
                    content: dom('body').html()
                  };
                }
              });
            }

            if (Object.keys(updates).length) {
              await self.apos.doc.db.updateOne(
                { _id: doc._id },
                { $set: updates }
              );
              self.apos.util.log(`Document ${doc._id} rich-texts have been updated`);
            }
          };

          const isConfirmed = await confirm(argv.confirm);

          return isConfirmed && self.apos.migration.eachWidget({}, iterator);
        }
      }
    };
  }
};
