/**
 *
 * @typedef {{
 *  id: string,
 *  side: string,
 *  direction: string,
 *  colspan: number,
 *  colstart: number,
 *  rowstart: number,
 *  rowspan: number,
 *  order: number
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
 *
 * @typedef {{
 *  columns: number
 *  desktop: {
 *    rows: number,
 *  },
 *  tablet: {
 *    rows: number,
 *    auto: boolean
 *  },
 *  mobile: {
 *    rows: number,
 *    auto: boolean
 *  }
 * }} LayoutMeta
 *
 * @typedef {{
 *   columns: number,
 *   gap: string,
 *   minSpan: number,
 *   defaultSpan: number,
 *   mobile: {
 *     breakpoint: number
 *   },
 *   tablet: {
 *     breakpoint: number
 *   },
 *   defaultCellHorizontalAlignment: string,
 *   defaultCellVerticalAlignment: string
 * }} LayoutOptions
 */

/**
 * Accepts:
 *  - items (array of instances of @apostrophecms/layout-column-widget)
 *  - meta (total columns and per-device rows/auto)
 *  - options (Browser options of @apostsrophecms/layout-widget)
 *  - layoutMode (string, either 'layout', 'focus' or 'content')
 *  - deviceMode (string, either 'desktop', 'tablet' or 'mobile')
 *
 * @param {Object} params
 * @param {CurrentItem[]} params.items - The items to be converted to state.
 * @param {LayoutMeta} params.meta - The meta information for the grid.
 * @param {LayoutOptions} params.options - The options for the grid.
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
    gap: [ 'layout', 'focus' ].includes(layoutMode) ? gap || '2px' : options.gap,
    snapThresholdMove: 0.4,
    snapThresholdResize: 0.5
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
 * Generate items for a new row. Attempt to fit the entire space, while
 * restricting each item's colspan to at least minColspan and ideally
 * defaultColspan (or anything between). Rowspan is always 1 and order
 * is sequential.
 *
 * @param {number} columns
 * @param {Object} [options]
 * @param {number} [options.minColspan]
 * @param {number} [options.defaultColspan]
 * @param {number} [options.row] The current row number (1-based)
 *
 * @returns {Pick<
 *    CurrentItem,
 *   'rowstart' | 'rowspan' | 'colstart' | 'colspan' | 'order'
 * >[]
 * }
 */
