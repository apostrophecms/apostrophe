// PostgreSQL Adapter for MongoDB-compatible interface
// Stores documents as JSONB with _id as primary key

const { Pool } = require('pg');
const crypto = require('crypto');

// =============================================================================
// SECURITY: Input Validation and Escaping
// =============================================================================

// Strict pattern for table/index names (PostgreSQL identifier limitations)
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Validate and sanitize a table/collection name
function validateTableName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 63) {
    throw new Error(`Invalid table name: must be a non-empty string up to 63 characters`);
  }
  // Replace hyphens with underscores (common in MongoDB collection names)
  const sanitized = name.replace(/-/g, '_');
  if (!SAFE_IDENTIFIER_PATTERN.test(sanitized)) {
    throw new Error(`Invalid table name: "${name}" contains disallowed characters`);
  }
  return sanitized;
}


// Escape a PostgreSQL identifier (table name, index name) for use in double quotes
// PostgreSQL: double any internal double quotes
function escapeIdentifier(name) {
  return name.replace(/"/g, '""');
}

// Escape a string for use in single quotes (JSON path segments)
// PostgreSQL: double any internal single quotes
function escapeString(str) {
  return str.replace(/'/g, "''");
}

// Validate and format an integer (for LIMIT, OFFSET)
function validateInteger(value, name) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return num;
}

// Generate a MongoDB-style ObjectId-like string
function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

// =============================================================================
// Query Building (with validated inputs only)
//
// IMPORTANT: buildWhereClause and buildOperatorClause MUTATE the `params` array
// by pushing values onto it. The returned SQL string contains positional
// placeholders ($1, $2, etc.) that reference these array indices. The current
// length of `params` determines the next placeholder number.
//
// Correct usage:
//   const params = [];
//   const whereClause = buildWhereClause(query, params);
//   // params is now populated, whereClause contains matching $N references
//   await pool.query(`SELECT * FROM t WHERE ${whereClause}`, params);
//
// DO NOT reuse a params array across independent queries.
// =============================================================================

// Build a single JSON arrow step for a path part.
// Numeric parts (array indices) use -> N, string parts use -> 'name'.
function jsonArrow(part) {
  return /^\d+$/.test(part) ? `->${part}` : `->'${escapeString(part)}'`;
}

// Build JSON path for nested fields (returns jsonb)
function buildJsonPath(field, prefix = 'data') {
  const parts = field.split('.');
  let path = prefix;
  for (const part of parts) {
    path += jsonArrow(part);
  }
  return path;
}

// Build JSON text path for nested fields (returns text, not jsonb)
function buildJsonTextPath(field, prefix = 'data') {
  const parts = field.split('.');
  let path = prefix;
  for (let i = 0; i < parts.length - 1; i++) {
    path += jsonArrow(parts[i]);
  }
  // Last segment uses ->> for text extraction
  const last = parts[parts.length - 1];
  path += /^\d+$/.test(last) ? `->>${last}` : `->>'${escapeString(last)}'`;
  return path;
}

/**
 * Convert a MongoDB query object to a PostgreSQL WHERE clause.
 *
 * MUTATES `params` by pushing values for parameterized query placeholders.
 * The returned SQL references these values as $1, $2, etc., based on their
 * position in `params` at the time each value is added.
 *
 * @param {Object} query - MongoDB-style query object
 * @param {Array} params - Array to append parameter values to (MUTATED)
 * @param {string} [prefix='data'] - Column name prefix for JSONB access
 * @returns {string} SQL WHERE clause (without "WHERE" keyword)
 */
function buildWhereClause(query, params, prefix = 'data') {
  const conditions = [];

  for (const [key, value] of Object.entries(query || {})) {
    if (key === '$and') {
      if (!Array.isArray(value)) {
        throw new Error('$and must be an array');
      }
      const andConditions = value.map(subQuery => {
        const subClause = buildWhereClause(subQuery, params, prefix);
        return `(${subClause})`;
      });
      conditions.push(`(${andConditions.join(' AND ')})`);
    } else if (key === '$or') {
      if (!Array.isArray(value)) {
        throw new Error('$or must be an array');
      }
      const orConditions = value.map(subQuery => {
        const subClause = buildWhereClause(subQuery, params, prefix);
        return `(${subClause})`;
      });
      conditions.push(`(${orConditions.join(' OR ')})`);
    } else if (key === '_id') {
      // _id is a separate column, handle specially
      if (value instanceof RegExp) {
        params.push(value.source);
        const flags = value.ignoreCase ? '*' : '';
        conditions.push(`_id ~${flags} $${params.length}`);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        conditions.push(buildOperatorClause('_id', value, params, true));
      } else {
        params.push(value);
        conditions.push(`_id = $${params.length}`);
      }
    } else if (key.startsWith('$')) {
      throw new Error(`Unsupported top-level operator: ${key}`);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp)) {
      // Check if it's an operator object
      const keys = Object.keys(value);
      if (keys.some(k => k.startsWith('$'))) {
        conditions.push(buildOperatorClause(key, value, params, false));
      } else {
        // Nested object equality
        params.push(JSON.stringify(value));
        conditions.push(`${prefix}->>'${escapeString(key)}' = $${params.length}`);
      }
    } else if (value instanceof RegExp) {
      params.push(value.source);
      const flags = value.ignoreCase ? '*' : '';
      conditions.push(`${prefix}->>'${escapeString(key)}' ~${flags} $${params.length}`);
    } else {
      // Simple equality
      const jsonPath = buildJsonPath(key, prefix);
      params.push(JSON.stringify(value));
      // Handle both direct equality AND array containment (MongoDB behavior)
      // If the field is an array and contains the value, OR if it equals the value directly
      params.push(JSON.stringify([value]));
      conditions.push(`(${jsonPath} = $${params.length - 1}::jsonb OR (jsonb_typeof(${jsonPath}) = 'array' AND ${jsonPath} @> $${params.length}::jsonb))`);
    }
  }

  return conditions.length > 0 ? conditions.join(' AND ') : 'TRUE';
}

