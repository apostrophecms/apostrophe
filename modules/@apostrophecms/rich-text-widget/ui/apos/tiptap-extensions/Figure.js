// import { Node } from '@tiptap/core';
import {
  findChildrenInRange,
  mergeAttributes,
  Node,
  // nodeInputRule,
  Tracker
} from '@tiptap/core';

export default options => {
  return Node.create({

    name: 'figure',

    addOptions() {
      return {
        // inline: true,
        // addPasteHandler: true,
        HTMLAttributes: {}
      };
    },

    // inline: true,

    // allowGapCursor: false,
    // atom: true,
    // isolating: false,
    // selectable: true,

    group: 'block',

    content: 'inline*',

    draggable: true,

    isolating: true,

    addAttributes() {
      return {
        // src: {
        //   default: null,
        //   parseHTML: element => element.querySelector('img')?.getAttribute('src')
        // },

        // alt: {
        //   default: null,
        //   parseHTML: element => element.querySelector('img')?.getAttribute('alt')
        // },

        // title: {
        //   default: null,
        //   parseHTML: element => element.querySelector('img')?.getAttribute('title')
        // },
        imageId: {
          default: null
        },
        caption: {
          default: ''
        },
        style: {
          default: null
        }
      };
    },

    parseHTML() {
      return [
        {
          tag: 'figure',
          contentElement: 'figcaption',
          getAttrs: el => {
            const img = el.querySelector('img');
            const src = img.getAttribute('src');
            if (!img || !src) {
              return false;
            }
            const caption = el.querySelector('figcaption');
            const components = src.split('/');
            if (components.length < 2) {
              return false;
            }
            const routeName = components.pop();
            if (routeName !== 'src') {
              return false;
            }
            const imageId = components.pop();
            const style = el.getAttribute('class');
            if (!imageId) {
              return false;
            }
            const result = {
              imageId,
              style,
              caption: (caption && caption.innerText) || ''
            };
            return result;
          }
        }
      ];
      // <figure>
      //   <img src="/media/cc0-images/elephant-660-480.jpg"
      //       alt="Elephant at sunset">
      //   <figcaption>An elephant at sunset</figcaption>
      // </figure>
      // return [
      //   {
      //     tag: 'figure',
      //     getAttrs: el => {
      //       const img = el.querySelector('img');
      //       const src = img.getAttribute('src');
      //       if (!img || !src) {
      //         return false;
      //       }
      //       const caption = el.querySelector('figcaption');
      //       const components = src.split('/');
      //       if (components.length < 2) {
      //         return false;
      //       }
      //       const routeName = components.pop();
      //       if (routeName !== 'src') {
      //         return false;
      //       }
      //       const imageId = components.pop();
      //       const style = el.getAttribute('class');
      //       if (!imageId) {
      //         return false;
      //       }
      //       const result = {
      //         imageId,
      //         style,
      //         caption: (caption && caption.innerText) || ''
      //       };
      //       return result;
      //     }
      //   }
      // ];
    },

    addCommands() {
      return {
        // setImage: options => ({ commands }) => {
        //   return commands.insertContent({
        //     type: this.name,
        //     attrs: options
        //   });
        // },
        setImage: ({ caption, ...attrs }) => ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
              content: caption
                ? [ {
                  type: 'text',
                  text: caption
                } ]
                : []
            })
            // set cursor at end of caption field
            .command(({ tr, commands }) => {
              const { doc, selection } = tr;
              const position = doc.resolve(selection.to - 2).end();

              return commands.setTextSelection(position);
            })
            .run();
        },
        // setFigure: ({ caption, ...attrs }) => ({ chain }) => {
        //   return chain()
        //     .insertContent({
        //       type: this.name,
        //       attrs,
        //       content: caption
        //         ? [ {
        //           type: 'text',
        //           text: caption
        //         } ]
        //         : []
        //     })
        //     // set cursor at end of caption field
        //     .command(({ tr, commands }) => {
        //       const { doc, selection } = tr;
        //       const position = doc.resolve(selection.to - 2).end();

        //       return commands.setTextSelection(position);
        //     })
        //     .run();
        // },

        // imageToFigure: () => ({ tr, commands }) => {
        //   const { doc, selection } = tr;
        //   const { from, to } = selection;
        //   const images = findChildrenInRange(doc, {
        //     from,
        //     to
        //   }, node => node.type.name === 'image');

        //   if (!images.length) {
        //     return false;
        //   }

        //   const tracker = new Tracker(tr);

        //   return commands.forEach(images, ({ node, pos }) => {
        //     const mapResult = tracker.map(pos);

        //     if (mapResult.deleted) {
        //       return false;
        //     }

        //     const range = {
        //       from: mapResult.position,
        //       to: mapResult.position + node.nodeSize
        //     };

        //     return commands.insertContentAt(range, {
        //       type: this.name,
        //       attrs: {
        //         src: node.attrs.src
        //       }
        //     });
        //   });
        // },

        figureToImage: () => ({ tr, commands }) => {
          const { doc, selection } = tr;
          const { from, to } = selection;
          const figures = findChildrenInRange(doc, {
            from,
            to
          }, node => node.type.name === this.name);

          if (!figures.length) {
            return false;
          }

          const tracker = new Tracker(tr);

          return commands.forEach(figures, ({ node, pos }) => {
            const mapResult = tracker.map(pos);

            if (mapResult.deleted) {
              return false;
            }

            const range = {
              from: mapResult.position,
              to: mapResult.position + node.nodeSize
            };

            return commands.insertContentAt(range, {
              type: 'image',
              attrs: {
                src: node.attrs.src
              }
            });
          });
        }
      };
    },

    renderHTML({ HTMLAttributes }) {
      console.log(HTMLAttributes);
      return [
        'figure', this.options.HTMLAttributes,
        [
          'img',
          mergeAttributes(
            HTMLAttributes,
            {
              src: `${apos.modules['@apostrophecms/image'].action}/${HTMLAttributes.imageId}/src`,
              draggable: false,
              contenteditable: false
            }
          )
        ],
        [ 'figcaption', 0 ]
      ];
      // return [
      //   'figure',
      //   {
      //     class: HTMLAttributes.style || this.options.HTMLAttributes.style
      //   },
      //   [
      //     'img',
      //     {
      //       src: `${apos.modules['@apostrophecms/image'].action}/${HTMLAttributes.imageId}/src`
      //     }
      //   ],
      //   [
      //     'figcaption',
      //     {},
      //     HTMLAttributes.caption
      //   ]
      // ];
    }
  });
};
