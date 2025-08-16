/**
 * Accepts:
 *  - items (array of instances of @apostrophecms/layout-column-widget)
 *  - meta (instance of @apostrophecms/layout-meta-widget, optional)
 *  - options (Browser options of @apostsrophecms/layout-widget)
 *  - layoutMode (string, either 'manage', 'focus' or 'preview')
 *  - deviceMode (string, either 'desktop', 'tablet' or 'mobile')
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
      type: item.type
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
  const lookup = new Map(current.items.map(i => [ i._id, i ]));

  const state = {
    columns: meta.columns || options.columns,
    layoutMode,
    deviceMode,
    devices: perDevice,
    current,
    lookup,
    options: resolvedOptions,
    positions: positionsIndex
  };

  return state;
}

// Create a 2d map (rows x columns) to store item positions
export function createPositionIndex(items) {
  const sorted = items.slice().sort((a, b) => a.order - b.order);
  const positionsIndex = new Map();
  const rows = Math.max(...sorted.map(item => item.rowstart));
  for (let i = 1; i <= rows; i++) {
    positionsIndex.set(i, new Map());
  }
  for (const item of sorted) {
    const {
      colstart, colspan, rowstart
    } = item;
    for (let i = 0; i < colspan; i++) {
      positionsIndex.get(rowstart).set(colstart + i, item._id);
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
 * @param {Object} item - The  item being resized.
 * @param {string} direction - The direction of resizing ('east' or 'west').
 * @param {number} newColspan - The new column span to validate.
 * @param {Map} positionsIndex - The index of existing items by their positions.
 * @param {number} maxColumns - The maximum number of columns in the grid.
 * @returns {number} - Returns the newColspan or max allowed colspan.
 */
export function validateResizeX({
  item, side, direction, newColspan, positionsIndex, maxColumns, minSpan
}) {
  if (!item) {
    throw new Error('Item is required for resizing validation');
  }
  const delta = newColspan - item.colspan;
  if (delta <= 0) {
    const newColstart = side === 'west'
      ? item.colstart - delta
      : item.colstart;

    return {
      _id: item._id,
      colspan: Math.max(newColspan, minSpan),
      colstart: Math.max(newColstart, 1)
    };
  }

  // The below logic is used only for expanding
  const itemRows = Array.from({ length: item.rowspan }, (_, i) => item.rowstart + i);

  return itemRows.reduce((acc, row) => {
    const rowIndex = positionsIndex.get(row);
    if (!rowIndex) {
      return acc;
    }
    const { capacity: rowCapacity } = computeCascadeCapacityX({
      xIndex: rowIndex,
      item,
      direction,
      maxColumns
    });

    const validColspan = Math.min(newColspan, rowCapacity.length);
    acc.colspan = Math.max(acc.colspan, validColspan, minSpan);

    const delta = acc.colspan - item.colspan;
    acc.colstart = side === 'west'
      ? Math.max(
        Math.min(item.colstart - delta, acc.colstart),
        maxColumns - rowCapacity.length + 1,
        1
      )
      : item.colstart;

    return acc;
  }, {
    _id: item._id,
    colspan: 0,
    colstart: item.colstart
  });
}

/**
 * Triggered on capturing the end of horizontal axis resize.
 * Returns the new position of the target item and all other affected items
 * if nudging is required.
 */
export function getResizeChangesX({
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

function computeCascadeCapacityX({
  xIndex, item, direction, maxColumns
}) {
  const startCell = item.colstart;
  const endCell = startCell + item.colspan - 1;
  const capacity = [];
  for (let i = startCell; i <= endCell; i++) {
    capacity.push(i);
  }
  if (direction === 'east') {
    for (let i = endCell + 1; i <= maxColumns; i++) {
      if (!xIndex.has(i)) {
        capacity.push(i);
      }
    }
  } else {
    for (let i = startCell - 1; i > 0; i--) {
      if (!xIndex.has(i)) {
        capacity.unshift(i);
      }
    }
  }
  return {
    capacity,
    startCell,
    endCell
  };
}
