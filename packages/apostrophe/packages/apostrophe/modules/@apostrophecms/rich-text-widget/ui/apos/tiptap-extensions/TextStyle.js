import TextStyle from '@tiptap/extension-text-style';
export default (options) => {
  return TextStyle.extend({
    parseHTML() {
      return [
        { tag: 'span' }
      ];
    }
  });
};
