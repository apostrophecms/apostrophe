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
          0
        ]
      ];
    },

    addCommands() {
      return {
        // setImage: attrs => ({ commands }) => {
        //   return commands.insertContent({
        //     type: this.name,
        //     attrs
        //   });
        // }
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
            // .command(({ tr, commands }) => {
            //   const { doc, selection } = tr;
            //   const position = doc.resolve(selection.to - 2).end();

            //   return commands.setTextSelection(position);
            // })
            .run();
        }
      };
    }
  });
};
