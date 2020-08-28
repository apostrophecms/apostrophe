import {
  Mark, Plugin, TextSelection
} from 'tiptap';
import {
  updateMark, removeMark, pasteRule
} from 'tiptap-commands';
import { getMarkRange } from 'tiptap-utils';

export default class Link extends Mark {

  get name() {
    return 'link';
  }

  get schema() {
    return {
      attrs: {
        href: {
          default: null
        },
        target: {
          default: null
        },
        // In HTML5, the name attribute is obsolete
        id: {
          default: null
        }
      },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a',
          getAttrs: dom => ({
            href: dom.getAttribute('href'),
            // Fallback for legacy name attributes
            id: dom.getAttribute('id') || dom.getAttribute('name'),
            target: dom.getAttribute('target')
          })
        }
      ],
      toDOM: node => [ 'a', {
        ...node.attrs
        // We are building a CMS, trust the links
        // rel: 'noopener noreferrer nofollow',
      }, 0 ]
    };
  }

  commands({ type }) {
    return attrs => {
      if (attrs.href || attrs.target || attrs.id) {
        return updateMark(type, attrs);
      }

      return removeMark(type);
    };
  }

  pasteRules({ type }) {
    return [
      pasteRule(
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g,
        type,
        url => ({ href: url })
      )
    ];
  }

  get plugins() {
    return [
      new Plugin({
        props: {
          handleClick(view, pos) {
            const {
              schema, doc, tr
            } = view.state;
            const range = getMarkRange(doc.resolve(pos), schema.marks.link);

            if (!range) {
              return;
            }

            const $start = doc.resolve(range.from);
            const $end = doc.resolve(range.to);
            const transaction = tr.setSelection(new TextSelection($start, $end));

            view.dispatch(transaction);
          }
        }
      })
    ];
  }

}
