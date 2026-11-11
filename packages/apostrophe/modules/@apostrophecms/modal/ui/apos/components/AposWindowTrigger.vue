<template>
  <div
    class="apos-window-trigger"
    :class="`apos-window-trigger--${cornerName}`"
    data-apos-window-trigger
    data-apos-stacking="top"
    data-apos-ignore-unfocus="true"
    :data-apos-test="`window-trigger:${trigger.name}`"
    :data-apos-corner="cornerName"
  >
    <button
      type="button"
      class="apos-window-trigger__button"
      :class="{
        'apos-window-trigger__button--held': held,
        'apos-window-trigger__button--free': !!free,
        'apos-window-trigger__button--resting': !near && !held
      }"
      :data-apos-raised="near ? 'true' : 'false'"
      :style="{ transform: `translate(${offset.x}px, ${offset.y}px)` }"
      :aria-label="$t(trigger.label)"
      aria-haspopup="dialog"
      @focus="focused = true"
      @blur="focused = false"
      @click="open"
      @pointerdown="grip"
    >
      <span
        class="apos-window-trigger__disc"
        data-apos-test="window-trigger-disc"
        aria-hidden="true"
      />
      <AposIndicator
        class="apos-window-trigger__icon"
        :icon="trigger.icon"
        :icon-size="22"
      />
    </button>
  </div>
</template>

<script setup>
import {
  ref, computed, onMounted, onBeforeUnmount
} from 'vue';
import { useModalStore } from 'Modules/@apostrophecms/ui/stores/modal';
import {
  TRIGGER_SIZE,
  DRAG_THRESHOLD,
  OFFSETS,
  parseCorner,
  getCornerName,
  getCornerFromName,
  isInReach,
  isPointerNear,
  getCornerOrigin,
  getRestOffset,
  getVelocity,
  getNearestCorner,
  stepSpring,
  isSettled
} from 'Modules/@apostrophecms/modal/lib/window-trigger.mjs';

const props = defineProps({
  trigger: {
    type: Object,
    required: true
  }
});

const store = useModalStore();
const storageKey = `aposWindowTrigger:${props.trigger.name}`;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// The project's corner until the editor picks one
const defaultCorner = getCornerFromName(props.trigger.corner);

const corner = computed(() => store.getTriggerCorner(props.trigger.name) ||
  defaultCorner);
const cornerName = computed(() => getCornerName(corner.value));
// The pointer close to the corner, or focus on the trigger, eases it up
const pointerNear = ref(false);
const focused = ref(false);
const near = computed(() => pointerNear.value || focused.value);
const held = ref(false);
// The offset while dragged or springing, else the rest offset applies
const free = ref(null);
const offset = computed(() => free.value || getTarget());

let pointer = null;
let frame = 0;
let dragged = false;

onMounted(() => {
  load();
  window.addEventListener('storage', onStorage);
  document.addEventListener('pointermove', onPointerMove, { passive: true });
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('storage', onStorage);
  document.removeEventListener('pointermove', onPointerMove);
  followPointer(false);
});

function followPointer(on) {
  const method = on ? 'addEventListener' : 'removeEventListener';
  window[method]('pointermove', drag);
  window[method]('pointerup', release);
  window[method]('pointercancel', release);
}

// Near: within the corner's reach, read from the page so the reach never
// takes the page's clicks. What lies under the pointer, read in the corner
// only, tells a modal's box from the trigger over it
function onPointerMove(event) {
  if (pointer) {
    return;
  }
  const point = {
    x: event.clientX,
    y: event.clientY
  };
  const bounds = getBounds();
  if (!isInReach(point, corner.value, bounds)) {
    pointerNear.value = false;
    return;
  }
  const under = document.elementsFromPoint(point.x, point.y);
  pointerNear.value = isPointerNear(point, corner.value, bounds, {
    overModal: under.some(el => el.matches('[data-apos-modal-inner]')),
    overTrigger: under.some(el => el.matches('[data-apos-window-trigger] *'))
  });
}