/**
 * Build SQL conditions for MongoDB query operators ($eq, $gt, $in, etc.).
 *
 * MUTATES `params` by pushing values for parameterized query placeholders.
 * Called by buildWhereClause for fields with operator objects.
 *
 * @param {string} field - Field name to apply operators to
 * @param {Object} operators - Object with MongoDB operators (e.g., { $gt: 5, $lt: 10 })
 * @param {Array} params - Array to append parameter values to (MUTATED)
 * @param {boolean} [isIdField=false] - True if operating on _id column directly
 * @returns {string} SQL condition string (e.g., "field > $1 AND field < $2")
 */
function buildOperatorClause(field, operators, params, isIdField = false) {
  const conditions = [];


  const jsonPath = isIdField ? '_id' : buildJsonPath(field);
  const jsonTextPath = isIdField ? '_id' : buildJsonTextPath(field);

  for (const [op, opValue] of Object.entries(operators)) {
    switch (op) {
      case '$eq':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id = $${params.length}`);
        } else {
          params.push(JSON.stringify(opValue));
          conditions.push(`${jsonPath} = $${params.length}::jsonb`);
        }
        break;

      case '$ne':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`(_id IS NULL OR _id != $${params.length})`);
        } else {
          params.push(JSON.stringify(opValue));
          conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} != $${params.length}::jsonb)`);
        }
        break;

      case '$gt':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id > $${params.length}`);
        } else if (opValue instanceof Date) {
          // Dates are stored as { "$date": "ISO string" } in UTC
          // Compare as text (ISO 8601 strings sort correctly) for index compatibility
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' > $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(${jsonTextPath})::numeric > $${params.length}`);
        }
        break;

      case '$gte':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id >= $${params.length}`);
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' >= $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(${jsonTextPath})::numeric >= $${params.length}`);
        }
        break;

      case '$lt':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id < $${params.length}`);
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' < $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(${jsonTextPath})::numeric < $${params.length}`);
        }
        break;

      case '$lte':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id <= $${params.length}`);
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' <= $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(${jsonTextPath})::numeric <= $${params.length}`);
        }
        break;

      case '$in':
        if (!Array.isArray(opValue)) {
          throw new Error('$in requires an array');
        }
        if (opValue.length === 0) {
          // $in with empty array matches nothing
          conditions.push('FALSE');
        } else if (isIdField) {
          const placeholders = opValue.map(v => {
            params.push(v);
            return `$${params.length}`;
          });
          conditions.push(`_id IN (${placeholders.join(', ')})`);
        } else {
          const hasNull = opValue.includes(null);
          const nonNullValues = opValue.filter(v => v !== null);
          const parts = [];
          if (nonNullValues.length > 0) {
            params.push(JSON.stringify(nonNullValues));
            const paramRef = `$${params.length}`;
            // Match scalar values directly
            parts.push(`${jsonPath} IN (SELECT jsonb_array_elements(${paramRef}::jsonb))`);
            // Also match if the field is an array that contains any of the values (MongoDB behavior)
            parts.push(`(jsonb_typeof(${jsonPath}) = 'array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(${jsonPath}) elem WHERE elem IN (SELECT jsonb_array_elements(${paramRef}::jsonb))))`);
          }
          if (hasNull) {
            parts.push(`${jsonPath} IS NULL`);
          }
          conditions.push(parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0]);
        }
        break;

      case '$nin':
        if (!Array.isArray(opValue)) {
          throw new Error('$nin requires an array');
        }
        if (opValue.length === 0) {
          // $nin with empty array matches everything
          conditions.push('TRUE');
        } else if (isIdField) {
          const placeholders = opValue.map(v => {
            params.push(v);
            return `$${params.length}`;
          });
          conditions.push(`(_id IS NULL OR _id NOT IN (${placeholders.join(', ')}))`);
        } else {
          const hasNull = opValue.includes(null);
          const nonNullValues = opValue.filter(v => v !== null);
          const parts = [];
          if (nonNullValues.length > 0) {
            params.push(JSON.stringify(nonNullValues));
            parts.push(`NOT ${jsonPath} IN (SELECT jsonb_array_elements($${params.length}::jsonb))`);
          }
          if (hasNull) {
            // $nin with null means exclude docs where field is null/missing
            parts.push(`${jsonPath} IS NOT NULL`);
          } else {
            // When null is NOT in $nin, still allow null/missing fields through
            parts.push(`${jsonPath} IS NULL`);
          }
          conditions.push(`(${parts.join(hasNull ? ' AND ' : ' OR ')})`);
        }
        break;

      case '$exists':
        if (isIdField) {
          conditions.push(opValue ? '_id IS NOT NULL' : '_id IS NULL');
        } else {
          conditions.push(opValue ? `${jsonPath} IS NOT NULL` : `${jsonPath} IS NULL`);
        }
        break;

      case '$not':
        if (typeof opValue !== 'object' || opValue === null) {
          throw new Error('$not requires an object');
        }
        const negatedClause = buildOperatorClause(field, opValue, params, isIdField);
        conditions.push(`NOT (${negatedClause})`);
        break;

      case '$regex':
        const pattern = opValue instanceof RegExp ? opValue.source : String(opValue);
        params.push(pattern);
        const regexOptions = operators.$options || '';
        const caseInsensitive = regexOptions.includes('i');
        if (isIdField) {
          conditions.push(`_id ~${caseInsensitive ? '*' : ''} $${params.length}`);
        } else {
          conditions.push(`${jsonTextPath} ~${caseInsensitive ? '*' : ''} $${params.length}`);
        }
        break;

      case '$options':
        // Handled with $regex, skip
        break;

      case '$all':
        if (!Array.isArray(opValue)) {
          throw new Error('$all requires an array');
        }
        params.push(JSON.stringify(opValue));
        conditions.push(`${jsonPath} @> $${params.length}::jsonb`);
        break;

      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  return conditions.join(' AND ');
}

