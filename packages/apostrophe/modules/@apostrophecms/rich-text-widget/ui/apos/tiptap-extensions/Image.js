import {
  mergeAttributes,
  Node
} from '@tiptap/core';

export default options => {
  return Node.create({
    name: 'image',

    addOptions() {
      return {
        addPasteHandler: true,
        openOnClick: false,
        HTMLAttributes: {}
      };
    },

    allowGapCursor: true,
    atom: true,
    selectable: true,

    group: 'block',

    content: 'inline*',

    draggable: true,

    addAttributes() {
      return {
        ...this.parent?.(),
        // The link schema HTML attributes, e.g. target.
        // Grab only the fields that are image-related if explicitly set
        // set in the schema.
        ...apos.modules['@apostrophecms/rich-text-widget'].linkSchema
          .filter(field => !!field.htmlAttribute)
          .filter(field => !field.extensions || field.extensions.includes('Image'))
          .reduce((obj, field) => {
            obj[field.htmlAttribute] = {
              default: field.def ?? null,
              parseHTML: element => {
                return element.querySelector('a')
                  ?.getAttribute(field.htmlAttribute);
              }
            };
            return obj;
          }, {}),
        // Image specific, defined in the component schema.
        imageId: {
          default: null,
          parseHTML: element => {
            const src = element.querySelector('img')?.getAttribute('src');

            const components = src.replace(/\?.*$/, '').split('/');
            if (components.length < 2) {
              return false;
            }

            const routeName = components.pop();
            if (routeName !== 'src') {
              return false;
            }

            const imageId = components.pop();

            return imageId;
          }
        },
        href: {
          default: null,
          parseHTML: element => element.querySelector('a')?.getAttribute('href')
        },
        title: {
          default: null,
          parseHTML: element => element.querySelector('a')?.getAttribute('title')
        },
        rel: {
          default: null,
          parseHTML: element => element.querySelector('a')?.getAttribute('rel')
        },
        caption: {
          default: '',
          parseHTML: element => element.querySelector('figcaption')?.innerText || ''
        },
        style: {
          default: null,
          parseHTML: element => element.getAttribute('class')
        },
        alt: {
          default: null,
          parseHTML: element => element.querySelector('img')?.getAttribute('alt')
        }
      };
    },

    parseHTML() {
      // The markup for the image node can be either:
      // <figure>
      //   <img src="/media/cc0-images/elephant-660-480.jpg"
      //     alt="Elephant at sunset">
      //   <figcaption>An elephant at sunset</figcaption>
      // </figure>
      // OR with link
      // <figure>
      //   <a href="https://example.com">
      //     <img src="/media/cc0-images/elephant-660-480.jpg"
      //       alt="Elephant at sunset">
      //   </a>
      //   <figcaption>An elephant at sunset</figcaption>
      // </figure>
      return [
        {
          tag: 'figure',
          contentElement: 'figcaption'
        }
      ];
    },

    renderHTML({ HTMLAttributes }) {
      const locale = apos.getActiveLocale();
      const result = [
        'figure',
        mergeAttributes(
          this.options.HTMLAttributes,
          {
            class: HTMLAttributes.style
          }
        )
      ];
      // Conditionally add the link
      const imgAttrs = {
        src: `${apos.modules['@apostrophecms/image'].action}/${HTMLAttributes.imageId}/src?aposLocale=${locale}&aposMode=draft`,
        alt: HTMLAttributes.alt,
        draggable: false,
        contenteditable: false
      };
      if (HTMLAttributes.href) {
        const linkAttrs = apos.modules['@apostrophecms/rich-text-widget'].linkSchema
          .filter(field => !!field.htmlAttribute)
          .filter(field => !field.extensions || field.extensions.includes('Image'))
          .reduce((obj, field) => {
            obj[field.htmlAttribute] = HTMLAttributes[field.htmlAttribute];
            return obj;
          }, {});
        result.push([
          'a',
          mergeAttributes(
            linkAttrs,
            {
              href: HTMLAttributes.href,
              title: HTMLAttributes.title,
              target: HTMLAttributes.target,
              rel: HTMLAttributes.rel,
              draggable: false,
              contenteditable: false
            }
          ),
          [
            'img',
            imgAttrs
          ]
        ]);
      } else {
        result.push([
          'img',
          imgAttrs
        ]);
      }
      result.push([
        'figcaption',
        0
      ]);

      return result;
    },

    addNodeView() {
      return ({
        editor, node, getPos, HTMLAttributes, decorations
      }) => {
        const locale = apos.getActiveLocale();
        const defaultWrapperClass = editor.isEditable
          ? 'ProseMirror-selectednode'
          : '';
        const coreAttrs = new Set([
          'imageId',
          'href',
          'title',
          'caption',
          'style',
          'alt'
        ]);
        const linkAttrs = Object.keys(HTMLAttributes)
          .filter(attr => !coreAttrs.has(attr));
        const dom = document.createElement('figure');
        if (HTMLAttributes.style) {
          dom.className = HTMLAttributes.style;
        }

        // Create the image element
        const img = document.createElement('img');
        img.src = `${apos.modules['@apostrophecms/image'].action}/${node.attrs.imageId}/src?aposLocale=${locale}&aposMode=draft`;
        if (HTMLAttributes.alt) {
          img.alt = HTMLAttributes.alt;
        }
        img.draggable = false;

        // Create the figure caption
        const figcaption = document.createElement('figcaption');
        figcaption.innerText = HTMLAttributes.caption || '';
        figcaption.contentEditable = 'false';

        // If we have an href, wrap the image in an anchor
        let anchor = null;
        if (HTMLAttributes.href) {
          anchor = document.createElement('a');
          for (const attr of linkAttrs) {
            if (HTMLAttributes[attr] !== null) {
              anchor.setAttribute(attr, HTMLAttributes[attr]);
            }
          }
          if (HTMLAttributes.rel) {
            anchor.rel = HTMLAttributes.rel;
          }
          anchor.href = HTMLAttributes.href;
          if (HTMLAttributes.title) {
            anchor.title = HTMLAttributes.title;
          }
          anchor.appendChild(img);

          // Prevent clicks when the editor is editable
          anchor.addEventListener('click', hrefHandler);

          dom.appendChild(anchor);
        } else {
          dom.appendChild(img);
        }

        dom.appendChild(figcaption);

        function hrefHandler(event) {
          // If editor is not editable, the default link behavior will work
          if (editor.isEditable) {
            event.preventDefault();
          }
        }

        return {
          dom,
          // No specification for the contentDOM, we probably don't need it
          // contentDOM: figcaption,
          update: (updatedNode) => {
            if (updatedNode.type !== node.type) {
              return false;
            }
            if (updatedNode.attrs.style) {
              dom.className = defaultWrapperClass + ' ' + updatedNode.attrs.style;
            } else {
              dom.className = defaultWrapperClass;
            }
            img.alt = updatedNode.attrs.alt;
            img.src = updatedNode.attrs.imageId
              ? `${apos.modules['@apostrophecms/image'].action}/${updatedNode.attrs.imageId}/src?aposLocale=${locale}&aposMode=draft`
              : '';
            figcaption.innerText = updatedNode.attrs.caption || '';

            const updateAnchor = dom.querySelector('a');
            if (updatedNode.attrs.href && !updateAnchor) {
              anchor = document.createElement('a');
              anchor.addEventListener('click', hrefHandler);
              // wrap the image in an anchor
              dom.insertBefore(anchor, img);
              anchor.appendChild(img);
            } else if (!updatedNode.attrs.href && updateAnchor) {
              anchor = dom.querySelector('a');
              // move the image as a first child of the figure
              // and remove the anchor
              dom.insertBefore(img, anchor);
              anchor.removeEventListener('click', hrefHandler);
              anchor.remove();
              anchor = null;
            }
            if (anchor) {
              for (const attr of linkAttrs) {
                if (updatedNode.attrs[attr] !== null) {
                  anchor.setAttribute(attr, updatedNode.attrs[attr]);
                } else {
                  anchor.removeAttribute(attr);
                }
              }
              anchor.href = updatedNode.attrs.href;
              if (updatedNode.attrs.title) {
                anchor.title = updatedNode.attrs.title;
              } else {
                anchor.removeAttribute('title');
              }
              if (updatedNode.attrs.rel) {
                anchor.rel = updatedNode.attrs.rel;
              } else {
                anchor.removeAttribute('rel');
              }
            }

            return true;
          }
        };
      };
    },

    addCommands() {
      return {
        setImage: (attrs) => ({ chain }) => {
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs,
              content: attrs?.caption
                ? [ {
                  type: 'text',
                  text: attrs.caption
                } ]
                : []
            })
            // Disabled for now because it's annooying.
            // Every update on the Image results in a new paragraph
            // added after the image, and sometimes before it.
            // We can re-enable if it breaks stuff.
            // .createParagraphNear()
            .run();
        }
      };
    }
  });
};