function load() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(storageKey);
  } catch (e) {
    // No storage: the default corner
  }
  store.setTriggerCorner(props.trigger.name, parseCorner(stored, defaultCorner));
}

function onStorage(event) {
  if (event.key === storageKey) {
    load();
  }
}

function save(next) {
  store.setTriggerCorner(props.trigger.name, next);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch (e) {
    // The corner holds for this page only
  }
}

function getTarget() {
  return getRestOffset(corner.value, getRest());
}

// Without a fine pointer there is no "near" and nothing tucked
function getRest() {
  if (!finePointer.matches) {
    return OFFSETS.open;
  }
  return near.value ? OFFSETS.near : OFFSETS.tucked;
}

function getBounds() {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight
  };
}

function open() {
  if (dragged) {
    dragged = false;
    return;
  }
  apos.modal.execute(props.trigger.componentName, { ...props.trigger.props });
}

function grip(event) {
  if (event.button !== 0 || !event.isPrimary) {
    return;
  }
  dragged = false;
  cancelAnimationFrame(frame);
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    start: { ...offset.value },
    samples: [ {
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp
    } ]
  };
  // The drag is followed on the window: the pointer soon leaves the disc
  followPointer(true);
}

function drag(event) {
  if (pointer?.id !== event.pointerId) {
    return;
  }
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!held.value) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      return;
    }
    held.value = true;
  }
  pointer.samples.push({
    x: event.clientX,
    y: event.clientY,
    t: event.timeStamp
  });
  if (pointer.samples.length > 12) {
    pointer.samples.shift();
  }
  const bounds = getBounds();
  const origin = getCornerOrigin(corner.value, bounds);
  const half = TRIGGER_SIZE / 2;
  const x = clamp(origin.left + half + pointer.start.x + dx, bounds.width);
  const y = clamp(origin.top + half + pointer.start.y + dy, bounds.height);
  free.value = {
    x: x - half - origin.left,
    y: y - half - origin.top
  };
}

function release(event) {
  if (pointer?.id !== event.pointerId) {
    return;
  }
  const { samples } = pointer;
  pointer = null;
  followPointer(false);
  if (!held.value) {
    return;
  }
  held.value = false;
  dragged = true;
  const bounds = getBounds();
  const half = TRIGGER_SIZE / 2;
  const from = getCornerOrigin(corner.value, bounds);
  const center = {
    x: from.left + half + free.value.x,
    y: from.top + half + free.value.y
  };
  const velocity = getVelocity(samples, {
    x: event.clientX,
    y: event.clientY,
    t: event.timeStamp
  });
  const next = getNearestCorner(center, velocity, bounds);
  const to = getCornerOrigin(next, bounds);
  save(next);
  pointerNear.value = false;
  if (reducedMotion.matches) {
    free.value = null;
    return;
  }
  free.value = {
    x: center.x - half - to.left,
    y: center.y - half - to.top
  };
  spring({
    x: velocity.x * 1000,
    y: velocity.y * 1000
  });
}

