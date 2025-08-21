/**
 *
 *
 * @typedef {{
 *  id: string,
 *  side: string,
 *  direction: string,
 *  colspan: number,
 *  colstart: number,
 *  rowstart: number,
 *  rowspan: number,
 *  order: number,
 *  snapColstart?: number,
 *  snapRowstart?: number,
 * }} GhostDataWrite
 *
 *
 *
 * @typedef {{
 *  _id: string,
 *  type: string,
 *  order: number,
 *  rowstart: number,
 *  colstart: number,
 *  colspan: number,
 *  rowspan: number,
 *  align: string,
 *  justify: string
 * }} CurrentItem
 *
 * @typedef {ReturnType<typeof itemsToState>} GridState
 * @typedef {ReturnType<typeof createPositionIndex>} PositionIndex
 */

/**
 * Accepts:
 *  - items (array of instances of @apostrophecms/layout-column-widget)
 *  - meta (instance of @apostrophecms/layout-meta-widget, optional)
 *  - options (Browser options of @apostsrophecms/layout-widget)
 *  - layoutMode (string, either 'manage', 'focus' or 'preview')
 *  - deviceMode (string, either 'desktop', 'tablet' or 'mobile')
 *
 * @param {Object} params
 * @param {CurrentItem[]} params.items - The items to be converted to state.
 * @param {Object} params.meta - The meta information for the grid.
 * @param {Object} params.options - The options for the grid.
 * @param {string} params.layoutMode - The layout mode of the grid.
 * @param {string} params.deviceMode - The device mode for the grid.
 */
export function itemsToState({
  items, meta, options, layoutMode, deviceMode
}) {
  const perDevice = {
    desktop: {
      items: [],
      rows: 1,
      auto: true
    },
    tablet: {
      items: [],
      rows: 1,
      auto: true
    },
    mobile: {
      items: [],
      rows: 1,
      auto: true
    }
  };

  for (const [ device, record ] of Object.entries(perDevice)) {
    record.items = items.map(item => ({
      ...item,
      ...item[device],
      _id: item._id,
      type: item.type,
      content: null // optimize memory, we don't need content here
    }));
    record.rows = meta[device]?.rows || 1;
    record.auto = meta[device]?.auto ?? false;
  }
  const current = perDevice[deviceMode] || perDevice.desktop;
  const gap = options.gap === '0' ? 0 : options.gap;
  const resolvedOptions = {
    ...options,
    columns: meta.columns || options.columns,
    gap: [ 'manage', 'focus' ].includes(layoutMode) ? gap || '2px' : options.gap
  };

  const positionsIndex = createPositionIndex(current.items, current.rows);
  const lookup = new Map(current.items.map(item => [ item._id, item ]));
  const originalItems = new Map(items.map(item => [ item._id, item ]));

  const state = {
    columns: meta.columns || options.columns,
    layoutMode,
    deviceMode,
    devices: perDevice,
    current,
    originalItems,
    lookup,
    options: resolvedOptions,
    positions: positionsIndex
  };

  return state;
}

/**
 * Create a 2d map (rows x columns) to store items positions
 *
 * @param {CurrentItem[]} items
 * @returns {Map<number, Map<number, string>>}
 */
export function createPositionIndex(items, rows) {
  const sorted = items.slice().sort((a, b) => a.order - b.order);
  const positionsIndex = new Map();
  for (let i = 1; i <= rows; i++) {
    positionsIndex.set(i, new Map());
  }
  for (const item of sorted) {
    const {
      colstart, colspan, rowstart
    } = item;
    for (let i = 0; i < colspan; i++) {
      positionsIndex.get(rowstart)?.set(colstart + i, item._id);
    }
  }

  return positionsIndex;
}

/**
 * Validates the new column span for all item rows.
 * Calculates the max available capacity in the provided direction
 * based on the existing items in the grid.
 * It's assumed that the item position is valid and within the grid bounds.
 *
 * Performance is critical as this is triggered on mouse move events.
 *
 * @param {Object} params - The parameters for validation.
 * @param {CurrentItem} params.item - The  item being resized.
 * @param {string} params.side - The side of the item being resized ('east' or 'west').
 * @param {string} params.direction - The direction of the resize ('east' or '
 * west').
 * @param {number} params.newColspan - The new column span being requested.
 * @param {PositionIndex} params.positionsIndex - The current positions index.
 * @param {number} params.maxColumns - The maximum number of columns in the grid.
 * @param {number} params.minSpan - The minimum column span allowed.
 * @returns {{
 *  _id: string,
 *  colspan: number,
 *  colstart: number
 * }} - The validated resize parameters plus the item ID and colstart.
 */
