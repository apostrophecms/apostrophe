const assert = require('node:assert/strict');

const getLib = async () => (await import(
  '../modules/@apostrophecms/document-versions/ui/apos/lib/change-groups.js'
)).default;
const getWidgetLib = async () => (await import(
  '../modules/@apostrophecms/document-versions/ui/apos/lib/widget-changes.js'
)).default;

describe('Document Versions UI', function () {

  describe('change groups', function () {
    const all = [ 'ai', 'added', 'modified', 'deleted' ];
    const title = {
      name: 'title',
      label: 'Title'
    };
    const main = {
      name: 'main',
      label: 'Main'
    };
    const widget = {
      name: 'w1',
      label: 'Rich Text',
      widgetType: '@apostrophecms/rich-text'
    };
    const content = {
      name: 'content',
      label: 'Content'
    };

    function row(path, props = {}) {
      return {
        path,
        type: 'modified',
        kind: 'leaf',
        ai: false,
        ...props
      };
    }

    it('should match a row by its change type or its AI involvement', async function () {
      const lib = await getLib();
      const plain = row([ title ]);
      const withAi = row([ title ], { ai: 'changed' });
      const assisted = row([ title ], { ai: 'assisted' });
      assert.equal(lib.matchesFilter(plain, [ 'modified' ]), true);
      assert.equal(lib.matchesFilter(plain, [ 'added', 'ai' ]), false);
      assert.equal(lib.matchesFilter(withAi, [ 'ai' ]), true);
      assert.equal(lib.matchesFilter(assisted, [ 'ai' ]), true);
    });

    it('should match every row while no option is checked', async function () {
      const lib = await getLib();
      assert.equal(lib.matchesFilter(row([ title ]), []), true);
      assert.equal(lib.matchesFilter(row([ title ], { type: 'deleted' }), []), true);
      assert.equal(lib.matchesFilter(row([ title ], { ai: 'changed' }), []), true);
    });

    it('should group rows under their top-level field, or the widget of an area', async function () {
      const lib = await getLib();
      const rows = [
        row([ main, widget, content ]),
        row([ title ]),
        row([ main, widget, {
          name: 'align',
          label: 'Align'
        } ]),
        row([ main, {
          name: 'w2',
          label: 'Image',
          widgetType: '@apostrophecms/image'
        }, content ])
      ];
      const groups = lib.getChangeGroups(rows, all);
      assert.deepEqual(groups.map(group => group.key), [ 'main.w1', 'title', 'main.w2' ]);
      assert.deepEqual(groups[0].path, [ main, widget ]);
      assert.deepEqual(groups[1].path, [ title ]);
      assert.deepEqual(groups[0].entries.map(entry => entry.key), [ '0', '2' ]);
      assert.deepEqual(groups[0].entries[0].segments, [ content ]);
      assert.equal(groups[0].entries[0].row, rows[0]);
      assert.equal(groups[0].type, 'modified');
    });

    it('should skip the rows the filter hides and keep the keys of the others', async function () {
      const lib = await getLib();
      const rows = [
        row([ title ], { type: 'added' }),
        row([ main, widget, content ]),
        row([ main, widget, content ], {
          type: 'deleted',
          ai: 'changed'
        })
      ];
      const groups = lib.getChangeGroups(rows, [ 'modified', 'ai' ]);
      assert.deepEqual(groups.map(group => group.key), [ 'main.w1' ]);
      assert.deepEqual(groups[0].entries.map(entry => entry.key), [ '1', '2' ]);
      assert.equal(lib.getChangeGroups(rows, []).length, 2);
    });

    it('should give a group the change type of its own row', async function () {
      const lib = await getLib();
      const groups = lib.getChangeGroups([
        row([ main, widget ], {
          type: 'added',
          kind: 'widget'
        }),
        row([ title ], { type: 'deleted' })
      ], all);
      assert.equal(groups[0].type, 'added');
      assert.equal(groups[0].entries[0].own, true);
      assert.deepEqual(groups[0].entries[0].segments, [ widget ]);
      assert.equal(groups[1].type, 'deleted');
      assert.deepEqual(groups[1].entries[0].segments, [ title ]);
    });

    it('should end the breadcrumb of an order row with the order crumb', async function () {
      const lib = await getLib();
      const long = 'x'.repeat(200);
      const diff = [
        {
          change: 'same',
          text: long
        },
        {
          change: 'added',
          text: 'Image'
        }
      ];
      const groups = lib.getChangeGroups([
        row([ main ], {
          kind: 'area',
          diff
        }),
        row([ {
          name: 'items',
          label: 'Items'
        } ], {
          kind: 'array',
          diff
        })
      ], all);
      for (const group of groups) {
        const [ entry ] = group.entries;
        assert.equal(entry.order, true);
        assert.equal(entry.own, false);
        assert.deepEqual(entry.segments, [ { label: 'apostrophe:versionOrderChanged' } ]);
        // Whole items, never cut inside
        assert.equal(entry.elided, false);
        assert.deepEqual(entry.short, entry.parts);
        assert.equal(group.type, 'modified');
      }
    });

    it('should give each side the parts both share and its own', async function () {
      const lib = await getLib();
      const diff = [
        {
          change: 'same',
          text: 'The '
        },
        {
          change: 'removed',
          text: 'old'
        },
        {
          change: 'added',
          text: 'new'
        },
        {
          change: 'same',
          text: ' title'
        }
      ];
      const [ { entries: [ entry ] } ] = lib.getChangeGroups([
        row([ title ], {
          diff,
          newText: 'The new title',
          oldText: 'The old title'
        })
      ], all);
      assert.deepEqual(entry.parts.new.map(part => part.text), [ 'The ', 'new', ' title' ]);
      assert.deepEqual(entry.parts.old.map(part => part.text), [ 'The ', 'old', ' title' ]);
      assert.deepEqual(entry.short, entry.parts);
      assert.equal(entry.elided, false);
      assert.equal(entry.changed, true);
      assert.equal(entry.detail, true);
      assert.deepEqual(entry.text, {
        new: true,
        old: true
      });
    });

    it('should cut a long unchanged run down to the words next to a change', async function () {
      const lib = await getLib();
      const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
      const diff = [
        {
          change: 'same',
          text: `${words} `
        },
        {
          change: 'added',
          text: 'first'
        },
        {
          change: 'same',
          text: ` ${words} `
        },
        {
          change: 'removed',
          text: 'second'
        },
        {
          change: 'same',
          text: ` ${words}`
        }
      ];
      const [ { entries: [ entry ] } ] = lib.getChangeGroups([
        row([ title ], { diff })
      ], all);
      assert.equal(entry.elided, true);
      assert.deepEqual(entry.parts.new.map(part => part.change), [ 'same', 'added', 'same', 'same' ]);
      // The first run keeps its end, the last one its start, the one between
      // both; none is cut inside a word
      assert.deepEqual(
        entry.short.new.map(part => part.change),
        [ 'elided', 'same', 'added', 'same', 'elided', 'same', 'same', 'elided' ]
      );
      assert.deepEqual(
        entry.short.old.map(part => part.change),
        [ 'elided', 'same', 'same', 'elided', 'same', 'removed', 'same', 'elided' ]
      );
      const texts = entry.short.new.filter(part => part.text).map(part => part.text);
      assert.deepEqual(texts, [
        'word55 word56 word57 word58 word59 ',
        'first',
        ' word0 word1 word2 word3 word4 word5',
        'word55 word56 word57 word58 word59 ',
        ' word0 word1 word2 word3 word4 word5'
      ]);
    });

    it('should leave a run of 120 characters whole', async function () {
      const lib = await getLib();
      const diff = [
        {
          change: 'same',
          text: 'x'.repeat(120)
        },
        {
          change: 'added',
          text: 'y'
        }
      ];
      const [ { entries: [ entry ] } ] = lib.getChangeGroups([
        row([ title ], { diff })
      ], all);
      assert.equal(entry.elided, false);
    });

    it('should cut a run of several parts as one, keeping their marks', async function () {
      const lib = await getLib();
      const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
      const diff = [
        {
          change: 'added',
          text: 'first'
        },
        {
          change: 'same',
          text: ' word0 word1 word2 '
        },
        {
          change: 'same',
          text: 'bold',
          marks: [ 'bold' ]
        },
        {
          change: 'same',
          text: ` ${words}`
        }
      ];
      const [ { entries: [ entry ] } ] = lib.getChangeGroups([
        row([ title ], {
          kind: 'richText',
          diff
        })
      ], all);
      assert.deepEqual(entry.inlineShort, [
        diff[0],
        diff[1],
        diff[2],
        {
          change: 'same',
          text: ' word0 word1'
        },
        { change: 'elided' }
      ]);
    });

    it('should show rich text and order as one block, anything else as two sides', async function () {
      const lib = await getLib();
      const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
      const diff = [
        {
          change: 'same',
          text: `${words} `
        },
        {
          change: 'removed',
          text: 'old'
        },
        {
          change: 'added',
          text: 'new'
        }
      ];
      const groups = lib.getChangeGroups([
        row([ main, widget, content ], {
          kind: 'richText',
          diff
        }),
        row([ main, widget, {
          name: 'items',
          label: 'Items'
        } ], {
          kind: 'array',
          diff
        }),
        row([ title ], { diff })
      ], all);
      const [ richText, order, leaf ] = groups.flatMap(group => group.entries);
      assert.deepEqual(
        [ richText, order, leaf ].map(entry => entry.layout),
        [ 'block', 'block', 'sides' ]
      );
      // Both sides in reading order, the long unchanged run cut down
      assert.deepEqual(richText.inline, diff);
      assert.deepEqual(
        richText.inlineShort.map(part => part.change),
        [ 'elided', 'same', 'removed', 'added' ]
      );
      // Whole items, never cut inside
      assert.deepEqual(order.inlineShort, diff);
    });

    it('should cut a long order down to the items next to a move', async function () {
      const lib = await getLib();
      const item = (text, change = 'same') => ({
        text,
        change
      });
      // #1 dragged from after #9 to the top, eleven items in all
      const diff = [
        item('#1', 'added'),
        ...[ 2, 3, 4, 5, 6, 7, 8, 9 ].map(ordinal => item(`#${ordinal}`)),
        item('#1', 'removed'),
        item('#10'),
        item('#11')
      ];
      const [ { entries: [ entry ] } ] = lib.getChangeGroups([
        row([ main ], {
          kind: 'area',
          diff
        })
      ], all);
      assert.deepEqual(entry.inlineShort.map(part => part.text || part.change), [
        '#1', '#2', 'elided', '#9', '#1', '#10', '#11'
      ]);
      assert.equal(entry.elided, true);
      assert.deepEqual(entry.inline, diff);
    });

    it('should tell whether a row has anything to expand', async function () {
      const lib = await getLib();
      const format = [ {
        change: 'bold',
        type: 'added'
      } ];
      const [ { entries } ] = lib.getChangeGroups([
        row([ main, widget ]),
        row([ main, widget, content ], {
          diff: [ {
            change: 'same',
            text: 'Same words'
          } ],
          formatChanges: format
        }),
        row([ main, widget, content ], {
          diff: [ {
            change: 'added',
            text: 'Words'
          } ],
          newText: 'Words'
        })
      ], all);
      assert.deepEqual(
        entries.map(entry => [ entry.changed, entry.detail, entry.format.length ]),
        [ [ false, false, 0 ], [ false, true, 1 ], [ true, true, 0 ] ]
      );
      assert.deepEqual(entries[2].text, {
        new: true,
        old: false
      });
    });
  });

  describe('marker targets', function () {
    const main = {
      name: 'main',
      label: 'Main'
    };
    const columns = {
      name: 'columns',
      label: 'Columns',
      widgetType: 'columns'
    };
    const left = {
      name: 'left',
      label: 'Left'
    };
    const nested = {
      name: 'nested',
      label: 'Rich Text',
      widgetType: '@apostrophecms/rich-text'
    };
    const content = {
      name: 'content',
      label: 'Content'
    };
    const rows = {
      title: {
        path: [ {
          name: 'title',
          label: 'Title'
        } ],
        kind: 'leaf'
      },
      order: {
        path: [ main ],
        kind: 'area',
        new: [ 'columns', 'other' ]
      },
      own: {
        path: [ main, columns ],
        kind: 'widget'
      },
      nestedOrder: {
        path: [ main, columns, left ],
        kind: 'area',
        new: [ 'nested' ]
      },
      nestedContent: {
        path: [ main, columns, left, nested, content ],
        kind: 'leaf'
      },
      nestedDeleted: {
        path: [ main, columns, left, nested ],
        kind: 'widget',
        type: 'deleted'
      },
      deleted: {
        path: [ main, columns ],
        kind: 'widget',
        type: 'deleted'
      }
    };
    it('should take the rows of a top-level field outside any widget', async function () {
      const lib = await getLib();
      assert.equal(lib.isMarkerTarget(rows.title, { field: 'title' }), true);
      assert.equal(lib.isMarkerTarget(rows.order, { field: 'title' }), false);
      // The order row of an area is its field's; rows inside widgets are not
      assert.equal(lib.isMarkerTarget(rows.order, { field: 'main' }), true);
      assert.equal(lib.isMarkerTarget(rows.own, { field: 'main' }), false);
      assert.equal(lib.isMarkerTarget(rows.nestedContent, { field: 'main' }), false);
    });

    it('should take the rows of the widget itself, not of the widgets inside it', async function () {
      const lib = await getLib();
      assert.equal(lib.isMarkerTarget(rows.own, { widgetId: 'columns' }), true);
      assert.equal(lib.isMarkerTarget(rows.nestedContent, { widgetId: 'columns' }), false);
      assert.equal(lib.isMarkerTarget(rows.nestedContent, { widgetId: 'nested' }), true);
      // An order row is never a widget's own, that of an area inside it
      // included
      assert.equal(lib.isMarkerTarget(rows.nestedOrder, { widgetId: 'columns' }), false);
      assert.equal(lib.isMarkerTarget(rows.order, { widgetId: 'columns' }), false);
      assert.equal(lib.isMarkerTarget(rows.title, { widgetId: 'columns' }), false);
    });

    it('should add the order of its area for a widget that moved', async function () {
      const lib = await getLib();
      const columns = {
        widgetId: 'columns',
        moved: true
      };
      const nested = {
        widgetId: 'nested',
        moved: true
      };
      assert.equal(lib.isMarkerTarget(rows.order, columns), true);
      assert.equal(lib.isMarkerTarget(rows.own, columns), true);
      assert.equal(lib.isMarkerTarget(rows.nestedOrder, columns), false);
      assert.equal(lib.isMarkerTarget(rows.nestedOrder, nested), true);
      assert.equal(lib.isMarkerTarget(rows.nestedContent, nested), true);
      assert.equal(lib.isMarkerTarget(rows.order, nested), false);
    });

    it('should give a deleted widget the body does not show to the widget or field holding it', async function () {
      const lib = await getLib();
      const shown = {
        nested: {
          changes: [ 'deleted' ]
        }
      };
      // Shown, or no markers given: its own
      for (const marked of [ shown, undefined ]) {
        assert.equal(lib.isMarkerTarget(rows.nestedDeleted, {
          widgetId: 'nested',
          marked
        }), true);
        assert.equal(lib.isMarkerTarget(rows.nestedDeleted, {
          widgetId: 'columns',
          marked
        }), false);
      }
      // Not shown: the widget holding it, or the top-level field
      assert.equal(lib.isMarkerTarget(rows.nestedDeleted, {
        widgetId: 'columns',
        marked: {}
      }), true);
      assert.equal(lib.isMarkerTarget(rows.nestedDeleted, {
        widgetId: 'nested',
        marked: {}
      }), false);
      assert.equal(lib.isMarkerTarget(rows.deleted, {
        field: 'main',
        marked: {}
      }), true);
      assert.equal(lib.isMarkerTarget(rows.deleted, {
        field: 'main',
        marked: {
          columns: {
            changes: [ 'deleted' ]
          }
        }
      }), false);
      // Other rows of the widget holding it are unaffected
      assert.equal(lib.isMarkerTarget(rows.nestedContent, {
        widgetId: 'columns',
        marked: {}
      }), false);
    });
  });

  describe('widget changes', function () {
    function widget(_id, props = {}) {
      return {
        _id,
        metaType: 'widget',
        type: 'test',
        ...props
      };
    }

    it('should collect the markers of the widgets by their id', async function () {
      const lib = await getWidgetLib();
      const changes = lib.getWidgetChanges({
        _id: 'doc',
        type: 'article',
        main: {
          _id: 'area',
          metaType: 'area',
          items: [
            widget('added', { _inserted: true }),
            widget('deleted', { _deleted: true }),
            widget('modified', { _modified: true }),
            widget('same')
          ]
        }
      });
      assert.deepEqual(changes, {
        added: {
          changes: [ 'added' ],
          ai: false
        },
        deleted: {
          changes: [ 'deleted' ],
          ai: false
        },
        modified: {
          changes: [ 'modified' ],
          ai: false
        }
      });
    });

    it('should list a move after the change, or alone', async function () {
      const lib = await getWidgetLib();
      const changes = lib.getWidgetChanges({
        main: {
          items: [
            widget('both', {
              _modified: true,
              _moved: true
            }),
            widget('moved', { _moved: true })
          ]
        }
      });
      assert.deepEqual(changes.both.changes, [ 'modified', 'moved' ]);
      assert.deepEqual(changes.moved.changes, [ 'moved' ]);
    });

    it('should say where AI was involved, in the change or in the move', async function () {
      const lib = await getWidgetLib();
      const changes = lib.getWidgetChanges({
        main: {
          items: [
            widget('changed', {
              _modified: true,
              _changedWithAi: 'changed'
            }),
            widget('moved', {
              _moved: true,
              _movedWithAi: 'assisted'
            }),
            widget('both', {
              _modified: true,
              _changedWithAi: 'assisted',
              _moved: true,
              _movedWithAi: 'changed'
            }),
            widget('plain', { _modified: true }),
            // Not a marker on its own
            widget('none', { _changedWithAi: 'changed' })
          ]
        }
      });
      assert.equal(changes.changed.ai, 'changed');
      assert.equal(changes.moved.ai, 'assisted');
      assert.equal(changes.both.ai, 'changed');
      assert.equal(changes.plain.ai, false);
      assert.equal(changes.none, undefined);
    });

    it('should carry what a widget with an older version renders with', async function () {
      const lib = await getWidgetLib();
      const older = widget('rich', { content: '<p>Old</p>' });
      const changes = lib.getWidgetChanges({
        main: {
          items: [
            widget('rich', {
              content: '<p><ins>New</ins></p>',
              _olderVersion: older
            }),
            widget('custom', {
              _olderVersion: widget('custom'),
              content: { nested: true }
            }),
            widget('plain', { _modified: true })
          ]
        }
      });
      assert.deepEqual(changes.rich, {
        changes: [ 'modified' ],
        ai: false,
        data: {
          _olderVersion: older,
          content: '<p><ins>New</ins></p>'
        }
      });
      assert.deepEqual(changes.custom.data, { _olderVersion: widget('custom') });
      assert.equal(Object.hasOwn(changes.plain, 'data'), false);
    });

    it('should find nested widgets and stay out of the older versions', async function () {
      const lib = await getWidgetLib();
      const changes = lib.getWidgetChanges({
        main: {
          items: [
            widget('columns', {
              _modified: true,
              _olderVersion: widget('columns', {
                left: { items: [ widget('gone', { _deleted: true }) ] }
              }),
              left: { items: [ widget('nested', { _inserted: true }) ] }
            })
          ]
        },
        list: [ { area: { items: [ widget('in-array', { _deleted: true }) ] } } ]
      });
      assert.deepEqual(Object.keys(changes), [ 'columns', 'nested', 'in-array' ]);
    });

    it('should take anything that is not a document', async function () {
      const lib = await getWidgetLib();
      assert.deepEqual(lib.getWidgetChanges(null), {});
      assert.deepEqual(lib.getWidgetChanges({}), {});
      // An id alone does not make a widget
      assert.deepEqual(lib.getWidgetChanges({
        _id: 'doc',
        _modified: true
      }), {});
    });
  });
});
