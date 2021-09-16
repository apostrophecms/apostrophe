// Lock Heading levels down to just those provided via configuration
import Heading from '@tiptap/extension-heading';

export default (options) => {
  const headings = options.styles.filter(style => style.type === 'heading');
  const levels = headings.map(heading => heading.options.level);
  const defaultLevel = headings.filter(heading => heading.def).length
    ? headings.filter(heading => heading.def)[0].options.level
    : levels[0];
  // Map of headings to their attributes
  const attrs = {};
  levels.forEach(level => {
    attrs[level] = headings.find(heading => heading.options.level === level).options.attrs || {};
  });
  return Heading.extend({
    defaultOptions: {
      levels,
      attrs
    },
    addAttributes() {
      return {
        level: {
          default: defaultLevel,
          rendered: false
        }
      };
    },
    renderHTML({ node, HTMLAttributes }) {
      // This ensures that headings always attempt to get their associated classes
      // even when instantiated by tiptap (on creation). Otherwise classes are only
      // applied when the editor sets them using the styles toolbar
      const hasLevel = this.options.levels.includes(node.attrs.level);
      const level = hasLevel
        ? node.attrs.level
        : this.options.levels[0];
      return [ `h${level}`, attrs[level], 0 ];
    }
  });
};