// Build ORDER BY clause
function buildOrderBy(sort) {
  if (!sort || Object.keys(sort).length === 0) {
    return '';
  }

  const clauses = Object.entries(sort).map(([field, direction]) => {
    if (field === '_id') {
      return `_id ${direction === -1 ? 'DESC' : 'ASC'}`;
    }
    const jsonPath = buildJsonTextPath(field);
    return `${jsonPath} ${direction === -1 ? 'DESC' : 'ASC'}`;
  });

  return `ORDER BY ${clauses.join(', ')}`;
}

// =============================================================================
// Update Operations (in-memory, no SQL injection risk)
// =============================================================================

function applyUpdate(doc, update) {
  const result = { ...doc };

  for (const [op, fields] of Object.entries(update)) {
    switch (op) {
      case '$set':
        for (const [field, value] of Object.entries(fields)) {
          setNestedField(result, field, value);
        }
        break;
      case '$unset':
        for (const field of Object.keys(fields)) {
          unsetNestedField(result, field);
        }
        break;
      case '$inc':
        for (const [field, value] of Object.entries(fields)) {
          const current = getNestedField(result, field) || 0;
          setNestedField(result, field, current + value);
        }
        break;
      case '$push':
        for (const [field, value] of Object.entries(fields)) {
          const arr = getNestedField(result, field) || [];
          arr.push(value);
          setNestedField(result, field, arr);
        }
        break;
      case '$pull':
        for (const [field, value] of Object.entries(fields)) {
          const arr = getNestedField(result, field) || [];
          setNestedField(result, field, arr.filter(item => !deepEqual(item, value)));
        }
        break;
      case '$addToSet':
        for (const [field, value] of Object.entries(fields)) {
          const arr = getNestedField(result, field) || [];
          if (!arr.some(item => deepEqual(item, value))) {
            arr.push(value);
          }
          setNestedField(result, field, arr);
        }
        break;
      case '$currentDate':
        for (const [field, value] of Object.entries(fields)) {
          if (value === true || (value && value.$type === 'date')) {
            setNestedField(result, field, new Date());
          }
        }
        break;
      default:
        throw new Error(`Unsupported update operator: ${op}`);
    }
  }

  return result;
}

// Helper functions for nested field operations
function getNestedField(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedField(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function unsetNestedField(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null) return;
    current = current[parts[i]];
  }
  delete current[parts[parts.length - 1]];
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// =============================================================================
// Document Serialization (Date handling)
// =============================================================================

function serializeDocument(doc) {
  // Recursively convert Date objects to { $date: ... } BEFORE JSON.stringify
  // (JSON.stringify calls toJSON on Dates before the replacer sees them)
  function convertDatesToWrapper(obj) {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return { $date: obj.toISOString() };
    if (Array.isArray(obj)) return obj.map(convertDatesToWrapper);
    if (typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = convertDatesToWrapper(value);
      }
      return result;
    }
    return obj;
  }
  return JSON.stringify(convertDatesToWrapper(doc));
}

function deserializeDocument(data, id) {
  // data might be a string or object depending on pg configuration
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;

  // Recursively convert $date wrappers back to Date objects
  function convertDates(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj.$date) return new Date(obj.$date);
    if (Array.isArray(obj)) return obj.map(convertDates);
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertDates(value);
    }
    return result;
  }
  const doc = convertDates(parsed);
  doc._id = id;
  return doc;
}

// =============================================================================
// Projection (in-memory, no SQL injection risk)
// =============================================================================

function applyProjection(doc, projection) {
  if (!projection || Object.keys(projection).length === 0) {
    return doc;
  }

  const fields = Object.entries(projection);
  const isInclusion = fields.some(([k, v]) => v && k !== '_id');

  if (isInclusion) {
    const result = {};
    for (const [field, include] of fields) {
      if (include) {
        const value = getNestedField(doc, field);
        if (value !== undefined) {
          setNestedField(result, field, value);
        }
      }
    }
    // Always include _id unless explicitly excluded
    if (projection._id !== 0 && projection._id !== false) {
      result._id = doc._id;
    }
    return result;
  } else {
    const result = JSON.parse(JSON.stringify(doc));
    for (const [field, include] of fields) {
      if (!include) {
        unsetNestedField(result, field);
      }
    }
    return result;
  }
}

// =============================================================================
// Cursor Implementation
// =============================================================================

class PostgresCursor {
  constructor(collection, query, options = {}) {
    this._collection = collection;
    this._query = query;
    this._projection = options.projection || null;
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._cursorClient = null;
    this._cursorName = null;
    this._exhausted = false;
  }

  project(projection) {
    this._projection = projection;
    return this;
  }

  sort(sort) {
    this._sort = sort;
    return this;
  }

  limit(n) {
    this._limit = validateInteger(n, 'limit');
    return this;
  }

  skip(n) {
    this._skip = validateInteger(n, 'skip');
    return this;
  }

  clone() {
    const cloned = new PostgresCursor(this._collection, this._query);
    cloned._projection = this._projection;
    cloned._sort = this._sort;
    cloned._limit = this._limit;
    cloned._skip = this._skip;
    return cloned;
  }

