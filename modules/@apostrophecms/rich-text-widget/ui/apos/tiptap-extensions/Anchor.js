// Implement named anchors as spans with ids (more HTML5-ish).

import { Mark, mergeAttributes } from '@tiptap/core';

export default (options) => {
  return Mark.create({
    name: 'anchor',

    // What does this do? Copied from link
    priority: 1000,

    // What does this do? Copied from link
    keepOnSplit: false,

    addAttributes() {
      return {
        id: {
          default: null
        }
      };
    },

    parseHTML() {
      return [
        { tag: 'span[id]' }
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
        0
      ];
    },

    addCommands() {
      return {
        setAnchor: attributes => ({ chain }) => {
          return chain()
            .setMark(this.name, attributes)
            .run();
        },

        toggleAnchor: attributes => ({ chain }) => {
          return chain()
            .toggleMark(this.name, attributes, { extendEmptyMarkRange: true })
            .run();
        },

        unsetAnchor: () => ({ chain }) => {
          return chain()
            .unsetMark(this.name, { extendEmptyMarkRange: true })
            .run();
        }
      };
    }
  });
};
