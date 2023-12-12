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
        HTMLAttributes: {}
      };
    },

    allowGapCursor: true,
    atom: true,
    selectable: true,

    group: 'block',

    content: 'inline*',

    draggable: true,

    isolating: true,

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
        },
        alt: {
          default: null,
          parseHTML: element => element.querySelector('img')?.getAttribute('alt')
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
              alt: HTMLAttributes.alt,
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
            .createParagraphNear()
            .run();
        }
      };
    }
  });
};