export function validateResizeX({
  item, side, direction, newColspan, positionsIndex, maxColumns, minSpan
}) {
  if (!item) {
    throw new Error('Item is required for resizing validation');
  }
  const appliedMinSpan = Math.max(1, minSpan || 1);
  const delta = newColspan - item.colspan;
  if (delta === 0) {
    return {
      _id: item._id,
      colspan: item.colspan,
      colstart: item.colstart
    };
  }
  if (delta < 0) {
  // Shrinking: keep the opposite edge fixed.
  // When shrinking from the west side, the colstart must move to the right by
  // the ACTUAL shrink amount (respecting minSpan).
    const targetColspan = Math.max(newColspan, appliedMinSpan);
    const appliedDelta = targetColspan - item.colspan; // negative or 0
    const unclampedStart = side === 'west'
      ? (item.colstart - appliedDelta) // subtracting a negative == plus
      : item.colstart;
    // Clamp inside grid: 1 .. (maxColumns - targetColspan + 1)
    const maxStart = Math.max(1, maxColumns - targetColspan + 1);
    return {
      _id: item._id,
      colspan: targetColspan,
      colstart: Math.min(Math.max(unclampedStart, 1), maxStart)
    };
  }

  // The below logic is used only for expanding
  const itemRows = Array.from({ length: item.rowspan }, (_, i) => item.rowstart + i);

  // Helper: count TOTAL free cells in a direction for a row index map.
  // East: columns in (endCell+1..maxColumns).
  // West: columns in (1..startCell-1).
  const countTotalFree = (rowIndex, from, to) => {
    // If rowIndex is missing, all cells in range are free.
    if (!rowIndex) {
      return Math.max(0, to - from + 1);
    }
    let count = 0;
    if (from <= to) {
      for (let c = from; c <= to; c++) {
        if (!rowIndex.has(c)) {
          count += 1;
        }
      }
    }
    return count;
  };

  // Determine maximum extra columns we can add while expanding in the given
  // direction, aligned across all spanned rows
  // (take the minimum across rows).
  const startCell = item.colstart;
  const endCell = startCell + item.colspan - 1;
  const range = (direction === 'east')
    ? {
      from: endCell + 1,
      to: maxColumns
    }
    : {
      from: 1,
      to: startCell - 1
    };

  let maxExtra = Infinity;
  for (const row of itemRows) {
    const rowIndex = positionsIndex.get(row);
    const free = countTotalFree(rowIndex, range.from, range.to);
    maxExtra = Math.min(maxExtra, free);
  }
  maxExtra = Math.max(0, maxExtra);

  const maxColspan = item.colspan + maxExtra;
  const targetColspan = Math.max(appliedMinSpan, Math.min(newColspan, maxColspan));

  // Compute resulting colstart respecting side and boundary
  const appliedDelta = targetColspan - item.colspan;
  let unclampedStart = item.colstart;
  if (side === 'west' && direction === 'west') {
    unclampedStart = item.colstart - appliedDelta;
  }
  const maxStart = Math.max(1, maxColumns - targetColspan + 1);
  const finalStart = Math.min(Math.max(unclampedStart, 1), maxStart);

  return {
    _id: item._id,
    colspan: targetColspan,
    colstart: finalStart
  };
}

/**
 * Triggered on capturing the end of horizontal axis resize.
 * Returns the new position of the target item and all other affected items
 * if nudging is required.
 *
 * @param {Object} arg - The ghost data containing the item and its state.
 * @param {GhostDataWrite} arg.data - The ghost data containing the item and its state.
 * @param {GridState} arg.state - The current grid state.
 * @param {CurrentItem} arg.item - The item being resized.
 *
 * @returns {{
 *  _id: string,
 *  colspan?: number,
 *  colstart: number,
 * }[]}
 */
