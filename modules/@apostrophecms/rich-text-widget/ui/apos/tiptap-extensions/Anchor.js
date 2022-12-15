// Based on the official TextAlign extension

import { Extension } from '@tiptap/core';

export default (options) => {
  return Extension.create({
    name: 'anchor',

    addOptions() {
      return {
        types: Object.keys(options.types)
      };
    },

    addGlobalAttributes() {
      return [
        {
          types: this.options.types,
          attributes: {
            anchor: {
              default: '',
              parseHTML: element => {
                return element.getAttribute('data-anchor') || element.getAttribute('id') || element.getAttribute('name') || '';
              },
              renderHTML: attributes => {
                if (attributes.anchor === '') {
                  return {};
                }
                return {
                  'data-anchor': attributes.anchor
                };
              }
            }
          }
        }
      ];
    },

    addCommands() {
      return {
        setAnchor: ({ anchor }) => ({ commands }) => {
          if (!((typeof anchor) === 'string') || anchor.match(/\s/)) {
            return false;
          }
          return this.options.types.every(type => commands.updateAttributes(type, {
            anchor
          }));
        },

        unsetAnchor: () => ({ commands }) => {
          return this.options.types.every(type => commands.resetAttributes(type, 'anchor'));
        }
      };
    }
  });
};
