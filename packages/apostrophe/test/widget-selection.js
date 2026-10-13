const assert = require('assert/strict');

const getLib = async () => import('../modules/@apostrophecms/area/ui/apos/lib/widget-selection.js');

describe('widget selection', function() {
  let lib;

  before(async function() {
    lib = await getLib();
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
    assert.equal(removed.selectionAnchorId, 'a');
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

  it('keeps pinned descendants when a later shift-click changes the sibling range', function() {
    const items = [ 'a', 'b', 'c', 'd' ];
    const anchor = lib.applyWidgetSelection({
      gesture: 'plain',
      widgetId: 'a',
      areaId: 'area',
      areaItemIds: items
    });
    const withChildren = lib.includeDescendants(anchor, [ 'child-1', 'child-2' ]);
    assert.deepEqual(withChildren.selectedWidgetIds, [ 'a', 'child-1', 'child-2' ]);
    assert.deepEqual(withChildren.pinnedWidgetIds, [ 'a', 'child-1', 'child-2' ]);

    const ranged = lib.applyWidgetSelection({
      state: withChildren,
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
});