  async toArray() {
    await this._collection._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._collection._tableName);
    const whereClause = buildWhereClause(this._query, params);
    const orderBy = buildOrderBy(this._sort);

    let sql = `SELECT _id, data FROM "${tableName}" WHERE ${whereClause} ${orderBy}`;

    if (this._limit != null) {
      sql += ` LIMIT ${this._limit}`;
    }
    if (this._skip != null) {
      sql += ` OFFSET ${this._skip}`;
    }

    const result = await this._collection._pool.query(sql, params);
    return result.rows.map(row => {
      const doc = deserializeDocument(row.data, row._id);
      return this._projection ? applyProjection(doc, this._projection) : doc;
    });
  }

  next(callback) {
    const promise = this._next();
    if (callback) {
      promise.then(doc => callback(null, doc), err => callback(err));
      return;
    }
    return promise;
  }

  async _next() {
    if (this._exhausted) {
      return null;
    }
    if (!this._cursorClient) {
      await this._collection._ensureTable();
      this._cursorClient = await this._collection._pool.connect();
      this._cursorName = `cur_${generateId()}`;

      const params = [];
      const tableName = escapeIdentifier(this._collection._tableName);
      const whereClause = buildWhereClause(this._query, params);
      const orderBy = buildOrderBy(this._sort);

      let sql = `SELECT _id, data FROM "${tableName}" WHERE ${whereClause} ${orderBy}`;
      if (this._limit != null) {
        sql += ` LIMIT ${this._limit}`;
      }
      if (this._skip != null) {
        sql += ` OFFSET ${this._skip}`;
      }

      const escapedCursorName = escapeIdentifier(this._cursorName);
      await this._cursorClient.query('BEGIN');
      await this._cursorClient.query(
        `DECLARE "${escapedCursorName}" CURSOR FOR ${sql}`,
        params
      );
    }

    const escapedCursorName = escapeIdentifier(this._cursorName);
    const result = await this._cursorClient.query(
      `FETCH NEXT FROM "${escapedCursorName}"`
    );

    if (result.rows.length === 0) {
      this._exhausted = true;
      await this._cursorClient.query('COMMIT');
      this._cursorClient.release();
      this._cursorClient = null;
      return null;
    }

    const row = result.rows[0];
    const doc = deserializeDocument(row.data, row._id);
    return this._projection ? applyProjection(doc, this._projection) : doc;
  }

  async close() {
    if (this._cursorClient) {
      const escapedCursorName = escapeIdentifier(this._cursorName);
      await this._cursorClient.query(`CLOSE "${escapedCursorName}"`);
      await this._cursorClient.query('COMMIT');
      this._cursorClient.release();
      this._cursorClient = null;
      this._exhausted = true;
    }
  }

  async count() {
    await this._collection._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._collection._tableName);
    const whereClause = buildWhereClause(this._query, params);
    const sql = `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`;
    const result = await this._collection._pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }
}

// =============================================================================
// Aggregation Cursor (in-memory processing)
// =============================================================================

class PostgresAggregationCursor {
  constructor(collection, pipeline) {
    this._collection = collection;
    this._pipeline = pipeline;
  }

  async toArray() {
    let docs = await this._collection.find({}).toArray();

    for (const stage of this._pipeline) {
      const [op, value] = Object.entries(stage)[0];

      switch (op) {
        case '$match':
          docs = docs.filter(doc => matchesQuery(doc, value));
          break;
        case '$group':
          docs = this._processGroup(docs, value);
          break;
        case '$project':
          docs = docs.map(doc => applyProjection(doc, value));
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
      } else {
        groupKey = groupField;
      }

      const keyStr = JSON.stringify(groupKey);
      if (!groups.has(keyStr)) {
        groups.set(keyStr, { _id: groupKey, docs: [] });
      }
      groups.get(keyStr).docs.push(doc);
    }

    const results = [];
    for (const [, group] of groups) {
      const result = { _id: group._id };

      for (const [field, expr] of Object.entries(groupSpec)) {
        if (field === '_id') continue;

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
          const values = group.docs.map(doc => getNestedField(doc, avgField)).filter(v => v != null);
          result[field] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
        } else if (expr.$first) {
          const firstField = expr.$first.substring(1);
          result[field] = group.docs.length > 0 ? getNestedField(group.docs[0], firstField) : null;
        } else if (expr.$last) {
          const lastField = expr.$last.substring(1);
          result[field] = group.docs.length > 0 ? getNestedField(group.docs[group.docs.length - 1], lastField) : null;
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
      for (const [field, direction] of Object.entries(sortSpec)) {
        const aVal = getNestedField(a, field);
        const bVal = getNestedField(b, field);

        if (aVal < bVal) return direction === -1 ? 1 : -1;
        if (aVal > bVal) return direction === -1 ? -1 : 1;
      }
      return 0;
    });
  }
}

// In-memory query matching for aggregation $match
function matchesQuery(doc, query) {
  for (const [key, value] of Object.entries(query)) {
    if (key === '$and') {
      if (!value.every(subQuery => matchesQuery(doc, subQuery))) return false;
    } else if (key === '$or') {
      if (!value.some(subQuery => matchesQuery(doc, subQuery))) return false;
    } else {
      const docValue = key === '_id' ? doc._id : getNestedField(doc, key);

      if (typeof value === 'object' && value !== null && !(value instanceof Date) && !(value instanceof RegExp)) {
        for (const [op, opValue] of Object.entries(value)) {
          switch (op) {
            case '$eq': if (!deepEqual(docValue, opValue)) return false; break;
            case '$ne': if (deepEqual(docValue, opValue)) return false; break;
            case '$gt': if (!(docValue > opValue)) return false; break;
            case '$gte': if (!(docValue >= opValue)) return false; break;
            case '$lt': if (!(docValue < opValue)) return false; break;
            case '$lte': if (!(docValue <= opValue)) return false; break;
            case '$in': if (!opValue.includes(docValue)) return false; break;
            case '$nin': if (opValue.includes(docValue)) return false; break;
            case '$exists': if ((docValue !== undefined) !== opValue) return false; break;
          }
        }
      } else if (Array.isArray(docValue)) {
        if (!docValue.some(item => deepEqual(item, value))) return false;
      } else {
        if (!deepEqual(docValue, value)) return false;
      }
    }
  }
  return true;
}

