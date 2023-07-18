
export default function checkIfConditions(doc, conditions) {
  return Object.entries(conditions).every(([ key, value ]) => {
    if (key === '$or') {
      return checkOrConditions(doc, value);
    }

    const isNotEqualCondition = typeof value === 'object' &&
          !Array.isArray(value) &&
          value !== null &&
          Object.hasOwn(value, '$ne');

    if (isNotEqualCondition) {
      return getNestedPropValue(doc, key) !== value.$ne;
    }

    return getNestedPropValue(doc, key) === value;
  });
}

function checkOrConditions(doc, conditions) {
  return conditions.some((condition) => {
    return checkIfConditions(doc, condition);
  });
}

function getNestedPropValue(doc, key) {
  if (key.includes('.')) {
    const keys = key.split('.');
    return keys.reduce((acc, cur) => acc[cur], doc);
  }

  return doc[key];
}
