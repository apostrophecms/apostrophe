
// Evaluate a field conditions against current schema values (doc or sub-doc).
// Expects a `conditions` object containing MongoDB-style conditions.
// Operators `$or` and `$and` are supported as top-level keys to allow
// for complex logical conditions. All comparison MongoDB operators are supported
// as object values.
// The condition object properties are field paths (dot notation is supported
// for objects), and the values are the conditions to evaluate against the
// document values.
// The `voterFn` function can be provided for evaluating
// conditions - return `false` to stop further evaluation.
// The function is called with three arguments:
// `voterFn(propName, condition, docValue)` where `propName` is the condition field path,
// `condition` is the condition value, and `docValue` is the field value extracted
// from the document.
// Example usage:
// ```js
// doc = {
//   assignee: 'john',
//   status: 'active',
//   stats: { count: 15 },
//   category: 'news'
// };
// const conditions = {
//   assignee: { '$exists': true },
//   status: { '$in': ['active', 'pending'] },
//   'stats.count': { '$gte': 10 },
//  $or: [
//     { 'category': 'news' },
//     { 'category': 'blog' }
//   ]
// };
// function voterFn(propName, condition, docValue) {
//   if (propName === 'status' && docValue === 'inactive') {
//     return false; // Reject the condition for 'status' if it's 'inactive'
//   }
//   // Non-boolean return values are ignored
// }
// const result = checkIfConditions(doc, conditions, voterFn);
// ```
export default function checkIfConditions(doc, conditions, voterFn = () => null) {
  return Object.entries(conditions).every(([ key, value ]) => {
    if (key === '$or') {
      return checkOrConditions(doc, value);
    }

    if (key === '$and') {
      return checkAndConditions(doc, value);
    }

    const docValue = getNestedPropValue(doc, key);

    // If the custom voter rejects the condition, we stop evaluating
    // and return false immediately.
    if (voterFn(key, value, docValue) === false) {
      return false;
    }
    // Otherwise, we evaluate the condition against the document value.
    return evaluate(value, docValue);
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

function evaluate(conditionValue, docValue) {
  if (
    typeof conditionValue === 'object' &&
      conditionValue !== null
  ) {
    // Empty objects are not valid conditions
    if (Object.keys(conditionValue).length === 0) {
      return false;
    }
    // Evaluate every operator in the conditionValue object.
    // A MongoDB-style condition object is expected.
    // We check for the presence of known comparison operators and
    // evaluate them accordingly.
    return Object.entries(conditionValue).every(([ operator, operand ]) => {
      switch (operator) {
        // BC, support the min and max properties because they were already supported
        // in a different routine.
        case 'min':
          return docValue >= operand;
        case 'max':
          return docValue <= operand;
        // Support all MongoDB comparison operators.
        case '$eq':
          return docValue === operand;
        case '$ne':
          return docValue !== operand;
        case '$exists':
          // Per MongoDB documentation, $exists should treat null and undefined the same.
          // == null and != null are documented to match or reject null, undefined
          // and nothing else.
          return (operand ? docValue != null : docValue == null);
        case '$in':
          return Array.isArray(operand) && operand.includes(docValue);
        case '$nin':
          return Array.isArray(operand) && !operand.includes(docValue);
        case '$gt':
          return docValue > operand;
        case '$lt':
          return docValue < operand;
        case '$gte':
          return docValue >= operand;
        case '$lte':
          return docValue <= operand;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    });
  }

  if (Array.isArray(docValue)) {
    return docValue.includes(conditionValue);
  }

  return conditionValue === docValue;
}
