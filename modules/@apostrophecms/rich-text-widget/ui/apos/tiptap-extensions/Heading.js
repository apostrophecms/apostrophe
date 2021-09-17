// Lock Heading levels down to just those provided via configuration
import Heading from '@tiptap/extension-heading';

export default (options) => {
  const headings = options.styles.filter(style => style.type === 'heading');
  const levels = headings.map(heading => heading.options.level);
  const defaultLevel = headings.filter(heading => heading.def).length
    ? headings.filter(heading => heading.def)[0].options.level
    : levels[0];
  return Heading.extend({
    defaultOptions: {
      levels
    },
    addAttributes() {
      return {
        level: {
          default: defaultLevel,
          rendered: false
        }
      };
    }
  });
};
