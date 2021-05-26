import Heading from '@tiptap/extension-heading';
export default (styles) => {

  // Create an allowlist for classes, per available heading tag
  const allow = {};
  const headings = styles
    .filter(s => s.type === 'heading')
    .map(s => {
      s.tag = s.tag.toLowerCase();
      return s;
    });
  headings.forEach(h => {
    if (allow[h.tag]) {
      allow[h.tag].push(h.class || null);
    } else {
      allow[h.tag] = [ h.class || null ];
    }
  });

  // Headings with no classes collapsed to empty array
  for (const key in allow) {
    if (allow[key].length === 1 && allow[key][0] === null) {
      allow[key] = [];
    }
  }

  return Heading.extend({
    addAttributes() {
      return {
        class: {
          default: null,
          parseHTML(element) {
            const tag = element.tagName.toLowerCase();
            // dont have this tag configured at all
            if (!allow[tag]) {
              console.log('bail');
              return {
                class: null
              };
            }
            console.log('continuing');
            const classes = (element.getAttribute('class') || '')
              .split(' ')
              .filter(c => allow[tag].includes(c));
            // console.log(allow);
            console.log(classes);
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