export function getResizeChanges({
  data, state, item
}) {
  if (!item || !data.direction) {
    return [];
  }

  const maxColumns = state.columns;
  const {
    direction, colspan: newColspan, colstart: newColstart
  } = data;
  const expanded = Math.max(0, newColspan - item.colspan);

  // Always include the current item patch
  const patches = [
    {
      _id: item._id,
      colspan: newColspan,
      colstart: newColstart
    }
  ];

  if (!expanded) {
    return patches;
  }

  // Collect required shift per neighbor across all affected rows
  const neighborShift = new Map(); // id -> shift amount (positive integer)
  // Rows occupied by the item
  const itemRows = Array.from({ length: item.rowspan }, (_, i) => item.rowstart + i);
  const itemsById = state.lookup;

  const inBounds = (col) => col >= 1 && col <= maxColumns;
  const advancePastNeighbor = direction === 'east'
    ? (item) => (item.colstart + item.colspan)
    : (item) => (item.colstart - 1);

  for (const row of itemRows) {
    const xIndex = state.positions.get(row);
    if (!xIndex) {
      continue;
    }

    // Build occupancy array [1..maxColumns] for this row
    const occupancy = new Array(maxColumns + 1).fill(null);
    for (let c = 1; c <= maxColumns; c++) {
      occupancy[c] = xIndex.get(c) || null;
    }

    const startCell = item.colstart;
    const endCell = startCell + item.colspan - 1;
    // Parameterize directional scanning to avoid duplicating logic
    const step = (direction === 'east') ? 1 : -1;
    const startScan = (direction === 'east')
      ? Math.min(endCell + 1, maxColumns + 1)
      : Math.max(startCell - 1, 1);

    // Create a gap of size `expanded` by cascading neighbors in `direction`
    let sinceLastEmpty = 0;
    let currentShift = expanded;
    let col = startScan;
    while (inBounds(col) && currentShift > 0) {
      const id = occupancy[col];
      if (!id) {
        sinceLastEmpty++;
        col += step;
        continue;
      }
      // Reduce the required shift by empties since last neighbor
      currentShift = Math.max(0, currentShift - sinceLastEmpty);
      if (!currentShift) {
        break;
      }
      const _item = itemsById.get(id);
      if (!_item || id === item._id) {
        col += step;
        continue;
      }
      const prev = neighborShift.get(id) || 0;
      neighborShift.set(id, Math.max(prev, currentShift));
      // Jump past this neighbor based on original positions
      col = advancePastNeighbor(_item);
      sinceLastEmpty = 0;
    }
  }

  // Convert neighbor shifts to patches (colstart only)
  for (const [ id, shift ] of neighborShift.entries()) {
    const n = itemsById.get(id);
    if (!n) {
      continue;
    }
    let newStart;
    if (direction === 'east') {
      newStart = Math.min(maxColumns - n.colspan + 1, n.colstart + shift);
    } else {
      newStart = Math.max(1, n.colstart - shift);
    }
    patches.push({
      _id: id,
      colstart: newStart
    });
  }

  return patches;
}

/**
 * Based on the current state, the ghost data and the item being moved,
 * returns an array of patches that represent the changes to be applied
 * to the grid items when the item is moved (including nudging
 * neighboring items if necessary).
 * If the positions are invalid or the item is not being moved,
 * an empty array is returned.
 *
 * @param {Object} arg
 * @param {GhostDataWrite} arg.data - The ghost data containing the item
 *  and its state.
 * @param {GridState} arg.state - The current grid state.
 * @param {CurrentItem} arg.item - The item being moved.
 * @param {Object} [arg.precomp] - Optional precomputed move index produced
 *  by prepareMoveIndex to speed up decisions.
 *
 * @return {{
 *  _id: string,
 *  colstart?: number,
 *  rowstart?: number,
 *  order?: number
 * }[]}
 */
