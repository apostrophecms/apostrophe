import {
  // findChildrenInRange,
  mergeAttributes,
  Node,
  nodeInputRule
} from '@tiptap/core';

const inputRegex = /!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/;

export default options => {
  return Node.create({
    name: 'image',

    addOptions() {
      return {
        addPasteHandler: true,
        renderText({ options, node }) {
          console.log({ options, node });
          return node.attrs.imageId;
        },
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

    // addAttributes2() {
    //   return {
    //     src: {
    //       default: null,
    //       parseHTML: element => element.querySelector('img')?.getAttribute('src'),
    //     },

    //     alt: {
    //       default: null,
    //       parseHTML: element => element.querySelector('img')?.getAttribute('alt'),
    //     },

    //     title: {
    //       default: null,
    //       parseHTML: element => element.querySelector('img')?.getAttribute('title'),
    //     },
    //   }
    // },

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
    },

    renderText({ node }) {
      console.log('renderText', node);
      return this.options.renderText({
        options: this.options,
        node,
      })
    },

    addInputRules() {
      return [
        nodeInputRule({
          find: inputRegex,
          type: this.type,
          getAttributes: match => {
            const [, src, alt, title] = match

            return { src, alt, title }
          },
        }),
      ]
    }
  });
};
