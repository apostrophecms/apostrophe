// Acts a custom Document extension
import { Node } from '@tiptap/core';
export default (options) => {
  const defNode = options.styles.filter(style => style.def)[0];
  const defNodeType = defNode ? defNode.type : null;
  const hasParagraph = !!options.styles.filter(style => style.type === 'paragraph').length;
  let content = 'block+'; // one or more block nodes (default Document setting)
  if (defNodeType) {
    if (defNodeType === 'heading') {
      if (hasParagraph) {
        // one or more headings or block nodes (prioritizes headings)
        content = '(heading|block)+';
      } else {
        // one or more heading nodes
        content = 'heading+';
      }
    }
  }
  return Node.create({
    name: 'doc',
    topNode: true,
    content
  });
};