export function provisionRow(columns, {
  minColspan = 2, defaultColspan = 3, row = 1
} = {}) {
  // Normalize inputs
  const C = Math.max(1, Math.floor(Number(columns) || 1));
  const min = Math.max(1, Math.floor(Number(minColspan) || 1));
  const ideal = Math.max(min, Math.floor(Number(defaultColspan) || min));

  // If columns are fewer than min, fall back to a single full-width item
  if (C <= min) {
    return [
      {
        rowstart: row,
        rowspan: 1,
        colstart: 1,
        colspan: C,
        order: 0
      }
    ];
  }

  // Choose the number of items n in [1..floor(C/min)] that best matches the
  // desired (near ideal) span while filling the row exactly. We evaluate a
  // small scoring function to bias toward:
  //  - average span close to `ideal`
  //  - exact division (no remainder)
  //  - n close to C/ideal
  const nMax = Math.max(1, Math.floor(C / min));
  const targetN = Math.max(1, Math.round(C / ideal));
  let best = null; // { n, base, rem, score }

  for (let n = 1; n <= nMax; n++) {
    const base = Math.floor(C / n);
    if (base < min) {
      continue;
    }
    const rem = C - base * n; // number of items that will get +1
    const avg = base + (rem / n);
    const closeness = Math.abs(avg - ideal);
    const evenPenalty = rem === 0 ? 0 : 0.05;
    const nPenalty = Math.abs(n - targetN) / targetN * 0.1;
    // light penalty for very many items (usability)
    const densityPenalty = n > 8 ? (n - 8) * 0.02 : 0;
    const score = closeness + evenPenalty + nPenalty + densityPenalty;

    if (!best || score < best.score ||
      (score === best.score && (rem < best.rem ||
        (rem === best.rem && Math.abs(n - targetN) < Math.abs(best.n - targetN))))) {
      best = {
        n,
        base,
        rem,
        score
      };
    }
  }

  if (!best) {
    // Fallback to a single item spanning the whole row
    return [
      {
        rowstart: row,
        rowspan: 1,
        colstart: 1,
        colspan: C,
        order: 0
      }
    ];
  }

  const {
    n, base, rem
  } = best;
  // Start with equal base widths, then distribute the remainder symmetrically
  const sizes = new Array(n).fill(base);
  let r = rem;

  if (n === 1) {
    sizes[0] = C;
  } else if (n % 2 === 1) {
    // Odd: center-first, then mirror outward in pairs
    const c = Math.floor(n / 2);
    if (r > 0) {
      sizes[c] += 1; r -= 1;
    }
    for (let k = 1; r >= 2 && (c - k) >= 0 && (c + k) < n; k++) {
      sizes[c - k] += 1;
      sizes[c + k] += 1;
      r -= 2;
    }
    if (r === 1) {
      // Last unmatched extra: place toward the side that keeps sizes near ideal
      const leftIdx = 0;
      const rightIdx = n - 1;
      const leftDelta = Math.abs((sizes[leftIdx] + 1) - ideal);
      const rightDelta = Math.abs((sizes[rightIdx] + 1) - ideal);
      const addLeft = leftDelta <= rightDelta;
      sizes[addLeft ? leftIdx : rightIdx] += 1;
      r = 0;
    }
  } else {
    // Even: two centers as the first symmetric pair, then expand outward
    const rc = n / 2; // right center index
    const lc = rc - 1; // left center index
    for (let k = 0; r >= 2 && (lc - k) >= 0 && (rc + k) < n; k++) {
      sizes[lc - k] += 1;
      sizes[rc + k] += 1;
      r -= 2;
    }
    if (r === 1) {
      // Bias to the side that yields closer-to-ideal span
      const leftIdx = Math.max(0, lc - Math.ceil((n - 2) / 2));
      const rightIdx = Math.min(n - 1, rc + Math.ceil((n - 2) / 2));
      const leftDelta = Math.abs((sizes[leftIdx] + 1) - ideal);
      const rightDelta = Math.abs((sizes[rightIdx] + 1) - ideal);
      const addLeft = leftDelta <= rightDelta;
      sizes[addLeft ? leftIdx : rightIdx] += 1;
      r = 0;
    }
  }

  // Build the items left-to-right
  const items = [];
  let colstart = 1;
  for (let i = 0; i < n; i++) {
    const span = sizes[i];
    items.push({
      rowstart: row,
      rowspan: 1,
      colstart,
      colspan: span,
      order: i
    });
    colstart += span;
  }

  return items;
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
      colstart, colspan, rowstart, rowspan
    } = item;
    const height = Math.max(1, rowspan || 1);
    for (let r = 0; r < height; r++) {
      const row = rowstart + r;
      const xIndex = positionsIndex.get(row);
      if (!xIndex) {
        continue;
      }
      for (let i = 0; i < colspan; i++) {
        xIndex.set(colstart + i, item._id);
      }
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
  const decided = decideMove({
    data,
    state,
    item,
    precomp
  });
  if (!decided) {
    return [];
  }
  const { posPatches } = decided;
  const orderPatches = computeOrderPatches({
    state,
    posPatches
  });
  return mergePositionAndOrderPatches(posPatches, orderPatches);
}

/**
 * Lightweight preview version of move calculations for high-frequency ghost snapping.
 * Returns only the prospective colstart/rowstart for the moving item (no ordering or
 * neighbor patches) or null if the move would be rejected. This shares the exact
 * decision logic with getMoveChanges via decideMove to avoid divergence.
 *
 * @param {Object} arg
 * @param {GhostDataWrite} arg.data
 * @param {GridState} arg.state
 * @param {CurrentItem} arg.item
 * @param {Object} [arg.precomp]
 * @returns {{ _id: string, colstart: number, rowstart: number } | null}
 */
