import {
  ref,
  computed,
  unref,
  isRef
} from 'vue';

/**
 * Draggable, positionable window logic. Handles mousedown → mousemove → mouseup
 * drag flow, viewport clamping, optional localStorage persistence, and optional
 * body class while dragging. Supports an optional corner resize handle with
 * developer-set min/max width and height. Use startResizing(e, edge) with
 * edge 'n'|'s'|'e'|'w' for top, right, bottom, left handles.
 *
 * @param {{
 *   size: import('vue').Ref<{ width: number; height: number }>
 *   | { width: number; height: number };
 *   storageKey?: string;
 *   bodyDragClass?: string;
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
 *   startResizing: (e: MouseEvent, edge: 'n'|'s'|'e'|'w'|'se') => void;
 *   stopResizing: () => void;
 *   setPosition: () => void;
 *   resetPosition: () => void;
 *   constrainPosition: () => void;
 *   constrainSize: () => void;
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
  let dragClassApplied = false;
  let resizeInitial = {
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    mouseX: 0,
    mouseY: 0,
    edge: null
  };
  let resizeClassApplied = false;

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

  function drag(e) {
    // Only apply bodyDragClass after the mouse has moved a threshold distance
    if (!dragClassApplied) {
      const deltaX = Math.abs(e.clientX - initialMousePos.x);
      const deltaY = Math.abs(e.clientY - initialMousePos.y);
      const threshold = 5; // pixels
      if (deltaX > threshold || deltaY > threshold) {
        document.body.classList.add(bodyDragClass);
        dragClassApplied = true;
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
    dragging.value = true;
    offset.x = e.clientX - position.value.left;
    offset.y = e.clientY - position.value.top;
    initialMousePos = {
      x: e.clientX,
      y: e.clientY
    };
    dragClassApplied = false;
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', stopDragging);
  }

  function stopDragging() {
    dragging.value = false;
    if (dragClassApplied) {
      document.body.classList.remove(bodyDragClass);
      dragClassApplied = false;
    }
    document.getSelection().removeAllRanges();

    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(position.value));
      } catch (err) {
        // Ignore storage errors (e.g. private mode)
      }
    }

    window.removeEventListener('mousemove', drag);
    window.removeEventListener('mouseup', stopDragging);
  }

  function clampDimension(value, min, max) {
    if (min != null && value < min) {
      return min;
    }
    if (max != null && value > max) {
      return max;
    }
    return value;
  }

  function applyResizeConstraints(edge, width, height, left, top) {
    let w = width;
    let h = height;
    let l = left;
    let t = top;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (edge === 'e') {
      w = clampDimension(width, minWidth, maxWidth);
      w = Math.min(w, vw - l);
    } else if (edge === 'w') {
      const rightEdge = left + width;
      w = clampDimension(width, minWidth, maxWidth);
      w = Math.min(w, vw, rightEdge);
      l = rightEdge - w;
    } else if (edge === 's') {
      h = clampDimension(height, minHeight, maxHeight);
      h = Math.min(h, vh - t);
    } else if (edge === 'n') {
      const bottomEdge = top + height;
      h = clampDimension(height, minHeight, maxHeight);
      h = Math.min(h, vh, bottomEdge);
      t = bottomEdge - h;
    } else if (edge === 'se') {
      w = clampDimension(width, minWidth, maxWidth);
      w = Math.min(w, vw - l);
      h = clampDimension(height, minHeight, maxHeight);
      h = Math.min(h, vh - t);
    }
    return {
      width: w,
      height: h,
      left: l,
      top: t
    };
  }

  function doResize(e) {
    if (!resizeClassApplied) {
      const deltaX = Math.abs(e.clientX - resizeInitial.mouseX);
      const deltaY = Math.abs(e.clientY - resizeInitial.mouseY);
      const threshold = 5;
      if (deltaX > threshold || deltaY > threshold) {
        document.body.classList.add(bodyResizeClass);
        resizeClassApplied = true;
      }
    }
    const deltaX = e.clientX - resizeInitial.mouseX;
    const deltaY = e.clientY - resizeInitial.mouseY;
    const edge = resizeInitial.edge;
    let width = resizeInitial.width;
    let height = resizeInitial.height;
    let left = resizeInitial.left;
    let top = resizeInitial.top;
    if (edge === 'e') {
      width = resizeInitial.width + deltaX;
    } else if (edge === 'w') {
      width = resizeInitial.width - deltaX;
      left = resizeInitial.left + deltaX;
    } else if (edge === 's') {
      height = resizeInitial.height + deltaY;
    } else if (edge === 'n') {
      height = resizeInitial.height - deltaY;
      top = resizeInitial.top + deltaY;
    } else if (edge === 'se') {
      width = resizeInitial.width + deltaX;
      height = resizeInitial.height + deltaY;
    }
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
    if (!isRef(size) || !edge || ![ 'n', 's', 'e', 'w', 'se' ].includes(edge)) {
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
    resizeClassApplied = false;
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResizing);
  }

  function stopResizing() {
    resizing.value = false;
    if (resizeClassApplied) {
      document.body.classList.remove(bodyResizeClass);
      resizeClassApplied = false;
    }
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
    constrainSize
  };
}
