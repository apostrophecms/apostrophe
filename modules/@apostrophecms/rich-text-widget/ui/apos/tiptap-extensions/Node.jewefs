import { Node } from '@tiptap/core';
export default (options) => {
  return Node.create({
    name: 'styles',
    group: 'block',
    defining: true,
    content: 'inline*',
    // parseHTML() {
    //   return [
    //     { tag: 'p' },
    //   ]
    // },
    renderHTML({ HTMLAttributes }) {
      return [ 'div', HTMLAttributes, 0 ];
    }
  });
};
