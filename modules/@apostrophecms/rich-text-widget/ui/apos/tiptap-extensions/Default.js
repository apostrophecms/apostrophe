// If a style has been marked `def`, we need to make sure it
// and its attributes are prioritized in our editor.
//
// Specifically, when the "enter" key is pressed, we don't want
// tiptap/prosemirror to insert "paragraph" nodes in a rich
// text widget in which they are not even configured as an option.
//
// The simplest way to ensure this is to create a new node type that
// matches the tag and CSS class of the default style (the first
// configured style, or the one marked with def: `true`).
//
// Matching extensions have been provided to the document and listItem types
// to prefer defaultNode rather than paragraph.

import { Node } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';

const nodeMap = {
  heading: Heading,
  paragraph: Paragraph
};

export default (options) => {
  const [ def ] = options.styles.filter(style => style.def);

  if (!def) {
    return;
  }

  // Configuration has a default style
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
            getAttrs: el => el.hasAttribute('style') ? {} : false
          }
        ];
      }
    });
  }
};
