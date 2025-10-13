import { throttle } from 'lodash';
import {
  getMoveChanges,
  getResizeChanges,
  validateResizeX,
  computeGhostMoveSnap,
  prepareMoveIndex,
  shouldComputeMoveSnap
} from './grid-state.mjs';

/**
 * @typedef {{
 *  id: string,
 *  startX: number,
 *  startY: number,
 *  clickOffsetX: number,
 *  clickOffsetY: number,
 *  side: 'west' | 'east',
 *  id: string,
 *  element: HTMLElement,
 *  top: number,
 *  left: number,
 *  width: number,
 *  height: number,
 * }} GhostData
 *
 * @typedef {import('./grid-state.mjs').GridState} GridState
 * @typedef {import('./grid-state.mjs').CurrentItem} CurrentItem
 */
const noop = () => {};
export class GridManager {
  constructor() {
    this.rootElement = null;
    this.gridElement = null;
    this.gridComputedStyle = null;
    this.gridBoundingRect = null;
    this.resizeObserver = null;
    this.onResizeAndScroll = null;
    this.getGridColumnIndicatorStylesDebounced = noop;
    this.onSceneResizeDebounced = noop;
    this.onSceneScrollDebounced = noop;
  }

  /**
   *
   * @param {HTMLElement} rootElement
   * @param {HTMLElement} gridElement
   * @param {(rect: DOMRectReadOnly | UIEvent) => void} onResize
   */
  init(rootElement, gridElement, onResizeAndScroll = (rect) => { }) {
    // console.debug('GridManager initialized', rootElement, gridElement);
    this.rootElement = rootElement;
    this.gridElement = gridElement;
    this.onResizeAndScroll = onResizeAndScroll;
    this.onSceneScrollDebounced = throttle(this.onSceneScroll, 100, {
      leading: true,
      trailing: true
    });
    this.onSceneResizeDebounced = throttle(this.onSceneResize, 100, {
      leading: true,
      trailing: true
    });
    this.getGridColumnIndicatorStylesDebounced = throttle(
      this.getGridColumnIndicatorStyles, 100, {
        leading: true,
        trailing: true
      }
    );
  }

  /**
   * @param {DOMRectReadOnly | UIEvent} contentRect
   */
  onSceneResize = (contentRect) => {
    this.resetCachedContainerMetrics();
    if (this.onResizeAndScroll) {
      this.onResizeAndScroll('resize', contentRect);
    }
  };

  /**
   * @param {DOMRectReadOnly | UIEvent} contentRect
   */
  onSceneScroll = (event) => {
    this.resetCachedContainerMetrics();
    if (this.onResizeAndScroll) {
      this.onResizeAndScroll('scroll', event);
    }
  };

  resetCachedContainerMetrics() {
    this.gridComputedStyle = null; // Reset cached styles
    this.getGridComputedStyle(); // Re-fetch styles
    this.gridBoundingRect = null; // Reset cached bounding rect
    this.getGridBoundingRect(); // Re-fetch bounding rect
  }

