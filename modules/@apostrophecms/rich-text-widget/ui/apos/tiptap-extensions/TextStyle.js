import TextStyle from '@tiptap/extension-text-style';
export default (options) => {
  return TextStyle.extend({
    addAttributes() {
      return {
        class: {
          default: null,
          parseHTML(element) {
            return {
              class: element.getAttribute('class')
            };
          }
        }
      };
    }
  });
};
