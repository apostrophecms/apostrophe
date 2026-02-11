import {
  ref,
  computed,
  unref,
  isRef
} from 'vue';

// Constants
const DRAG_THRESHOLD = 5; // pixels
const RESIZE_THRESHOLD = 5; // pixels
const VALID_EDGES = [ 'n', 's', 'e', 'w', 'se', 'sw', 'ne', 'nw' ];

// Edge configuration for resize calculations
// Each edge defines multipliers for how deltaX and deltaY affect
// width, height, left, and top
const EDGE_DELTAS = {
  e: {
    width: 1,
    height: 0,
    left: 0,
    top: 0
  },
  w: {
    width: -1,
    height: 0,
    left: 1,
    top: 0
  },
  s: {
    width: 0,
    height: 1,
    left: 0,
    top: 0
  },
  n: {
    width: 0,
    height: -1,
    left: 0,
    top: 1
  },
  se: {
    width: 1,
    height: 1,
    left: 0,
    top: 0
  },
  sw: {
    width: -1,
    height: 1,
    left: 1,
    top: 0
  },
  ne: {
    width: 1,
    height: -1,
    left: 0,
    top: 1
  },
  nw: {
    width: -1,
    height: -1,
    left: 1,
    top: 1
  }
};

/**
 * Draggable, positionable window logic. Handles mousedown → mousemove → mouseup
 * drag flow, viewport clamping, optional localStorage persistence, and optional
 * body class while dragging. Supports an optional corner resize handle with
 * developer-set min/max width and height. Use startResizing(e, edge) with
 * edge 'n'|'s'|'e'|'w'|'se'|'sw'|'ne'|'nw' for top, right, bottom, left handles.
 *
 * @param {{
 *   size: import('vue').Ref<{ width: number; height: number }>
 *   | { width: number; height: number };
 *   storageKey?: string;
 *   getDefaultPosition?: () => { left: number; top: number };
 *   minWidth?: number;
 *   maxWidth?: number;
 *   minHeight?: number;
 *   maxHeight?: number;
 * }} options
 * @returns {{
 *   position: import('vue').Ref<{ left: number; top: number }>;
 *   dragging: import('vue').Ref<boolean>;
 *   resizing: import('vue').Ref<boolean>;
 *   style: import('vue').ComputedRef<
 *   { left: string; top: string; width: string; height: string }>;
 *   startDragging: (e: MouseEvent) => void;
 *   stopDragging: () => void;
 *   startResizing: (e: MouseEvent, edge: 'n'|'s'|'e'|'w'|'se'|'sw'|'ne'|'nw') => void;
 *   stopResizing: () => void;
 *   setPosition: () => void;
 *   resetPosition: () => void;
 *   constrainPosition: () => void;
 *   constrainSize: () => void;
 *   cleanup: () => void;
 * }}
 */
