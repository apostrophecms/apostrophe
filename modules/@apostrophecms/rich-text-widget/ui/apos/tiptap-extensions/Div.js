import { mergeAttributes, Node } from '@tiptap/core';

// Based on the default heading extension

export default (options) => {
  return Node.create({

    name: 'div',

    addOptions() {
      return {
        HTMLAttributes: {}
      };
    },

    content: 'inline*',

    group: 'block',

    defining: true,

    parseHTML() {
      return [
        { tag: 'div' }
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [ 'div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0 ];
    },

    addCommands() {
      return {
        setDiv: attributes => ({ commands }) => {
          return commands.setNode(this.name, attributes);
        },
        toggleDiv: attributes => ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph', attributes);
        }
      };
    }
  });
};
