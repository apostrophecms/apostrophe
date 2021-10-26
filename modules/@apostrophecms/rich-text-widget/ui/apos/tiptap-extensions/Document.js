// Acts as a custom Document extension
import { Node } from '@tiptap/core';
export default (options) => {
  const def = options.styles.filter(style => style.def)[0];
  let content = 'block+'; // one or more block nodes (default Document setting)
  if (def) {
    // one/more defaultNodes (created in ./Default) or one/more other block nodes
    content = '(defaultNode|block)+';
  }
  return Node.create({
    name: 'doc',
    topNode: true,
    content
  });
};
