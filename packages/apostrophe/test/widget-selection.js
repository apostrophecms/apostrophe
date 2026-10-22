const assert = require('assert/strict');

const getLib = async () => import('../modules/@apostrophecms/area/ui/apos/lib/widget-selection.js');
const getDom = async () => import('../modules/@apostrophecms/area/ui/apos/lib/widget-selection-dom.js');

describe('widget selection', function() {
  let lib;
  let dom;

  before(async function() {
    lib = await getLib();
    dom = await getDom();
  });

  it('toggles a widget on and off and resets the anchor', function() {
    const first = lib.applyWidgetSelection({
      gesture: 'plain',
      widgetId: 'a'
    });
    const added = lib.applyWidgetSelection({
      state: first,
      gesture: 'toggle',
      widgetId: 'b'
    });
    assert.deepEqual(added.selectedWidgetIds, [ 'a', 'b' ]);
    assert.equal(added.selectionAnchorId, 'b');
    assert.deepEqual(added.pinnedWidgetIds, [ 'a', 'b' ]);

    const removed = lib.applyWidgetSelection({
      state: added,
      gesture: 'toggle',
      widgetId: 'a'
    });
    assert.deepEqual(removed.selectedWidgetIds, [ 'b' ]);
    assert.equal(removed.selectionAnchorId, 'b');
    assert.deepEqual(removed.pinnedWidgetIds, [ 'b' ]);
  });

  it('selects a same-area range and shrinks it on a shorter shift-click', function() {
    const items = [ 'a', 'b', 'c', 'd', 'e' ];
    const areaOf = () => ({
      areaId: 'area',
      itemIds: items
    });
    const anchor = lib.applyWidgetSelection({
      gesture: 'plain',
      widgetId: 'b'
    });
    const range = lib.applyWidgetSelection({
      state: anchor,
      gesture: 'range',
      widgetId: 'e',
      areaOf
    });
    assert.deepEqual(range.selectedWidgetIds, [ 'b', 'c', 'd', 'e' ]);
    assert.equal(range.selectionAnchorId, 'b');
    assert.deepEqual(range.pinnedWidgetIds, [ 'b' ]);

    const shorter = lib.applyWidgetSelection({
      state: range,
      gesture: 'range',
      widgetId: 'c',
      areaOf
    });
    assert.deepEqual(shorter.selectedWidgetIds, [ 'b', 'c' ]);
    assert.equal(shorter.selectionAnchorId, 'b');
  });

  // page
  //   main: top-1, layout, top-2, top-3, hero
  //     layout: col-a, col-b, col-c
  //       col-b: deep
  //     hero
  //       left: h-1, h-2, h-3
  //       right: h-4, h-5
  //   footer: foot
  const tree = {
    'col-a': 'layout',
    'col-b': 'layout',
    'col-c': 'layout',
    deep: 'col-b',
    'h-1': 'hero',
    'h-2': 'hero',
    'h-3': 'hero',
    'h-4': 'hero',
    'h-5': 'hero'
  };
  const areas = {
    main: [ 'top-1', 'layout', 'top-2', 'top-3', 'hero' ],
    columns: [ 'col-a', 'col-b', 'col-c' ],
    inner: [ 'deep' ],
    left: [ 'h-1', 'h-2', 'h-3' ],
    right: [ 'h-4', 'h-5' ],
    footer: [ 'foot' ]
  };
  const parentOf = (id) => tree[id] || null;
  const areaOf = (id) => {
    const [ areaId, itemIds ] = Object.entries(areas)
      .find(([ , ids ]) => ids.includes(id)) || [];
    return areaId
      ? {
        areaId,
        itemIds
      }
      : null;
  };
  const select = (state, gesture, widgetId) => {
    return lib.applyWidgetSelection({
      state,
      gesture,
      widgetId,
      parentOf,
      areaOf
    });
  };

  it('lifts a meta-click inside a compound widget to that widget', function() {
    const first = select(undefined, 'plain', 'top-1');
    const added = select(first, 'toggle', 'col-b');
    assert.deepEqual(added.selectedWidgetIds, [ 'top-1', 'layout' ]);
    assert.equal(added.selectionAnchorId, 'layout');

    const deeper = select(first, 'toggle', 'deep');
    assert.deepEqual(deeper.selectedWidgetIds, [ 'top-1', 'layout' ]);
  });

  it('lifts a nested selection when a meta-click lands on a peer of its compound widget', function() {
    const first = select(undefined, 'plain', 'col-a');
    const siblings = select(first, 'toggle', 'col-c');
    assert.deepEqual(siblings.selectedWidgetIds, [ 'col-a', 'col-c' ]);
    const lifted = select(siblings, 'toggle', 'top-2');
    assert.deepEqual(lifted.selectedWidgetIds, [ 'layout', 'top-2' ]);
  });

  it('selects widgets in different areas of the same parent', function() {
    const first = select(undefined, 'plain', 'h-1');
    const added = select(first, 'toggle', 'h-5');
    assert.deepEqual(added.selectedWidgetIds, [ 'h-1', 'h-5' ]);
    const lifted = select(added, 'toggle', 'top-1');
    assert.deepEqual(lifted.selectedWidgetIds, [ 'hero', 'top-1' ]);
  });

  it('deselects a compound widget when a meta-click lands inside it', function() {
    const first = select(undefined, 'plain', 'top-1');
    const added = select(first, 'toggle', 'col-b');
    const removed = select(added, 'toggle', 'col-a');
    assert.deepEqual(removed.selectedWidgetIds, [ 'top-1' ]);
    assert.equal(removed.selectionAnchorId, 'top-1');
  });

  it('keeps a compound widget when another selected widget still lives in it', function() {
    const state = {
      selectedWidgetIds: [ 'col-a', 'col-b' ],
      selectionAnchorId: 'col-b',
      pinnedWidgetIds: [ 'col-a', 'col-b' ]
    };
    const removed = select(state, 'toggle', 'col-a');
    assert.deepEqual(removed.selectedWidgetIds, [ 'col-b' ]);
    // Turning a nested widget off while the selection spans its parent's
    // peers leaves the compound widget alone when col-b is still in it.
    assert.deepEqual(
      lib.liftToCommonParent([ 'col-a', 'col-b', 'top-2' ], {
        parentOf,
        removeId: 'col-a'
      }),
      [ 'layout', 'top-2' ]
    );
    assert.deepEqual(
      lib.liftToCommonParent([ 'col-a', 'top-2' ], {
        parentOf,
        removeId: 'col-a'
      }),
      [ 'top-2' ]
    );
  });

  it('turns off the only selected widget', function() {
    const first = select(undefined, 'plain', 'layout');
    const removed = select(first, 'toggle', 'deep');
    assert.deepEqual(removed.selectedWidgetIds, []);
    assert.equal(removed.selectionAnchorId, null);
  });

  it('fills the gaps when a shift-click spans a compound widget and its peers', function() {
    const first = select(undefined, 'plain', 'col-b');
    const spanned = select(first, 'range', 'top-3');
    assert.deepEqual(spanned.selectedWidgetIds, [ 'layout', 'top-2', 'top-3' ]);
    assert.deepEqual(spanned.pinnedWidgetIds, [ 'col-b' ]);

    const inside = select(spanned, 'range', 'col-c');
    assert.deepEqual(inside.selectedWidgetIds, [ 'col-b', 'col-c' ]);

    const top = select(undefined, 'plain', 'top-1');
    const into = select(top, 'range', 'deep');
    assert.deepEqual(into.selectedWidgetIds, [ 'top-1', 'layout' ]);
  });

  it('fills gaps in each area separately', function() {
    const first = select(undefined, 'plain', 'h-1');
    const added = select(first, 'toggle', 'h-4');
    const spanned = select(added, 'range', 'h-3');
    assert.deepEqual(spanned.selectedWidgetIds, [ 'h-1', 'h-2', 'h-3', 'h-4' ]);
  });

  it('ignores a meta-click or shift-click on a widget from another top-level area', function() {
    const first = select(undefined, 'plain', 'deep');
    assert.equal(select(first, 'toggle', 'foot'), first);
    assert.equal(select(first, 'range', 'foot'), first);
    const top = select(undefined, 'plain', 'top-1');
    assert.equal(select(top, 'toggle', 'foot'), top);
    assert.equal(select(top, 'range', 'foot'), top);
    assert.equal(
      lib.liftToCommonParent([ 'col-a', 'foot' ], {
        parentOf,
        areaOf
      }),
      null
    );
  });

  it('captures only widgets from one top-level area in a drag', function() {
    const options = {
      parentOf,
      areaOf
    };
    const fromSelection = lib.addCapturedWidgets(
      select(undefined, 'plain', 'top-1'),
      [ 'top-3', 'hero', 'foot' ],
      options
    );
    assert.deepEqual(fromSelection.selectedWidgetIds, [ 'top-1', 'top-3', 'hero' ]);

    const elsewhere = lib.addCapturedWidgets(
      select(undefined, 'plain', 'top-1'),
      [ 'foot' ],
      options
    );
    assert.deepEqual(elsewhere.selectedWidgetIds, [ 'top-1' ]);

    const fromStart = lib.addCapturedWidgets(undefined, [ 'hero', 'foot' ], {
      ...options,
      startId: 'foot'
    });
    assert.deepEqual(fromStart.selectedWidgetIds, [ 'foot' ]);

    const fromFirst = lib.addCapturedWidgets(undefined, [ 'top-3', 'hero', 'foot' ], options);
    assert.deepEqual(fromFirst.selectedWidgetIds, [ 'top-3', 'hero' ]);
  });

  it('tells a click from a drag by how far the pointer moved', function() {
    const start = {
      x: 10,
      y: 10
    };
    assert.equal(lib.isDrag(start, start), false);
    assert.equal(lib.isDrag(start, {
      x: 10 + lib.DRAG_THRESHOLD,
      y: 10
    }), false);
    assert.equal(lib.isDrag(start, {
      x: 13,
      y: 13
    }), true);
  });

  it('combines removals from several areas into one undo edit', function() {
    const combined = lib.combineContextEdits([
      {
        patch: {
          $pullAllById: {
            '@column-a.items': [ 'w1' ]
          }
        },
        inverse: {
          $push: {
            '@column-a.items': {
              $each: [ { _id: 'w1' } ]
            }
          }
        },
        target: {
          widgetId: 'w1',
          anchorId: null
        }
      },
      {
        patch: {
          $pullAllById: {
            '@column-b.items': [ 'w2' ]
          }
        },
        inverse: {
          $push: {
            '@column-b.items': {
              $each: [ { _id: 'w2' } ],
              $before: 'keep'
            }
          }
        },
        target: {
          widgetId: 'w2'
        }
      }
    ]);
    assert.deepEqual(combined.patch, {
      $pullAllById: {
        '@column-a.items': [ 'w1' ],
        '@column-b.items': [ 'w2' ]
      }
    });
    assert.deepEqual(combined.inverse.$push['@column-a.items'].$each, [ { _id: 'w1' } ]);
    assert.equal(combined.inverse.$push['@column-b.items'].$before, 'keep');
    assert.equal(combined.target.widgetId, 'w1');
  });

  it('drops a selected descendant when its ancestor is also selected', function() {
    const ids = [ 'parent', 'child', 'other' ];
    const outer = lib.outermostIds(ids, (id, ancestorId) => {
      return ancestorId === 'parent' && id === 'child';
    });
    assert.deepEqual(outer, [ 'parent', 'other' ]);
  });

  it('drops removed widgets and their descendants and repairs the anchor', function() {
    const state = {
      selectedWidgetIds: [ 'parent', 'child', 'sibling' ],
      selectionAnchorId: 'child',
      pinnedWidgetIds: [ 'parent', 'child', 'sibling', 'kept' ]
    };
    const next = lib.selectionWithout(
      state,
      [ 'parent' ],
      (id) => id === 'child'
    );
    assert.deepEqual(next.selectedWidgetIds, [ 'sibling' ]);
    assert.equal(next.selectionAnchorId, 'sibling');
    assert.deepEqual(next.pinnedWidgetIds, [ 'sibling', 'kept' ]);

    const keptAnchor = lib.selectionWithout({
      selectedWidgetIds: [ 'a', 'b' ],
      selectionAnchorId: 'a',
      pinnedWidgetIds: [ 'a', 'b' ]
    }, [ 'b' ]);
    assert.deepEqual(keptAnchor.selectedWidgetIds, [ 'a' ]);
    assert.equal(keptAnchor.selectionAnchorId, 'a');
  });

  it('reports a contiguous sibling run and rejects a gap or an outsider', function() {
    const items = [ 'a', 'b', 'c', 'd', 'e' ];
    assert.deepEqual(lib.contiguousRange(items, [ 'd', 'b', 'c' ]), {
      first: 1,
      last: 3
    });
    assert.equal(lib.contiguousRange(items, [ 'a', 'c' ]), null);
    assert.equal(lib.contiguousRange(items, [ 'a', 'from-another-area' ]), null);
    assert.equal(lib.contiguousRange(items, []), null);
  });

  it('captures boxes that overlap a rectangle, including a parent and its child', function() {
    const rect = {
      left: 10,
      top: 10,
      right: 50,
      bottom: 40
    };
    const boxes = [
      {
        id: 'partial',
        left: 40,
        top: 30,
        right: 80,
        bottom: 70
      },
      {
        id: 'edge',
        left: 50,
        top: 10,
        right: 70,
        bottom: 40
      },
      {
        id: 'miss',
        left: 60,
        top: 50,
        right: 90,
        bottom: 80
      },
      {
        id: 'parent',
        left: 0,
        top: 0,
        right: 100,
        bottom: 100
      },
      {
        id: 'child',
        left: 12,
        top: 12,
        right: 30,
        bottom: 28
      }
    ];
    assert.deepEqual(dom.boxesInRect(boxes, rect), [ 'partial', 'parent', 'child' ]);
    assert.deepEqual(dom.boxesInRect(boxes, {
      left: 50,
      top: 40,
      right: 10,
      bottom: 10
    }), [ 'partial', 'parent', 'child' ]);
  });

  it('adds captured widgets without dropping the ones already selected', function() {
    const state = {
      selectedWidgetIds: [ 'a', 'b' ],
      selectionAnchorId: 'b',
      pinnedWidgetIds: [ 'a', 'b' ]
    };
    const next = lib.addCapturedWidgets(state, [ 'b', 'c', 'd' ]);
    assert.deepEqual(next.selectedWidgetIds, [ 'a', 'b', 'c', 'd' ]);
    assert.equal(next.selectionAnchorId, 'd');
    assert.deepEqual(next.pinnedWidgetIds, [ 'a', 'b', 'c', 'd' ]);

    const unchanged = lib.addCapturedWidgets(state, []);
    assert.deepEqual(unchanged.selectedWidgetIds, [ 'a', 'b' ]);
    assert.equal(unchanged.selectionAnchorId, 'b');
    assert.deepEqual(unchanged.pinnedWidgetIds, [ 'a', 'b' ]);
  });

  it('keeps the outermost widget when a drag also captures its contents', function() {
    const parents = {
      child: 'parent',
      parent: 'grandparent'
    };
    const parentOf = (id) => parents[id] || null;
    const state = {
      selectedWidgetIds: [ 'keeper' ],
      selectionAnchorId: 'keeper',
      pinnedWidgetIds: [ 'keeper' ]
    };
    const next = lib.addCapturedWidgets(
      state,
      [ 'grandparent', 'parent', 'child', 'sibling' ],
      { parentOf }
    );
    assert.deepEqual(next.selectedWidgetIds, [ 'keeper', 'grandparent', 'sibling' ]);
    assert.equal(next.selectionAnchorId, 'sibling');
    assert.deepEqual(next.pinnedWidgetIds, [ 'keeper', 'grandparent', 'sibling' ]);

    const capturedParent = lib.addCapturedWidgets({
      selectedWidgetIds: [ 'child' ],
      selectionAnchorId: 'child',
      pinnedWidgetIds: [ 'child' ]
    }, [ 'parent' ], { parentOf });
    assert.deepEqual(capturedParent.selectedWidgetIds, [ 'parent' ]);
    assert.equal(capturedParent.selectionAnchorId, 'parent');

    // keeper is top-level, so the child is lifted to keep one parent.
    const onlyChild = lib.addCapturedWidgets(state, [ 'child' ], { parentOf });
    assert.deepEqual(onlyChild.selectedWidgetIds, [ 'keeper', 'grandparent' ]);
    assert.equal(onlyChild.selectionAnchorId, 'grandparent');
  });

  it('selects one nested widget instead of the layout that contains it', function() {
    const parents = {
      child: 'parent',
      parent: 'grandparent'
    };
    const parentOf = (id) => parents[id] || null;
    const empty = {
      selectedWidgetIds: [],
      selectionAnchorId: null,
      pinnedWidgetIds: []
    };
    const next = lib.addCapturedWidgets(
      empty,
      [ 'grandparent', 'parent', 'child' ],
      { parentOf }
    );
    assert.deepEqual(next.selectedWidgetIds, [ 'child' ]);
    assert.equal(next.selectionAnchorId, 'child');
    assert.deepEqual(next.pinnedWidgetIds, [ 'child' ]);

    const narrowed = lib.addCapturedWidgets({
      selectedWidgetIds: [ 'grandparent', 'keeper' ],
      selectionAnchorId: 'grandparent',
      pinnedWidgetIds: [ 'grandparent', 'keeper' ]
    }, [ 'grandparent', 'parent', 'child' ], { parentOf });
    assert.deepEqual(narrowed.selectedWidgetIds, [ 'keeper', 'grandparent' ]);
    assert.equal(narrowed.selectionAnchorId, 'grandparent');
  });

  describe('layout columns', function() {
    // main: top, layout
    //   layout columns: col-1, col-2 (layout columns)
    //     col-1: g-1, g-2
    //     col-2: g-3
    const parents = {
      'col-1': 'layout',
      'col-2': 'layout',
      'g-1': 'col-1',
      'g-2': 'col-1',
      'g-3': 'col-2'
    };
    const lists = {
      main: [ 'top', 'layout' ],
      columns: [ 'col-1', 'col-2' ],
      one: [ 'g-1', 'g-2' ],
      two: [ 'g-3' ]
    };
    const tree = {
      parentOf: (id) => parents[id] || null,
      areaOf: (id) => {
        const [ areaId, itemIds ] = Object.entries(lists)
          .find(([ , ids ]) => ids.includes(id)) || [];
        return areaId
          ? {
            areaId,
            itemIds
          }
          : null;
      },
      isColumn: (id) => id.startsWith('col-')
    };
    const choose = (state, gesture, widgetId) => {
      return lib.applyWidgetSelection({
        state,
        gesture,
        widgetId,
        ...tree
      });
    };

    it('selects the layout for widgets in two of its columns', function() {
      const first = choose(undefined, 'plain', 'g-1');
      assert.deepEqual(choose(first, 'toggle', 'g-3').selectedWidgetIds, [ 'layout' ]);
      assert.deepEqual(choose(first, 'range', 'g-3').selectedWidgetIds, [ 'layout' ]);
      assert.deepEqual(choose(first, 'toggle', 'g-2').selectedWidgetIds, [ 'g-1', 'g-2' ]);
    });

    it('never selects a column with a meta-click or shift-click', function() {
      const column = choose(undefined, 'plain', 'col-1');
      assert.deepEqual(choose(column, 'toggle', 'col-2').selectedWidgetIds, [ 'layout' ]);
      assert.deepEqual(choose(column, 'toggle', 'top').selectedWidgetIds, [ 'layout', 'top' ]);
      assert.deepEqual(choose(column, 'range', 'top').selectedWidgetIds, [ 'top', 'layout' ]);
      const top = choose(undefined, 'plain', 'top');
      assert.deepEqual(choose(top, 'toggle', 'col-2').selectedWidgetIds, [ 'top', 'layout' ]);
    });

    it('never captures a column in a drag', function() {
      const columns = lib.addCapturedWidgets(undefined, [ 'col-1', 'col-2' ], tree);
      assert.deepEqual(columns.selectedWidgetIds, []);
      const across = lib.addCapturedWidgets(undefined, [ 'col-1', 'g-1', 'col-2', 'g-3' ], tree);
      assert.deepEqual(across.selectedWidgetIds, [ 'layout' ]);
      assert.equal(across.selectionAnchorId, 'layout');
      const within = lib.addCapturedWidgets(undefined, [ 'col-1', 'g-1', 'g-2' ], tree);
      assert.deepEqual(within.selectedWidgetIds, [ 'g-1', 'g-2' ]);
    });
  });

  describe('scopes', function() {
    const { JSDOM } = require('jsdom');
    const widget = (id, inner = '') => {
      return `<div data-apos-widget-id="${id}" data-apos-widget-foreign="0">${inner}</div>`;
    };
    const area = (id, ...widgets) => {
      return `<div data-apos-area="${id}"><div class="apos-areas-widgets-list">${widgets.join('')}</div></div>`;
    };
    // The widget editor shows the layout's columns with the same ids as
    // the page, and an inline array item, artificially inside a widget,
    // holds an area of its own.
    const html = `
      <main>${area('main', widget('top-1'), widget('layout', area('columns', widget('col-a'), widget('col-b'))))}</main>
      <section data-apos-modal id="editor">
        ${area('columns', widget('col-a'), widget('col-b'))}
        ${widget('holder', '<div data-apos-input-array-inline-item id="item">' + area('item-area', widget('in-item')) + '</div>')}
      </section>
      <section data-apos-read-only>${area('versions', widget('old-1'), widget('old-2'))}</section>`;
    let saved;

    before(function() {
      const { window } = new JSDOM(html);
      saved = {
        document: global.document,
        window: global.window,
        CSS: global.CSS
      };
      global.document = window.document;
      global.window = window;
      window.apos = { adminBar: { editMode: true } };
      global.CSS = { escape: (value) => value };
    });

    after(function() {
      Object.assign(global, saved);
    });

    const byId = (id) => document.getElementById(id);
    const click = (scope, id, extra = {}) => {
      const el = dom.widgetElement(id, scope);
      return {
        el,
        event: {
          type: 'click',
          target: el,
          ...extra
        }
      };
    };

    it('finds the copy of a widget in the scope asked for', function() {
      const pageCopy = dom.widgetElement('col-a', document);
      const modalCopy = dom.widgetElement('col-a', byId('editor'));
      assert.ok(pageCopy && modalCopy && pageCopy !== modalCopy);
      assert.equal(dom.selectionScope(pageCopy), document);
      assert.equal(dom.selectionScope(modalCopy), byId('editor'));
      assert.equal(dom.parentWidgetId('col-a', document), 'layout');
      assert.equal(dom.parentWidgetId('col-a', byId('editor')), null);
    });

    it('stops the ancestor walk at an inline array item', function() {
      const item = byId('item');
      assert.equal(dom.selectionScope(dom.widgetElement('in-item', item)), item);
      assert.equal(dom.parentWidgetId('in-item', item), null);
      assert.equal(dom.widgetElement('in-item', byId('editor')), null);
    });

    it('selects in one scope and ignores a meta-click from another', function() {
      const editor = byId('editor');
      const page = lib.applyWidgetSelection({
        gesture: 'plain',
        widgetId: 'top-1'
      });
      const across = click(editor, 'col-b', { metaKey: true });
      assert.equal(dom.nextSelectionFromClick({
        ...across,
        widgetId: 'col-b',
        state: page,
        stateScope: document
      }).ignored, true);

      const first = click(editor, 'col-a');
      const plain = dom.nextSelectionFromClick({
        ...first,
        widgetId: 'col-a',
        state: page,
        stateScope: document
      });
      assert.equal(plain.scope, editor);
      assert.deepEqual(plain.next.selectedWidgetIds, [ 'col-a' ]);

      const second = click(editor, 'col-b', { metaKey: true });
      const added = dom.nextSelectionFromClick({
        ...second,
        widgetId: 'col-b',
        state: plain.next,
        stateScope: plain.scope
      });
      assert.deepEqual(added.next.selectedWidgetIds, [ 'col-a', 'col-b' ]);
      assert.equal(added.scope, editor);
    });

    it('treats a meta-click in a read only view as a plain click', function() {
      const old = dom.widgetElement('old-1');
      assert.equal(dom.isEditingContext(old), false);
      assert.equal(dom.isEditingContext(dom.widgetElement('top-1')), true);
      const state = lib.applyWidgetSelection({
        gesture: 'plain',
        widgetId: 'old-2'
      });
      const meta = click(document, 'old-1', { metaKey: true });
      assert.deepEqual(dom.nextSelectionFromClick({
        ...meta,
        widgetId: 'old-1',
        state,
        stateScope: document
      }).next.selectedWidgetIds, [ 'old-1' ]);
    });

    it('recognizes the column type of any layout widget module', function() {
      document.body.insertAdjacentHTML('beforeend', `
        <div data-apos-area="extra">
          <div data-apos-widget-id="custom-col" data-apos-widget-type="my-column"></div>
          <div data-apos-widget-id="plain" data-apos-widget-type="rich-text"></div>
        </div>`);
      window.apos.modules = {
        '@apostrophecms/layout-widget': { columnWidgetName: '@apostrophecms/layout-column' },
        'my-layout-widget': { columnWidgetName: 'my-column' }
      };
      assert.equal(dom.isLayoutColumn('custom-col'), true);
      assert.equal(dom.isLayoutColumn('plain'), false);
    });

    it('works out the scope of a selection the store did not record', function() {
      const editor = byId('editor');
      const state = lib.applyWidgetSelection({
        gesture: 'plain',
        widgetId: 'top-1'
      });
      const into = click(editor, 'col-b', { metaKey: true });
      assert.equal(dom.nextSelectionFromClick({
        ...into,
        widgetId: 'col-b',
        state
      }).ignored, true);
      const page = click(document, 'layout', { metaKey: true });
      assert.deepEqual(dom.nextSelectionFromClick({
        ...page,
        widgetId: 'layout',
        state
      }).next.selectedWidgetIds, [ 'top-1', 'layout' ]);
    });
  });
});
