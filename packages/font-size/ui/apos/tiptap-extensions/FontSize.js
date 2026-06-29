// Allows the font size of selected rich text to be freely set. Like the core
// Color extension (which wraps @tiptap/extension-color), it stores its value
// as an attribute of the shared `textStyle` mark, so the result is rendered
// as <span style="font-size: ...">...</span>. This relies on the TextStyle
// extension, which the core rich text widget always loads.
import { Extension } from '@tiptap/core';

export default (options) => {
  return Extension.create({
    name: 'fontSize',
    addOptions() {
      return {
        types: [ 'textStyle' ]
      };
    },
    addGlobalAttributes() {
      return [
        {
          types: this.options.types,
          attributes: {
            fontSize: {
              default: null,
              parseHTML: element => element.style.fontSize?.replace(/['"]+/g, '') || null,
              renderHTML: attributes => {
                if (!attributes.fontSize) {
                  return {};
                }
                return {
                  style: `font-size: ${attributes.fontSize}`
                };
              }
            }
          }
        }
      ];
    },
    addCommands() {
      return {
        setFontSize: fontSize => ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontSize })
            .run();
        },
        unsetFontSize: () => ({ chain }) => {
          return chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        }
      };
    }
  });
};
