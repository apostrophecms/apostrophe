import Link from '@tiptap/extension-link';
export default (options) => {
  return Link.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        openOnClick: false,
        linkOnPaste: true,
        // Intentional, the default-defaults are poorly suited
        // to CMS work e.g. nofollow
        HTMLAttributes: {}
      };
    },
    addAttributes() {
      return {
        // Necessary to not break href, etc.
        ...this.parent?.(),
        'aria-label': {
          default: null
        }
      };
    }
  });
};
