// A plain string field modeled as a ProseMirror document holding nothing but
// text, so that it can be edited collaboratively exactly as rich text is
// (see `text-sync.js`) without writing a second algorithm for it. Positions
// in the document are offsets in the string.
//
// The textarea stays the editor: each change the user makes is turned into a
// step with `setValue`, and changes from elsewhere are handed back through
// `onChange` with where the user's selection should now be.

import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import {
  history, undo, redo, undoDepth, redoDepth
} from '@tiptap/pm/history';
import { COLLAB_REMOTE } from './text-sync.js';

export const stringSchema = new Schema({
  nodes: {
    doc: {
      content: 'text*'
    },
    text: {}
  }
});

// The document holding `value`
export function stringDoc(value) {
  return stringSchema.node('doc', null, value ? [ stringSchema.text(value) ] : []);
}

export default class StringModel {
  // `onChange(value, { remote, selection, tr })` is called whenever the
  // value changes other than by `setValue`, e.g. with someone else's typing
  // or on undo. `selection` is `{ start, end }`, mapped from the one passed
  // to the last `setValue` or `setSelection`
  constructor({ value = '', onChange = () => {} } = {}) {
    this.onChange = onChange;
    this.selection = {
      start: 0,
      end: 0
    };
    this.state = EditorState.create({
      doc: stringDoc(value),
      plugins: [ history() ]
    });
  }

  get value() {
    return this.state.doc.textContent;
  }

  getState() {
    return this.state;
  }

  dispatch(tr) {
    this.state = this.state.apply(tr);
    if (tr.docChanged && !tr.getMeta('aposStringModelLocal')) {
      this.selection = {
        start: tr.mapping.map(this.selection.start, -1),
        end: tr.mapping.map(this.selection.end, 1)
      };
      this.onChange(this.value, {
        remote: !!tr.getMeta(COLLAB_REMOTE),
        selection: { ...this.selection },
        tr
      });
    }
  }

  registerPlugin(plugin) {
    this.state = this.state.reconfigure({
      plugins: [ ...this.state.plugins, plugin ]
    });
  }

  // As tiptap's editor does: `key` is a `PluginKey`, or the name it was
  // created with
  unregisterPlugin(key) {
    const name = (typeof key === 'string') ? `${key}$` : key.key;
    this.state = this.state.reconfigure({
      plugins: this.state.plugins.filter(plugin => plugin.key !== name)
    });
  }

  setContent({ doc, value }) {
    const next = doc
      ? stringSchema.nodeFromJSON(doc)
      : stringDoc((typeof value === 'string') ? value : '');
    const tr = this.state.tr
      .replaceWith(0, this.state.doc.content.size, next.content)
      .setMeta('addToHistory', false)
      .setMeta('aposStringModelLocal', true);
    this.state = this.state.apply(tr);
  }

  getValue() {
    return this.value;
  }

  setSelection(start, end) {
    this.selection = {
      start,
      end
    };
  }

  // The user typed: the textarea now holds `value`. Records the difference
  // as one step, so undo and collaboration see what actually changed
  setValue(value, selection) {
    const old = this.value;
    if (selection) {
      this.selection = selection;
    }
    if (value === old) {
      return null;
    }
    const shorter = Math.min(old.length, value.length);
    let start = 0;
    while ((start < shorter) && (old[start] === value[start])) {
      start++;
    }
    let oldEnd = old.length;
    let newEnd = value.length;
    while (
      (oldEnd > start) &&
      (newEnd > start) &&
      (old[oldEnd - 1] === value[newEnd - 1])
    ) {
      oldEnd--;
      newEnd--;
    }
    const inserted = value.slice(start, newEnd);
    const tr = this.state.tr;
    if (inserted.length) {
      tr.replaceWith(start, oldEnd, stringSchema.text(inserted));
    } else {
      tr.delete(start, oldEnd);
    }
    tr.setMeta('aposStringModelLocal', true);
    this.state = this.state.apply(tr);
    return tr;
  }

  undo() {
    return undo(this.state, tr => this.dispatch(tr));
  }

  redo() {
    return redo(this.state, tr => this.dispatch(tr));
  }

  undoDepth() {
    return undoDepth(this.state);
  }

  redoDepth() {
    return redoDepth(this.state);
  }
}