// =============================================================================
// Collection Implementation
// =============================================================================

class PostgresCollection {
  constructor(db, name) {
    this._db = db;
    this._pool = db._pool;
    // Prefix table name with database name to support multiple "databases" in one PostgreSQL db
    const dbPrefix = validateTableName(db._name);
    const collName = validateTableName(name);
    this._tableName = `${dbPrefix}_${collName}`;
    this._name = name;
    this._indexes = new Map();
    this._initialized = false;
  }

  get collectionName() {
    return this._name;
  }

  get name() {
    return this._name;
  }

  async _ensureTable() {
    if (this._initialized) return;

    const tableName = escapeIdentifier(this._tableName);
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        _id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      )
    `);
    this._initialized = true;
  }

  async insertOne(doc) {
    await this._ensureTable();

    const id = doc._id != null ? String(doc._id) : generateId();
    const docWithoutId = { ...doc };
    delete docWithoutId._id;

    const tableName = escapeIdentifier(this._tableName);
    try {
      await this._pool.query(
        `INSERT INTO "${tableName}" (_id, data) VALUES ($1, $2)`,
        [id, serializeDocument(docWithoutId)]
      );
      return { acknowledged: true, insertedId: id };
    } catch (e) {
      if (e.code === '23505') {
        const error = new Error(`Duplicate key error: _id "${id}" already exists`);
        error.code = 11000;
        throw error;
      }
      throw e;
    }
  }

  async insertMany(docs) {
    await this._ensureTable();

    const insertedIds = {};
    let insertedCount = 0;

    for (let i = 0; i < docs.length; i++) {
      const result = await this.insertOne(docs[i]);
      insertedIds[i] = result.insertedId;
      insertedCount++;
    }

    return { acknowledged: true, insertedCount, insertedIds };
  }

  async findOne(query, options = {}) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);
    const sql = `SELECT _id, data FROM "${tableName}" WHERE ${whereClause} LIMIT 1`;

    const result = await this._pool.query(sql, params);
    if (result.rows.length === 0) return null;

    const doc = deserializeDocument(result.rows[0].data, result.rows[0]._id);
    return options.projection ? applyProjection(doc, options.projection) : doc;
  }

  find(query) {
    return new PostgresCursor(this, query);
  }

  async updateOne(query, update, options = {}) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id, data FROM "${tableName}" WHERE ${whereClause} LIMIT 1`;
    const selectResult = await this._pool.query(selectSql, params);