export function previewMoveChanges({
  data,
  state,
  item,
  precomp
}) {
  const decided = decideMove({
    data,
    state,
    item,
    precomp
  });
  if (!decided) {
    return null;
  }
  // Moving item patch always first in our construction
  const moving = decided.posPatches.find(p => p._id === item._id);
  return moving
    ? {
      _id: moving._id,
      colstart: moving.colstart,
      rowstart: moving.rowstart
    }
    : null;
}

/**
 * Compute ghost snapping target (columns/rows and pixel offsets) for a move.
 * Stateless and DOM-free: caller must provide stepX/stepY (track + gap size).
 *
 * @param {Object} arg
 * @param {number} arg.left - Current ghost left (px) relative to grid container.
 * @param {number} arg.top - Current ghost top (px) relative to grid container.
 * @param {import('./grid-state.mjs').GridState} arg.state - Current grid state.
 * @param {import('./grid-state.mjs').CurrentItem} arg.item - Moving item.
 * @param {Object} [arg.precomp] - Optional precomputed move index.
 * @param {number} arg.columns - Number of columns.
 * @param {number} arg.rows - Number of rows.
 * @param {number} arg.stepX - Column track size incl. gap (px).
 * @param {number} arg.stepY - Row track size incl. gap (px).
 * @param {number} [arg.threshold] - Snap threshold [0..1], defaults to 0.6 if missing.
 * @returns {{
 *  colstart: number,
 *  rowstart: number,
 *  snapLeft: number,
 *  snapTop: number
 * } | null}
 */
