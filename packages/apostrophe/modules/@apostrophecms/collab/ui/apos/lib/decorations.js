// Shows, in a ProseMirror editor, where other people are and what they just
// changed. Changes are tinted in the color of whoever made them, with their
// name, and fade away (see `TheAposCollabPresence.vue` for the styles);
// cursors stay as long as their owners are here.
//
// Driven entirely by transaction metadata, see `addChange`, `removeChange`
// and `setCursors`.

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const collabDecorationsKey = new PluginKey('aposCollabDecorations');

let nextChange = 1;

export function collabDecorations() {
  return new Plugin({
    key: collabDecorationsKey,
    state: {
      init() {
        return {
          changes: DecorationSet.empty,
          cursors: DecorationSet.empty
        };
      },
      apply(tr, value) {
        let changes = value.changes.map(tr.mapping, tr.doc);
        let cursors = value.cursors.map(tr.mapping, tr.doc);
        const meta = tr.getMeta(collabDecorationsKey);
        if (meta?.addChange) {
          changes = changes.add(tr.doc, changeDecorations(tr.doc, meta.addChange));
        }
        if (meta?.removeChange) {
          changes = changes.remove(changes.find(
            undefined,
            undefined,
            spec => spec.changeId === meta.removeChange
          ));
        }
        if (meta?.cursors) {
          cursors = DecorationSet.create(tr.doc, cursorDecorations(tr.doc, meta.cursors));
        }
        return {
          changes,
          cursors
        };
      }
    },
    props: {
      decorations(state) {
        const { changes, cursors } = collabDecorationsKey.getState(state);
        return changes.add(state.doc, cursors.find());
      }
    }
  });
}

// Point out a change: `{ ranges, color, title }`, `ranges` being
// `[ from, to ]` pairs in the document as it is now. Resolves the id to pass
// to `removeChange`
export function addChange(view, change) {
  const id = nextChange++;
  view.dispatch(view.state.tr.setMeta(collabDecorationsKey, {
    addChange: {
      ...change,
      id
    }
  }));
  return id;
}

export function removeChange(view, id) {
  if (view.isDestroyed) {
    return;
  }
  view.dispatch(view.state.tr.setMeta(collabDecorationsKey, {
    removeChange: id
  }));
}

// Show these cursors, replacing any shown before: an array of
// `{ tabId, anchor, head, color, title }`
export function setCursors(view, cursors) {
  if (view.isDestroyed) {
    return;
  }
  view.dispatch(view.state.tr.setMeta(collabDecorationsKey, {
    cursors
  }));
}

// The ranges of the document that `tr` changed, in the document it produced.
// Only the steps from `from`, `count` of them, are considered: a transaction
// that folds in someone else's steps also takes ours off and puts them back
// on top, and those are not the change to point out
export function changedRanges(tr, { from = 0, count = tr.mapping.maps.length } = {}) {
  const ranges = [];
  tr.mapping.maps.forEach((map, i) => {
    if ((i < from) || (i >= from + count)) {
      return;
    }
    const rest = tr.mapping.slice(i + 1);
    map.forEach((oldStart, oldEnd, newStart, newEnd) => {
      const from = rest.map(newStart, -1);
      const to = rest.map(newEnd, 1);
      ranges.push([ Math.min(from, to), Math.max(from, to) ]);
    });
  });
  return ranges;
}

function clamp(doc, pos) {
  return Math.max(0, Math.min(pos, doc.content.size));
}

function changeDecorations(doc, {
  id, ranges, color, title
}) {
  const style = `--apos-collab-color: ${color}`;
  const decorations = [];
  let last = null;
  for (const [ start, end ] of ranges) {
    const from = clamp(doc, start);
    const to = clamp(doc, end);
    if (to > from) {
      decorations.push(Decoration.inline(from, to, {
        class: 'apos-collab-change',
        style
      }, {
        changeId: id
      }));
    }
    last = Math.max(last ?? to, to);
  }
  if (last !== null) {
    decorations.push(Decoration.widget(last, () => label('apos-collab-change__tag', title, style), {
      side: 1,
      changeId: id,
      ignoreSelection: true
    }));
  }
  return decorations;
}

function cursorDecorations(doc, cursors) {
  const decorations = [];
  for (const cursor of cursors) {
    const style = `--apos-collab-color: ${cursor.color}`;
    const anchor = clamp(doc, cursor.anchor);
    const head = clamp(doc, cursor.head);
    if (anchor !== head) {
      decorations.push(Decoration.inline(Math.min(anchor, head), Math.max(anchor, head), {
        class: 'apos-collab-selection',
        style
      }));
    }
    decorations.push(Decoration.widget(head, () => {
      const caret = document.createElement('span');
      caret.className = 'apos-collab-cursor';
      caret.setAttribute('style', style);
      caret.appendChild(label('apos-collab-cursor__label', cursor.title, style));
      return caret;
    }, {
      side: -1,
      key: `cursor-${cursor.tabId}-${cursor.title}`,
      ignoreSelection: true
    }));
  }
  return decorations;
}

function label(className, text, style) {
  const el = document.createElement('span');
  el.className = className;
  el.setAttribute('style', style);
  el.setAttribute('contenteditable', 'false');
  el.textContent = text || '';
  return el;
}