function spring(initial) {
  let velocity = initial;
  let last = performance.now();
  const tick = now => {
    const seconds = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const target = getTarget();
    const step = stepSpring(free.value, velocity, target, seconds);
    velocity = step.velocity;
    if (isSettled(step.position, velocity, target)) {
      free.value = null;
      return;
    }
    free.value = step.position;
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

function clamp(value, max) {
  return Math.min(max, Math.max(0, value));
}
</script>

<style lang="scss" scoped>
  $size: 64px;
  $ease: cubic-bezier(0.77, 0, 0.175, 1);
  // A soft overshoot, settling back
  $spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  .apos-window-trigger {
    z-index: $z-index-window-top;
    position: fixed;
    right: 0;
    bottom: 0;
    width: 120px;
    height: 108px;
    pointer-events: none;
  }

  .apos-window-trigger--top-left,
  .apos-window-trigger--bottom-left {
    right: auto;
    left: 0;
  }

  .apos-window-trigger--top-left,
  .apos-window-trigger--top-right {
    top: 0;
    bottom: auto;
  }

  .apos-window-trigger__button {
    position: absolute;
    right: 0;
    bottom: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: $size;
    height: $size;
    padding: 0;
    border: 0;
    border-radius: 999px;
    color: var(--a-primary);
    background: linear-gradient(to bottom, color-mix(in srgb, var(--a-base-3) 10%, transparent), transparent);
    cursor: pointer;
    transition: transform 280ms $ease;
    pointer-events: auto;
    touch-action: none;
    user-select: none;

    &:focus-visible {
      outline: 2px solid var(--a-primary);
      outline-offset: 3px;
    }
  }

  .apos-window-trigger--top-left .apos-window-trigger__button,
  .apos-window-trigger--bottom-left .apos-window-trigger__button {
    right: auto;
    left: 0;
  }

  .apos-window-trigger--top-left .apos-window-trigger__button,
  .apos-window-trigger--top-right .apos-window-trigger__button {
    top: 0;
    bottom: auto;
  }

  .apos-window-trigger__button--free {
    transition: none;
  }

  .apos-window-trigger__button--held {
    cursor: grabbing;
  }

  // At rest only the disc takes the pointer: the button's box reaches past
  // the corner modals leave free. Its events reach the button all the same
  .apos-window-trigger__button--resting {
    pointer-events: none;
  }

  .apos-window-trigger__disc {
    position: absolute;
    width: 42px;
    height: 42px;
    border-radius: inherit;
    background: var(--a-background-primary);
    pointer-events: auto;
    transition: box-shadow 260ms $ease, transform 260ms $ease;
    box-shadow:
      0 1px 2px color-mix(in srgb, var(--a-black) 3%, transparent),
      0 2px 2px color-mix(in srgb, var(--a-black) 3%, transparent),
      inset 0 -1px 2px color-mix(in srgb, var(--a-black) 5%, transparent);
  }

  .apos-window-trigger__icon {
    position: relative;
    transition: transform 360ms $spring;
    pointer-events: none;
  }

  // Hovered: the spark twinkles in place, an even glow rings the disc
  .apos-window-trigger__button:hover,
  .apos-window-trigger__button:focus-visible {
    .apos-window-trigger__disc {
      box-shadow:
        0 0 0 4px color-mix(in srgb, var(--a-primary) 14%, transparent),
        0 1px 2px color-mix(in srgb, var(--a-black) 3%, transparent),
        0 2px 2px color-mix(in srgb, var(--a-black) 3%, transparent),
        inset 0 -1px 2px color-mix(in srgb, var(--a-black) 5%, transparent);
    }

    .apos-window-trigger__icon {
      transform: rotate(-14deg) scale(1.14);
    }
  }

  // Picked up: larger in place, the disc staying in its ring
  .apos-window-trigger__button--held {
    .apos-window-trigger__disc,
    .apos-window-trigger__icon {
      transform: scale(1.08);
    }

    .apos-window-trigger__disc {
      box-shadow:
        0 12px 24px color-mix(in srgb, var(--a-black) 14%, transparent),
        0 2px 4px color-mix(in srgb, var(--a-black) 6%, transparent),
        inset 0 -1px 2px color-mix(in srgb, var(--a-black) 5%, transparent);
    }
  }

  .apos-window-trigger__button:active .apos-window-trigger__disc {
    transform: scale(0.97);
  }

  /* stylelint-disable-next-line media-feature-name-allowed-list */
  @media (prefers-reduced-motion: reduce) {
    .apos-window-trigger__button,
    .apos-window-trigger__disc,
    .apos-window-trigger__icon {
      transition: none;
    }

    .apos-window-trigger__button:hover .apos-window-trigger__icon,
    .apos-window-trigger__button:focus-visible .apos-window-trigger__icon {
      transform: none;
    }
  }
</style>
