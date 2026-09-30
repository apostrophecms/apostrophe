const {
  getNestedField,
  setNestedField,
  deepEqual,
  validateInteger
} = require('./shared');

class AggregationCursor {
  constructor(collection, pipeline) {
    this._collection = collection;
    this._pipeline = pipeline;
  }

  async toArray() {
    let stages = this._pipeline;
    let query = {};
    if (stages.length > 0 && stages[0].$match) {
      query = stages[0].$match;
      stages = stages.slice(1);
    }
    let docs = await this._collection.find(query).toArray();

    for (const stage of stages) {
      const [ op, value ] = Object.entries(stage)[0];

      switch (op) {
        case '$match':
          docs = docs.filter(doc => matchesQuery(doc, value));
          break;
        case '$group':
          docs = this._processGroup(docs, value);
          break;
        case '$project':
          docs = docs.map(doc => applyAggregateProject(doc, value));
          break;
        case '$unwind':
          docs = this._processUnwind(docs, value);
          break;
        case '$sort':
          docs = this._processSort(docs, value);
          break;
        case '$limit':
          docs = docs.slice(0, validateInteger(value, '$limit'));
          break;
        case '$skip':
          docs = docs.slice(validateInteger(value, '$skip'));
          break;
        default:
          throw new Error(`Unsupported aggregation stage: ${op}`);
      }
    }

    return docs;
  }

  _processGroup(docs, groupSpec) {
    const groups = new Map();
    const groupField = groupSpec._id;

    for (const doc of docs) {
      let groupKey;
      if (typeof groupField === 'string' && groupField.startsWith('$')) {
        groupKey = getNestedField(doc, groupField.substring(1));
      } else if (groupField !== null && typeof groupField === 'object') {
        groupKey = {};
        for (const [ k, v ] of Object.entries(groupField)) {
          if (typeof v === 'string' && v.startsWith('$')) {
            groupKey[k] = getNestedField(doc, v.substring(1));
          } else {
            groupKey[k] = v;
          }
        }
      } else {
        groupKey = groupField;
      }

      const keyStr = JSON.stringify(groupKey);
      if (!groups.has(keyStr)) {
        groups.set(keyStr, {
          _id: groupKey,
          docs: []
        });
      }
      groups.get(keyStr).docs.push(doc);
    }

    const results = [];
    for (const [ , group ] of groups) {
      const result = { _id: group._id };

      for (const [ field, expr ] of Object.entries(groupSpec)) {
        if (field === '_id') {
          continue;
        }

        if (expr.$sum) {
          const sumField = expr.$sum;
          if (typeof sumField === 'string' && sumField.startsWith('$')) {
            result[field] = group.docs.reduce((sum, doc) => {
              return sum + (getNestedField(doc, sumField.substring(1)) || 0);
            }, 0);
          } else if (typeof sumField === 'number') {
            result[field] = group.docs.length * sumField;
          }
        } else if (expr.$avg) {
          const avgField = expr.$avg.substring(1);
          const values = group.docs
            .map(doc => getNestedField(doc, avgField))
            .filter(v => v != null);
          result[field] = values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : null;
        } else if (expr.$first) {
          const firstField = expr.$first.substring(1);
          result[field] = group.docs.length > 0
            ? getNestedField(group.docs[0], firstField)
            : null;
        } else if (expr.$last) {
          const lastField = expr.$last.substring(1);
          const last = group.docs[group.docs.length - 1];
          result[field] = group.docs.length > 0
            ? getNestedField(last, lastField)
            : null;
        }
      }

      results.push(result);
    }

    return results;
  }

  _processUnwind(docs, field) {
    const fieldName = field.startsWith('$') ? field.substring(1) : field;
    const results = [];

    for (const doc of docs) {
      const arr = getNestedField(doc, fieldName);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const newDoc = JSON.parse(JSON.stringify(doc));
          setNestedField(newDoc, fieldName, item);
          results.push(newDoc);
        }
      } else {
        results.push(doc);
      }
    }

    return results;
  }

  _processSort(docs, sortSpec) {
    return docs.slice().sort((a, b) => {
      for (const [ field, direction ] of Object.entries(sortSpec)) {
        const aVal = getNestedField(a, field);
        const bVal = getNestedField(b, field);

        if (aVal < bVal) {
          return direction === -1 ? 1 : -1;
        }
        if (aVal > bVal) {
          return direction === -1 ? -1 : 1;
        }
      }
      return 0;
    });
  }
}

function applyAggregateProject(doc, spec) {
  const result = {};
  let includeId = true;
  for (const [ key, value ] of Object.entries(spec)) {
    if (key === '_id') {
      if (value === 0 || value === false) {
        includeId = false;
      } else if (value === 1 || value === true) {
        includeId = true;
      }
      continue;
    }
    if (value === 0 || value === false) {
      continue;
    }
    if (value === 1 || value === true) {
      const v = getNestedField(doc, key);
      if (v !== undefined) {
        setNestedField(result, key, v);
      }
    } else if (typeof value === 'string' && value.startsWith('$')) {
      const refPath = value.slice(1);
      const v = getNestedField(doc, refPath);
      if (v !== undefined) {
        setNestedField(result, key, v);
      }
    } else {
      setNestedField(result, key, value);
    }
  }
  if (includeId && doc._id !== undefined) {
    result._id = doc._id;
  }
  return result;
}

