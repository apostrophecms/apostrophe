import Link from '@tiptap/extension-link';
export default (options) => {
  return Link.extend({
    defaultOptions: {
      openOnClick: true,
      linkOnPaste: true,
      HTMLAttributes: {}
    }
  });
};
