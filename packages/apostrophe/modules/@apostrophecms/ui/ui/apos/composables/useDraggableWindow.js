import { ref, computed, unref } from 'vue';

/**
 * Draggable, positionable window logic. Handles mousedown → mousemove → mouseup
 * drag flow, viewport clamping, optional localStorage persistence, and optional
 * body class while dragging.
 *
 * @param {{
 *   size: import('vue').Ref<{ width: number; height: number }> | { width: number; height: number };
 *   storageKey?: string;
 *   bodyDragClass?: string;
 *   getDefaultPosition?: () => { left: number; top: number };
 * }} options
 * @returns {{
 *   position: import('vue').Ref<{ left: number; top: number }>;
 *   dragging: import('vue').Ref<boolean>;
 *   style: import('vue').ComputedRef<{ left: string; top: string; width: string; height: string }>;
 *   startDragging: (e: MouseEvent) => void;
 *   stopDragging: () => void;
 *   setPosition: () => void;
 *   resetPosition: () => void;
 *   constrainPosition: () => void;
 * }}
 */
export function useDraggableWindow({
  size,
  storageKey = null,
  getDefaultPosition = null
}) {
  const position = ref({ left: 0, top: 0 });
  const dragging = ref(false);
  const bodyDragClass = 'apos-window-is-dragging';
  let offset = { x: 0, y: 0 };
  let initialMousePos = { x: 0, y: 0 };
  let dragClassApplied = false;

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
    position.value = { left: x, top: y };
  }

  function startDragging(e) {
    dragging.value = true;
    offset.x = e.clientX - position.value.left;
    offset.y = e.clientY - position.value.top;
    initialMousePos = { x: e.clientX, y: e.clientY };
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
      position.value = { left: x, top: y };
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
    style,
    startDragging,
    stopDragging,
    setPosition,
    resetPosition,
    constrainPosition
  };
}
