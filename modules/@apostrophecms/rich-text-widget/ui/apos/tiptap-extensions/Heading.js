import Heading from '@tiptap/extension-heading';
export default (styles) => {
  const allow = {};
  const headings = styles.filter(s => s.type === 'heading');
  headings.forEach(h => {
    if (allow[h.tag]) {
      allow[h.tag].push(h.class || null);
    } else {
      allow[h.tag] = [ h.class || null ];
    }
  });
  for (const key in allow) {
    if (allow[key].length === 1 && allow[key][0] === null) {
      allow[key] = [];
    }
  }
  console.log(allow);
  return Heading.extend({
    addAttributes() {
      return {
        class: {
          default: null,
          parseHTML(element) {
            console.log('run');
            const tag = element.tagName;
            // dont have this tag configured at all
            if (!allow[tag]) {
              return {
                class: null
              };
            }
            const classes = (element.getAttribute('class') || '')
              .split(' ')
              .filter(c => allow[tag].includes(c));
            // console.log(allow);
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
    }
  });
};
