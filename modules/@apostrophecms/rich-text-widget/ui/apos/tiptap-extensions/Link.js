import Link from '@tiptap/extension-link';
export default (options) => {
  const attrs = apos.modules['@apostrophecms/rich-text-widget'].linkSchema
    .filter(field => field.htmlAttribute)
    .reduce((obj, field) => {
      obj[field.name] = { default: null };
      return obj;
    }, {});

  return Link.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        ...attrs,
        openOnClick: false,
        linkOnPaste: true,
        HTMLAttributes: {}
      };
    }
  });
};
