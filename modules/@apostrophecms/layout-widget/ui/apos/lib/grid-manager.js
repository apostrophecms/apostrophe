import { debounce } from 'lodash';
import {
  getMoveChanges, getResizeChanges, validateResizeX
} from './grid-state';

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
 * @typedef {import('./grid-state').GridState} GridState
 * @typedef {import('./grid-state').CurrentItem} CurrentItem
 */

export class GridManager {
  constructor() {
    this.rootElement = null;
    this.gridElement = null;
    this.gridComputedStyle = null;
    this.gridBoundingRect = null;
    this.resizeObserver = null;
    this.onResizeAndScroll = null;
  }

  /**
   *
   * @param {HTMLElement} rootElement
   * @param {HTMLElement} gridElement
   * @param {(rect: DOMRectReadOnly | UIEvent) => void} onResize
   */
  init(rootElement, gridElement, onResizeAndScroll = (rect) => {}) {
    this.rootElement = rootElement;
    this.gridElement = gridElement;
    this.onResizeAndScroll = onResizeAndScroll;
    this.onSceneResizeDebounced = debounce(this.onSceneResize, 100, {
      leading: false,
      trailing: true
    });
    document.addEventListener('scroll', this.onSceneResizeDebounced);

    // Initialize resize observer
    // FIXME: improve, it's quick and dirty and doesn't trigger
    // always on resize. Also we need to support the device preview apos feature.
    this.resizeObserver = new ResizeObserver(entries => {
      this.onSceneResizeDebounced(entries[0].contentRect);
    });

    this.resizeObserver.observe(window.document.body);
  }

  /**
   * @param {DOMRectReadOnly | UIEvent} contentRect
   */
  onSceneResize = (contentRect) => {
    this.gridComputedStyle = null; // Reset cached styles
    this.getGridComputedStyle(); // Re-fetch styles
    this.gridBoundingRect = null; // Reset cached bounding rect
    this.getGridBoundingRect(); // Re-fetch bounding rect
    if (this.onResizeAndScroll) {
      this.onResizeAndScroll(contentRect);
    }
  };

