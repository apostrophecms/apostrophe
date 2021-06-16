import Link from '@tiptap/extension-link';
export default (options) => {
  return Link.extend({
    defaultOptions: {
      openOnClick: false,
      linkOnPaste: true,
      HTMLAttributes: {}
    }
  });
};
