// Undo history for a rich text editor on the page, kept by the context bar
// instead of by tiptap.
//
// Two undo stacks, one per editor and one for the page, cannot share a
// keyboard shortcut without stepping on each other: undoing typing in one
// widget would clear the page's redo history, and the page's history could
// not reach typing in an editor that has since been destroyed. So on the page
// there is one stack. This extension takes the place of tiptap's `History`:
// it records what each transaction did, as ProseMirror steps and their
// inverses, and hands that to the context bar, which keeps the stack and asks
// for the steps to be replayed here on undo and redo.
//
// Transactions are grouped the way `prosemirror-history` groups them, so that
// undo takes back as much typing at once as it always has.
//
// In a modal there is no page history to join, and tiptap's own `History`
// is used as before.

import { Extension, getHTMLFromFragment } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Step } from '@tiptap/pm/transform';
import { history, undoDepth } from '@tiptap/pm/history';

// Set on transactions that replay history, so that they are not recorded
// as new history in turn
export const HISTORY_META = 'aposHistory';

const pluginKey = new PluginKey('aposContextHistory');

// As in `prosemirror-history`
const newGroupDelay = 500;

// `onRecord` receives one record per transaction the user makes, together
// with any transactions plugins appended to it:
//
// `{ steps, inverses, docBefore, docAfter, selectionBefore, selectionAfter,
// schema, newGroup }`
//
// `newGroup` is false when the record continues the typing of the previous
// one and may be merged into it.
//
// With `collab: true`, several people are editing the text at once, and
// replaying recorded steps would take back their typing along with ours. The
// editor then keeps its own history with `prosemirror-history`, which knows
// how to rebase it over everyone else's changes, and records are just
// `{ collab: true, newGroup }`: the context bar asks the editor to undo or
// redo one of its own groups (see `collabHistoryPlugins`).
export default function createContextHistory({ onRecord, collab = false }) {
  return Extension.create({
    name: 'aposContextHistory',
    // The toolbar's undo and redo buttons call these by name
    addCommands() {
      return {
        undo: () => ({ dispatch }) => {
          if (dispatch) {
            apos.bus.$emit('command-menu-admin-bar-undo');
          }
          return true;
        },
        redo: () => ({ dispatch }) => {
          if (dispatch) {
            apos.bus.$emit('command-menu-admin-bar-redo');
          }
          return true;
        }
      };
    },
    // The bindings `History` provides. The page's own shortcut does not
    // fire while the cursor is in an editor, so they are routed to the
    // context bar from here. Returning true also keeps the browser's own
    // undo away from the editor's markup
    addKeyboardShortcuts() {
      const undo = () => {
        apos.bus.$emit('command-menu-admin-bar-undo');
        return true;
      };
      const redo = () => {
        apos.bus.$emit('command-menu-admin-bar-redo');
        return true;
      };
      return {
        'Mod-z': undo,
        'Shift-Mod-z': redo,
        'Mod-y': redo,
        // The last two are tiptap's, kept exactly as its `History`
        // extension has them so that turning that extension off here takes
        // nothing away. A keymap matches the character the key reports, and
        // on the Russian layout the key where Z sits reports `я`, so
        // `Mod-z` never matches there. Other Cyrillic layouts put `я`
        // elsewhere and are not covered, by tiptap or by us
        'Mod-я': undo,
        'Shift-Mod-я': redo
      };
    },
    addProseMirrorPlugins() {
      return collab
        ? collabHistoryPlugins({ onRecord })
        : [ createHistoryPlugin({ onRecord }) ];
    }
  });
}

// As deep as the context bar's own history
const collabHistoryDepth = 500;

// See `collab` above. Each transaction the user makes is reported once the
// view has it; it starts a new record if `prosemirror-history` started a new
// group for it, so that undoing a record undoes exactly one group
export function collabHistoryPlugins({ onRecord }) {
  const key = new PluginKey('aposCollabHistory');
  return [
    history({ depth: collabHistoryDepth }),
    new Plugin({
      key,
      state: {
        init() {
          return { userChange: false };
        },
        apply(tr, value) {
          const appended = tr.getMeta('appendedTransaction');
          const userChange = tr.docChanged &&
            !tr.getMeta('history$') &&
            (tr.getMeta('addToHistory') !== false) &&
            !tr.getMeta(HISTORY_META);
          if (appended) {
            return value;
          }
          return { userChange };
        }
      },
      view(view) {
        let depth = undoDepth(view.state);
        return {
          update(view) {
            const current = undoDepth(view.state);
            const { userChange } = key.getState(view.state);
            if (userChange && current) {
              onRecord({
                collab: true,
                newGroup: current > depth
              });
            }
            depth = current;
          }
        };
      }
    })
  ];
}

// The ProseMirror plugin doing the recording, separate from the extension
// so that it can be tested without an editor
export function createHistoryPlugin({ onRecord }) {
  return new Plugin({
    key: pluginKey,
    state: {
      init() {
        return {
          prevTime: 0,
          prevRanges: null,
          prevComposition: -1,
          record: null
        };
      },
      apply: applyTransaction
    },
    // Recording happens as the state is computed, but reporting waits for
    // the view to take it, by which time any transactions appended by other
    // plugins have been folded into the record too
    view() {
      let reported = null;
      return {
        update(view) {
          const { record } = pluginKey.getState(view.state);
          if (record && (record !== reported)) {
            reported = record;
            onRecord(record);
          }
        }
      };
    }
  });
}

