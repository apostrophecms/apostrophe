import { debounce } from 'lodash';
import { getResizeChangesX, validateResizeX } from './grid-state';

/**
 * @typedef {{
 *  id: string,
 *  startX: number,
 *  startY: number,
 *  side: string,
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
    if (Math.abs(deltaX) % 2 !== 0 || !item) {
      return {}; // Ignore small movements
    }
    return this.ghostResizeX({
      data,
      state,
      item
    }, deltaX);
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
    const columnWidth = containerRect.width / state.options.columns;
    const direction = deltaX > 0 ? 'east' : 'west';
    const directionCorrection = data.side === direction ? 1 : -1;
    const deltaColspan = Math.round(Math.abs(deltaX) / columnWidth) * directionCorrection;
    const desired = Math.max(
      state.options.minSpan,
      Math.min(item.colspan + deltaColspan, state.options.columns)
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
      maxColumns: state.options.columns,
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

    const patches = getResizeChangesX({
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
