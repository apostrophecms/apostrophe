const assert = require('node:assert/strict');
const getLib = async () => import(
  '../modules/@apostrophecms/layout-widget/ui/apos/lib/grid-state.mjs'
);

describe('Layout Widget', function () {

  describe('Move (grid-state)', function () {
    it('[shouldComputeMoveSnap] changes memo when coarse col/row bucket changes', async function () {
      const lib = await getLib();
      const items = [ buildItem('a', 1, 2, 0) ];
      const state = makeState(lib, items, 12, 2);
      const stepX = 100;
      const stepY = 100;
      const item = items[0];
      const a1 = lib.shouldComputeMoveSnap({
        left: 0,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 2,
        stepX,
        stepY,
        threshold: 0.6
      });
      const a2 = lib.shouldComputeMoveSnap({
        left: 120,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 2,
        stepX,
        stepY,
        threshold: 0.6,
        prevMemo: a1.memo
      });
      assert.equal(a1.compute, true);
      assert.equal(a2.compute, true, 'moving one track should change memo');
    });

    it('[shouldComputeMoveSnap] stable pointer within same coarse state returns compute=false', async function () {
      const lib = await getLib();
      const items = [ buildItem('a', 1, 2, 0) ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const stepY = 100;
      const item = items[0];
      const a1 = lib.shouldComputeMoveSnap({
        left: 10,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY,
        threshold: 0.6
      });
      const a2 = lib.shouldComputeMoveSnap({
        left: 15,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY,
        threshold: 0.6,
        prevMemo: a1.memo
      });
      assert.equal(a2.compute, false, 'small move in same bucket should not recompute');
    });

    it('[shouldComputeMoveSnap] flips compute when crossing hovered-neighbor flip boundary (east)', async function () {
      const lib = await getLib();
      // a:1..6 (6), b:7..2 (2), c:9..12 (4)
      const items = [
        buildItem('a', 1, 6, 0),
        buildItem('b', 7, 2, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const stepY = 100;
      const item = items[1];
      // For c width=4, threshold 0.7 ->
      //   flip at neighborStartPx + 0.7*width = 800 + 280 = 1080
      // Using right edge (b width=2 => widthPx=200): left threshold = 880
      const a1 = lib.shouldComputeMoveSnap({
        left: 879,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY,
        threshold: 0.7
      });
      const a2 = lib.shouldComputeMoveSnap({
        left: 880,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY,
        threshold: 0.7,
        prevMemo: a1.memo
      });
      assert.equal(a2.compute, true, 'crossing swap flip must recompute');
    });

    it('[shouldComputeMoveSnap] flips compute when crossing hovered-neighbor flip boundary (west)', async function () {
      const lib = await getLib();
      // a:1..2 (2), b:3..8 (6), c:9..12 (4)
      const items = [
        buildItem('a', 1, 2, 0),
        buildItem('b', 3, 6, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const stepY = 100;
      const item = items[1];
      // West neighbor a width=2 -> flip at end - 0.7*width -> 200 - 140 = 60
      const a1 = lib.shouldComputeMoveSnap({
        left: 59,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY,
        threshold: 0.7
      });
      const a2 = lib.shouldComputeMoveSnap({
        left: 61,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY,
        threshold: 0.7,
        prevMemo: a1.memo
      });
      assert.equal(a2.compute, true, 'crossing west swap flip must recompute');
    });
    it('[computeGhostMoveSnap] basic column-based snapping (no collisions)', async function () {
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 2, 0)
      ];
      const state = makeState(lib, items, 12, 1);
      const columns = 12;
      const rows = 1;
      // Assume track width 100px, no gap -> stepX = 100
      const stepX = 100;
      const stepY = 100; // unused for row=1
      const item = items[0];
      // Threshold default ~0.6 -> shift = (1 - 0.6) * 100 = 40
      // Positions near 0 should snap to colstart 1
      let snap = lib.computeGhostMoveSnap({
        left: 0,
        top: 0,
        state,
        item,
        columns,
        rows,
        stepX,
        stepY
      });
      assert.equal(snap.colstart, 1);
      // At left=61, (61+40)/100=1.01 -> floor=1 -> +1 => col 2
      snap = lib.computeGhostMoveSnap({
        left: 61,
        top: 0,
        state,
        item,
        columns,
        rows,
        stepX,
        stepY
      });
      assert.equal(snap.colstart, 2);
    });
    it('[computeGhostMoveSnap] respects custom threshold', async function () {
      const lib = await getLib();
      const items = [ buildItem('a', 1, 1, 0) ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const item = items[0];
      // With threshold=0.9 -> shift = 10px
      // - at left=89: (89+10)/100=0.99 floor=0 -> col 1
      // - at left=90: (90+10)/100=1.0 floor=1 -> +1 => col 2
      let snap = lib.computeGhostMoveSnap({
        left: 89,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.9
      });
      assert.equal(snap.colstart, 1);
      snap = lib.computeGhostMoveSnap({
        left: 90,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.9
      });
      assert.equal(snap.colstart, 2);
    });
    it('[computeGhostMoveSnap] 6|2|4: moving middle (2) into right (4) stays before when no space', async function () {
      const lib = await getLib();
      // a:1..6 (6), b:7..8 (2), c:9..12 (4)
      const items = [
        buildItem('a', 1, 6, 0),
        buildItem('b', 7, 2, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const item = items[1]; // move b
      // Start entering c area slightly but after-snap is impossible (edge packed)
      const leftIntoC = (9 - 1) * stepX + 10; // 10px into c
      const snap = lib.computeGhostMoveSnap({
        left: leftIntoC,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100
      });
      // Should remain before c => colstart 7
      assert.equal(snap.colstart, 7);
    });
    it('[computeGhostMoveSnap] 6|2|4: moving middle (2) into left (6) stays after when no space', async function () {
      const lib = await getLib();
      // a:1..6 (6), b:7..8 (2), c:9..12 (4)
      const items = [
        buildItem('a', 1, 6, 0),
        buildItem('b', 7, 2, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const item = items[1]; // move b
      // Enter a area slightly but before-snap is impossible (packed)
      const leftIntoA = (6 - 1) * stepX - 10; // just 10px before a's end
      const snap = lib.computeGhostMoveSnap({
        left: leftIntoA,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100
      });
      // Should remain after a => colstart 7
      assert.equal(snap.colstart, 7);
    });

    it('[computeGhostMoveSnap] 6|2|4 swap right flips at hovered-neighbor threshold (t=0.7)', async function () {
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 6, 0),
        buildItem('b', 7, 2, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100; // px per column
      const item = items[1];
      // neighbor: c width=4 -> flip at 0.7*4 cols from c start
      // stepX=100 => flipPx = 800 + 0.7*400 = 1080
      // Using leading edge (east: right edge). Item width=2 => widthPx=200
      // Swap when left + 200 >= 1080 -> left >= 880
      let snap = lib.computeGhostMoveSnap({
        left: 879,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });
      // 879 -> right edge 1079 < 1080 => stay before c
      assert.equal(snap.colstart, 7);
      snap = lib.computeGhostMoveSnap({
        left: 880,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });
      // 880 -> right edge 1080 => swap-right to equal-edge at 11
      assert.equal(snap.colstart, 11);
    });

    it('[computeGhostMoveSnap] 6|2|4 swap left flips at hovered-neighbor threshold (t=0.7)', async function () {
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 6, 0),
        buildItem('b', 7, 2, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const item = items[1];
      // neighbor: a width=6 -> west flip at end - 0.7*width = 600 - 420 = 180
      // stepX=100 => flipPx = 180 (west uses left-edge)
      let snap = lib.computeGhostMoveSnap({
        left: 179,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });
      // 179 -> left-edge <= 180 => swap-left to 1
      assert.equal(snap.colstart, 1);
      snap = lib.computeGhostMoveSnap({
        left: 181,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });
      // 181 -> above neighbor flip => stay after a at colstart 7
      assert.equal(snap.colstart, 7);
    });

    it('[computeGhostMoveSnap] 2|6|4 swap right flips at hovered-neighbor threshold (t=0.7)', async function () {
      const lib = await getLib();
      // a:1..2 (2), b:3..8 (6), c:9..12 (4)
      const items = [
        buildItem('a', 1, 2, 0),
        buildItem('b', 3, 6, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const item = items[1]; // move b (6 wide)
      // neighbor: c width=4, flipPx = 800 + 0.7*400 = 1080
      // Using leading edge (east: right edge)
      // b width=6 => widthPx=600; left threshold=480
      let snap = lib.computeGhostMoveSnap({
        left: 479,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });
      // 479 -> right edge 1079 < 1080 => stay before c at colstart 3
      assert.equal(snap.colstart, 3);
      snap = lib.computeGhostMoveSnap({
        left: 480,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });
      // 480 -> right edge 1080 => swap-right to equal-edge at colstart 7
      assert.equal(snap.colstart, 7);
    });

    it('[computeGhostMoveSnap] 2|6|4 west swap flips at hovered-neighbor threshold (t=0.7)', async function () {
      const lib = await getLib();
      // a:1..2 (2), b:3..8 (6), c:9..12 (4)
      const items = [
        buildItem('a', 1, 2, 0),
        buildItem('b', 3, 6, 1),
        buildItem('c', 9, 4, 2)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const item = items[1];

      let snap = lib.computeGhostMoveSnap({
        left: 69,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });

      assert.equal(snap.colstart, 1);
      snap = lib.computeGhostMoveSnap({
        left: 71,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100,
        threshold: 0.7
      });

      assert.equal(snap.colstart, 3);
    });

    it('[computeGhostMoveSnap] 6|4: nudges neighbor before swap (two steps east)', async function () {
      const lib = await getLib();
      // a:1..6 (6), b:7..10 (4) with 2 cols free at right
      const items = [
        buildItem('a', 1, 6, 0),
        buildItem('b', 7, 4, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      const stepX = 100;
      const item = items[0]; // move the 6-wide left item

      // Step 1: move so colstart becomes 2 (left ~60)
      let snap = lib.computeGhostMoveSnap({
        left: 60,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100
      });
      assert.equal(snap.colstart, 2);
      // Dropping here should nudge the 4 from 7 -> 8
      let patches = lib.getMoveChanges({
        data: {
          id: 'a',
          colstart: 2,
          rowstart: 1
        },
        state,
        item
      });
      const pm1 = patchMap(patches);
      assert.equal(pm1.get('a')?.colstart, 2);
      assert.equal(pm1.get('b')?.colstart, 8);

      // Step 2: move so colstart becomes 3 (left ~160)
      snap = lib.computeGhostMoveSnap({
        left: 160,
        top: 0,
        state,
        item,
        columns: 12,
        rows: 1,
        stepX,
        stepY: 100
      });
      assert.equal(snap.colstart, 3);
      patches = lib.getMoveChanges({
        data: {
          id: 'a',
          colstart: 3,
          rowstart: 1
        },
        state,
        item
      });
      const pm2 = patchMap(patches);
      assert.equal(pm2.get('a')?.colstart, 3);
      assert.equal(pm2.get('b')?.colstart, 9);
    });

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

    it('[getMoveChanges] v1: reject until equal-edge swap allowed', async function () {
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

    it('[getMoveChanges] v2: reject overlaps for b; allow free move for a', async function () {
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

    it('[getMoveChanges] v3: reject overlaps for a and b (east)', async function () {
      // 1) a: 1..4, 2) b: 9..12
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 5, 0),
        buildItem('b', 9, 4, 1)
      ];
      const state = makeState(lib, items, 12, 1);

      // Moving a into overlaps should be rejected
      for (const start of [ 5, 6, 7 ]) {
        const patches = lib.getMoveChanges({
          data: {
            id: 'a',
            colstart: start,
            rowstart: 1
          },
          state,
          item: items[1]
        });
        assert.deepEqual(patches, [], `Failed to reject move with ${start - 4} step(s) east`);
      }
    });

    it('[getMoveChanges] equal-edge triggers opposite-direction nudging first, then fallback', async function () {
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

    it('[getMoveChanges] overlapping may triggers opposite-direction nudging', async function () {
      // a: 1..4, b: 5..9. Move a -> colstart 5 (a new end 8 equals b end 8).
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 4, 0),
        buildItem('b', 5, 5, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      const patches = lib.getMoveChanges({
        data: {
          id: 'a',
          colstart: 7,
          rowstart: 1
        },
        state,
        item: items[0]
      });
      const pm = patchMap(patches);
      // a placed at 7..10
      assert.equal(pm.get('a')?.colstart, 7);
      // Opposite-direction fallback -> b nudged west to 2..6
      assert.equal(pm.get('b')?.colstart, 2);
    });

    it('[getMoveChanges] same-direction east nudging any allowed tile', async function () {
      // Same setup as above: a: 1..4, b: 5..9.
      // Move a -> colstart 2 (a new end 5 overlaps b start 5 by one cell).
      // Expect b to nudge east by one to start at 6.
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 4, 0),
        buildItem('b', 5, 5, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      {
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
        // a placed at 2..5
        assert.equal(pm.get('a')?.colstart, 2, 'unable to move one tile east');
        // Same-direction nudging east by one -> b to 6..10
        assert.equal(pm.get('b')?.colstart, 6, 'unable to nudge b one tile east');
      }
      {
        const patches = lib.getMoveChanges({
          data: {
            id: 'a',
            colstart: 3,
            rowstart: 1
          },
          state,
          item: items[0]
        });
        const pm = patchMap(patches);
        // a placed at 3..6
        assert.equal(pm.get('a')?.colstart, 3, 'unable to move two tiles east');
        // Same-direction nudging east by one -> b to 6..10
        assert.equal(pm.get('b')?.colstart, 7, 'unable to nudge b two tiles east');
      }
      {
        const patches = lib.getMoveChanges({
          data: {
            id: 'a',
            colstart: 4,
            rowstart: 1
          },
          state,
          item: items[0]
        });
        const pm = patchMap(patches);
        // a placed at 4..7
        assert.equal(pm.get('a')?.colstart, 4, 'unable to move three tiles east');
        // Same-direction nudging east by one -> b to 6..10
        assert.equal(pm.get('b')?.colstart, 8, 'unable to nudge b three tiles east');
      }
      {
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
        // a placed at 5..8 would push b past grid (to 9..13) -> reject
        assert.equal(pm.get('a')?.colstart, undefined, 'failed to deny the move four tiles east');
        // b remains unchanged when move is denied
        assert.equal(pm.get('b')?.colstart, undefined, 'failed to deny the nudge b four tiles east');
      }
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

    it('[previewMoveChanges] mirrors getMoveChanges moving item placement (free move)', async function () {
      const lib = await getLib();
      const items = [
        buildItem('a', 1, 3, 0),
        buildItem('b', 6, 2, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      const target = {
        id: 'b',
        colstart: 4,
        rowstart: 1
      };
      const preview = lib.previewMoveChanges({
        data: target,
        state,
        item: items[1]
      });
      assert.equal(preview?.colstart, 4);
      const full = lib.getMoveChanges({
        data: target,
        state,
        item: items[1]
      });
      const pm = patchMap(full);
      assert.equal(pm.get('b')?.colstart, preview.colstart);
    });

    it('[previewMoveChanges] mirrors nudged placement on overlap scenario', async function () {
      const lib = await getLib();
      // a: 1..4, b: 5..9. Move a to colstart 2 (nudges b east)
      const items = [
        buildItem('a', 1, 4, 0),
        buildItem('b', 5, 5, 1)
      ];
      const state = makeState(lib, items, 12, 1);
      const target = {
        id: 'a',
        colstart: 2,
        rowstart: 1
      };
      const preview = lib.previewMoveChanges({
        data: target,
        state,
        item: items[0]
      });
      // preview should allow the move and report new colstart 2
      assert.equal(preview?.colstart, 2);
      const full = lib.getMoveChanges({
        data: target,
        state,
        item: items[0]
      });
      const pm = patchMap(full);
      assert.equal(pm.get('a')?.colstart, preview.colstart);
    });
  });

  describe('Resize (grid-state)', function () {
    it('[validateResizeX] shrinking from east keeps colstart', async function () {
      const lib = await getLib();
      // spans 2..7
      const item = buildItem('a', 2, 6, 0);
      const state = makeState(lib, [ item ], 12, 1);
      const validated = lib.validateResizeX({
        item,
        side: 'east',
        direction: 'east',
        // shrink by 2
        newColspan: 4,
        positionsIndex: state.positions,
        maxColumns: state.columns,
        minSpan: 1
      });
      // colstart unchanged, colspan reduced
      assert.equal(validated.colstart, 2);
      assert.equal(validated.colspan, 4);
    });

    it('[validateResizeX] shrinking from west shifts colstart right', async function () {
      const lib = await getLib();
      // 5..8
      const item = buildItem('a', 5, 4, 0);
      const state = makeState(lib, [ item ], 12, 1);
      const validated = lib.validateResizeX({
        item,
        side: 'west',
        direction: 'west',
        // shrink by 2 keeping east edge fixed
        newColspan: 2,
        positionsIndex: state.positions,
        maxColumns: state.columns,
        minSpan: 1
      });
      // East edge was 8, new span 2 => colstart 7
      assert.equal(validated.colstart, 7);
      assert.equal(validated.colspan, 2);
    });

    it('[validateResizeX] shrinking below minSpan clamps and adjusts start (west)', async function () {
      const lib = await getLib();
      // 5..9
      const item = buildItem('a', 5, 5, 0);
      const state = makeState(lib, [ item ], 12, 1);
      const validated = lib.validateResizeX({
        item,
        side: 'west',
        direction: 'west',
        // below minSpan 3
        newColspan: 1,
        positionsIndex: state.positions,
        maxColumns: state.columns,
        minSpan: 3
      });
      // Clamp to 3 -> shrink by 2; east edge 9 => new start 7
      assert.equal(validated.colspan, 3);
      assert.equal(validated.colstart, 7);
    });

    it('[validateResizeX] expand east within free space', async function () {
      const lib = await getLib();
      // 1..3
      const item = buildItem('a', 1, 3, 0);
      const state = makeState(lib, [ item ], 12, 1);
      const validated = lib.validateResizeX({
        item,
        side: 'east',
        direction: 'east',
        newColspan: 8,
        positionsIndex: state.positions,
        maxColumns: state.columns,
        minSpan: 1
      });
      assert.equal(validated.colstart, 1);
      assert.equal(validated.colspan, 8);
    });

    it('[validateResizeX] expand east clamped at grid edge', async function () {
      const lib = await getLib();
      // 1..5
      const item = buildItem('a', 1, 5, 0);
      const state = makeState(lib, [ item ], 12, 1);
      const validated = lib.validateResizeX({
        item,
        side: 'east',
        direction: 'east',
        // request beyond grid edge
        newColspan: 15,
        positionsIndex: state.positions,
        maxColumns: state.columns,
        minSpan: 1
      });
      // can fill entire row
      assert.equal(validated.colspan, 12);
      assert.equal(validated.colstart, 1);
    });

    it('[validateResizeX] expand west limited by neighbor and boundary', async function () {
      const lib = await getLib();
      // 5..7 target
      const a = buildItem('a', 5, 3, 0);
      // occupies 1..2 leaves 3..4 free
      const blocker = buildItem('b', 1, 2, 1);
      const state = makeState(lib, [ a, blocker ], 12, 1);
      const validated = lib.validateResizeX({
        item: a,
        side: 'west',
        direction: 'west',
        // request more than available (only cols 3..7 usable)
        newColspan: 10,
        positionsIndex: state.positions,
        maxColumns: state.columns,
        minSpan: 1
      });
      // Free cells west of a: 3 & 4 -> 2 extra => final span 5, start 3
      assert.equal(validated.colspan, 5);
      assert.equal(validated.colstart, 3);
    });

    it('[getResizeChanges] shrink returns only item patch', async function () {
      const lib = await getLib();
      const a = buildItem('a', 2, 6, 0);
      const state = makeState(lib, [ a ], 12, 1);
      const patches = lib.getResizeChanges({
        data: {
          id: 'a',
          side: 'east',
          direction: 'east',
          colspan: 4,
          colstart: 2,
          rowstart: 1,
          rowspan: 1,
          order: 0
        },
        state,
        item: a
      });
      assert.equal(patches.length, 1);
      const p = patches[0];
      assert.equal(p._id, 'a');
      assert.equal(p.colspan, 4);
      assert.equal(p.colstart, 2);
    });

    it('[getResizeChanges] east expansion nudges single neighbor', async function () {
      const lib = await getLib();
      // 1..4
      const a = buildItem('a', 1, 4, 0);
      // 5..8
      const b = buildItem('b', 5, 4, 1);
      const state = makeState(lib, [ a, b ], 12, 1);
      const patches = lib.getResizeChanges({
        data: {
          id: 'a',
          side: 'east',
          direction: 'east',
          // expand by 1
          colspan: 5,
          colstart: 1,
          rowstart: 1,
          rowspan: 1,
          order: 0
        },
        state,
        item: a
      });
      const pm = patchMap(patches);
      assert.equal(pm.get('a')?.colspan, 5);
      assert.equal(pm.get('a')?.colstart, 1);
      assert.equal(pm.get('b')?.colstart, 6, 'neighbor not nudged east by 1');
    });

    it('[getResizeChanges] east expansion cascades two neighbors (clamping at edge)', async function () {
      const lib = await getLib();
      const a = buildItem('a', 1, 4, 0); // 1..4
      const b = buildItem('b', 5, 4, 1); // 5..8
      const c = buildItem('c', 9, 4, 2); // 9..12 (edge)
      const state = makeState(lib, [ a, b, c ], 12, 1);
      const patches = lib.getResizeChanges({
        data: {
          id: 'a',
          side: 'east',
          direction: 'east',
          // expand 1
          colspan: 5,
          colstart: 1,
          rowstart: 1,
          rowspan: 1,
          order: 0
        },
        state,
        item: a
      });
      const pm = patchMap(patches);
      assert.equal(pm.get('a')?.colspan, 5);
      assert.equal(pm.get('b')?.colstart, 6, 'b should shift east by 1');
      // c cannot move east (already at edge), algorithm clamps -> stays 9
      assert.equal(pm.get('c')?.colstart, 9);
    });

    it('[getResizeChanges] west expansion nudges neighbor west', async function () {
      const lib = await getLib();
      const a = buildItem('a', 5, 3, 0); // 5..7
      const left = buildItem('b', 1, 3, 1); // 1..3
      const state = makeState(lib, [ a, left ], 12, 1);
      const patches = lib.getResizeChanges({
        data: {
          id: 'a',
          side: 'west',
          direction: 'west',
          colspan: 5, // expand by 2 into cols 3-4
          colstart: 3,
          rowstart: 1,
          rowspan: 1,
          order: 0
        },
        state,
        item: a
      });
      const pm = patchMap(patches);
      assert.equal(pm.get('a')?.colspan, 5);
      assert.equal(pm.get('a')?.colstart, 3);
      // left neighbor shifts west by 0? Only 1 free cell (col 4) so needs shift
      // It has original start 1 so cannot move further west -> clamped to 1
      assert.equal(pm.get('b')?.colstart, 1);
    });
  });

  describe('Provisioning (grid-state)', function () {
    it('[provisionRow] smoke and symmetry cases', async function () {
      const { provisionRow } = await getLib();
      const cases = [
        {
          C: 12,
          min: 2,
          ideal: 3,
          expect: [ 3, 3, 3, 3 ]
        },
        {
          C: 10,
          min: 2,
          ideal: 3,
          expect: [ 3, 4, 3 ]
        },
        {
          C: 11,
          min: 2,
          ideal: 3,
          expect: [ 3, 3, 3, 2 ]
        },
        {
          C: 7,
          min: 2,
          ideal: 3,
          expect: [ 4, 3 ]
        },
        {
          C: 5,
          min: 2,
          ideal: 3,
          expect: [ 3, 2 ]
        },
        {
          C: 4,
          min: 2,
          ideal: 3,
          expect: [ 4 ]
        },
        {
          C: 3,
          min: 2,
          ideal: 3,
          expect: [ 3 ]
        },
        {
          C: 2,
          min: 2,
          ideal: 3,
          expect: [ 2 ]
        },
        {
          C: 1,
          min: 2,
          ideal: 3,
          expect: [ 1 ]
        }
      ];

      for (const t of cases) {
        const items = provisionRow(t.C, {
          minColspan: t.min,
          defaultColspan: t.ideal,
          row: 1
        });
        const spans = items.map(i => i.colspan);
        const sum = spans.reduce((a, b) => a + b, 0);
        // Fills entire row
        assert.equal(sum, t.C, `sum != columns for C=${t.C}`);
        // Expected distribution
        assert.deepEqual(
          spans,
          t.expect,
          `unexpected spans for C=${t.C} -> ${JSON.stringify(spans)}`
        );
        // Sequential colstart and order
        let col = 1;
        items.forEach((it, idx) => {
          assert.equal(it.rowstart, 1);
          assert.equal(it.rowspan, 1);
          assert.equal(it.order, idx);
          assert.equal(it.colstart, col);
          col += it.colspan;
        });
      }
    });

    it('[provisionRow] default < min coerces toward min-sized tiles', async function () {
      const { provisionRow } = await getLib();
      const C = 12;
      const items = provisionRow(C, {
        minColspan: 3,
        defaultColspan: 2,
        row: 2
      });
      const spans = items.map(i => i.colspan);
      const sum = spans.reduce((a, b) => a + b, 0);
      assert.equal(sum, C);
      spans.forEach(s => assert.ok(s >= 3));
      assert.ok(spans.every(s => s >= 3 && s <= 4));
      items.forEach((it, idx) => {
        assert.equal(it.rowstart, 2);
        assert.equal(it.order, idx);
      });
    });

    it('[provisionRow] min = 1 and ideal = 1 yields 1-wide tiles', async function () {
      const { provisionRow } = await getLib();
      const C = 5;
      const items = provisionRow(C, {
        minColspan: 1,
        defaultColspan: 1,
        row: 3
      });
      const spans = items.map(i => i.colspan);
      assert.deepEqual(spans, [ 1, 1, 1, 1, 1 ]);
      items.forEach((it, idx) => {
        assert.equal(it.rowstart, 3);
        assert.equal(it.rowspan, 1);
        assert.equal(it.order, idx);
      });
    });

    it('[provisionRow] columns less than min -> single full-width item', async function () {
      const { provisionRow } = await getLib();
      const C = 2;
      const items = provisionRow(C, {
        minColspan: 3,
        defaultColspan: 4,
        row: 4
      });
      assert.equal(items.length, 1);
      assert.equal(items[0].colspan, 2);
      assert.equal(items[0].rowstart, 4);
      assert.equal(items[0].rowspan, 1);
      assert.equal(items[0].colstart, 1);
      assert.equal(items[0].order, 0);
    });

    it('[provisionRow] large columns with ideal 3 produce repeated 3s', async function () {
      const { provisionRow } = await getLib();
      const C = 24;
      const items = provisionRow(C, {
        minColspan: 2,
        defaultColspan: 3,
        row: 5
      });
      const spans = items.map(i => i.colspan);
      const sum = spans.reduce((a, b) => a + b, 0);
      assert.equal(sum, C);
      assert.ok(spans.every(s => s === 3));
      let c = 1;
      items.forEach((it) => {
        assert.equal(it.colstart, c);
        c += it.colspan;
      });
    });

    it('[provisionRow] odd columns with min 3 ideal 4 have limited spread', async function () {
      const { provisionRow } = await getLib();
      const C = 13;
      const items = provisionRow(C, {
        minColspan: 3,
        defaultColspan: 4,
        row: 6
      });
      const spans = items.map(i => i.colspan);
      const sum = spans.reduce((a, b) => a + b, 0);
      assert.equal(sum, C);
      spans.forEach(s => assert.ok(s >= 3));
      const minS = Math.min(...spans);
      const maxS = Math.max(...spans);
      assert.ok(maxS - minS <= 2);
    });

    it('[provisionRow] supports string columns input', async function () {
      const { provisionRow } = await getLib();
      const items = provisionRow('12', {
        minColspan: 2,
        defaultColspan: 3
      });
      const spans = items.map(i => i.colspan);
      assert.equal(spans.reduce((a, b) => a + b, 0), 12);
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