    if (selectResult.rows.length === 0) {
      if (options.upsert) {
        let newDoc = {};
        if (query._id) {
          newDoc._id = query._id;
        }
        newDoc = applyUpdate(newDoc, update);
        const insertResult = await this.insertOne(newDoc);
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedId: insertResult.insertedId,
          upsertedCount: 1,
          result: { nModified: 0, n: 1 }
        };
      }
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, result: { nModified: 0, n: 0 } };
    }

    const existing = deserializeDocument(selectResult.rows[0].data, selectResult.rows[0]._id);
    const updated = applyUpdate(existing, update);
    const { _id, ...dataWithoutId } = updated;

    await this._pool.query(
      `UPDATE "${tableName}" SET data = $1 WHERE _id = $2`,
      [serializeDocument(dataWithoutId), selectResult.rows[0]._id]
    );

    return { acknowledged: true, matchedCount: 1, modifiedCount: 1, result: { nModified: 1, n: 1 } };
  }

  async updateMany(query, update, options = {}) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id, data FROM "${tableName}" WHERE ${whereClause}`;
    const selectResult = await this._pool.query(selectSql, params);

    if (selectResult.rows.length === 0) {
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0, result: { nModified: 0, n: 0 } };
    }

    let modifiedCount = 0;
    for (const row of selectResult.rows) {
      const existing = deserializeDocument(row.data, row._id);
      const updated = applyUpdate(existing, update);
      const { _id, ...dataWithoutId } = updated;

      await this._pool.query(
        `UPDATE "${tableName}" SET data = $1 WHERE _id = $2`,
        [serializeDocument(dataWithoutId), row._id]
      );
      modifiedCount++;
    }

    return { acknowledged: true, matchedCount: selectResult.rows.length, modifiedCount, result: { nModified: modifiedCount, n: selectResult.rows.length } };
  }

  async replaceOne(query, replacement, options = {}) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id FROM "${tableName}" WHERE ${whereClause} LIMIT 1`;
    const selectResult = await this._pool.query(selectSql, params);

    if (selectResult.rows.length === 0) {
      if (options.upsert) {
        const result = await this.insertOne(replacement);
        return {
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedId: result.insertedId,
          upsertedCount: 1
        };
      }
      return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    }

    const { _id, ...dataWithoutId } = replacement;
    await this._pool.query(
      `UPDATE "${tableName}" SET data = $1 WHERE _id = $2`,
      [serializeDocument(dataWithoutId), selectResult.rows[0]._id]
    );

    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(query) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);

    const result = await this._pool.query(
      `DELETE FROM "${tableName}" WHERE _id IN (
        SELECT _id FROM "${tableName}" WHERE ${whereClause} LIMIT 1
      )`,
      params
    );

    return { acknowledged: true, deletedCount: result.rowCount };
  }

  async deleteMany(query) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);

    const result = await this._pool.query(
      `DELETE FROM "${tableName}" WHERE ${whereClause}`,
      params
    );

    return { acknowledged: true, deletedCount: result.rowCount };
  }

  // Legacy MongoDB method aliases used by ApostropheCMS
  async remove(query) {
    return this.deleteMany(query);
  }

  async removeOne(query) {
    return this.deleteOne(query);
  }

  async removeMany(query) {
    return this.deleteMany(query);
  }

  async countDocuments(query = {}) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);
    const sql = `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`;

    const result = await this._pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  async distinct(field, query = {}) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);

    if (field === '_id') {
      const sql = `SELECT DISTINCT _id as value FROM "${tableName}" WHERE ${whereClause}`;
      const result = await this._pool.query(sql, params);
      return result.rows.map(row => row.value).filter(v => v !== null);
    }

    const jsonPath = buildJsonPath(field);
    // MongoDB's distinct() automatically flattens arrays.
    // Use LATERAL with jsonb_array_elements to unwind array values,
    // and fall back to the value itself for scalars.
    const sql = `SELECT DISTINCT elem as value FROM "${tableName}", LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(${jsonPath}) = 'array' THEN ${jsonPath} ELSE jsonb_build_array(${jsonPath}) END
    ) AS elem WHERE ${whereClause} AND ${jsonPath} IS NOT NULL`;
    const result = await this._pool.query(sql, params);

    return result.rows
      .map(row => {
        const v = row.value;
        if (v === null) return null;
        // jsonb values come back as objects/strings, deserialize them
        if (typeof v === 'string') {
          try { return JSON.parse(v); } catch { return v; }
        }
        // jsonb primitives may come through as native types
        return v;
      })
      .filter(v => v !== null);
  }

  aggregate(pipeline) {
    return new PostgresAggregationCursor(this, pipeline);
  }

  async bulkWrite(operations) {
    await this._ensureTable();

    let insertedCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;
    let upsertedCount = 0;
    const insertedIds = {};
    const upsertedIds = {};

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      if (op.insertOne) {
        const result = await this.insertOne(op.insertOne.document);
        insertedIds[i] = result.insertedId;
        insertedCount++;
      } else if (op.updateOne) {
        const result = await this.updateOne(
          op.updateOne.filter,
          op.updateOne.update,
          { upsert: op.updateOne.upsert }
        );
        modifiedCount += result.modifiedCount;
        if (result.upsertedId) {
          upsertedIds[i] = result.upsertedId;
          upsertedCount++;
        }
      } else if (op.updateMany) {
        const result = await this.updateMany(
          op.updateMany.filter,
          op.updateMany.update,
          { upsert: op.updateMany.upsert }
        );
        modifiedCount += result.modifiedCount;
      } else if (op.deleteOne) {
        const result = await this.deleteOne(op.deleteOne.filter);
        deletedCount += result.deletedCount;
      } else if (op.deleteMany) {
        const result = await this.deleteMany(op.deleteMany.filter);
        deletedCount += result.deletedCount;
      } else if (op.replaceOne) {
        const result = await this.replaceOne(
          op.replaceOne.filter,
          op.replaceOne.replacement,
          { upsert: op.replaceOne.upsert }
        );
        modifiedCount += result.modifiedCount;
        if (result.upsertedId) {
          upsertedIds[i] = result.upsertedId;
          upsertedCount++;
        }
      }
    }

    return {
      acknowledged: true,
      insertedCount,
      modifiedCount,
      deletedCount,
      upsertedCount,
      insertedIds,
      upsertedIds
    };
  }

  async findOneAndUpdate(query, update, options = {}) {
    await this._ensureTable();

    const params = [];
    const tableName = escapeIdentifier(this._tableName);
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id, data FROM "${tableName}" WHERE ${whereClause} LIMIT 1`;
    const selectResult = await this._pool.query(selectSql, params);

    if (selectResult.rows.length === 0) {
      if (options.upsert) {
        let newDoc = {};
        if (query._id) {
          newDoc._id = query._id;
        }
        newDoc = applyUpdate(newDoc, update);
        await this.insertOne(newDoc);
        return options.returnDocument === 'after' ? newDoc : null;
      }
      return null;
    }

    const existing = deserializeDocument(selectResult.rows[0].data, selectResult.rows[0]._id);
    const updated = applyUpdate(existing, update);
    const { _id, ...dataWithoutId } = updated;

    await this._pool.query(
      `UPDATE "${tableName}" SET data = $1 WHERE _id = $2`,
      [serializeDocument(dataWithoutId), selectResult.rows[0]._id]
    );

    return options.returnDocument === 'after' ? updated : existing;
  }

  /**
   * Create an index on one or more fields.
   *
   * @param {Object} keys - Fields to index, e.g. { fieldName: 1 } or { fieldName: -1 }
   * @param {Object} options - Index options
   * @param {string} [options.name] - Custom index name
   * @param {boolean} [options.unique] - Create a unique index
   * @param {boolean} [options.sparse] - Create a sparse/partial index (only index docs where field exists)
   * @param {string} [options.type] - Field type for range query optimization:
   *   - 'number': Creates expression index on numeric cast, enables efficient $gt/$lt on numbers
   *   - 'date': Creates expression index on date extraction, enables efficient $gt/$lt on dates
   *   - undefined (default): Text index, efficient for $eq, $in, $regex, and text equality
   *
   * IMPORTANT: The `type` option is required for PostgreSQL to efficiently use indexes
   * on range queries ($gt, $gte, $lt, $lte). Without it, the index expression won't match
   * the query expression. MongoDB ignores this option (it handles types automatically).
   *
   * @example
   * // Text/equality index (default) - efficient for $eq, $in, $regex
   * await collection.createIndex({ slug: 1 });
   *
   * // Numeric index - efficient for $gt, $lt on numbers
   * await collection.createIndex({ price: 1 }, { type: 'number' });
   *
   * // Date index - efficient for $gt, $lt on dates
   * await collection.createIndex({ createdAt: 1 }, { type: 'date' });
   *
   * // Unique sparse date index
   * await collection.createIndex({ publishedAt: 1 }, { type: 'date', unique: true, sparse: true });
   */
  async createIndex(keys, options = {}) {
    await this._ensureTable();

    const keyEntries = Object.entries(keys);
    const indexType = options.type; // 'number', 'date', or undefined (text)

    // Helper to build JSON path expression for index (handles nested fields like 'user.name')
    // The type parameter determines the expression for range query optimization
    const buildIndexPath = (field, type) => {
      const parts = field.split('.');

      if (type === 'date') {
        // Dates are stored as { $date: "ISO string" } in UTC
        // ISO 8601 strings sort correctly as text (YYYY-MM-DDTHH:MM:SS.sssZ format)
        // We index the raw text because timestamp casts aren't IMMUTABLE in PostgreSQL
        let path = 'data';
        for (const part of parts) {
          path += `->'${escapeString(part)}'`;
        }
        // Extract $date text value (no cast - text sorts correctly for ISO dates)
        return `${path}->>'$date'`;
      }

      if (type === 'number') {
        // Build path to extract text and cast to numeric
        let path = 'data';
        if (parts.length === 1) {
          path = `data->>'${escapeString(parts[0])}'`;
        } else {
          for (let i = 0; i < parts.length - 1; i++) {
            path += `->'${escapeString(parts[i])}'`;
          }
          path += `->>'${escapeString(parts[parts.length - 1])}'`;
        }
        return `(${path})::numeric`;
      }

      // Default: text extraction for equality/text queries
      if (parts.length === 1) {
        return `data->>'${escapeString(parts[0])}'`;
      }
      // For nested: data->'user'->>'name'
      let path = 'data';
      for (let i = 0; i < parts.length - 1; i++) {
        path += `->'${escapeString(parts[i])}'`;
      }
      path += `->>'${escapeString(parts[parts.length - 1])}'`;
      return path;
    };

    // Helper to build JSON path for existence check (returns jsonb, not text)
    const buildIndexPathJsonb = (field) => {
      const parts = field.split('.');
      let path = 'data';
      for (const part of parts) {
        path += `->'${escapeString(part)}'`;
      }
      return path;
    };

    // Generate a safe index name
    const safeFieldNames = keyEntries.map(([k]) => k.replace(/[^a-zA-Z0-9]/g, '_')).join('_');
    const indexName = options.name
      ? validateTableName(options.name)
      : `idx_${this._tableName}_${safeFieldNames}`.substring(0, 63);

    // Store index metadata
    this._indexes.set(indexName, { keys, options });

    const tableName = escapeIdentifier(this._tableName);
    const escapedIndexName = escapeIdentifier(indexName);

    // Build WHERE clause for sparse indexes (PostgreSQL partial index)
    let whereClause = '';
    if (options.sparse) {
      const sparseConditions = keyEntries.map(([field]) => {
        if (field === '_id') {
          return '_id IS NOT NULL';
        }
        return `${buildIndexPathJsonb(field)} IS NOT NULL`;
      });
      whereClause = ` WHERE ${sparseConditions.join(' AND ')}`;
    }

    // Handle text indexes (full-text search, always uses text extraction)
    const hasTextIndex = keyEntries.some(([, v]) => v === 'text');
    if (hasTextIndex) {
      const textFields = keyEntries.filter(([, v]) => v === 'text').map(([k]) => k);
      const tsvectorExpr = textFields
        .map(f => `coalesce(${buildIndexPath(f, null)}, '')`)
        .join(" || ' ' || ");

      await this._pool.query(`
        CREATE INDEX IF NOT EXISTS "${escapedIndexName}"
        ON "${tableName}"
        USING gin(to_tsvector('english', ${tsvectorExpr}))${whereClause}
      `);
      return indexName;
    }

    // Handle unique constraint
    if (options.unique) {
      const indexExprs = keyEntries.map(([field]) => {
        return field === '_id' ? '_id' : `(${buildIndexPath(field, indexType)})`;
      });

      await this._pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "${escapedIndexName}"
        ON "${tableName}" (${indexExprs.join(', ')})${whereClause}
      `);
      return indexName;
    }

    // Handle regular indexes (single or compound)
    const indexExprs = keyEntries.map(([field, direction]) => {
      if (field === '_id') {
        return `_id ${direction === -1 ? 'DESC' : 'ASC'}`;
      }
      return `(${buildIndexPath(field, indexType)}) ${direction === -1 ? 'DESC' : 'ASC'}`;
    });

    await this._pool.query(`
      CREATE INDEX IF NOT EXISTS "${escapedIndexName}"
      ON "${tableName}" (${indexExprs.join(', ')})${whereClause}
    `);

    return indexName;
  }

  async dropIndex(indexName) {
    const safeIndexName = validateTableName(indexName);
    this._indexes.delete(safeIndexName);
    const escapedIndexName = escapeIdentifier(safeIndexName);
    await this._pool.query(`DROP INDEX IF EXISTS "${escapedIndexName}"`);
  }

  async indexes() {
    await this._ensureTable();

    const result = await this._pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = $1
    `, [this._tableName]);

    const indexes = [{
      name: '_id_',
      key: { _id: 1 },
      unique: true
    }];

    for (const row of result.rows) {
      if (row.indexname === `${this._tableName}_pkey`) continue;

      const storedIndex = this._indexes.get(row.indexname);
      if (storedIndex) {
        indexes.push({
          name: row.indexname,
          key: storedIndex.keys,
          unique: storedIndex.options.unique || false
        });
      } else {
        indexes.push({
          name: row.indexname,
          key: {},
          unique: row.indexdef.includes('UNIQUE')
        });
      }
    }

    return indexes;
  }

  async indexInformation() {
    const indexes = await this.indexes();
    const info = {};
    for (const idx of indexes) {
      info[idx.name] = Object.entries(idx.key).map(([k, v]) => [k, v]);
    }
    return info;
  }

  async drop() {
    const tableName = escapeIdentifier(this._tableName);
    await this._pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
    this._initialized = false;
    this._indexes.clear();
  }

  async rename(newName) {
    const oldName = this._name;
    const dbPrefix = validateTableName(this._db._name);
    const newCollName = validateTableName(newName);
    const newTableName = `${dbPrefix}_${newCollName}`;
    const oldTableName = escapeIdentifier(this._tableName);
    const escapedNewTableName = escapeIdentifier(newTableName);
    await this._pool.query(`ALTER TABLE "${oldTableName}" RENAME TO "${escapedNewTableName}"`);

    // Update internal state
    this._tableName = newTableName;
    this._name = newName;

    // Update the database's collection cache
    this._db._collections.delete(oldName);
    this._db._collections.set(newName, this);
  }
}

// =============================================================================
// Database Implementation
// =============================================================================

class PostgresDb {
  constructor(client, name) {
    this._client = client;
    this._pool = client._pool;
    this._name = name;
    this.databaseName = name;
    this._collections = new Map();
  }

  collection(name) {
    if (!this._collections.has(name)) {
      this._collections.set(name, new PostgresCollection(this, name));
    }
    return this._collections.get(name);
  }

  async createCollection(name) {
    const col = this.collection(name);
    await col._ensureTable();
    return col;
  }

  async dropDatabase() {
    const dbName = this._name;
    if (!dbName) {
      return;
    }
    // Close the current pool (can't drop a database with active connections)
    this._client._poolEnded = true;
    await this._client._pool.end();
    // Connect to the admin 'postgres' database to drop the target
    const adminUrl = new URL(this._client._uri);
    adminUrl.pathname = '/postgres';
    const adminPool = new Pool({
      connectionString: adminUrl.toString(),
      ...this._client._options
    });
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS "${escapeIdentifier(dbName)}" WITH (FORCE)`);
    } finally {
      await adminPool.end();
    }
  }

  listCollections() {
    const self = this;
    const dbPrefix = validateTableName(this._name) + '_';
    return {
      async toArray() {
        const result = await self._pool.query(`
          SELECT tablename as name
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename LIKE $1
        `, [dbPrefix + '%']);
        // Strip the database prefix from returned names
        return result.rows.map(row => ({
          name: row.name.substring(dbPrefix.length)
        }));
      }
    };
  }
}

