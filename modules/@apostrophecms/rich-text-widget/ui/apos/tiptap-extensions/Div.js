import { mergeAttributes, Node } from '@tiptap/core';

export default (options) => {
  return Node.create({

    name: 'div',

    addOptions() {
      return {
        HTMLAttributes: {}
      };
    },

    content: 'block+',

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
        setDiv: () => ({ commands }) => {
          return commands.wrapIn(this.name);
        },
        toggleDiv: () => ({ commands }) => {
          return commands.toggleWrap(this.name);
        },
        unsetDiv: () => ({ commands }) => {
          return commands.lift(this.name);
        }
      };
    }
  });
};