export function getMoveChanges({
  data,
  state,
  item,
  precomp
}) {
  if (!data.colstart || !data.rowstart ||
    (data.colstart === item.colstart && data.rowstart === item.rowstart)
  ) {
    return [];
  }
  const maxColumns = state.columns;
  const maxRows = state.current?.rows || 1;

  // Geometry of the moving item (size is immutable for move)
  const width = item.colspan;
  const height = item.rowspan;
  const newStartCol = data.colstart;
  const newStartRow = data.rowstart;
  const newEndCol = newStartCol + width - 1;
  const newEndRow = newStartRow + (height || 1) - 1;

  // Basic bounds validation (ghost snapping should already ensure this)
  const inGrid = (
    newStartCol >= 1 && newEndCol <= maxColumns &&
    newStartRow >= 1 && newEndRow <= maxRows
  );
  if (!inGrid) {
    return [];
  }

  // Strategy 1: place if destination is completely free (ignoring the moving item itself)
  const placeIfFree = attemptPlaceWithoutNudging({
    state,
    item,
    newStartCol,
    newStartRow,
    precomp
  });
  if (placeIfFree) {
    const posPatches = [
      {
        _id: item._id,
        colstart: newStartCol,
        rowstart: newStartRow
      }
    ];
    const orderPatches = computeOrderPatches({
      state,
      posPatches
    });
    return mergePositionAndOrderPatches(posPatches, orderPatches);
  }

  // Strategy 2: horizontal nudge of neighbours only
  const overlapExists = true; // we only reach here when placeIfFree is false
  // Decide preferred nudge directions based on movement intent and edge overlaps
  const oldStartCol = item.colstart;
  const oldEndCol = oldStartCol + (item.colspan || 1) - 1;
  // Check if the target start column is empty across all spanned rows AND
  // lies outside the item's original horizontal footprint. This avoids
  // misclassifying small same-direction shifts (where newStartCol is still
  // within the old footprint) as the "empty start" special case.
  const startOutsideOld = (newStartCol < oldStartCol) || (newStartCol > oldEndCol);
  const targetStartEmpty = startOutsideOld && (() => {
    for (let r = newStartRow; r <= newEndRow; r++) {
      const occRow = precomp?.occByRow?.get(r);
      const rowIndex = state.positions.get(r);
      const id = (occRow ? occRow[newStartCol] : rowIndex?.get(newStartCol));
      if (id && id !== item._id) {
        return false;
      }
    }
    return true;
  })();
  // Note: vertical-only moves are handled specially below
  // Note: vertical-only moves are handled specially below

  // Determine movement on X axis
  let primaryDir;
  if (newStartCol > oldStartCol) {
    primaryDir = 'east';
  } else if (newStartCol < oldStartCol) {
    primaryDir = 'west';
  } else {
    primaryDir = null; // vertical-only move
  }

  // Compute the most relevant overlapped target (first in scan order)
  const target = findPrimaryOverlappedTarget({
    state,
    item,
    newStartCol,
    newStartRow,
    width,
    precomp
  });

  // Decide attempt order according to the rules
  const tryDirs = (() => {
    // If vertical-only, try both directions (east then west)
    if (!primaryDir) {
      return [ 'east', 'west' ];
    }
    // Special rule: targeting an empty start cell but overall footprint overlaps
    // -> attempt only the opposite direction.
    if (overlapExists && targetStartEmpty) {
      return primaryDir === 'east' ? [ 'west' ] : [ 'east' ];
    }
    if (!target) {
      // No concrete target: only try primary to avoid unintended cascades.
      return primaryDir === 'east' ? [ 'east' ] : [ 'west' ];
    }

    const ghostStart = newStartCol;
    const ghostEnd = newEndCol;
    const tStart = target.colstart;
    const tEnd = target.colstart + target.colspan - 1;

    if (primaryDir === 'east') {
      // Not overlapping target end-bound -> primary only
      if (ghostEnd < tEnd) {
        return [ 'east' ];
      }
      // Equal-edge or overlapping past end-bound -> opposite first, then primary
      if (ghostEnd === tEnd) {
        return [ 'west', 'east' ];
      }
      return [ 'west', 'east' ];
    } else {
      // primaryDir === 'west'
      // Not overlapping target start-bound -> primary only
      if (ghostStart > tStart) {
        return [ 'west' ];
      }
      // Equal-edge or overlapping past start-bound -> opposite first, then primary
      if (ghostStart === tStart) {
        return [ 'east', 'west' ];
      }
      return [ 'east', 'west' ];
    }
  })();

  for (const dir of tryDirs) {
    const patches = attemptHorizontalNudge({
      state,
      item,
      newStartCol,
      newStartRow,
      dir,
      precomp
    });
    if (patches) {
      // Success: include moved item position and recompute ordering
      const posPatches = [
        {
          _id: item._id,
          colstart: newStartCol,
          rowstart: newStartRow
        },
        ...patches
      ];
      const orderPatches = computeOrderPatches({
        state,
        posPatches
      });
      return mergePositionAndOrderPatches(posPatches, orderPatches);
    }
  }

  // No strategy succeeded
  return [];
}
/**
 * Compute order patches for all items based on current state but with
 * virtual positions applied from posPatches. This ensures determinism even
 * if array order differs from grid order.
 * @param {Object} args
 * @param {GridState} args.state - The current grid state.
 * @param {Object[]} [args.posPatches] - Optional position patches to apply.
 * @returns
 */
