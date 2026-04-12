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

function matchesQuery(doc, query) {
  for (const [ key, value ] of Object.entries(query)) {
    if (key === '$and') {
      if (!value.every(subQuery => matchesQuery(doc, subQuery))) {
        return false;
      }
    } else if (key === '$or') {
      if (!value.some(subQuery => matchesQuery(doc, subQuery))) {
        return false;
      }
    } else {
      const docValue = key === '_id' ? doc._id : getNestedField(doc, key);

      if (typeof value === 'object' && value !== null && !(value instanceof Date) && !(value instanceof RegExp)) {
        for (const [ op, opValue ] of Object.entries(value)) {
          switch (op) {
            case '$eq': if (!deepEqual(docValue, opValue)) {
              return false;
            } break;
            case '$ne': if (deepEqual(docValue, opValue)) {
              return false;
            } break;
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
            case '$in': if (!opValue.includes(docValue)) {
              return false;
            } break;
            case '$nin': if (opValue.includes(docValue)) {
              return false;
            } break;
            case '$exists': if ((docValue !== undefined) !== opValue) {
              return false;
            } break;
          }
        }
      } else if (value instanceof RegExp) {
        if (typeof docValue !== 'string' || !value.test(docValue)) {
          return false;
        }
      } else if (Array.isArray(docValue)) {
        if (!docValue.some(item => deepEqual(item, value))) {
          return false;
        }
      } else if (value === null) {
        // MongoDB: { field: null } matches null, undefined, and missing
        if (docValue !== null && docValue !== undefined) {
          return false;
        }
      } else {
        if (!deepEqual(docValue, value)) {
          return false;
        }
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
