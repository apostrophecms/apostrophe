import Heading from '@tiptap/extension-heading';
export default (options) => {
  return Heading.extend({
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
