// Enhances common node/mark types to accept a class parameter
// and filter out classes that don't match the list on paste/parse
import { Extension } from '@tiptap/core';

export default (options) => {
  // Create a class allowlist map for each element
  const allow = {};
  const styleLists = [
    options.styles.nodes || [],
    options.styles.marks || []
  ];
  styleLists.forEach((styleList) => {
    styleList.forEach((style) => {
      const tag = style.tag?.toLowerCase();
      if (tag) {
        allow[tag] = (allow[tag] || []).concat(
          ...(style.class ? style.class.split(' ') : [])
        );
      }
      // If a class is allowed on other tags, add it to their allowlist
      if (style.allowedTags) {
        style.allowedTags.forEach((allowedTag) => {
          allow[allowedTag] = (allow[allowedTag] || []).concat(
            ...(style.class ? style.class.split(' ') : [])
          );
        });
      }
    });
  });

  return Extension.create({
    addCommands() {
      return {
        toggleClass:
          (type, options) =>
            ({ editor, commands }) => {
              // let applied = false;

              for (let i = 0; i < options.typeChecks.length; i++) {
                const check = options.typeChecks[i];

                console.log('checking', editor.isActive(check.type, check.attributes));
                console.log('double checking', editor.isActive(check.type));

                // Are we in one of our allowed els?
                if (editor.isActive(check.type, check.attributes)) {
                  let finalClasses;

                  // does the el already have the class?
                  let currentClasses = editor.getAttributes(check.type).class;

                  // classes can come back as null, string, or array
                  // normalize them to an array

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

                  // it already has it, remove it
                  if (currentClasses.includes(options.class)) {
                    finalClasses = currentClasses.filter(
                      (c) => c !== options.class
                    );
                    // it doesn't have it, append it
                  } else {
                    finalClasses = currentClasses.concat(options.class);
                  }

                  // Update the el we found with the final classes
                  commands.updateAttributes(check.type, {
                    class: finalClasses.length
                      ? finalClasses.join(' ')
                      : null
                  });
                  // applied = true;
                  break;
                }
              }

              // If we have not touched whats active we need to
              // insert or remove the default el
              // if (!applied) {
              //   console.log('applying default');
              //   commands[options.applyCommand](type, {
              //     class: options.class
              //   });
              // }
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
                  .filter((c) => allow[tag].includes(c));

                // If we have valid classes, join and return them.
                // If no valid classes for this parse, default to the
                // the first setting for this tag (including null for tags defined without classes).
                // else, remove classes.
                const defaultOrNull =
                  options.styles.nodes.find(s => s.tag === tag)?.class ||
                  options.styles.marks.find(s => s.tag === tag)?.class ||
                  null;
                return classes.length
                  ? classes.join(' ')
                  : defaultOrNull;
              }
            }
          }
        }
      ];
    }
  });
};