function computeOrderPatches({ state, posPatches }) {
  /** @type {Map<string, { colstart?: number, rowstart?: number }>} */
  const patchById = new Map();
  for (const p of posPatches || []) {
    patchById.set(p._id, {
      colstart: p.colstart,
      rowstart: p.rowstart
    });
  }

  const list = state.current.items.map(it => ({
    _id: it._id,
    rowstart: (patchById.get(it._id)?.rowstart ?? it.rowstart ?? 1),
    colstart: (patchById.get(it._id)?.colstart ?? it.colstart ?? 1),
    order: (typeof it.order === 'number') ? it.order : Number.MAX_SAFE_INTEGER
  }))
    .filter(it => {
      if (patchById.has(it._id)) {
        return true;
      }

      return it.order !== state.lookup.get(it._id)?.order;
    });

  // Deterministic ordering (top-to-bottom, left-to-right, previous order)
  list.sort((a, b) => {
    if (a.rowstart !== b.rowstart) {
      return a.rowstart - b.rowstart;
    }
    if (a.colstart !== b.colstart) {
      return a.colstart - b.colstart;
    }
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return 0;
  });

  // Generate zero-based order patches for all items
  return list.map((it, index) => ({
    _id: it._id,
    order: index
  }));
}

// Merge position patches (if any) with order patches, ensuring each item
// gets a single patch object including 'order'. Items not present in
// posPatches receive order-only patches.
function mergePositionAndOrderPatches(posPatches, orderPatches) {
  /** @type {Map<string, any>} */
  const result = new Map();
  for (const op of posPatches || []) {
    result.set(op._id, { ...op });
  }
  for (const ord of orderPatches || []) {
    const existing = result.get(ord._id);
    if (existing) {
      existing.order = ord.order;
    } else {
      result.set(ord._id, {
        _id: ord._id,
        order: ord.order
      });
    }
  }
  return Array.from(result.values());
}

// ---- Strategy helpers ----------------------------------------------------

function attemptPlaceWithoutNudging({
  state,
  item,
  newStartCol,
  newStartRow,
  precomp
}) {
  const width = item.colspan;
  const height = item.rowspan || 1;
  const endCol = newStartCol + width - 1;
  const endRow = newStartRow + height - 1;
  const positions = state.positions;

  for (let r = newStartRow; r <= endRow; r++) {
    if (precomp?.occByRow) {
      const occ = precomp.occByRow.get(r);
      if (occ) {
        for (let c = newStartCol; c <= endCol; c++) {
          const id = occ[c] || null;
          if (id && id !== item._id) {
            return false;
          }
        }
        continue;
      }
    }
    const rowIndex = positions.get(r);
    for (let c = newStartCol; c <= endCol; c++) {
      const occ = rowIndex?.get(c);
      if (occ && occ !== item._id) {
        return false;
      }
    }
  }
  return true;
}

function findPrimaryOverlappedTarget({
  state,
  item,
  newStartCol,
  newStartRow,
  width,
  precomp
}) {
  const height = item.rowspan || 1;
  const endCol = newStartCol + width - 1;
  const endRow = newStartRow + height - 1;
  const positions = state.positions;

  // Prefer earliest conflict in scan order across spanned rows
  let best = null; // { id, col, colstart, colspan }

  // Determine scan direction by whether colstart changed
  const dir = (newStartCol > item.colstart) ? 'east' : (newStartCol < item.colstart ? 'west' : null);

  for (let r = newStartRow; r <= endRow; r++) {
    const rowIndex = precomp?.rowIndexByRow?.get(r) || positions.get(r);
    if (!rowIndex) {
      continue;
    }
    if (dir === 'west') {
      for (let c = endCol; c >= newStartCol; c--) {
        const id = precomp?.occByRow?.get(r)?.[c] ?? rowIndex.get(c);
        if (id && id !== item._id) {
          const n = state.lookup.get(id);
          if (!n) {
            continue;
          }
          if (!best || c > best.col) {
            best = {
              id,
              col: c,
              colstart: n.colstart,
              colspan: n.colspan
            };
          }
          break;
        }
      }
    } else {
      // east or vertical-only (use east for tie-breaker)
      for (let c = newStartCol; c <= endCol; c++) {
        const id = precomp?.occByRow?.get(r)?.[c] ?? rowIndex.get(c);
        if (id && id !== item._id) {
          const n = state.lookup.get(id);
          if (!n) {
            continue;
          }
          if (!best || c < best.col) {
            best = {
              id,
              col: c,
              colstart: n.colstart,
              colspan: n.colspan
            };
          }
          break;
        }
      }
    }
  }

  if (!best) {
    return null;
  }
  const target = state.lookup.get(best.id);
  return target || null;
}