  /**
   * Get the original position of an item within a container.
   *
   * @param {HTMLElement} element
   */
  getItemOriginalPosition(element) {
    const rect = element.getBoundingClientRect();
    const containerRect = this.getGridBoundingRect();
    return {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  getGridColumnIndicatorStyles = (columns, rows) => {
    if (!this.gridElement) {
      return [];
    }
    const containerRect = this.getGridBoundingRect();
    const style = this.getGridComputedStyle();
    const colGap = parseFloat(style.columnGap || style.gap) || 0;
    const trackWidth = (containerRect.width - colGap * (columns - 1)) / columns;
    const styles = [];

    for (let i = 1; i < columns; i++) {
      // Full gap support, adapting based on the gap size
      // to avoid visual glitches.
      const left = i * trackWidth + (i - 1) * (colGap || 1) + 'px';
      styles.push({
        style: {
          left,
          width: (colGap || 2) + 'px'
        },
        class: {
          gap: colGap >= 10
        }
      });
    }
    this.updateGridRowIndicatorStyles(styles, {
      columns,
      rows,
      colGap,
      trackWidth
    });

    return styles;
  };

  /**
   * Returns a map of relative to the grid shim positions objects
   * for each existing item in the grid.
   *
   * @param {Object} args
   * @param {GridState} args.state - The current grid state.
   * @param {HTMLElement[] | NodeListOf<HTMLElement>} args.refs -
   *   The DOM refs of grid items (each with data-id attribute).
   *
   * @deprecated
   * We don't need to compute that anymore - the grid clone ensures
   * the cell width and position is always correct.
   */
  getGridShimPositions({ state, refs }) {
    // Guard clauses
    if (!state || !state.current || !this.gridElement || !refs || !refs.length) {
      return new Map();
    }

    // Cache lookups
    const containerRect = this.getGridBoundingRect();
    const style = this.getGridComputedStyle();

    // Grid metrics
    const columns = Math.max(1, Number(state.columns) || 1);
    const rowsCount = Math.max(1, Number(state.current.rows) || 1);
    const colGap = parseFloat(style.columnGap || style.gap) || 0;
    const rowGap = parseFloat(style.rowGap || style.gap) || 0;
    const trackWidth = (containerRect.width - colGap * (columns - 1)) / columns;

    // Build a quick map from id -> element and measure heights once
    /** @type {Map<string, HTMLElement>} */
    const elById = new Map();
    /** @type {Map<string, number>} */
    const heightById = new Map();

    for (const el of refs) {
      if (!el || !el.dataset) {
        continue;
      }
      const id = el.dataset.id;
      if (!id) {
        continue;
      }
      elById.set(id, el);
      // Read once; avoids repeated layout reads later
      const rect = el.getBoundingClientRect();
      heightById.set(id, rect.height);
    }

    // Prepare per-row heights (content-based). Start with zeros.
    const rowHeights = new Array(rowsCount).fill(0);

    // Helper to safely iterate items currently rendered
    const currentItems = Array.isArray(state.current.items)
      ? state.current.items
      : [];

    // Pass 1: single-row items define a lower bound for that row height
    for (const it of currentItems) {
      if (!it || it.rowstart == null || it.rowspan == null) {
        continue;
      }
      const id = it._id;
      if (!id || !heightById.has(id)) {
        continue;
      }
      const r = Math.max(1, Math.min(rowsCount, it.rowstart)) - 1; // zero-based
      const span = Math.max(1, it.rowspan);
      if (span === 1) {
        rowHeights[r] = Math.max(rowHeights[r], heightById.get(id));
      }
    }

    // Pass 2: multi-row items distribute their height across spanned rows
    // so that the sum of involved track heights (plus gaps) meets the measured height.
    for (const it of currentItems) {
      if (!it || it.rowstart == null || it.rowspan == null) {
        continue;
      }
      const id = it._id;
      if (!id || !heightById.has(id)) {
        continue;
      }
      const start = Math.max(1, Math.min(rowsCount, it.rowstart)) - 1; // zero-based
      const span = Math.max(1, it.rowspan);
      if (span <= 1) {
        continue;
      }

      const measured = heightById.get(id);
      const availableRows = Math.min(span, rowsCount - start);
      if (availableRows <= 0) {
        continue;
      }

      const targetSum = Math.max(0, measured - rowGap * (availableRows - 1));
      const perRow = targetSum / availableRows;
      // Raise each spanned row to at least perRow
      for (let k = 0; k < availableRows; k++) {
        const idx = start + k;
        rowHeights[idx] = Math.max(rowHeights[idx], perRow);
      }
    }

    // Compute prefix sums for tops (accumulated row heights + gaps)
    const rowTop = new Array(rowsCount).fill(0);
    for (let r = 1; r < rowsCount; r++) {
      rowTop[r] = rowTop[r - 1] + rowHeights[r - 1] + rowGap;
    }

    // Build result map: id -> { top, left, width, height }
    const result = new Map();

    for (const it of currentItems) {
      if (!it || it._id == null) {
        continue;
      }
      const id = it._id;
      const colstart = Math.max(1, Math.min(columns, it.colstart || 1));
      const colspan = Math.max(1, Math.min(columns - colstart + 1, it.colspan || 1));
      const rowstart1 = Math.max(1, Math.min(rowsCount, it.rowstart || 1));
      const rowspan1 = Math.max(1, Math.min(rowsCount - rowstart1 + 1, it.rowspan || 1));

      const left = (colstart - 1) * (trackWidth + colGap);
      const width = colspan * trackWidth + (colspan - 1) * colGap;

      const top = rowTop[rowstart1 - 1] || 0;
      // Always use the computed row track heights so that all items sharing
      // the same rows have identical heights (matches CSS Grid behavior).
      let height = 0;
      for (let k = 0; k < rowspan1; k++) {
        const rr = rowstart1 - 1 + k;
        height += (rowHeights[rr] || 0);
        if (k < rowspan1 - 1) {
          height += rowGap;
        }
      }

      result.set(id, {
        top,
        left,
        width,
        height
      });
    }

    return result;
  }

  /**
   *
   * @param {HTMLElement[]} refs
   * @returns
   */
  getGridContentStyles(refs) {
    const result = new Map();
    for (const element of (refs || [])) {
      result.set(element.dataset.id, {
        width: element.offsetWidth + 'px',
        height: element.offsetHeight + 'px'
      });
    }

    return result;
  }

  /**
   * Handles item resizing ghost event.
   * @param {Object} arg
   * @param {GhostData} arg.data - The ghost data containing the item and its state.
   * @param {GridState} arg.state - The current grid state.
   * @param {CurrentItem} arg.item - The item being resized.
   * @param {MouseEvent} event - The mouse event triggering the resize.
   */
  onGhostResize({
    data, state, item
  }, event) {
    const deltaX = event.clientX - data.startX;
    // Our "dirty" FPS optimization
    if (Math.abs(deltaX) <= 0 || !item) {
      return {}; // Ignore small movements
    }
    return this.ghostResizeX({
      data,
      state,
      item
    }, deltaX);
  }

  /**
   *
   * @param {Object} arg
   * @param {GhostData} arg.data - The ghost data containing the item and its state.
   * @param {GridState} arg.state - The current grid state.
   * @param {CurrentItem} arg.item - The item being moved.
   * @param {Object} arg.precomp - precomputation for move preview.
   * @returns {{
   *  left: number,
   *  top: number,
   *  snapLeft?: number,
   *  snapTop?: number,
   *  colstart?: number,
   *  rowstart?: number
   * }} - The new position of the ghost item and optional snap info.
   */
  onGhostMove({
    data, state, item, precomp
  }, event) {
    const containerRect = this.getGridBoundingRect();
    const elWidth = data.width || data.element.offsetWidth;
    const elHeight = data.height || data.element.offsetHeight;

    if (data.clickOffsetX == null || data.clickOffsetY == null) {
      data.clickOffsetX = Math.min(
        Math.max(0, data.startX - containerRect.left - data.left),
        elWidth
      );
      data.clickOffsetY = Math.min(
        Math.max(0, data.startY - containerRect.top - data.top),
        elHeight
      );
    }

    // Desired top-left so the cursor stays at the same offset within the item
    // as at mousedown.
    let left = event.clientX - containerRect.left - (data.clickOffsetX || 0);
    let top = event.clientY - containerRect.top - (data.clickOffsetY || 0);

    // Constrain within the grid container.
    const maxLeft = Math.max(0, containerRect.width - elWidth);
    const maxTop = Math.max(0, containerRect.height - elHeight);
    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));

    // Round to whole pixels for smoother repaints.
    left = Math.round(left);
    top = Math.round(top);

    if (!state && !item) {
      return {
        left,
        top
      };
    }

    const style = this.getGridComputedStyle();
    const colGap = parseFloat(style.columnGap || style.gap) || 0;
    const rowGap = parseFloat(style.rowGap || style.gap) || 0;
    const columns = state.columns;
    const rows = Math.max(1, state.current?.rows || 1);
    const trackWidth = (containerRect.width - colGap * (columns - 1)) / columns;
    const trackHeight = (containerRect.height - rowGap * (rows - 1)) / rows;
    const stepX = trackWidth + colGap;
    const stepY = trackHeight + rowGap;
    const tMoveOpt = state?.options?.snapThresholdMove;

    // Memoize precomputed move index across a drag
    if (!precomp && data) {
      if (!data._movePrecomp || data._movePrecompFor !== item?._id) {
        data._movePrecomp = prepareMoveIndex({
          state,
          item
        });
        data._movePrecompFor = item?._id;
      }
      precomp = data._movePrecomp;
    }

    // Fast early bailout: skip recompute when signature unchanged
    const bail = shouldComputeMoveSnap({
      left,
      top,
      state,
      item,
      columns,
      rows,
      stepX,
      stepY,
      threshold: tMoveOpt,
      prevMemo: data?.moveSnapMemo || null
    });

    if (
      !bail.compute &&
      typeof data?.snapLeft === 'number' &&
      typeof data?.snapTop === 'number'
    ) {
      return {
        left,
        top,
        snapLeft: data.snapLeft,
        snapTop: data.snapTop,
        colstart: null,
        rowstart: null
      };
    }

    const snap = computeGhostMoveSnap({
      left,
      top,
      state,
      item,
      precomp,
      columns,
      rows,
      stepX,
      stepY,
      threshold: tMoveOpt
    }) || {};

    // Store latest memo and snap so future frames can bail early
    if (bail.memo) {
      data.moveSnapMemo = bail.memo;
    }

    return {
      left,
      top,
      snapLeft: snap.snapLeft,
      snapTop: snap.snapTop,
      colstart: snap.colstart,
      rowstart: snap.rowstart
    };
  }

