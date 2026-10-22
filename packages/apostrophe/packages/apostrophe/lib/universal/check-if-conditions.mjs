
// NOTE: This is a universal library for evaluating MongoDB-style conditions
// against a document or sub-document. Do not use any browser or node specific
// APIs here.
//
//
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
//   $or: [
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
  return Object.entries(conditions).every(([ key, condition ]) => {
    if (key === '$or') {
      return checkOrConditions(doc, condition, voterFn);
    }

    if (key === '$and') {
      return checkAndConditions(doc, condition, voterFn);
    }

    const docValue = getNestedPropValue(doc, key);

    // If the custom voter rejects the condition, we stop evaluating
    // and return false immediately.
    if (voterFn(key, condition, docValue) === false) {
      return false;
    }

    // External conditions should be handled outside of this function,
    // so we skip them here. Use the `voterFn` to gather external condition
    // entries and evaluate them separately.
    if (isExternalCondition(key)) {
      return true;
    }

    // Otherwise, we evaluate the condition against the document value.
    return evaluate(docValue, condition);
  });
}

export function isExternalCondition(conditionKey) {
  return conditionKey.endsWith(')');
}

function checkOrConditions(doc, conditions, voterFn) {
  return conditions.some((condition) => {
    return checkIfConditions(doc, condition, voterFn);
  });
}

function checkAndConditions(doc, conditions, voterFn) {
  return conditions.every((condition) => {
    return checkIfConditions(doc, condition, voterFn);
  });
}

function getNestedPropValue(doc, key) {
  if (!key.includes('.')) {
    return doc?.[key];
  }

  const keys = key.split('.');
  let currentValue = doc;
  while (keys.length > 0) {
    if (
      // The `==` comparison is intentionally used here to match
      // both `null` and `undefined`
      currentValue == null ||
      // Support i.e. `stringField.length`
      // eslint-disable-next-line valid-typeof
      typeof currentValue?.[keys[0]] == null
    ) {
      return undefined;
    }
    if (Array.isArray(currentValue)) {
      // Support i.e. `arrayField.length` or `arrayField.0`
      if (!Object.hasOwn(currentValue, keys[0])) {
        return currentValue.flatMap(item => {
          return getNestedPropValue(item, keys.join('.'));
        });
      }
    }
    const prop = keys.shift();
    currentValue = currentValue[prop];
  }

  return currentValue;
}

// Comparison operators registry for MongoDB-style conditions.
// https://www.mongodb.com/docs/manual/reference/operator/query-comparison/
const opRegistry = {};
opRegistry.$eq = (docValue, conditionValue) => {
  if (Array.isArray(docValue)) {
    if (Array.isArray(conditionValue)) {
      // Unlike MongoDB, we don't match the index order of the arrays.
      return docValue.length === conditionValue.length &&
        conditionValue.every(value => docValue.includes(value));
    }
    return docValue.includes(conditionValue);
  }
  return docValue === conditionValue;
};
opRegistry.$ne = (docValue, conditionValue) => (
  opRegistry.$eq(docValue, conditionValue) === false
);
opRegistry.$exists = (docValue, conditionValue) => {
  // Per MongoDB documentation, $exists should treat null and undefined the same.
  // == null and != null are documented to match or reject null, undefined
  // and nothing else.
  return (conditionValue ? docValue != null : docValue == null);
};
opRegistry.$in = (docValue, conditionValue) => {
  if (!Array.isArray(conditionValue)) {
    throw new Error('$in and $nin operators require an array as condition value');
  }
  if (Array.isArray(docValue)) {
    return conditionValue.some(value => docValue.includes(value));
  }
  return conditionValue.includes(docValue);
};
opRegistry.$nin = (docValue, conditionValue) => (
  opRegistry.$in(docValue, conditionValue) === false
);
opRegistry.$gt = (docValue, conditionValue) => (
  docValue > conditionValue
);
opRegistry.$lt = (docValue, conditionValue) => (
  docValue < conditionValue
);
opRegistry.$gte = (docValue, conditionValue) => (
  docValue >= conditionValue
);
opRegistry.$lte = (docValue, conditionValue) => (
  docValue <= conditionValue
);

export function evaluate(docValue, conditionValue) {
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
        default: {
          if (opRegistry[operator]) {
            return opRegistry[operator](docValue, operand);
          }
          throw new Error(`Unsupported operator: ${operator}`);
        }
      }
    });
  }

  if (Array.isArray(docValue)) {
    return docValue.includes(conditionValue);
  }

  return conditionValue === docValue;
}