function attemptHorizontalNudge({
  state,
  item,
  newStartCol,
  newStartRow,
  dir,
  precomp
}) {
  const width = item.colspan;
  const height = item.rowspan || 1;
  const endCol = newStartCol + width - 1;
  const endRow = newStartRow + height - 1;
  const maxColumns = state.columns;

  // Collect all candidate neighbor ids that appear on any of the rows the
  // moving item will occupy. This ensures we can cascade shifts across the
  // row consistently without underestimating required moves.
  /** @type {Set<string>} */
  const candidateIds = new Set();
  for (let r = newStartRow; r <= endRow; r++) {
    const segs = precomp?.segmentsByRow?.get(r);
    if (segs && segs.length) {
      for (const seg of segs) {
        if (seg.id && seg.id !== item._id) {
          candidateIds.add(seg.id);
        }
      }
      continue;
    }
    // Fallback when segments are not provided: collect ids from the row index
    const rowIndex = state.positions.get(r);
    if (rowIndex) {
      for (const id of rowIndex.values()) {
        if (id && id !== item._id) {
          candidateIds.add(id);
        }
      }
    }
  }

  if (!candidateIds.size) {
    // No neighbors to consider, if there was overlap this implies an error.
    return null;
  }

  // Turn into item objects and sort in scanning order for the cascade.
  const candidates = Array.from(candidateIds)
    .map(id => state.lookup.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      if (dir === 'east') {
        return (a.colstart - b.colstart) || (a.order - b.order);
      }
      const aEnd = a.colstart + a.colspan - 1;
      const bEnd = b.colstart + b.colspan - 1;
      return (bEnd - aEnd) || (a.order - b.order);
    });

  /** @type {Map<string, number>} */
  const shiftById = new Map();

  if (dir === 'east') {
    // Minimal cascade so every item to the left of or touching the ghost end
    // moves just enough to start at (endCol + 1), and cascades to the right
    // without overlaps. Items already beyond neededStart remain in place.
    let neededStart = endCol + 1;
    for (const n of candidates) {
      const len = n.colspan;
      const start0 = n.colstart;
      const end0 = start0 + len - 1;
      // Only items whose start is before the current neededStart can block.
      if (start0 < neededStart && end0 >= newStartCol) {
        const newStart = neededStart;
        const newEnd = newStart + len - 1;
        if (newEnd > maxColumns) {
          return null;
        }
        shiftById.set(n._id, Math.max(shiftById.get(n._id) || 0, newStart - start0));
        neededStart = newEnd + 1;
      } else {
        // No shift for this item; it defines the next available start.
        neededStart = Math.max(neededStart, end0 + 1);
      }
    }
  } else {
    // dir === 'west'
    let neededEnd = newStartCol - 1;
    for (const n of candidates) {
      const len = n.colspan;
      const start0 = n.colstart;
      const end0 = start0 + len - 1;
      // Only items whose end is after the current neededEnd can block.
      if (end0 > neededEnd && start0 <= endCol) {
        const newEnd = neededEnd;
        const newStart = newEnd - len + 1;
        if (newStart < 1) {
          return null;
        }
        shiftById.set(n._id, Math.max(shiftById.get(n._id) || 0, start0 - newStart));
        neededEnd = newStart - 1;
      } else {
        // No shift; it defines the next available end.
        neededEnd = Math.min(neededEnd, start0 - 1);
      }
      if (neededEnd < 0) {
        return null;
      }
    }
  }

  if (!shiftById.size) {
    // Nothing to move means either no overlap or impossible scenario we don't handle here
    return null;
  }

  // Produce patches with new colstart per id
  const patches = [];
  for (const [ id, shift ] of shiftById.entries()) {
    const n = state.lookup.get(id);
    if (!n || !shift) {
      continue;
    }
    const newStart = dir === 'east'
      ? Math.min(maxColumns - n.colspan + 1, n.colstart + shift)
      : Math.max(1, n.colstart - shift);
    if (newStart === n.colstart) {
      return null;
    }
    patches.push({
      _id: id,
      colstart: newStart
    });
  }

  return patches;
}

