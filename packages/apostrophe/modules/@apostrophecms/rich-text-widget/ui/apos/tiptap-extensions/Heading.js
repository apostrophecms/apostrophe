// Lock Heading levels down to just those provided via configuration
import Heading from '@tiptap/extension-heading';

export default (options) => {
  const headings = options.nodes.filter(style => style.type === 'heading');
  const levels = headings.map(heading => heading.options.level);
  const defaultLevel = headings.filter(heading => heading.def).length
    ? headings.filter(heading => heading.def)[0].options.level
    : levels[0];
  return Heading.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        levels
      };
    },
    addAttributes() {
      return {
        ...this.parent?.(),
        level: {
          default: defaultLevel,
          rendered: false
        }
      };
    },
    addKeyboardShortcuts() {
      const marks = Object.keys(this.editor.schema.marks);
      return this.options.levels.reduce((items, level) => ({
        ...items,
        ...{
          [`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level }),
          Enter: () => marks.forEach(mark => this.editor.commands.unsetMark(mark))
        }
      }), {});
    }
  });
};
