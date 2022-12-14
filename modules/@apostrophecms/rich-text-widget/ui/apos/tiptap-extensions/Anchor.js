// Based on sample code:
// https://gist.github.com/mackmm145/f100a62de841464872785e3d041be13f

import { Mark, mergeAttributes } from '@tiptap/core';

export const jumpAnchor = Mark.create({
  name: 'anchor',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {};
          }

          return {
            id: attributes.id
          };
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-anchor]'
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [ 'span', mergeAttributes({ 'data-anchor': true }, HTMLAttributes), 0 ];
  },

  addCommands() {
    return {
      setAnchor: (attributes) => ({ chain }) => {
        return chain().extendMarkRange('jumpAnchor').setMark('jumpAnchor', attributes).run()
      },
      getAnchor: () => ({ commands }) => {
        if (this.editor.view.state.selection.$from.nodeAfter == null) {
          return;
        }

        const node = this.editor.view.state.selection.$from.nodeAfter;
        const mark = node.marks.find(mark => mark.type && mark.type.name === 'anchor');
        if (mark) {
          return mark.attrs.id;
        }
      },
      unsetAnchor: () => ({ commands }) => {
        console.log('unsetAnchor not written...');
      }
    };
  }
});
