// If a style has been marked `def`, we need to make sure it
// and it's attributes are prioritized in our editor.
// It's easier to create a new Node with our specifications and put it
// at the front of the line than try to infer between editor instantiation
// and the editor-user setting styles via the toolbar to know when its needed.

import { Node } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';

const nodeMap = {
  heading: Heading,
  paragraph: Paragraph
};

export default (options) => {
  const def = options.styles.filter(style => style.def)[0];

  // Configuration has a default style
  if (def) {
    const nodeName = 'defaultNode';
    const attrs = {
      class: def.options.class || null
    };

    if (def.type === 'heading' || def.type === 'paragraph') {
      return nodeMap[def.type].extend({
        name: nodeName,
        addOptions() {
          return {
            ...this.parent?.(),
            HTMLAttributes: attrs,
            levels: def.options.level ? [ def.options.level ] : null
          };
        }
      });
    }

    if (def.type === 'textStyle') {
      return Node.create({
        group: 'block',
        content: 'text*',
        name: nodeName,
        addOptions() {
          return {
            ...this.parent?.(),
            HTMLAttributes: attrs
          };
        },
        renderHTML: () => {
          return [ 'span', attrs, 0 ];
        },
        parseHTML() {
          return [
            {
              tag: 'span',
              getAttrs: element => {
                const hasStyles = element.hasAttribute('style');
                if (!hasStyles) {
                  return false;
                }
                return {};
              }
            }
          ];
        }
      });
    }
  }
};
