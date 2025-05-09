
export default function checkIfConditions(doc, conditions) {
  return Object.entries(conditions).every(([ key, value ]) => {
    if (key === '$or') {
      return checkOrConditions(doc, value);
    }

    if (key === '$and') {
      return checkAndConditions(doc, value);
    }

    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null
    ) {
      if (Object.hasOwn(value, '$ne')) {
        return getNestedPropValue(doc, key) !== value.$ne;
      } else if (Object.hasOwn(value, '$exists')) {
        // Per MongoDB documentation, $exists should treat null and undefined the same.
        // == null and != null are documented to match or reject null, undefined and nothing else.
        const actual = getNestedPropValue(doc, key);
        if (value.$exists) {
          return actual != null;
        } else {
          return actual == null;
        }
      }
    }
    return getNestedPropValue(doc, key) === value;
  });
}

function checkOrConditions(doc, conditions) {
  return conditions.some((condition) => {
    return checkIfConditions(doc, condition);
  });
}

function checkAndConditions(doc, conditions) {
  return conditions.every((condition) => {
    return checkIfConditions(doc, condition);
  });
}

function getNestedPropValue(doc, key) {
  if (key.includes('.')) {
    const keys = key.split('.');
    // Do not crash if a key is not found — mongodb doesn't, which is useful because
    // you can test for things like _image.0 where both might not exist yet
    return keys.reduce((acc, cur) => {
      if ((typeof acc !== 'object') || (acc == null)) {
        return undefined;
      } else {
        return acc[cur];
      }
    }, doc);
  }

  return doc[key];
}
