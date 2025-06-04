import Link from '@tiptap/extension-link';
export default (options) => {
  return Link.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        openOnClick: false,
        linkOnPaste: true,
        HTMLAttributes: {}
      };
    },
    addAttributes() {
      return {
        ...this.parent?.(),
        title: {
          default: null,
          parseHTML: element => element.getAttribute('title')
        },
        ...apos.modules['@apostrophecms/rich-text-widget'].linkSchema
          .filter(field => !!field.htmlAttribute)
          .filter(field => !field.extensions || field.extensions.includes('Link'))
          .reduce((obj, field) => {
            obj[field.htmlAttribute] = { default: field.def ?? null };
            return obj;
          }, {})
      };
    }
  });
};
