// The browser-side pieces of in-context undo and redo that can be tested
// without a browser: replaying an area patch on the page, and recording and
// replaying rich text history as ProseMirror steps.

const assert = require('node:assert/strict');

const getApplyPatch = async () => (await import(
  '../modules/@apostrophecms/area/ui/apos/lib/apply-patch.js'
)).default;
const getHistory = async () => import(
  '../modules/@apostrophecms/rich-text-widget/ui/apos/lib/context-history.js'
);

describe('Context history', function() {

  describe('apply-patch', function() {
    const areaId = 'area1';
    const key = `@${areaId}.items`;
    const items = () => [
      {
        _id: 'a',
        type: 'x',
        title: 'A'
      },
      {
        _id: 'b',
        type: 'x',
        title: 'B'
      },
      {
        _id: 'c',
        type: 'x',
        title: 'C'
      }
    ];
    const ids = result => result.items.map(item => item._id);

    it('ignores a patch aimed at another area or widget', async function() {
      const applyPatch = await getApplyPatch();
      assert.equal(applyPatch(areaId, items(), { $pullAllById: { '@other.items': [ 'a' ] } }), null);
      assert.equal(applyPatch(areaId, items(), { '@zzz': { _id: 'zzz' } }), null);
      assert.equal(applyPatch(areaId, items(), { title: 'Doc title' }), null);
    });

    it('pushes before, after, and at the end when the anchor is gone', async function() {
      const applyPatch = await getApplyPatch();
      const d = {
        _id: 'd',
        type: 'x'
      };
      assert.deepEqual(ids(applyPatch(areaId, items(), {
        $push: {
          [key]: {
            $each: [ d ],
            $before: 'b'
          }
        }
      })), [ 'a', 'd', 'b', 'c' ]);
      assert.deepEqual(ids(applyPatch(areaId, items(), {
        $push: {
          [key]: {
            $each: [ d ],
            $after: 'b'
          }
        }
      })), [ 'a', 'b', 'd', 'c' ]);
      const result = applyPatch(areaId, items(), {
        $push: {
          [key]: {
            $each: [ d ],
            $before: 'gone'
          }
        }
      });
      assert.deepEqual(ids(result), [ 'a', 'b', 'c', 'd' ]);
      assert.deepEqual(result.changed, [ 'd' ]);
    });

    it('pulls by id and moves before and after', async function() {
      const applyPatch = await getApplyPatch();
      assert.deepEqual(ids(applyPatch(areaId, items(), {
        $pullAllById: { [key]: [ 'b' ] }
      })), [ 'a', 'c' ]);
      assert.deepEqual(ids(applyPatch(areaId, items(), {
        $move: {
          [key]: {
            $item: 'c',
            $before: 'a'
          }
        }
      })), [ 'c', 'a', 'b' ]);
      assert.deepEqual(ids(applyPatch(areaId, items(), {
        $move: {
          [key]: {
            $item: 'a',
            $after: 'b'
          }
        }
      })), [ 'b', 'a', 'c' ]);
    });

    it('takes back a move with its inverse', async function() {
      const applyPatch = await getApplyPatch();
      // As `AposAreaEditor.up` sends them
      const forward = applyPatch(areaId, items(), {
        $move: {
          [key]: {
            $item: 'b',
            $before: 'a'
          }
        }
      });
      assert.deepEqual(ids(forward), [ 'b', 'a', 'c' ]);
      const back = applyPatch(areaId, forward.items, {
        $move: {
          [key]: {
            $item: 'b',
            $after: 'a'
          }
        }
      });
      assert.deepEqual(ids(back), [ 'a', 'b', 'c' ]);
    });

    it('replaces a widget, or a property of one, without touching the original', async function() {
      const applyPatch = await getApplyPatch();
      const original = items();
      const replaced = applyPatch(areaId, original, {
        '@b': {
          _id: 'b',
          type: 'x',
          title: 'New B'
        }
      });
      assert.equal(replaced.items[1].title, 'New B');
      assert.deepEqual(replaced.changed, [ 'b' ]);
      assert.equal(original[1].title, 'B');
      const property = applyPatch(areaId, original, { '@c.title': 'New C' });
      assert.equal(property.items[2].title, 'New C');
      assert.equal(original[2].title, 'C');
    });

    it('reaches into nested areas only when asked to', async function() {
      const applyPatch = await getApplyPatch();
      const nested = [
        {
          _id: 'layout',
          type: 'layout',
          columns: {
            _id: 'area2',
            metaType: 'area',
            items: [
              {
                _id: 'inner',
                type: 'x',
                title: 'Inner'
              }
            ]
          },
          _relationship: [
            {
              _id: 'inner',
              title: 'A copy that must be left alone'
            }
          ]
        }
      ];
      assert.equal(applyPatch(areaId, nested, { '@inner.title': 'Changed' }), null);
      const result = applyPatch(areaId, nested, { '@inner.title': 'Changed' }, { deep: true });
      assert.equal(result.items[0].columns.items[0].title, 'Changed');
      assert.equal(result.items[0]._relationship[0].title, 'A copy that must be left alone');
      assert.deepEqual(result.changed, [ 'layout' ]);
      assert.equal(nested[0].columns.items[0].title, 'Inner');
    });
  });

  describe('rich text history', function() {
    let lib;
    let schemaBasic;
    let EditorState;
    let Schema;

    before(async function() {
      lib = await getHistory();
      schemaBasic = await import('@tiptap/pm/schema-basic');
      ({ EditorState } = await import('@tiptap/pm/state'));
      ({ Schema } = await import('@tiptap/pm/model'));
    });

    // Stands in for a tiptap editor: just enough for `replay`
    function makeEditor(schema, doc) {
      const editor = {
        schema,
        state: EditorState.create({
          schema,
          doc,
          plugins: [ lib.createHistoryPlugin({ onRecord() {} }) ]
        }),
        view: {
          dispatch(tr) {
            editor.state = editor.state.apply(tr);
          }
        }
      };
      return editor;
    }

    function paragraph(schema, text) {
      return schema.node('doc', null, [
        schema.node('paragraph', null, text ? [ schema.text(text) ] : [])
      ]);
    }

    // Type `text` at the end of the document, one transaction per character,
    // `delay` milliseconds apart, merging records into entries as the
    // context bar does. Returns the entries
    function type(editor, text, {
      delay = 50, start = 1000, entries = []
    } = {}) {
      const plugin = editor.state.plugins[0];
      let time = start;
      for (const char of text) {
        const end = editor.state.doc.content.size - 1;
        const tr = editor.state.tr.insertText(char, end);
        tr.time = time;
        editor.view.dispatch(tr);
        time += delay;
        const { record } = plugin.getState(editor.state);
        const top = entries.at(-1);
        if (top && !record.newGroup) {
          top.steps.push(...record.steps);
          top.inverses.push(...record.inverses);
          top.docAfter = record.docAfter;
          top.selectionAfter = record.selectionAfter;
        } else {
          entries.push({
            ...record,
            steps: [ ...record.steps ],
            inverses: [ ...record.inverses ]
          });
        }
      }
      return entries;
    }

    it('groups quick adjacent typing and splits on a pause', function() {
      const schema = schemaBasic.schema;
      const editor = makeEditor(schema, paragraph(schema, ''));
      const entries = type(editor, 'abc', { delay: 100 });
      assert.equal(entries.length, 1);
      type(editor, 'de', {
        delay: 100,
        start: 5000,
        entries
      });
      assert.equal(entries.length, 2);
      assert.equal(editor.state.doc.textContent, 'abcde');
    });

    it('splits typing that is not adjacent to the previous edit', function() {
      const schema = schemaBasic.schema;
      const editor = makeEditor(schema, paragraph(schema, 'hello world'));
      const plugin = editor.state.plugins[0];
      let tr = editor.state.tr.insertText('!', 12);
      tr.time = 1000;
      editor.view.dispatch(tr);
      tr = editor.state.tr.insertText('>', 1);
      tr.time = 1100;
      editor.view.dispatch(tr);
      assert.equal(plugin.getState(editor.state).record.newGroup, true);
    });

    it('undoes and redoes typing group by group, restoring the selection', function() {
      const schema = schemaBasic.schema;
      const editor = makeEditor(schema, paragraph(schema, ''));
      const entries = type(editor, 'Hello', { delay: 100 });
      type(editor, ' world', {
        delay: 100,
        start: 10000,
        entries
      });
      assert.equal(entries.length, 2);
      lib.replay(editor, entries[1], 'undo');
      assert.equal(editor.state.doc.textContent, 'Hello');
      assert.equal(editor.state.selection.from, 6);
      lib.replay(editor, entries[0], 'undo');
      assert.equal(editor.state.doc.textContent, '');
      lib.replay(editor, entries[0], 'redo');
      assert.equal(editor.state.doc.textContent, 'Hello');
      lib.replay(editor, entries[1], 'redo');
      assert.equal(editor.state.doc.textContent, 'Hello world');
      assert.equal(editor.state.selection.from, 12);
    });

    it('does not record its own replays as new history', function() {
      const schema = schemaBasic.schema;
      const editor = makeEditor(schema, paragraph(schema, ''));
      const plugin = editor.state.plugins[0];
      const entries = type(editor, 'abc');
      lib.replay(editor, entries[0], 'undo');
      assert.equal(plugin.getState(editor.state).record, null);
      // And typing afterwards starts a fresh group rather than continuing one
      // that has just been undone
      const next = type(editor, 'x', { start: 1100 });
      assert.equal(next[0].newGroup, true);
    });

    it('ignores transactions that ask to stay out of the history', function() {
      const schema = schemaBasic.schema;
      const editor = makeEditor(schema, paragraph(schema, 'abc'));
      const plugin = editor.state.plugins[0];
      const tr = editor.state.tr.insertText('z', 1).setMeta('addToHistory', false);
      editor.view.dispatch(tr);
      assert.equal(plugin.getState(editor.state).record, null);
    });

    it('replays steps in an editor recreated with a schema of its own', function() {
      const schema = schemaBasic.schema;
      const first = makeEditor(schema, paragraph(schema, 'Start'));
      const entries = type(first, ' more');
      // As when the widget was removed and restored: same content, new
      // editor, new schema instance
      const otherSchema = new Schema(schemaBasic.schema.spec);
      const copy = otherSchema.nodeFromJSON(first.state.doc.toJSON());
      const second = makeEditor(otherSchema, copy);
      lib.replay(second, entries[0], 'undo');
      assert.equal(second.state.doc.textContent, 'Start');
      assert.equal(second.state.schema, otherSchema);
    });

    it('puts the whole document back when the editor is not where the steps expect', function() {
      const schema = schemaBasic.schema;
      const editor = makeEditor(schema, paragraph(schema, 'Start'));
      const entries = type(editor, '!!');
      // Something changed the document without being recorded
      editor.view.dispatch(
        editor.state.tr.insertText('?', 1).setMeta('addToHistory', false)
      );
      lib.replay(editor, entries[0], 'undo');
      assert.equal(editor.state.doc.textContent, 'Start');
      // The next group back is replayed step by step again
      assert.ok(editor.state.doc.eq(entries[0].docBefore));
    });

    it('folds transactions appended by other plugins into the record', function() {
      const schema = schemaBasic.schema;
      const { Plugin } = require('@tiptap/pm/state');
      // Stands in for prosemirror-tables' `fixTables`, which appends a
      // change of its own when a table is left malformed. Here "malformed"
      // is a lone `a`
      const appender = new Plugin({
        appendTransaction(trs, oldState, newState) {
          if (newState.doc.textContent !== 'a') {
            return null;
          }
          return newState.tr.insertText('#', newState.doc.content.size - 1);
        }
      });
      const history = lib.createHistoryPlugin({ onRecord() {} });
      const editor = {
        schema,
        state: EditorState.create({
          schema,
          doc: paragraph(schema, ''),
          plugins: [ history, appender ]
        }),
        view: {
          dispatch(tr) {
            editor.state = editor.state.applyTransaction(tr).state;
          }
        }
      };
      editor.view.dispatch(editor.state.tr.insertText('a', 1));
      assert.equal(editor.state.doc.textContent, 'a#');
      const { record } = history.getState(editor.state);
      assert.equal(record.steps.length, 2);
      assert.ok(record.docAfter.eq(editor.state.doc));
      lib.replay(editor, record, 'undo');
      assert.equal(editor.state.doc.textContent, '');
      lib.replay(editor, record, 'redo');
      assert.equal(editor.state.doc.textContent, 'a#');
    });
  });
});