export function computeGhostMoveSnap({
  left,
  top,
  state,
  item,
  precomp,
  columns,
  rows,
  stepX,
  stepY,
  threshold
}) {
  if (!state || !item) {
    return null;
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const colspan = Math.max(1, item.colspan || 1);
  const rowspan = Math.max(1, item.rowspan || 1);
  const maxStartX = Math.max(1, columns - colspan + 1);
  const maxStartY = Math.max(1, rows - rowspan + 1);

  const t = Number(threshold ?? 0.6);
  const tClamped = clamp(Number.isFinite(t) ? t : 0.6, 0.05, 0.95);
  const shiftX = (1 - tClamped) * stepX;
  const shiftY = (1 - tClamped) * stepY;

  let c = Math.floor((left + shiftX) / stepX) + 1;
  let r = Math.floor((top + shiftY) / stepY) + 1;
  c = Math.max(1, Math.min(c, maxStartX));
  r = Math.max(1, Math.min(r, maxStartY));

  let colstart = c;
  let rowstart = r;

  // Hovered-neighbor threshold for swapping only
  // - If the ghost is hovering an occupied segment (neighbor) in the move direction
  //   and a swap candidate is valid, compute the flip boundary using the hovered
  //   neighbor's width instead of per-track threshold.
  // - Otherwise, use the faster track-based behavior.
  const width = colspan;
  const pre = precomp || prepareMoveIndex({
    state,
    item
  });
  const occSegs = pre?.segmentsByRow?.get(r) || [];
  const dir = (c > (item.colstart || 1))
    ? 'east'
    : (c < (item.colstart || 1) ? 'west' : null);
  // Leading edge in pixels: right edge when moving east, left edge when moving west
  const widthPx = width * stepX;
  const leadPx = dir === 'east' ? (left + widthPx) : left;
  // Column index under the leading edge (1-based), independent of threshold shift
  const hoverCol = Math.max(1, Math.min(columns, Math.floor(leadPx / stepX) + 1));
  /** @type {{ id: string, start: number, end: number } | null} */
  let hoveredSeg = null;
  if (dir && occSegs.length) {
    for (const seg of occSegs) {
      if (seg.start <= hoverCol && hoverCol <= seg.end && seg.id !== item._id) {
        hoveredSeg = seg;
        break;
      }
    }
  }

  let validated = false;
  if (hoveredSeg) {
    const nStart = hoveredSeg.start;
    const nEnd = hoveredSeg.end;
    const nWidth = (nEnd - nStart + 1);
    let swapStart;
    if (dir === 'west') {
      // swap-left (before neighbor)
      swapStart = nStart;
    } else {
      // dir === 'east',  place so end aligns to neighbor end
      const equalEnd = nEnd - width + 1;
      swapStart = Math.max(1, equalEnd);
    }
    // Clamp into bounds
    swapStart = Math.max(1, Math.min(swapStart, maxStartX));

    // Decide based on hovered-neighbor threshold boundary in pixels
    const neighborStartPx = (nStart - 1) * stepX;
    const neighborWidthPx = nWidth * stepX;
    const neighborEndPx = neighborStartPx + neighborWidthPx;
    // Directional thresholds:
    // - east: flip when right-edge crosses start + t * width
    // - west: flip when left-edge crosses end - t * width (== start + (1 - t) * width)
    const flipPx = (dir === 'west')
      ? (neighborEndPx - (tClamped * neighborWidthPx))
      : (neighborStartPx + tClamped * neighborWidthPx);
    const onSwapSide = dir === 'west' ? (leadPx <= flipPx) : (leadPx >= flipPx);
    if (onSwapSide) {
      const p = previewMoveChanges({
        data: {
          id: item._id,
          colstart: swapStart,
          rowstart
        },
        state,
        item,
        precomp: pre
      });
      if (p) {
        colstart = p.colstart;
        rowstart = p.rowstart;
        validated = true;
      }
    }
  }

  // Validate the final candidate once with preview to ensure consistency
  // with drop-time logic. This is at most one call per mousemove.
  if (!validated && item && item._id) {
    const preview = previewMoveChanges({
      data: {
        id: item._id,
        colstart,
        rowstart
      },
      state,
      item,
      precomp: pre
    });
    if (preview) {
      colstart = preview.colstart;
      rowstart = preview.rowstart;
      validated = true;
    } else {
      // Invalid move -> snap to current item position
      colstart = item.colstart ?? colstart;
      rowstart = item.rowstart ?? rowstart;
      validated = true;
    }
  }

  const snapLeft = Math.round((colstart - 1) * stepX);
  const snapTop = Math.round((rowstart - 1) * stepY);

  return {
    colstart,
    rowstart,
    snapLeft,
    snapTop
  };
}

/**
 * Fast, stateless bailout to decide whether we need to recompute move snapping.
 * Computes a coarse signature made of:
 *  - coarse column and row buckets (track-based)
 *  - hovered neighbor segment id on the leading edge (if any)
 *  - movement direction (east/west/null)
 *  - whether the pointer is on the swap side of the hovered neighbor threshold
 * If this signature hasn't changed since the last call (prevMemo), higher-level
 * code can skip calling computeGhostMoveSnap without observable behavior change.
 *
 * Returns an object with:
 *  - compute: boolean -> true if signature changed or prev missing
 *  - memo: string -> the new signature to store for next comparison
 *
 * Note: This function is stateless and does no caching; callers store memo.
 *
 * @param {Object} arg
 * @param {number} arg.left
 * @param {number} arg.top
 * @param {import('./grid-state.mjs').GridState} arg.state
 * @param {import('./grid-state.mjs').CurrentItem} arg.item
 * @param {number} arg.columns
 * @param {number} arg.rows
 * @param {number} arg.stepX
 * @param {number} arg.stepY
 * @param {number} [arg.threshold]
 * @param {string} [arg.prevMemo]
 * @returns {{ compute: boolean, memo: string }}
 */
export function shouldComputeMoveSnap({
  left,
  top,
  state,
  item,
  columns,
  rows,
  stepX,
  stepY,
  threshold,
  prevMemo
}) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const colspan = Math.max(1, item?.colspan || 1);
  const rowspan = Math.max(1, item?.rowspan || 1);
  const maxStartX = Math.max(1, columns - colspan + 1);
  const maxStartY = Math.max(1, rows - rowspan + 1);

  const t = Number(threshold ?? 0.6);
  const tClamped = clamp(Number.isFinite(t) ? t : 0.6, 0.05, 0.95);
  const shiftX = (1 - tClamped) * stepX;
  const shiftY = (1 - tClamped) * stepY;

  let c = Math.floor((left + shiftX) / stepX) + 1;
  let r = Math.floor((top + shiftY) / stepY) + 1;
  c = Math.max(1, Math.min(c, maxStartX));
  r = Math.max(1, Math.min(r, maxStartY));

  // Direction based on coarse col delta relative to original item
  let dir = null;
  if (item?.colstart != null) {
    if (c > item.colstart) {
      dir = 'east';
    } else if (c < item.colstart) {
      dir = 'west';
    }
  }

  // Leading edge and hovered neighbor segment at that row for swap-side check
  // Build contiguous segments from positions for row r
  let hoveredId = '-';
  let onSwapSide = 0;
  const widthPx = colspan * stepX;
  const leadPx = dir === 'west' ? left : (left + widthPx);
  const hoverCol = Math.max(1, Math.min(columns, Math.floor(leadPx / stepX) + 1));
  const rowIndex = state.positions?.get?.(r);
  if (rowIndex) {
    // Walk to find containing segment for hoverCol
    let segStart = 0;
    let segEnd = 0;
    let segId = null;
    // Expand outward from hoverCol to identify contiguous id block
    const idAt = (col) => rowIndex.get(col) || null;
    const centerId = idAt(hoverCol);
    if (centerId && centerId !== item._id) {
      segId = centerId;
      // walk left
      segStart = hoverCol;
      while (segStart - 1 >= 1 && idAt(segStart - 1) === segId) {
        segStart -= 1;
      }
      // walk right
      segEnd = hoverCol;
      while (segEnd + 1 <= columns && idAt(segEnd + 1) === segId) {
        segEnd += 1;
      }
      hoveredId = segId;

      // Compute flip boundary in px based on neighbor width
      const nStart = segStart;
      const nEnd = segEnd;
      const neighborStartPx = (nStart - 1) * stepX;
      const neighborEndPx = nEnd * stepX;
      const neighborWidthPx = (nEnd - nStart + 1) * stepX;
      const flipPx = dir === 'west'
        ? (neighborEndPx - (tClamped * neighborWidthPx))
        : (neighborStartPx + (tClamped * neighborWidthPx));
      onSwapSide = (dir === 'west')
        ? (leadPx <= flipPx ? 1 : 0)
        : (leadPx >= flipPx ? 1 : 0);
    }
  }

  const memo = `${r}|${c}|${hoveredId}|${dir || '-'}|${onSwapSide}`;
  return {
    compute: memo !== prevMemo,
    memo
  };
}

