// Enhances common node/mark types to accept a class parameter
// and filter out classes that don't match the list on paste/parse
import { Extension } from '@tiptap/core';

export default (options) => {
  // Create a class allowlist map for each element
  const allow = {};
  const styles = [ ...options.nodes || [], ...options.marks || [] ];
  styles.forEach((style) => {
    const tag = style.tag?.toLowerCase();
    if (tag) {
      allow[tag] = (allow[tag] || []).concat(
        ...(style.class ? style.class.split(' ') : [])
      );
    }
  });

  return Extension.create({
    addCommands() {
      return {
        toggleClassOrToggleMark:
          (type, options) =>
            ({ editor, commands }) => {

              // If we're in a span we need to toggle the class
              if (editor.isActive('textStyle')) {
                let finalClasses;
                let currentClasses = editor.getAttributes('textStyle').class;

                // // Classes can come back as null, string, or array
                // // normalize them to an array

                if (typeof currentClasses === 'string') {
                  currentClasses = currentClasses.split(' ');
                }

                if (Array.isArray(currentClasses)) {
                  currentClasses = currentClasses.filter((c) => {
                    return typeof c === 'string' && c.length > 0;
                  });
                } else {
                  currentClasses = [];
                }

                // If this el already has this class, remove it
                if (currentClasses.includes(options.class)) {
                  finalClasses = currentClasses.filter(
                    (c) => c !== options.class
                  );
                  // If not, add it
                } else {
                  finalClasses = currentClasses.concat(options.class);
                }

                // If we're removing the last class, remove the span
                if (finalClasses.length === 0) {
                  commands.toggleMark('textStyle', { class: options.class });
                } else {
                  // Update the el we found with the final classes
                  commands.updateAttributes('textStyle', {
                    class: finalClasses.length
                      ? finalClasses.join(' ')
                      : null
                  });
                }
              } else {
                commands.toggleMark('textStyle', { class: options.class });
              }
            }
      };
    },
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
                  return null;
                }

                const classes = (element.getAttribute('class') || '')
                  .split(' ')
                  .filter(c => allow[tag].includes(c));

                // If we have valid classes, join and return them.
                // else, remove classes.
                return classes.length
                  ? classes.join(' ')
                  : null;
              }
            }
          }
        }
      ];
    }
  });
};