function applyTransaction(tr, value, oldState, newState) {
  const appended = tr.getMeta('appendedTransaction');
  if (!appended) {
    // A new transaction from the user, nothing to report yet
    value = {
      ...value,
      record: null
    };
  }
  if (!tr.steps.length) {
    return value;
  }
  if (
    unrecorded(tr) ||
    (appended && unrecorded(appended))
  ) {
    // The recorded steps may no longer line up with the document, and
    // whatever is typed next must not be merged into a record made before
    // this happened
    return {
      ...value,
      prevTime: 0,
      prevRanges: null
    };
  }
  const inverses = tr.steps.map((step, i) => step.invert(tr.docs[i]));
  if (appended && value.record) {
    return {
      ...value,
      prevRanges: mapRanges(value.prevRanges, tr.mapping),
      record: {
        ...value.record,
        steps: [ ...value.record.steps, ...tr.steps ],
        inverses: [ ...value.record.inverses, ...inverses ],
        docAfter: newState.doc,
        selectionAfter: newState.selection.getBookmark()
      }
    };
  }
  const composition = tr.getMeta('composition');
  const newGroup = (value.prevTime === 0) ||
    (
      !appended &&
      (value.prevComposition !== composition) &&
      (
        (value.prevTime < (tr.time || 0) - newGroupDelay) ||
        !isAdjacentTo(tr, value.prevRanges)
      )
    );
  return {
    prevTime: tr.time,
    prevRanges: appended
      ? mapRanges(value.prevRanges, tr.mapping)
      : rangesFor(tr.mapping.maps),
    prevComposition: (composition == null) ? value.prevComposition : composition,
    record: {
      steps: tr.steps.slice(),
      inverses,
      docBefore: oldState.doc,
      docAfter: newState.doc,
      selectionBefore: oldState.selection.getBookmark(),
      selectionAfter: newState.selection.getBookmark(),
      schema: newState.schema,
      newGroup
    }
  };
}

// Our own replays, and anything that asks, per the ProseMirror convention,
// to stay out of the history
function unrecorded(tr) {
  return tr.getMeta(HISTORY_META) || (tr.getMeta('addToHistory') === false);
}

// Replay `record` in `editor`, backwards to undo it or forwards to redo it.
//
// The steps are replayed only when the editor holds exactly the document
// they were recorded against. Otherwise, say because the content was
// normalized when the editor was recreated, the document the record started
// or ended with is put back whole, which puts the editor where the next
// record expects to find it.
export function replay(editor, record, direction) {
  const undo = direction === 'undo';
  const expected = undo ? record.docAfter : record.docBefore;
  const result = undo ? record.docBefore : record.docAfter;
  if (sameDoc(editor.state.doc, expected)) {
    const steps = undo ? [ ...record.inverses ].reverse() : record.steps;
    const tr = editor.state.tr;
    let failed = false;
    for (const step of steps) {
      // An editor recreated since the record was made has a schema of its
      // own, so the steps have to be rebuilt against it
      const usable = (editor.schema === record.schema)
        ? step
        : Step.fromJSON(editor.schema, step.toJSON());
      if (tr.maybeStep(usable).failed) {
        failed = true;
        break;
      }
    }
    if (!failed) {
      const bookmark = undo ? record.selectionBefore : record.selectionAfter;
      try {
        tr.setSelection(bookmark.resolve(tr.doc));
      } catch (e) {
        // Leave the selection wherever the steps put it
      }
      tr.setMeta(HISTORY_META, true).scrollIntoView();
      editor.view.dispatch(tr);
      return;
    }
  }
  // Rebuilt from JSON, since the document may belong to the schema of an
  // editor that no longer exists
  const doc = editor.schema.nodeFromJSON(result.toJSON());
  const tr = editor.state.tr
    .replaceWith(0, editor.state.doc.content.size, doc.content)
    .setMeta(HISTORY_META, true)
    // As tiptap's own `setContent` does, so the editor reports no update
    .setMeta('preventUpdate', true);
  editor.view.dispatch(tr);
}

// Replace the content of `editor` with `html`, without recording it as
// history and without the editor reporting an update
export function setContent(editor, html) {
  editor
    .chain()
    .command(({ tr }) => {
      tr.setMeta(HISTORY_META, true);
      return true;
    })
    .setContent(html, false)
    .run();
}

// The markup `record` leaves behind (redo) or started from (undo), for when
// there is no editor left to replay it in
export function html(record, direction) {
  const doc = (direction === 'undo') ? record.docBefore : record.docAfter;
  return getHTMLFromFragment(doc.content, record.schema);
}

function sameDoc(a, b) {
  if ((a === b) || a.eq(b)) {
    return true;
  }
  // Nodes of two different editors never compare equal, however alike
  return (a.type.schema !== b.type.schema) &&
    (JSON.stringify(a.toJSON()) === JSON.stringify(b.toJSON()));
}

// The three functions below are those of `prosemirror-history`

function isAdjacentTo(transform, prevRanges) {
  if (!prevRanges) {
    return false;
  }
  if (!transform.docChanged) {
    return true;
  }
  let adjacent = false;
  transform.mapping.maps[0].forEach((start, end) => {
    for (let i = 0; i < prevRanges.length; i += 2) {
      if ((start <= prevRanges[i + 1]) && (end >= prevRanges[i])) {
        adjacent = true;
      }
    }
  });
  return adjacent;
}

function rangesFor(maps) {
  const result = [];
  for (let i = maps.length - 1; (i >= 0) && (result.length === 0); i--) {
    maps[i].forEach((_from, _to, from, to) => result.push(from, to));
  }
  return result;
}

function mapRanges(ranges, mapping) {
  if (!ranges) {
    return null;
  }
  const result = [];
  for (let i = 0; i < ranges.length; i += 2) {
    const from = mapping.map(ranges[i], 1);
    const to = mapping.map(ranges[i + 1], -1);
    if (from <= to) {
      result.push(from, to);
    }
  }
  return result;
}