  /**
   * Handles horizontal axis resizing of an ghost item.
   * @param {Object} arg
   * @param {GhostData} arg.data
   * @param {GridState} arg.state
   * @param {number} arg.deltaX - The change in X position.
   */
  ghostResizeX({
    data, state, item
  }, deltaX) {
    const containerRect = this.getGridBoundingRect();
    const elementRect = data.element.getBoundingClientRect();
    const columnWidth = containerRect.width / state.columns;
    const direction = deltaX > 0 ? 'east' : 'west';
    const directionCorrection = data.side === direction ? 1 : -1;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const tResizeOpt = (
      state?.options?.snapThresholdResize ?? 0.5
    );
    const tResize = Number(tResizeOpt);
    const SNAP_THRESHOLD = clamp(
      Number.isFinite(tResize) ? tResize : 0.5,
      0.05,
      0.95
    );
    const deltaSteps = Math.floor(
      (Math.abs(deltaX) + (1 - SNAP_THRESHOLD) * columnWidth) / columnWidth
    );
    const deltaColspan = deltaSteps * directionCorrection;
    const desired = Math.max(
      state.options.minSpan,
      Math.min(item.colspan + deltaColspan, state.columns)
    );
    const validated = validateResizeX({
      item,
      side: data.side,
      direction,
      newColspan: desired,
      positionsIndex: state.positions,
      maxColumns: state.options.columns,
      minSpan: state.options.minSpan
    });
    const { width, left } = this.getDeltaGhostPositionX({
      direction,
      side: data.side,
      item,
      newColspan: validated.colspan,
      newColstart: validated.colstart,
      maxColumns: state.columns,
      elementLeft: elementRect.left - containerRect.left,
      elementWidth: elementRect.width
    });
    return {
      direction,
      width,
      left,
      colstart: validated.colstart,
      colspan: validated.colspan
    };
  }

