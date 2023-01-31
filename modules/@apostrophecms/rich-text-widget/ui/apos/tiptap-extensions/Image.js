import { Node } from '@tiptap/core';

export default options => {
  return Node.create({

    name: 'image',

    addOptions() {
      return {
        addPasteHandler: true,
        HTMLAttributes: {}
      };
    },

    inline: true,

    group: 'inline',

    draggable: true,

    addAttributes() {
      return {
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
      // <figure>
      //   <img src="/media/cc0-images/elephant-660-480.jpg"
      //       alt="Elephant at sunset">
      //   <figcaption>An elephant at sunset</figcaption>
      // </figure>
      return [
        {
          tag: 'figure',
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
    },

    addCommands() {
      return {
        setImage: options => ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options
          });
        }
      };
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'figure',
        {
          class: HTMLAttributes.style || this.options.HTMLAttributes.style
        },
        [
          'img',
          {
            src: `${apos.modules['@apostrophecms/image'].action}/${HTMLAttributes.imageId}/src`
          }
        ],
        [
          'figcaption',
          {},
          HTMLAttributes.caption
        ]
      ];
    }
  });
};
