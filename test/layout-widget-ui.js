const assert = require('node:assert/strict');
const getLib = async () => import(
  '../modules/@apostrophecms/layout-widget/ui/apos/lib/grid-state.mjs'
);

describe('Layout Widget', function () {

  describe('UI State', function () {

    it('[getMoveChanges] should return no patches for no changes', async function () {
      const { getMoveChanges } = await getLib();
      const state = {
        lookup: new Map(),
        grid: {
          columns: 12,
          rows: 6
        }
      };
      const data = {
        id: 'test-item',
        colstart: 1,
        colspan: 2,
        rowspan: 1,
        rowstart: 1
      };

      {
        const patches = getMoveChanges({
          data,
          state,
          item: {
            id: 'test-item',
            colstart: 1,
            colspan: 2,
            rowspan: 1,
            rowstart: 1
          }
        });
        assert.deepEqual(patches, []);
      }

      {
        const patches = getMoveChanges({
          data,
          state,
          item: {
            id: 'test-item',
            colstart: 1,
            rowstart: 1
          }
        });
        assert.deepEqual(patches, []);
      }
    });

    it('[getMoveChanges] place if destination free (no nudge)', async function () {
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 3, 0),
        buildItem('b', 6, 2, 1)
      ];
      const state = makeState(lib, items, 12, 1);

      const data = {
        id: 'b',
        colstart: 4, // free gap between a (1..3) and b (6..7)
        rowstart: 1
      };
      const patches = lib.getMoveChanges({
        data,
        state,
        item: items[1]
      });
      const pm = patchMap(patches);
      // b moves to start 4
      assert.equal(pm.get('b')?.colstart, 4);
      // a unchanged
      assert.equal(pm.get('a')?.colstart, undefined);
    });

    it('[getMoveChanges] Test 1: reject until equal-edge swap allowed', async function () {
      // 12 cols, 1 row
      // 1) a: 1..5, 2) b: 9..12
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 5, 0),
        buildItem('b', 9, 4, 1)
      ];
      const state = makeState(lib, items, 12, 1);

      // Move b to colstart 5 -> reject
      let patches = lib.getMoveChanges({
        data: {
          id: 'b',
          colstart: 5,
          rowstart: 1
        },
        state,
        item: items[1]
      });
      assert.deepEqual(patches, []);
      // 4 -> reject
      patches = lib.getMoveChanges({
        data: {
          id: 'b',
          colstart: 4,
          rowstart: 1
        },
        state,
        item: items[1]
      });
      assert.deepEqual(patches, []);
      // 3 -> reject
      patches = lib.getMoveChanges({
        data: {
          id: 'b',
          colstart: 3,
          rowstart: 1
        },
        state,
        item: items[1]
      });
      assert.deepEqual(patches, []);
      // 2 -> reject
      patches = lib.getMoveChanges({
        data: {
          id: 'b',
          colstart: 2,
          rowstart: 1
        },
        state,
        item: items[1]
      });
      assert.deepEqual(patches, []);
      // 1 -> allowed via opposite-direction nudge (swap)
      patches = lib.getMoveChanges({
        data: {
          id: 'b',
          colstart: 1,
          rowstart: 1
        },
        state,
        item: items[1]
      });
      const pm = patchMap(patches);
      assert.equal(pm.get('b')?.colstart, 1);
      assert.equal(pm.get('a')?.colstart, 5); // a nudged east to start at 5
    });

    it('[getMoveChanges] Test 2: reject overlaps for b; allow free move for a', async function () {
      // 1) a: 1..4, 2) b: 8..12
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 4, 0),
        buildItem('b', 8, 5, 1)
      ];
      const state = makeState(lib, items, 12, 1);

      // Moving b into overlaps should be rejected
      for (const start of [ 4, 3, 2 ]) {
        const patches = lib.getMoveChanges({
          data: {
            id: 'b',
            colstart: start,
            rowstart: 1
          },
          state,
          item: items[1]
        });
        assert.deepEqual(patches, []);
      }
      // Moving a to colstart 2 is free (no overlap) -> allowed
      const patches = lib.getMoveChanges({
        data: {
          id: 'a',
          colstart: 2,
          rowstart: 1
        },
        state,
        item: items[0]
      });
      const pm = patchMap(patches);
      assert.equal(pm.get('a')?.colstart, 2);
      assert.equal(pm.get('b')?.colstart, undefined);
    });

    it('[getMoveChanges] equal-edge triggers opposite-direction first, then fallback', async function () {
      // a: 1..4, b: 7..8. Move a -> colstart 5 (a new end 8 equals b end 8).
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 4, 0),
        buildItem('b', 7, 2, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      const patches = lib.getMoveChanges({
        data: {
          id: 'a',
          colstart: 5,
          rowstart: 1
        },
        state,
        item: items[0]
      });
      const pm = patchMap(patches);
      // a placed at 5..8
      assert.equal(pm.get('a')?.colstart, 5);
      // Opposite-direction first -> b nudged west to 3..4
      assert.equal(pm.get('b')?.colstart, 3);
    });

    it('[getMoveChanges] reject when nudging would exceed grid bounds', async function () {
      const lib = await getLib();
      // a: 1..7 (7 cols), b: 8..12 (5 cols).
      // Move b -> 7..11 would require a to move west outside grid.
      const items = [
        buildItem('a', 1, 7, 0),
        buildItem('b', 8, 5, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      const patches = lib.getMoveChanges({
        data: {
          id: 'b',
          colstart: 7,
          rowstart: 1
        },
        state,
        item: items[1]
      });
      assert.deepEqual(patches, []);
    });

    it('[getMoveChanges] vertical-only move, free destination accepted', async function () {
      // rows: 2. a at row1 1..3. Move a to row2 same columns.
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 3, 0, 1, 1)
      ];
      const state = makeState(lib, items, 12, 2);
      // Destination row 2 is empty
      const patches = lib.getMoveChanges({
        data: {
          id: 'a',
          colstart: 1,
          rowstart: 2
        },
        state,
        item: items[0]
      });
      const pm = patchMap(patches);
      assert.equal(pm.get('a')?.rowstart, 2);
      assert.equal(pm.get('a')?.colstart, 1);
    });

    it('[getMoveChanges] honors precomputed index during nudging', async function () {
      // Use Test 1 swap scenario with precomp
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 5, 0),
        buildItem('b', 9, 4, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      const precomp = lib.prepareMoveIndex({
        state,
        item: items[1]
      });
      const patches = lib.getMoveChanges({
        data: {
          id: 'b',
          colstart: 1,
          rowstart: 1
        },
        state,
        item: items[1],
        precomp
      });
      const pm = patchMap(patches);
      assert.equal(pm.get('b')?.colstart, 1);
      assert.equal(pm.get('a')?.colstart, 5);
    });
  });
});

function buildItem(id, colstart, colspan, order, rowstart = 1, rowspan = 1) {
  return {
    _id: id,
    type: 'test',
    order,
    rowstart,
    colstart,
    colspan,
    rowspan,
    align: 'stretch',
    justify: 'stretch'
  };
}

function makeState(lib, items, columns = 12, rows = 1) {
  const current = {
    items,
    rows
  };
  return {
    columns,
    current,
    options: {},
    lookup: new Map(items.map(i => [ i._id, i ])),
    positions: lib.createPositionIndex(items, rows)
  };
}

function patchMap(patches) {
  const m = new Map();
  for (const p of patches) {
    m.set(p._id, p);
  }
  return m;
}