export function useDraggableWindow({
  size,
  storageKey = null,
  getDefaultPosition = null,
  minWidth = null,
  maxWidth = null,
  minHeight = null,
  maxHeight = null
}) {
  const position = ref({
    left: 0,
    top: 0
  });
  const dragging = ref(false);
  const resizing = ref(false);
  const dragClassApplied = ref(false);
  const resizeClassApplied = ref(false);
  const bodyDragClass = 'apos-window-is-dragging';
  const bodyResizeClass = 'apos-window-is-resizing';
  const offset = {
    x: 0,
    y: 0
  };
  let initialMousePos = {
    x: 0,
    y: 0
  };
  let resizeInitial = {
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    mouseX: 0,
    mouseY: 0,
    edge: null
  };

  /**
   * Clamps a position value to ensure the element stays within the viewport
   * @param {string} axis - 'x' or 'y'
   * @param {number} value - The position value to clamp
   * @returns {number} The clamped position value
   */
  function getAxisPos(axis, value) {
    const s = unref(size);
    if (!s) {
      return value;
    }
    if (value < 0) {
      return 0;
    }
    const containerSize = axis === 'x' ? window.innerWidth : window.innerHeight;
    const elSize = axis === 'x' ? s.width : s.height;

    if (value + elSize > containerSize) {
      return containerSize - elSize;
    }
    return value;
  }

  /**
   * Checks if the mouse has moved enough to apply the drag/resize class
   * @param {{ x: number; y: number }} currentPos - Current mouse position
   * @param {{ x: number; y: number }} initialPos - Initial mouse position
   * @param {number} threshold - Threshold in pixels
   * @returns {boolean} True if threshold exceeded
   */
  function shouldApplyClass(currentPos, initialPos, threshold) {
    const deltaX = Math.abs(currentPos.x - initialPos.x);
    const deltaY = Math.abs(currentPos.y - initialPos.y);
    return deltaX > threshold || deltaY > threshold;
  }

  /**
   * Validates if an edge string is valid
   * @param {string} edge - Edge identifier
   * @returns {boolean} True if valid
   */
  function isValidEdge(edge) {
    return VALID_EDGES.includes(edge);
  }

  function drag(e) {
    // Only apply bodyDragClass after the mouse has moved a threshold distance
    if (!dragClassApplied.value) {
      if (shouldApplyClass(
        {
          x: e.clientX,
          y: e.clientY
        },
        initialMousePos,
        DRAG_THRESHOLD
      )) {
        document.body.classList.add(bodyDragClass);
        dragClassApplied.value = true;
      }
    }
    const x = getAxisPos('x', e.clientX - offset.x);
    const y = getAxisPos('y', e.clientY - offset.y);
    position.value = {
      left: x,
      top: y
    };
  }

  function startDragging(e) {
    // Prevent re-entry
    if (dragging.value) {
      return;
    }
    dragging.value = true;
    offset.x = e.clientX - position.value.left;
    offset.y = e.clientY - position.value.top;
    initialMousePos = {
      x: e.clientX,
      y: e.clientY
    };
    dragClassApplied.value = false;
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', stopDragging);
  }

  function stopDragging() {
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', stopDragging);
    dragging.value = false;
    // Remove unconditionally
    document.body.classList.remove(bodyDragClass);
    dragClassApplied.value = false;
    document.getSelection().removeAllRanges();

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(position.value));
      } catch (err) {
        // Ignore storage errors (e.g. private mode)
      }
    }
  }

  /**
   * Clamps a dimension value between min and max
   * @param {number} value - Value to clamp
   * @param {number|null} min - Minimum value (null if no minimum)
   * @param {number|null} max - Maximum value (null if no maximum)
   * @returns {number} Clamped value
   */
  function clampDimension(value, min, max) {
    if (min != null && value < min) {
      return min;
    }
    if (max != null && value > max) {
      return max;
    }
    return value;
  }

  /**
   * Applies resize constraints based on edge, min/max dimensions, and viewport
   * limits
   * @param {string} edge - Edge identifier ('n', 's', 'e', 'w', 'se', 'sw', 'ne', 'nw')
   * @param {number} width - Proposed width
   * @param {number} height - Proposed height
   * @param {number} left - Proposed left position
   * @param {number} top - Proposed top position
   * @returns {{ width: number; height: number; left: number; top: number }}
   * Constrained dimensions and position
   */
  function applyResizeConstraints(edge, width, height, left, top) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Determine which dimensions need constraint based on edge
    const affectsWidth = edge.includes('e') || edge.includes('w');
    const affectsHeight = edge.includes('n') || edge.includes('s');
    const affectsLeft = edge.includes('w');
    const affectsTop = edge.includes('n');

    let w = width;
    let h = height;
    let l = left;
    let t = top;

    // Apply min/max constraints
    if (affectsWidth) {
      w = clampDimension(width, minWidth, maxWidth);
    }
    if (affectsHeight) {
      h = clampDimension(height, minHeight, maxHeight);
    }

    // Apply viewport constraints for width
    if (affectsWidth) {
      if (affectsLeft) {
        // When resizing from left/west edge, maintain right edge position
        const rightEdge = left + width;
        w = Math.min(w, vw, rightEdge);
        l = rightEdge - w;
      } else {
        // When resizing from right/east edge, constrain to viewport
        w = Math.min(w, vw - l);
      }
    }

    // Apply viewport constraints for height
    if (affectsHeight) {
      if (affectsTop) {
        // When resizing from top/north edge, maintain bottom edge position
        const bottomEdge = top + height;
        h = Math.min(h, vh, bottomEdge);
        t = bottomEdge - h;
      } else {
        // When resizing from bottom/south edge, constrain to viewport
        h = Math.min(h, vh - t);
      }
    }

    return {
      width: w,
      height: h,
      left: l,
      top: t
    };
  }

  function doResize(e) {
    // Apply class after threshold
    if (!resizeClassApplied.value) {
      if (shouldApplyClass(
        {
          x: e.clientX,
          y: e.clientY
        },
        {
          x: resizeInitial.mouseX,
          y: resizeInitial.mouseY
        },
        RESIZE_THRESHOLD
      )) {
        document.body.classList.add(bodyResizeClass);
        resizeClassApplied.value = true;
      }
    }

    const deltaX = e.clientX - resizeInitial.mouseX;
    const deltaY = e.clientY - resizeInitial.mouseY;
    const edge = resizeInitial.edge;
    const config = EDGE_DELTAS[edge];

    if (!config) {
      return;
    }

    // Calculate new dimensions and position using edge configuration
    const width = resizeInitial.width + (deltaX * config.width);
    const height = resizeInitial.height + (deltaY * config.height);
    const left = resizeInitial.left + (deltaX * config.left);
    const top = resizeInitial.top + (deltaY * config.top);

    const result = applyResizeConstraints(edge, width, height, left, top);

    if (!isRef(size)) {
      return;
    }

    size.value = {
      width: result.width,
      height: result.height
    };
    position.value = {
      left: result.left,
      top: result.top
    };
  }

  function startResizing(e, edge) {
    if (
      resizing.value ||
      e.button !== 0 ||
      !isRef(size) ||
      !edge ||
      !isValidEdge(edge)
    ) {
      return;
    }
    resizing.value = true;
    const s = unref(size);
    const p = position.value;
    resizeInitial = {
      width: s.width,
      height: s.height,
      left: p.left,
      top: p.top,
      mouseX: e.clientX,
      mouseY: e.clientY,
      edge
    };
    resizeClassApplied.value = false;
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResizing);
  }

  function stopResizing() {
    resizing.value = false;
    document.body.classList.remove(bodyResizeClass);
    resizeClassApplied.value = false;
    document.getSelection().removeAllRanges();
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResizing);
  }

  function setPosition() {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const { left, top } = JSON.parse(stored);
          if (typeof left === 'number' && typeof top === 'number') {
            position.value = {
              left: getAxisPos('x', left),
              top: getAxisPos('y', top)
            };
            return;
          }
        }
      } catch (err) {
        // Ignore parse/storage errors
      }
    }

    resetPosition();
  }

  function resetPosition() {
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {
        // Ignore
      }
    }
    if (getDefaultPosition) {
      const { left, top } = getDefaultPosition();
      position.value = {
        left: getAxisPos('x', left),
        top: getAxisPos('y', top)
      };
    }
  }

  function constrainPosition() {
    const s = unref(size);
    if (!s) {
      return;
    }
    const x = getAxisPos('x', position.value.left);
    const y = getAxisPos('y', position.value.top);
    if (x !== position.value.left || y !== position.value.top) {
      position.value = {
        left: x,
        top: y
      };
    }
  }

  function constrainSize() {
    if (!isRef(size)) {
      return;
    }
    const s = unref(size);
    if (!s) {
      return;
    }
    const p = position.value;
    const maxW = window.innerWidth - p.left;
    const maxH = window.innerHeight - p.top;
    const width = clampDimension(Math.min(s.width, maxW), minWidth, maxWidth);
    const height = clampDimension(Math.min(s.height, maxH), minHeight, maxHeight);
    if (width !== s.width || height !== s.height) {
      size.value = {
        width,
        height
      };
    }
  }

  const style = computed(() => {
    const s = unref(size);
    const p = position.value;
    if (!s) {
      return {
        left: `${p.left}px`,
        top: `${p.top}px`,
        width: '0',
        height: '0'
      };
    }
    return {
      left: `${p.left}px`,
      top: `${p.top}px`,
      width: `${s.width}px`,
      height: `${s.height}px`
    };
  });

  /**
   * Cleanup function to be called on component unmount
   * Ensures event listeners are removed and classes are cleaned up
   */
  function cleanup() {
    // Unconditionally clean up — reactive state may be out of sync
    // if mouseup was lost (tab switch, mouse left viewport, etc.)
    document.body.classList.remove(bodyDragClass);
    document.body.classList.remove(bodyResizeClass);
    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', stopDragging);
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResizing);
    dragging.value = false;
    resizing.value = false;
    dragClassApplied.value = false;
    resizeClassApplied.value = false;
    document.getSelection().removeAllRanges();
  }

  return {
    position,
    dragging,
    resizing,
    style,
    startDragging,
    stopDragging,
    startResizing,
    stopResizing,
    setPosition,
    resetPosition,
    constrainPosition,
    constrainSize,
    cleanup
  };
}
