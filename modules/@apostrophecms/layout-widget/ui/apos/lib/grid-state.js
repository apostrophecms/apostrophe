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
 *
 * @return {{
 *  _id: string,
 *  colstart?: number,
 *  rowstart?: number,
 *  order?: number
 * }[]}
 */
export function getMoveChanges({
  data, state, item
}) {
  if (!data.colstart || !data.rowstart) {
    return [];
  }

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
