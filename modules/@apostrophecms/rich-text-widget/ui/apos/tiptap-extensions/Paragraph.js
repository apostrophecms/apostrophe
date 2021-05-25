import Paragraph from '@tiptap/extension-paragraph';
export default (options) => {
  console.log('hello');
  console.log(options);
  return Paragraph.extend({
    addAttributes() {
      return {
        class: {
          default: 'def',
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
