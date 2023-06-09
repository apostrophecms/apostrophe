// Implements rich text editor widgets. Unlike most widget types, the rich text
// editor does not use a modal; instead you edit in context on the page.

const sanitizeHtml = require('sanitize-html');
const cheerio = require('cheerio');

module.exports = {
  extend: '@apostrophecms/widget-type',
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
      styles: {
        component: 'AposTiptapStyles',
        label: 'apostrophe:richTextStyles'
      },
      table: {
        component: 'AposTiptapTable',
        label: 'apostrophe:table'
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
      }
    },
    // Additional properties used in executing tiptap commands
    // Will be mixed in automatically for developers
    tiptapTextCommands: {
      setNode: [ 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'div' ],
      toggleMark: [
        'b', 'strong', 'code', 'mark', 'em', 'i',
        'a', 's', 'del', 'strike', 'span', 'u', 'anchor',
        'superscript', 'subscript'
      ],
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
    'table-icon': 'Table'
  },
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
          table: [ 'table', 'tr', 'td', 'th' ],
          image: [ 'figure', 'img', 'figcaption' ],
          div: [ 'div' ]
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
              'target'
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
              tag: 'td',
              attributes: [ 'colspan', 'rowspan' ]
            },
            {
              tag: 'th',
              attributes: [ 'colspan', 'rowspan' ]
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
          ]
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
      // actual, SEO-friendly URLs based on `widget._relatedDocs`
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
            if (!widget._edit) {
              if ((left !== -1) && (href !== -1) && (close !== -1)) {
                content = content.substring(0, href + 6) + doc._url + content.substring(close + 1);
              } else {
                // So we don't get stuck in an infinite loop
                break;
              }
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
      // actual, SEO-friendly URLs based on `widget._relatedDocs`
      linkImages(widget, content) {
        if (widget._edit) {
          return content;
        }
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
            if (!widget._edit) {
              if ((left !== -1) && (src !== -1) && (close !== -1)) {
                content = content.substring(0, src + 5) + doc.attachment._urls[self.apos.modules['@apostrophecms/image'].getLargestSize()] + content.substring(close + 1);
              } else {
                // So we don't get stuck in an infinite loop
                break;
              }
            }
          }
        }
        return content;
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
          imageStyles: self.options.imageStyles
        };
        return finalData;
      }
    };
  }
};