// Core move decision logic (position-only).
// Used by both getMoveChanges and previewMoveChanges.
function decideMove({
  data,
  state,
  item,
  precomp
}) {
  // Guard against mismatched item/data identifiers when the target id exists in lookup
  if (data.id && state?.lookup?.has?.(data.id) && item?._id && data.id !== item._id) {
    return null;
  }
  if (!data.colstart || !data.rowstart ||
    (data.colstart === item.colstart && data.rowstart === item.rowstart)
  ) {
    return null;
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
    return null;
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
    return {
      posPatches: [
        {
          _id: item._id,
          colstart: newStartCol,
          rowstart: newStartRow
        }
      ]
    };
  }

  // Strategy 2: horizontal nudge of neighbours only
  // We only reach here when placeIfFree is false
  // Decide preferred nudge directions based on movement intent and edge overlaps
  const oldStartCol = item.colstart;
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
    if (!primaryDir) {
      return [ 'east', 'west' ];
    }
    if (!target) {
      return primaryDir === 'east' ? [ 'east' ] : [ 'west' ];
    }

    const ghostStart = newStartCol;
    const ghostEnd = newEndCol;
    const tStart = target.colstart;
    const tEnd = target.colstart + target.colspan - 1;

    if (primaryDir === 'east') {
      if (ghostEnd < tEnd) {
        return [ 'east' ];
      }
      if (ghostEnd === tEnd) {
        return [ 'west', 'east' ];
      }
      return [ 'west', 'east' ];
    } else {
      if (ghostStart > tStart) {
        return [ 'west' ];
      }
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
      // Success: include moved item position
      return {
        posPatches: [
          {
            _id: item._id,
            colstart: newStartCol,
            rowstart: newStartRow
          },
          ...patches
        ]
      };
    }
  }

  // No strategy succeeded
  return null;
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
      // No need to fail if neededStart exceeds grid after processing;
      // we already enforce bounds on each neighbor shift.
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
      // Similarly, don't fail solely due to neededEnd becoming < 0
      // after processing; individual shifts are already bounded.
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
export function prepareMoveIndex({ state, item }) {
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
    const east = new Int32Array(maxColumns + 2);
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

/**
 * Compute synthetic insertion slots for the current device state.
 * Each slot represents a potential position where a new item could be placed.
 * Constraints:
 *  - rowspan is always 1
 *  - colspan is clamped to [minSpan, defaultSpan]
 *  - choose the largest possible span that fits the contiguous empty segment
 *  - one synthetic per contiguous empty segment (leftmost aligned)
 *
 * The returned items include an `_id`, `synthetic: true`, positioning
 * properties, and an `order` number computed to align with the grid's
 * deterministic ordering so CSS order works as expected.
 *
 * @param {import('./grid-state.mjs').GridState} state
 * @returns {Array<{
 *  _id: string,
 *  synthetic: true,
 *  colstart: number,
 *  colspan: number,
 *  rowstart: number,
 *  rowspan: 1,
 *  order: number,
 *  align: string,
 *  justify: string
 * }>} synthetic items
 */
export function computeSyntheticSlots(state) {
  if (!state || !state.current) {
    return [];
  }
  const maxRows = Math.max(1, Number(state.current.rows) || 1);
  const maxColumns = Math.max(1, Number(state.columns) || 1);
  const minSpan = Math.max(1, Number(state.options?.minSpan) || 1);
  const defaultSpan = Math.max(1, Number(state.options?.defaultSpan) || 1);

  // Collect raw synthetic slot drafts before assigning order
  const syntheticDrafts = [];

  for (let r = 1; r <= maxRows; r++) {
    const xIndex = state.positions.get(r);
    let c = 1;
    const isFreeAt = (col) => !(xIndex && xIndex.has(col));
    while (c <= maxColumns) {
      const occupied = !isFreeAt(c);
      if (occupied) {
        c += 1;
        continue;
      }
      const start = c;
      while (c <= maxColumns && isFreeAt(c)) {
        c += 1;
      }
      const end = c - 1;
      let cur = start;
      while (cur <= end) {
        const remaining = end - cur + 1;
        const span = Math.min(defaultSpan, remaining);
        const id = `syn-r${r}-c${cur}-w${span}`;
        syntheticDrafts.push({
          _id: id,
          synthetic: true,
          toosmall: remaining < minSpan,
          colstart: cur,
          colspan: span,
          rowstart: r,
          rowspan: 1,
          // placeholders; will compute order below
          order: Number.MAX_SAFE_INTEGER,
          align: 'stretch',
          justify: 'stretch'
        });
        cur += span;
      }
    }
  }

  if (!syntheticDrafts.length) {
    return [];
  }

  // Compute a deterministic order for synthetic items alongside existing ones
  const existing = (state.current?.items || []).map(it => ({
    _id: it._id,
    rowstart: it.rowstart ?? 1,
    colstart: it.colstart ?? 1,
    order: typeof it.order === 'number' ? it.order : Number.MAX_SAFE_INTEGER,
    isSynthetic: false
  }));
  const drafts = syntheticDrafts.map(s => ({
    _id: s._id,
    rowstart: s.rowstart,
    colstart: s.colstart,
    order: Number.MAX_SAFE_INTEGER,
    isSynthetic: true
  }));
  const merged = existing.concat(drafts);
  merged.sort((a, b) => {
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

  // Assign order index to synthetic based on merged order
  const orderById = new Map();
  merged.forEach((it, index) => {
    if (it.isSynthetic) {
      orderById.set(it._id, index);
    }
  });

  return syntheticDrafts.map(s => ({
    ...s,
    order: orderById.get(s._id) ?? Number.MAX_SAFE_INTEGER
  }));
}