  /**
   * Get the original position of an item within a container.
   *
   * @param {HTMLElement} item
   */
  getItemOriginalPosition(item) {
    const rect = item.getBoundingClientRect();
    const containerRect = this.getGridBoundingRect();
    return {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  getGridColumnIndicatorStyles(columns, rows) {
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
  * @returns {{
  *  left: number,
  *  top: number,
  *  snapLeft?: number,
  *  snapTop?: number,
  *  colstart?: number,
  *  rowstart?: number,
  *  snapColstart?: number,
  *  snapRowstart?: number
  * }} - The new position of the ghost item and optional snap info.
   */
  onGhostMove({
    data, state, item
  }, event) {
    // Fast computation of position relative to the grid container, keeping the
    // entire ghost within bounds. Avoids layout thrash by using cached
    // container rect and known ghost dimensions from `data`.
    const containerRect = this.getGridBoundingRect();
    const elWidth = data.width || data.element.offsetWidth;
    const elHeight = data.height || data.element.offsetHeight;

    // Lazily compute the cursor offset within the item on first move.
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

    // Compute optional snapping with minimal overhead.
    // Uses cached grid metrics and the positions index to find the nearest
    // valid cell start that can fit the moving item (ignoring the item itself).
    // let snapLeft;
    // let snapTop;
    // let snapColstart;
    // let snapRowstart;
    const style = this.getGridComputedStyle();
    const colGap = parseFloat(style.columnGap || style.gap) || 0;
    const rowGap = parseFloat(style.rowGap || style.gap) || 0;
    const columns = state.columns;
    const rows = Math.max(1, state.current?.rows || 1);
    const trackWidth = (containerRect.width - colGap * (columns - 1)) / columns;
    const trackHeight = (containerRect.height - rowGap * (rows - 1)) / rows;
    const stepX = trackWidth + colGap;
    const stepY = trackHeight + rowGap;

    const colspan = Math.max(1, item.colspan || 1);
    const rowspan = Math.max(1, item.rowspan || 1);
    const maxStartX = Math.max(1, columns - colspan + 1);
    const maxStartY = Math.max(1, rows - rowspan + 1);

    // Initial nearest indices from current pixel position
    let c = Math.round(left / stepX) + 1;
    let r = Math.round(top / stepY) + 1;
    c = Math.max(1, Math.min(c, maxStartX));
    r = Math.max(1, Math.min(r, maxStartY));

    // Record the raw nearest snap indices (no collision checks)
    const colstart = c;
    const rowstart = r;

    // // Fast validator: region must be empty or occupied by the moving item
    // // in every spanned row.
    // const positions = state.positions;
    // const canPlaceAt = (rr, cc) => {
    //   // bounds check
    //   if (rr < 1 || rr > maxStartY || cc < 1 || cc > maxStartX) {
    //     return false;
    //   }
    //   for (let ry = 0; ry < rowspan; ry++) {
    //     const rowIndex = positions.get(rr + ry);
    //     if (!rowIndex) {
    //       // No occupancy recorded: free row segment
    //       continue;
    //     }
    //     for (let cx = 0; cx < colspan; cx++) {
    //       const occupant = rowIndex.get(cc + cx);
    //       if (occupant && occupant !== item._id) {
    //         return false;
    //       }
    //     }
    //   }
    //   return true;
    // };

    // // Search in expanding Manhattan rings around (r,c) for a valid spot.
    // // With typical columns <= 12 and small row counts, this is cheap.
    // let found = false;
    // const maxCDelta = Math.max(0, maxStartX - 1);
    // const maxRDelta = Math.min(3, Math.max(0, maxStartY - 1));
    // for (let rd = 0; rd <= maxRDelta && !found; rd++) {
    //   const rCandidates = rd === 0 ? [ r ] : [ r - rd, r + rd ];
    //   for (let i = 0; i < rCandidates.length && !found; i++) {
    //     const rr = rCandidates[i];
    //     if (rr < 1 || rr > maxStartY) {
    //       continue;
    //     }
    //     // Column scan from nearest outward
    //     for (let cd = 0; cd <= maxCDelta; cd++) {
    //       const cc1 = c - cd;
    //       if (cc1 >= 1 && cc1 <= maxStartX && canPlaceAt(rr, cc1)) {
    //         snapColstart = cc1; snapRowstart = rr; found = true; break;
    //       }
    //       if (cd === 0) {
    //         continue; // avoid duplicate center
    //       }
    //       const cc2 = c + cd;
    //       if (cc2 >= 1 && cc2 <= maxStartX && canPlaceAt(rr, cc2)) {
    //         snapColstart = cc2; snapRowstart = rr; found = true; break;
    //       }
    //     }
    //   }
    // }

    // if (found && snapColstart && snapRowstart) {
    //   snapLeft = Math.round((snapColstart - 1) * stepX);
    //   snapTop = Math.round((snapRowstart - 1) * stepY);
    // }

    const snapLeft = Math.round((colstart - 1) * stepX);
    const snapTop = Math.round((rowstart - 1) * stepY);
    const snapColstart = colstart;
    const snapRowstart = rowstart;

    return {
      left,
      top,
      snapLeft,
      snapTop,
      colstart,
      rowstart,
      snapColstart,
      snapRowstart
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
    const deltaColspan = Math.round(Math.abs(deltaX) / columnWidth) * directionCorrection;
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
    data, state, item
  }) {
    if (!item) {
      return [];
    }

    const patches = getMoveChanges({
      data,
      state,
      item
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
    if (!this.gridComputedStyle) {
      this.gridComputedStyle = getComputedStyle(this.gridElement);
    }
    return this.gridComputedStyle;
  }

  getGridBoundingRect() {
    if (!this.gridBoundingRect) {
      this.gridBoundingRect = this.gridElement.getBoundingClientRect();
    }
    return this.gridBoundingRect;
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    document.removeEventListener('scroll', this.onSceneResizeDebounced);
    this.onSceneResizeDebounced = null;
    this.rootElement = null;
    this.gridElement = null;
  }
}
