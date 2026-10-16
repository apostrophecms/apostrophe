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
      widgetId: 'a',
      areaId: 'area'
    });
    const added = lib.applyWidgetSelection({
      state: first,
      gesture: 'toggle',
      widgetId: 'b',
      areaId: 'area'
    });
    assert.deepEqual(added.selectedWidgetIds, [ 'a', 'b' ]);
    assert.equal(added.selectionAnchorId, 'b');
    assert.deepEqual(added.pinnedWidgetIds, [ 'a', 'b' ]);

    const removed = lib.applyWidgetSelection({
      state: added,
      gesture: 'toggle',
      widgetId: 'a',
      areaId: 'area'
    });
    assert.deepEqual(removed.selectedWidgetIds, [ 'b' ]);
    assert.equal(removed.selectionAnchorId, 'b');
    assert.deepEqual(removed.pinnedWidgetIds, [ 'b' ]);
  });

  it('selects a same-area range and shrinks it on a shorter shift-click', function() {
    const items = [ 'a', 'b', 'c', 'd', 'e' ];
    const anchor = lib.applyWidgetSelection({
      gesture: 'plain',
      widgetId: 'b',
      areaId: 'area',
      areaItemIds: items
    });
    const range = lib.applyWidgetSelection({
      state: anchor,
      gesture: 'range',
      widgetId: 'e',
      areaId: 'area',
      anchorAreaId: 'area',
      areaItemIds: items
    });
    assert.deepEqual(range.selectedWidgetIds, [ 'b', 'c', 'd', 'e' ]);
    assert.equal(range.selectionAnchorId, 'b');
    assert.deepEqual(range.pinnedWidgetIds, [ 'b' ]);

    const shorter = lib.applyWidgetSelection({
      state: range,
      gesture: 'range',
      widgetId: 'c',
      areaId: 'area',
      anchorAreaId: 'area',
      areaItemIds: items
    });
    assert.deepEqual(shorter.selectedWidgetIds, [ 'b', 'c' ]);
    assert.equal(shorter.selectionAnchorId, 'b');
  });

  it('treats a shift-click in another area as a plain click', function() {
    const anchor = lib.applyWidgetSelection({
      gesture: 'plain',
      widgetId: 'a',
      areaId: 'one'
    });
    const shifted = lib.applyWidgetSelection({
      state: anchor,
      gesture: 'range',
      widgetId: 'z',
      areaId: 'two',
      anchorAreaId: 'one',
      areaItemIds: [ 'z' ]
    });
    assert.deepEqual(shifted.selectedWidgetIds, [ 'z' ]);
    assert.equal(shifted.selectionAnchorId, 'z');
    assert.deepEqual(shifted.pinnedWidgetIds, [ 'z' ]);
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

  it('keeps pinned widgets from outside the area when a shift-click changes the sibling range', function() {
    const items = [ 'a', 'b', 'c', 'd' ];
    const withOutside = {
      selectedWidgetIds: [ 'a', 'child-1', 'child-2' ],
      selectionAnchorId: 'a',
      pinnedWidgetIds: [ 'a', 'child-1', 'child-2' ]
    };

    const ranged = lib.applyWidgetSelection({
      state: withOutside,
      gesture: 'range',
      widgetId: 'c',
      areaId: 'area',
      anchorAreaId: 'area',
      areaItemIds: items
    });
    assert.deepEqual(ranged.selectedWidgetIds, [ 'child-1', 'child-2', 'a', 'b', 'c' ]);
    assert.deepEqual(ranged.pinnedWidgetIds, [ 'a', 'child-1', 'child-2' ]);

    const shrunk = lib.applyWidgetSelection({
      state: ranged,
      gesture: 'range',
      widgetId: 'a',
      areaId: 'area',
      anchorAreaId: 'area',
      areaItemIds: items
    });
    assert.deepEqual(shrunk.selectedWidgetIds, [ 'child-1', 'child-2', 'a' ]);
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

    const onlyChild = lib.addCapturedWidgets(state, [ 'child' ], { parentOf });
    assert.deepEqual(onlyChild.selectedWidgetIds, [ 'keeper', 'child' ]);
    assert.equal(onlyChild.selectionAnchorId, 'child');
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
    assert.deepEqual(narrowed.selectedWidgetIds, [ 'keeper', 'child' ]);
    assert.equal(narrowed.selectionAnchorId, 'child');
  });
});
