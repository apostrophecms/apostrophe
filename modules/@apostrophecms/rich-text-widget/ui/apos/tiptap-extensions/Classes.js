// Enhances common node/mark types to accept a class parameter
// and filter out classes that don't match the list on paste/parse
import { Extension } from '@tiptap/core';
export default (options) => {
  // Create a class allowlist map for each element
  const allow = {};
  options.styles.forEach(style => {
    const tag = style.tag.toLowerCase();
    allow[tag] = (allow[tag] || []).concat(...(style.class ? style.class.split(' ') : [ null ]));
  });
  return Extension.create({
    addGlobalAttributes() {
      return [
        {
          types: Object.keys(options.types),
          attributes: {
            class: {
              default: null,
              renderHTML(attributes) {
                return {
                  class: attributes.class
                };
              },
              parseHTML(element) {
                const tag = element.tagName.toLowerCase();
                // This tag is not configured
                if (!allow[tag]) {
                  return {
                    class: null
                  };
                }
                const classes = (element.getAttribute('class') || '')
                  .split(' ')
                  .filter(c => allow[tag].includes(c));
                // If we have valid classes, join and return them.
                // If no valid classes for this parse, default to the
                // the first setting for this tag (including null for tags defined without classes).
                // else, remove classes.
                return classes.length
                  ? classes.join(' ')
                  : (
                    allow[tag].length ? allow[tag][0] : null
                  );
              }
            }
          }
        }
      ];
    }
  });
};