// Operators supported inside a field's operator object, e.g.
// { field: { $gt: 3, $lt: 10 } }. Kept in sync with the SQL adapters'
// buildOperatorClause — any operator the main query path supports should
// match here, and unknown operators throw rather than silently succeeding.
const FIELD_OPERATORS = new Set([
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$exists', '$not',
  '$regex', '$options', '$all', '$size'
]);

function matchesValueEq(docValue, target) {
  // MongoDB semantics: a scalar match also matches when the field is an
  // array containing that scalar.
  if (Array.isArray(docValue) && !Array.isArray(target)) {
    return docValue.some(item => deepEqual(item, target));
  }
  return deepEqual(docValue, target);
}

function matchesRegex(docValue, regex) {
  if (Array.isArray(docValue)) {
    return docValue.some(item => typeof item === 'string' && regex.test(item));
  }
  return typeof docValue === 'string' && regex.test(docValue);
}

function matchesQuery(doc, query) {
  for (const [ key, value ] of Object.entries(query)) {
    if (key === '$and') {
      if (!value.every(subQuery => matchesQuery(doc, subQuery))) {
        return false;
      }
      continue;
    }
    if (key === '$or') {
      if (!value.some(subQuery => matchesQuery(doc, subQuery))) {
        return false;
      }
      continue;
    }
    if (key.startsWith('$')) {
      throw new Error(`Unsupported top-level operator: ${key}`);
    }

    const docValue = key === '_id' ? doc._id : getNestedField(doc, key);

    if (value instanceof RegExp) {
      if (!matchesRegex(docValue, value)) {
        return false;
      }
      continue;
    }

    if (value === null || value === undefined) {
      // MongoDB: { field: null } matches null, undefined, and missing
      if (docValue !== null && docValue !== undefined) {
        return false;
      }
      continue;
    }

    const isOperatorObject = typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value) &&
      Object.keys(value).some(k => k.startsWith('$'));

    if (!isOperatorObject) {
      if (!matchesValueEq(docValue, value)) {
        return false;
      }
      continue;
    }

    for (const [ op, opValue ] of Object.entries(value)) {
      if (!FIELD_OPERATORS.has(op)) {
        throw new Error(`Unsupported operator: ${op}`);
      }
      switch (op) {
        case '$eq':
          // $eq null matches explicit null AND missing fields
          if (opValue === null || opValue === undefined) {
            if (docValue !== null && docValue !== undefined) {
              return false;
            }
          } else if (!matchesValueEq(docValue, opValue)) {
            return false;
          }
          break;
        case '$ne':
          if (opValue === null || opValue === undefined) {
            if (docValue === null || docValue === undefined) {
              return false;
            }
          } else if (matchesValueEq(docValue, opValue)) {
            return false;
          }
          break;
        case '$gt': if (!(docValue > opValue)) {
          return false;
        } break;
        case '$gte': if (!(docValue >= opValue)) {
          return false;
        } break;
        case '$lt': if (!(docValue < opValue)) {
          return false;
        } break;
        case '$lte': if (!(docValue <= opValue)) {
          return false;
        } break;
        case '$in': {
          if (!Array.isArray(opValue)) {
            throw new Error('$in requires an array');
          }
          const matched = opValue.some(candidate => {
            if (candidate instanceof RegExp) {
              return matchesRegex(docValue, candidate);
            }
            if (candidate === null || candidate === undefined) {
              return docValue === null || docValue === undefined;
            }
            return matchesValueEq(docValue, candidate);
          });
          if (!matched) {
            return false;
          }
          break;
        }
        case '$nin': {
          if (!Array.isArray(opValue)) {
            throw new Error('$nin requires an array');
          }
          const matched = opValue.some(candidate => {
            if (candidate instanceof RegExp) {
              return matchesRegex(docValue, candidate);
            }
            if (candidate === null || candidate === undefined) {
              return docValue === null || docValue === undefined;
            }
            return matchesValueEq(docValue, candidate);
          });
          if (matched) {
            return false;
          }
          break;
        }
        case '$exists': if ((docValue !== undefined) !== Boolean(opValue)) {
          return false;
        } break;
        case '$not': {
          if (typeof opValue !== 'object' || opValue === null) {
            throw new Error('$not requires an object');
          }
          // Apply the inner operator object to the same field and negate
          // the result. Errors from unknown inner operators propagate.
          if (matchesQuery(doc, { [key]: opValue })) {
            return false;
          }
          break;
        }
        case '$regex': {
          const pattern = opValue instanceof RegExp ? opValue.source : String(opValue);
          const flags = value.$options || (opValue instanceof RegExp ? opValue.flags : '');
          const regex = new RegExp(pattern, flags);
          if (!matchesRegex(docValue, regex)) {
            return false;
          }
          break;
        }
        case '$options':
          // Handled with $regex, skip
          break;
        case '$all': {
          if (!Array.isArray(opValue)) {
            throw new Error('$all requires an array');
          }
          if (!Array.isArray(docValue)) {
            return false;
          }
          const allPresent = opValue.every(target =>
            docValue.some(item => deepEqual(item, target))
          );
          if (!allPresent) {
            return false;
          }
          break;
        }
        case '$size':
          if (!Array.isArray(docValue) || docValue.length !== opValue) {
            return false;
          }
          break;
      }
    }
  }
  return true;
}

module.exports = {
  AggregationCursor,
  matchesQuery,
  applyAggregateProject
};
