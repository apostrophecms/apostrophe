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

    name: 'image',

    addOptions() {
      return {
        // inline: true,
        addPasteHandler: true,
        HTMLAttributes: {}
      };
    },

    allowGapCursor: true,
    atom: true,
    selectable: true,

    group: 'block',

    content: 'inline*',

    draggable: true,

    isolating: false,

    addAttributes() {
      return {
        imageId: {
          default: null,
          parseHTML: element => {
            const src = element.querySelector('img')?.getAttribute('src');

            const components = src.split('/');
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
        caption: {
          default: '',
          parseHTML: element => element.querySelector('figcaption')?.innerText || ''
        },
        style: {
          default: null,
          parseHTML: element => element.getAttribute('class')
        }
      };
    },

    parseHTML() {
      // <figure>
      //   <img src="/media/cc0-images/elephant-660-480.jpg"
      //     alt="Elephant at sunset">
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
      console.log(
        {
          HTMLAttributes,
          options
        },
        this.options.HTMLAttributes,
        HTMLAttributes.caption,
        HTMLAttributes.imageId,
        HTMLAttributes.style,
        this.options.HTMLAttributes.style
      );

      return [
        'figure',
        mergeAttributes(
          this.options.HTMLAttributes,
          {
            class: HTMLAttributes.style
          }
        ),
        [
          'img',
          mergeAttributes(
            HTMLAttributes,
            {
              src: `${apos.modules['@apostrophecms/image'].action}/${HTMLAttributes.imageId}/src`,
              alt: HTMLAttributes.caption,
              draggable: false,
              contenteditable: false
            }
          )
        ],
        [
          'figcaption',
          // 0
          {},
          HTMLAttributes.caption
        ]
        // [ 'figcaption', 0 ]
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
    },

    addCommands() {
      return {
        // setImage: attrs => ({ commands }) => {
        //   debugger;
        //   return commands.insertContent({
        //     type: this.name,
        //     attrs
        //   });
        // }
        setImage: ({ caption, ...attrs }) => ({ chain }) => {
          return chain()
            .focus()
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
        }
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

        // figureToImage: () => ({ tr, commands }) => {
        //   const { doc, selection } = tr;
        //   const { from, to } = selection;
        //   const figures = findChildrenInRange(doc, {
        //     from,
        //     to
        //   }, node => node.type.name === this.name);

        //   if (!figures.length) {
        //     return false;
        //   }

        //   const tracker = new Tracker(tr);

        //   return commands.forEach(figures, ({ node, pos }) => {
        //     const mapResult = tracker.map(pos);

        //     if (mapResult.deleted) {
        //       return false;
        //     }

        //     const range = {
        //       from: mapResult.position,
        //       to: mapResult.position + node.nodeSize
        //     };

        //     return commands.insertContentAt(range, {
        //       type: 'image',
        //       attrs: {
        //         src: node.attrs.src
        //       }
        //     });
        //   });
        // }
      };
    }
  });
};
