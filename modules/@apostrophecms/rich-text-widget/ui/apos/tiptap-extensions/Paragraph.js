import Paragraph from '@tiptap/extension-paragraph';
export default (options) => {
  const allow = options.styles
    .filter(s => s.tag === 'p')
    .map(s => s.class);
  // console.log(classes);
  return Paragraph.extend({
    addAttributes() {
      return {
        class: {
          // default: allow.length ? allow[0] : null,
          default: null,
          parseHTML(element) {
            return {
              class: element.getAttribute('class')
            };
          },
          renderHTML(attributes) {
            console.log(attributes.class);
            const classes = (attributes.class || '')
              .split(' ')
              .filter(c => {
                // console.log(c);
                // console.log(allowList.includes(c));
                return allow.includes(c);
              });
            console.log(classes);
            // const allowedClass = attributes.class.filter()
            return {
              // class: attributes.class
              class: classes.length ? classes.join(' ') : null
            };
          }
        }
      };
    },

  });
};
