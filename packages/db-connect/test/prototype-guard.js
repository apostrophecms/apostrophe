// Test helper: snapshot the built-in prototypes (and the Object and
// Function constructors, and their methods) and restore them afterwards, so a test that
// demonstrates prototype pollution cannot break the rest of the test run
// even when the code under test is vulnerable.

// Capture everything we rely on up front, in case the code under test
// deletes it
const getDescriptors = Object.getOwnPropertyDescriptors;
const defineProperty = Object.defineProperty;
const ownKeys = Reflect.ownKeys;
const hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

const baseTargets = [
  Object.prototype,
  Array.prototype,
  Function.prototype,
  Object,
  Function
];

// Also watch the built-in methods themselves, e.g. a path like
// `hasOwnProperty.call` could otherwise replace `call` on a shared method
const targets = [ ...baseTargets ];
for (const target of baseTargets) {
  const descriptors = getDescriptors(target);
  for (const key of ownKeys(descriptors)) {
    const value = descriptors[key].value;
    if ((typeof value === 'function') && !targets.includes(value)) {
      targets.push(value);
    }
  }
}

function snapshot() {
  const snap = [];
  for (const target of targets) {
    snap.push({
      target,
      descriptors: getDescriptors(target)
    });
  }
  return snap;
}

function restore(snap) {
  for (const { target, descriptors } of snap) {
    for (const key of ownKeys(target)) {
      if (!hasOwn(descriptors, key)) {
        delete target[key];
      }
    }
    for (const key of ownKeys(descriptors)) {
      try {
        defineProperty(target, key, descriptors[key]);
      } catch (e) {
        // Non-configurable built-ins cannot have been removed either
      }
    }
  }
}

// Returns the names of properties that were added to, removed from or
// replaced on the built-ins since the snapshot was taken
function changes(snap) {
  const result = [];
  for (const { target, descriptors } of snap) {
    const now = getDescriptors(target);
    const keys = new Set(ownKeys(descriptors));
    for (const key of ownKeys(now)) {
      keys.add(key);
    }
    for (const key of keys) {
      const before = descriptors[key];
      const after = now[key];
      if (!before || !after || before.value !== after.value ||
        before.get !== after.get || before.set !== after.set) {
        result.push(String(key));
      }
    }
  }
  return result;
}

module.exports = {
  snapshot,
  restore,
  changes
};
