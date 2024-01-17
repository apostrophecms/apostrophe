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
        ...apos.modules['@apostrophecms/rich-text-widget'].linkSchema
          .filter(field => !!field.htmlAttribute)
          .reduce((obj, field) => {
            obj[field.htmlAttribute] = { default: field.def ?? null };
            return obj;
          }, {})
      };
    }
  });
};