  /**
   * Apply validated resize to all affected items.
   * @param {Object} arg
   * @param {GhostData} arg.data - The ghost data containing the item and its state.
   * @param {GridState} arg.state - The current grid state.
   * @param {CurrentItem} arg.item - The item being resized.
   */
  performItemResize({
    data, state, item
  }) {
    if (!item) {
      return [];
    }

    const patches = getResizeChanges({
      data,
      state,
      item
    });

    return patches;
  }

  performItemMove({
    data, state, item, precomp
  }) {
    if (!item) {
      return [];
    }
    // Reuse precomp from drag if present
    if (!precomp && data?._movePrecomp && data._movePrecompFor === item?._id) {
      precomp = data._movePrecomp;
    }
    const patches = getMoveChanges({
      data,
      state,
      item,
      precomp
    });

    return patches;
  }

  /**
   * Mutates the styles array to include row indicator styles.
   */
  updateGridRowIndicatorStyles(styles, {
    columns, rows, colGap, trackWidth
  }) {
    // TODO: Implement row indicators when we implement 2d grid support
  }

  /**
   * Calculate the new ghost position and width based on the resize parameters.
   * @param {Object} arg
   * @param {string} arg.direction - The direction of the resize ('east' or 'west').
   * @param {string} arg.side - The side of the ghost being resized ('east' or 'west').
   * @param {CurrentItem} arg.item - The item being resized.
   * @param {number} arg.newColspan - The new column span after resizing.
   * @param {number} arg.newColstart - The new column start index after resizing.
   * @param {number} arg.maxColumns - The maximum number of columns in the grid.
   * @param {number} arg.elementLeft - The left position of the ghost element.
   * @param {number} arg.elementWidth - The width of the ghost element.
   * @returns {{width: number, left: number}} - The new width and left position
   * of the ghost element.
   */
  getDeltaGhostPositionX({
    direction,
    side,
    item,
    newColspan,
    newColstart,
    maxColumns,
    elementLeft,
    elementWidth
  }) {
    if (item.colspan === newColspan && item.colstart === newColstart) {
      return {
        width: elementWidth,
        left: elementLeft
      };
    }
    const containerRect = this.getGridBoundingRect();
    const style = this.getGridComputedStyle();
    const colGap = parseFloat(style.columnGap || style.gap) || 0;
    const trackWidth = (containerRect.width - colGap * (maxColumns - 1)) / maxColumns;
    const newWidth = Math.max(0, newColspan * trackWidth + (newColspan - 1) * colGap);
    const directionCorrection = direction === 'east' ? 1 : -1;
    const colstartDelta = Math.abs(newColstart - item.colstart);

    const left = side === 'west' && newColstart !== item.colstart
      ? elementLeft + colstartDelta * (trackWidth + colGap) * directionCorrection
      : elementLeft;

    return {
      width: newWidth,
      left
    };
  }

  getGridComputedStyle() {
    if (!this.gridComputedStyle && this.gridElement) {
      this.gridComputedStyle = getComputedStyle(this.gridElement);
    }
    return this.gridComputedStyle;
  }

  getGridBoundingRect() {
    if (!this.gridBoundingRect && this.gridElement) {
      this.gridBoundingRect = this.gridElement.getBoundingClientRect();
    }
    return this.gridBoundingRect;
  }

  destroy() {
    if (this.onSceneResizeDebounced?.cancel) {
      this.onSceneResizeDebounced.cancel();
      this.onSceneResizeDebounced = noop;
    }
    if (this.onSceneScrollDebounced?.cancel) {
      this.onSceneScrollDebounced.cancel();
      this.onSceneScrollDebounced = noop;
    }
    if (this.getGridColumnIndicatorStylesDebounced?.cancel) {
      this.getGridColumnIndicatorStylesDebounced.cancel();
      this.getGridColumnIndicatorStylesDebounced = noop;
    }
    this.rootElement = null;
    this.gridElement = null;
  }
}