// =============================================================================
// Client Implementation
// =============================================================================

class PostgresClient {
  constructor(pool, defaultDb, uri, options) {
    this._pool = pool;
    this._defaultDb = defaultDb;
    this._uri = uri;
    this._options = options;
    this._databases = new Map();
  }

  db(name) {
    const dbName = name || this._defaultDb;
    if (!this._databases.has(dbName)) {
      this._databases.set(dbName, new PostgresDb(this, dbName));
    }
    return this._databases.get(dbName);
  }

  async close() {
    if (!this._poolEnded) {
      this._poolEnded = true;
      await this._pool.end();
    }
  }
}

// =============================================================================
// Module Export
// =============================================================================

module.exports = {
  name: 'postgres',
  // Native protocol schemes for this adapter
  protocols: ['postgres', 'postgresql'],

  /**
   * Connect to PostgreSQL and return a client with MongoDB-compatible interface.
   *
   * @param {string} uri - PostgreSQL connection URI (e.g., 'postgres://user:pass@localhost:5432/mydb')
   * @param {Object} [options={}] - Additional pg Pool options (not duplicating URI params)
   * @returns {Promise<PostgresClient>} Client with db(), close() methods
   */
  async connect(uri, options = {}) {
    // Parse URI to extract database name for the client
    const url = new URL(uri);
    const database = url.pathname.slice(1) || undefined;

    let pool = new Pool({
      connectionString: uri,
      ...options
    });

    // Test connection, creating the database if it doesn't exist
    // (matching MongoDB's implicit database creation behavior)
    try {
      await pool.query('SELECT 1');
    } catch (e) {
      // 3D000 = invalid_catalog_name (database does not exist)
      if (e.code === '3D000' && database) {
        await pool.end();
        // Connect to the default 'postgres' database to create the target
        const adminUrl = new URL(uri);
        adminUrl.pathname = '/postgres';
        const adminPool = new Pool({
          connectionString: adminUrl.toString(),
          ...options
        });
        try {
          // Database names are validated by validateTableName rules upstream,
          // but use escapeIdentifier for the CREATE DATABASE statement
          await adminPool.query(`CREATE DATABASE "${escapeIdentifier(database)}"`);
        } catch (createErr) {
          // 42P04 = duplicate_database (another process just created it, that's fine)
          if (createErr.code !== '42P04') {
            throw createErr;
          }
        } finally {
          await adminPool.end();
        }
        // Reconnect to the now-existing database
        pool = new Pool({
          connectionString: uri,
          ...options
        });
        await pool.query('SELECT 1');
      } else {
        throw e;
      }
    }

    return new PostgresClient(pool, database, uri, options);
  }
};
