import Link from '@tiptap/extension-link';
export default (options) => {
  return Link.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        openOnClick: false,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: null,
          'aria-label': null
        }
      };
    },
    addAttributes() {
      return {
        'aria-label': {
          default: this.options.HTMLAttributes['aria-label']
        },
        href: {
          default: null,
        },
        target: {
          default: this.options.HTMLAttributes.target
        },
        rel: {
          default: this.options.HTMLAttributes.rel
        },
        class: {
          default: this.options.HTMLAttributes.class
        },
      }
    },
  
  });
};