// Optional precomputation hook for faster move decisions
// This minimal implementation builds a shape you can replace with a smarter index.
/**
 * Prepare precomputed data structures to speed up getMoveChanges on drop.
 * Replace/extend this as needed; pass the result as `precomp` to getMoveChanges.
 *
 * @param {Object} arg
 * @param {GridState} arg.state
 * @param {CurrentItem} arg.item
 * @returns {{
 *  // Example shape; extend as needed in caller-side implementation
 *  // occupancyByRow: Map<number, (string|null)[]>
 *  // id per col for each row, current item removed
 * }}
 */
export function prepareMoveIndex({ state, item }) { // eslint-disable-line no-unused-vars
  const maxColumns = state.columns;
  const maxRows = state.current?.rows || 1;
  const positions = state.positions;

  // Build per-row occupancy arrays (1..maxColumns) mapping col -> item id,
  // excluding the moving item id for collision checks.
  /** @type {Map<number, (string|null)[]>} */
  const occByRow = new Map();
  /** @type {Map<number, Map<number, string>>} */
  const rowIndexByRow = new Map();

  for (let r = 1; r <= maxRows; r++) {
    const rowIndex = positions.get(r) || new Map();
    const arr = new Array(maxColumns + 1).fill(null);
    for (let c = 1; c <= maxColumns; c++) {
      const id = rowIndex.get(c) || null;
      arr[c] = (id === item._id) ? null : id;
    }
    occByRow.set(r, arr);
    // Provide a rowIndex variant that resolves to actual map, but callers
    // should rely on occByRow first when available for speed.
    rowIndexByRow.set(r, rowIndex);
  }

  // Precompute next occupied jump tables per row, both east and west.
  // These help skip empty runs quickly during scans.
  /** @type {Map<number, Int32Array>} */
  const nextOccEast = new Map();
  /** @type {Map<number, Int32Array>} */
  const nextOccWest = new Map();

  for (let r = 1; r <= maxRows; r++) {
    const arr = occByRow.get(r);
    const east = new Int32Array(maxColumns + 2); // +2 for sentinel ease
    const west = new Int32Array(maxColumns + 2);
    // East: next index >= i that is occupied (or 0 if none)
    let next = 0;
    for (let c = maxColumns; c >= 1; c--) {
      next = (arr && arr[c + 1]) ? (c + 1) : next;
      if (arr && arr[c]) {
        next = c;
      }
      east[c] = next;
    }
    // West: previous index <= i that is occupied (or 0 if none)
    let prev = 0;
    for (let c = 1; c <= maxColumns; c++) {
      prev = (arr && arr[c - 1]) ? (c - 1) : prev;
      if (arr && arr[c]) {
        prev = c;
      }
      west[c] = prev;
    }
    nextOccEast.set(r, east);
    nextOccWest.set(r, west);
  }

  // Precompute neighbor segments per row: contiguous [start,end] groups by id
  /** @type {Map<number, Array<{id: string, start: number, end: number}>>} */
  const segmentsByRow = new Map();
  for (let r = 1; r <= maxRows; r++) {
    const arr = occByRow.get(r) || [];
    const segs = [];
    let c = 1;
    while (c <= maxColumns) {
      const id = arr[c];
      if (!id) {
        c += 1;
        continue;
      }
      const start = c;
      let end = c;
      while (end + 1 <= maxColumns && arr[end + 1] === id) {
        end += 1;
      }
      segs.push({
        id,
        start,
        end
      });
      c = end + 1;
    }
    segmentsByRow.set(r, segs);
  }

  return {
    occByRow,
    rowIndexByRow,
    nextOccEast,
    nextOccWest,
    segmentsByRow,
    maxColumns,
    maxRows
  };
}

