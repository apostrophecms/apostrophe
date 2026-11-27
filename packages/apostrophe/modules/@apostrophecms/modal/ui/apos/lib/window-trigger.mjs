// The window trigger's corner, its throw and its spring. Positions are the
// trigger's offset from its resting place in the current corner, in pixels;
// velocities are in pixels per millisecond unless noted.

export const TRIGGER_SIZE = 64;
export const DRAG_THRESHOLD = 8;
export const DEFAULT_CORNER = Object.freeze({
  x: 'right',
  y: 'bottom'
});

export const CORNER_NAMES = Object.freeze([
  'top-left', 'top-right', 'bottom-left', 'bottom-right'
]);

export const DISC_RADIUS = 21;

// How far the trigger sits from its corner: partly below the edge when at
// rest, eased up when the pointer comes near, fully in view without a fine
// pointer. Positive values move away from the screen's center
export const OFFSETS = Object.freeze({
  open: [ -20, -20 ],
  tucked: [ 14, 26 ],
  near: [ -8, -8 ]
});

// The reach of "near" from the corner
export const NEAR_REACH = Object.freeze({
  x: 120,
  y: 108
});

const SPRING = {
  stiffness: 632,
  damping: 40
};
const SAMPLE_WINDOW = 80;
const FRICTION = 0.998;
const DEAD_ZONE = 0.4;

// A stored corner, else `fallback`
export function parseCorner(value, fallback = DEFAULT_CORNER) {
  try {
    const corner = typeof value === 'string' ? JSON.parse(value) : value;
    if ([ 'left', 'right' ].includes(corner?.x) && [ 'top', 'bottom' ].includes(corner?.y)) {
      return {
        x: corner.x,
        y: corner.y
      };
    }
  } catch (e) {
    // An unreadable preference falls back to the default
  }
  return { ...fallback };
}

export function getCornerName(corner) {
  return `${corner.y}-${corner.x}`;
}

// `bottom-right` and the like, else the default corner
export function getCornerFromName(name) {
  if (!CORNER_NAMES.includes(name)) {
    return { ...DEFAULT_CORNER };
  }
  const [ y, x ] = name.split('-');
  return {
    x,
    y
  };
}

// Whether `point` is within the reach of `corner`
export function isInReach(point, corner, bounds) {
  const x = corner.x === 'right' ? bounds.width - point.x : point.x;
  const y = corner.y === 'bottom' ? bounds.height - point.y : point.y;
  return x >= 0 && y >= 0 && x <= NEAR_REACH.x && y <= NEAR_REACH.y;
}

// Whether the pointer at `point` raises the trigger in `corner`, or keeps it
// raised: within the corner's reach, but over a modal or window box
// (`overModal`) only when it is on the trigger itself (`overTrigger`: its disc
// at rest, all of it raised), so aiming at a modal's corner controls never
// raises it, and reaching for it once raised never drops it
export function isPointerNear(point, corner, bounds, { overModal, overTrigger }) {
  return isInReach(point, corner, bounds) && (overTrigger || !overModal);
}

// Top left of the trigger's box when it rests in `corner` of `bounds`
export function getCornerOrigin(corner, bounds) {
  return {
    left: corner.x === 'right' ? bounds.width - TRIGGER_SIZE : 0,
    top: corner.y === 'bottom' ? bounds.height - TRIGGER_SIZE : 0
  };
}

// Where the trigger rests in `corner`, as an offset from the corner's origin
export function getRestOffset(corner, offset) {
  return {
    x: corner.x === 'right' ? offset[0] : -offset[0],
    y: corner.y === 'bottom' ? offset[1] : -offset[1]
  };
}

// The pointer's velocity over its last moves
export function getVelocity(samples, now) {
  const first = samples.find(sample => sample.t >= now.t - SAMPLE_WINDOW);
  const elapsed = first ? now.t - first.t : 0;
  if (!first || elapsed <= 0) {
    return {
      x: 0,
      y: 0
    };
  }
  return {
    x: (now.x - first.x) / elapsed,
    y: (now.y - first.y) / elapsed
  };
}

// The corner a trigger released at `center` (its center, in `bounds`) heads
// for, carrying the throw in `velocity`
export function getNearestCorner(center, velocity, bounds) {
  const reach = FRICTION / (1 - FRICTION);
  const x = center.x + withoutDeadZone(velocity.x) * reach;
  const y = center.y + withoutDeadZone(velocity.y) * reach;
  return {
    x: x < bounds.width / 2 ? 'left' : 'right',
    y: y < bounds.height / 2 ? 'top' : 'bottom'
  };
}

function withoutDeadZone(speed) {
  return Math.sign(speed) * Math.max(0, Math.abs(speed) - DEAD_ZONE);
}

// One frame of the spring pulling `position` toward `target`. `velocity` is
// in pixels per second, `seconds` the frame's duration
export function stepSpring(position, velocity, target, seconds) {
  const steps = Math.max(1, Math.ceil(seconds * 240));
  const dt = seconds / steps;
  const next = { ...position };
  const speed = { ...velocity };
  for (let i = 0; i < steps; i++) {
    for (const axis of [ 'x', 'y' ]) {
      const force = -SPRING.stiffness * (next[axis] - target[axis]) -
        SPRING.damping * speed[axis];
      speed[axis] += force * dt;
      next[axis] += speed[axis] * dt;
    }
  }
  return {
    position: next,
    velocity: speed
  };
}

export function isSettled(position, velocity, target) {
  return [ 'x', 'y' ].every(axis => Math.abs(position[axis] - target[axis]) < 0.5 &&
    Math.abs(velocity[axis]) < 20);
}
