import { Node } from 'tiptap'
import { setBlockType, textblockTypeInputRule, toggleBlockType } from 'tiptap-commands'

export default class Styles extends Node {

  get name() {
    return 'styles'
  }

  get schema() {
    return {
      attrs: {
        tag: {
          default: 'p'
        },
        class: {
          default: ''
        }
      },
      content: 'inline*',
      group: 'block',
      defining: true,
      draggable: false,

      parseDOM: this.options.styles.map(style => {
        return {
          tag: style.class ? `${style.tag}[class="${style.class}"]` : `${style.tag}:not([class])`,
          attrs: {
            tag: style.tag,
            class: style.class
          }
        }
      }),

      toDOM: node => {
        console.log('in toDOM');
        console.log(node);
        const attrs = {};
        if (node.attrs.class) {
          attrs.class = node.attrs.class;
        }
        console.log([ node.attrs.tag, attrs, 0 ]);
        return [ node.attrs.tag, attrs, 0 ];
      }

    }
  }

  commands({ type, schema }) {
    console.log(type);
    return attrs => {
      return setBlockType(type, {
        class: '',
        ...attrs
      });
    };
  }

  // keys({ type }) {
  //   return this.options.levels.reduce((items, level) => ({
  //     ...items,
  //     ...{
  //       [`Shift-Ctrl-${level}`]: setBlockType(type, { level }),
  //     },
  //   }), {})
  // }

  // inputRules({ type }) {
  //   return this.options.levels.map(level => textblockTypeInputRule(
  //     new RegExp(`^(#{1,${level}})\\s$`),
  //     type,
  //     () => ({ level }),
  //   ))
  // }

}