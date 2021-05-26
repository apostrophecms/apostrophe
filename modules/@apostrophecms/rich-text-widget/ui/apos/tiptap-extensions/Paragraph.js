import Paragraph from '@tiptap/extension-paragraph';
export default (styles) => {
  const allow = styles
    .filter(s => s.tag === 'p')
    .map(s => s.class);
  return Paragraph.extend({
    addAttributes() {
      return {
        class: {
          default: allow.length ? allow[0] : null,
          parseHTML(element) {
            const classes = (element.getAttribute('class') || '')
              .split(' ')
              .filter(c => allow.includes(c));
            return {
              class: classes.length ? classes.join(' ') : null
            };
          },
          renderHTML(attributes) {
            return {
              class: attributes.class
            };
          }
        }
      };
    },

  });
};