/**
 * Pass grid item, grid state and side (east or west) to answer if
 * a new item can be inserted in the given direction immediately
 * before or after the item.
 *
 * @param {Object} arg - The parameters for checking fit.
 * @param {CurrentItem} arg.item - The item to check against.
 * @param {string} arg.side - The side to check ('east' or 'west').
 * @param {GridState} arg.state - The current grid state.
 * @returns {{
 *  result: boolean,
 *  colstart: number,
 *  colspan: number
 * }} - An object indicating if the item can fit and its position.
 */
export function canFitX({
  item, side, state
}) {
  if (!item) {
    return {
      result: false,
      colstart: 0,
      colspan: 0
    };
  }
  const {
    colstart, colspan, rowstart, rowspan
  } = item;

  const maxColumns = state.columns;
  const maxRows = state.current.rows;
  const minSpan = state.options.minSpan || 1;
  const defaultColspan = state.options.defaultSpan || 1;

  // Directional scanning setup
  const endCell = colstart + colspan - 1;
  const rows = Array.from({ length: Math.max(1, rowspan) }, (_, i) => rowstart + i)
    .filter(r => r >= 1 && r <= maxRows);
  const positions = state.positions;
  const step = side === 'west' ? -1 : 1;
  let cursor = side === 'west' ? (colstart - 1) : (endCell + 1);

  // Count contiguous empty cells aligned across all spanned rows
  let available = 0;
  while (cursor >= 1 && cursor <= maxColumns) {
    let free = true;
    for (const r of rows) {
      const xIndex = positions.get(r);
      if (xIndex && xIndex.has(cursor)) {
        free = false;
        break;
      }
    }
    if (!free) {
      break;
    }
    available += 1;
    cursor += step;
  }

  if (available < minSpan) {
    return {
      result: false,
      colstart: 0,
      colspan: 0
    };
  }

  const chosen = Math.min(defaultColspan, available);
  const start = side === 'east'
    ? (endCell + 1)
    : (colstart - chosen);

  return {
    result: true,
    colstart: start,
    colspan: chosen
  };
}

/**
 * Recalculate the `order` property (zero based index) of all items in the grid
 * based on their current positions and no matter of their array index
 * order.
 * Optionally, pass an new item coordinates (colstart, colspan, rowstart, rowspan)
 * that will be inserted in the future. The position of the new item is guaranteed
 * to be valid and within the grid bounds.
 *
 * Optionally, pass a deleted item to remove it from the ordering.
 *
 * Returns an array of patch objects with _id and order properties. If an item
 * was passed, it will be included in the result with its proper order (_id
 * for the new item is optional).
 *
 * @param {Object} arg - The parameters for generating the reorder patch.
 * @param {GridState} arg.state - The current grid state.
 * @param {CurrentItem} [arg.item] - The item to include in the ordering.
 * @param {CurrentItem} [arg.deleted] - The item to remove from the ordering
 *
 * @returns {{
 *  _id: string,
 *  order: number
 * }[]}
 */
export function getReorderPatch({
  state,
  item,
  deleted
}) {
  const list = (state.current?.items || []).map(it => ({
    _id: it._id,
    rowstart: it.rowstart ?? 1,
    colstart: it.colstart ?? 1,
    order: typeof it.order === 'number' ? it.order : Number.MAX_SAFE_INTEGER
  }));

  // If a new item geometry is provided, include it virtually in the ordering
  if (item && (typeof item.colstart === 'number') && (typeof item.rowstart === 'number')) {
    list.push({
      _id: item._id,
      rowstart: item.rowstart,
      colstart: item.colstart,
      order: Number.MAX_SAFE_INTEGER,
      isNew: true
    });
  }
  // Remove deleted item from the list
  if (deleted?._id) {
    const index = list.findIndex(it => it._id === deleted._id);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  // Deterministic ordering: top-to-bottom, then left-to-right,
  // then by previous order
  list.sort((a, b) => {
    if (a.rowstart !== b.rowstart) {
      return a.rowstart - b.rowstart;
    }
    if (a.colstart !== b.colstart) {
      return a.colstart - b.colstart;
    }
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return 0;
  });

  // Produce zero-based consecutive orders as patches
  const patches = list.map((it, index) => {
    const patch = {
      order: index,
      _id: it._id
    };
    if (it.isNew) {
      return Object.assign({}, item, patch);
    }
    return patch;
  });

  return patches;
}
