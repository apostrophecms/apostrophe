// SQLite Adapter for MongoDB-compatible interface
// Stores documents as JSON text with _id as primary key
// Uses better-sqlite3 for synchronous, high-performance SQLite access

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const {
  serializeValue,
  serializeDocument,
  deserializeDocument,
  getNestedField,
  setNestedField,
  deepEqual,
  applyProjection,
  applyUpdate
} = require('../lib/shared');

// =============================================================================
// SECURITY: Input Validation and Escaping
// =============================================================================

const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateTableName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 63) {
    throw new Error('Invalid table name: must be a non-empty string up to 63 characters');
  }
  const sanitized = name.replace(/-/g, '_');
  if (!SAFE_IDENTIFIER_PATTERN.test(sanitized)) {
    throw new Error(`Invalid table name: "${name}" contains disallowed characters`);
  }
  return sanitized;
}

function escapeIdentifier(name) {
  return name.replace(/"/g, '""');
}

function escapeString(str) {
  return str.replace(/'/g, '\'\'');
}

// Convert a dot-path like "body.items.0.sublabel" to a SQLite JSON path
// like "$.body.items[0].sublabel". Numeric segments become array indices.
function toJsonPath(dotPath) {
  return '$.' + dotPath.split('.').map(p =>
    /^\d+$/.test(p) ? `[${p}]` : escapeString(p)
  ).join('.').replace(/\.\[/g, '[');
}

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
// SQLite Duplicate Key Error
// =============================================================================

function makeDuplicateKeyError(sqliteError, collection, doc) {
  const message = 'Duplicate key error: already exists';
  const error = new Error(message);
  error.code = 11000;
  if (sqliteError.message) {
    // For _id primary key: "UNIQUE constraint failed: tablename._id"
    const colMatch = sqliteError.message.match(/UNIQUE constraint failed:\s*\S+\.(\S+)/);
    if (colMatch && colMatch[1] === '_id') {
      error.keyValue = { _id: doc ? doc._id : null };
    }
    // For expression indexes: "UNIQUE constraint failed: index 'indexname'"
    const idxMatch = sqliteError.message.match(/UNIQUE constraint failed:\s*index '([^']+)'/);
    if (idxMatch && collection && collection._indexes) {
      const indexMeta = collection._indexes.get(idxMatch[1]);
      if (indexMeta && indexMeta.keys) {
        error.keyValue = {};
        for (const field of Object.keys(indexMeta.keys)) {
          error.keyValue[field] = doc ? getNestedField(doc, field) : null;
        }
      }
    }
  }
  return error;
}

// =============================================================================
// Query Building for SQLite
// =============================================================================

// Build a json_extract path for a field: json_extract(data, '$.field.nested')
function buildJsonExtractPath(field) {
  const parts = field.split('.');
  let path = '$';
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      // Array index — no dot before bracket notation
      path += `[${p}]`;
    } else {
      path += `.${p.replace(/'/g, '\'\'')}`;
    }
  }
  return `'${path}'`;
}

// Build full json_extract expression
function buildJsonExtract(field, prefix = 'data') {
  return `json_extract(${prefix}, ${buildJsonExtractPath(field)})`;
}

/**
 * Convert a MongoDB query object to a SQLite WHERE clause.
 *
 * MUTATES `params` by pushing values for parameterized query placeholders.
 * The returned SQL string contains ? placeholders.
 */
function buildWhereClause(query, params, prefix = 'data', options = {}) {
  const conditions = [];

  for (const [ key, value ] of Object.entries(query || {})) {
    if (key === '$and') {
      if (!Array.isArray(value)) {
        throw new Error('$and must be an array');
      }
      const andConditions = value.map(subQuery => {
        const subClause = buildWhereClause(subQuery, params, prefix, options);
        return `(${subClause})`;
      });
      conditions.push(`(${andConditions.join(' AND ')})`);
    } else if (key === '$or') {
      if (!Array.isArray(value)) {
        throw new Error('$or must be an array');
      }
      const orConditions = value.map(subQuery => {
        const subClause = buildWhereClause(subQuery, params, prefix, options);
        return `(${subClause})`;
      });
      conditions.push(`(${orConditions.join(' OR ')})`);
    } else if (key === '$text') {
      const searchTerm = value.$search;
      if (typeof searchTerm !== 'string') {
        throw new Error('$text.$search must be a string');
      }
      const words = searchTerm.trim().split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) {
        conditions.push('0');
      } else if (options.ftsTable) {
        // FTS5 search: match against the virtual table by rowid
        // FTS5 query: OR the words together for MongoDB-compatible semantics
        const ftsQuery = words.map(w => `"${w.replace(/"/g, '""')}"`).join(' OR ');
        params.push(ftsQuery);
        const rowidRef = options.mainTable ? `${options.mainTable}.rowid` : 'rowid';
        conditions.push(
          `${rowidRef} IN (SELECT rowid FROM ${options.ftsTable} WHERE ${options.ftsTable} MATCH ?)`
        );
      } else {
        // Fallback LIKE-based search when no FTS5 table exists
        const fieldNames = options.textFields || [
          'highSearchText', 'lowSearchText', 'title', 'searchBoost'
        ];
        const textFields = fieldNames.map(f => {
          const jsonPath = '$.' + f.split('.').map(p => escapeString(p)).join('.');
          return `COALESCE(json_extract(${prefix}, '${jsonPath}'), '')`;
        });
        const textExpr = textFields.join(' || \' \' || ');
        const wordConditions = words.map(w => {
          params.push(`%${w}%`);
          return `(${textExpr}) LIKE ?`;
        });
        conditions.push(`(${wordConditions.join(' OR ')})`);
      }
    } else if (key === '_id') {
      if (value instanceof RegExp) {
        params.push(value.source);
        if (value.ignoreCase) {
          conditions.push('regexp_i(?, _id)');
        } else {
          conditions.push('regexp(?, _id)');
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        conditions.push(buildOperatorClause('_id', value, params, true));
      } else {
        params.push(value);
        conditions.push('_id = ?');
      }
    } else if (key.startsWith('$')) {
      throw new Error(`Unsupported top-level operator: ${key}`);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp)) {
      const keys = Object.keys(value);
      if (keys.some(k => k.startsWith('$'))) {
        conditions.push(buildOperatorClause(key, value, params, false));
      } else {
        // Nested object equality
        params.push(JSON.stringify(value));
        conditions.push(`json_extract(${prefix}, '$.${escapeString(key)}') = ?`);
      }
    } else if (value instanceof RegExp) {
      const jsonExtract = buildJsonExtract(key, prefix);
      params.push(value.source);
      if (value.ignoreCase) {
        // Match scalar text OR any element of an array (MongoDB behavior)
        conditions.push(`(regexp_i(?, ${jsonExtract}) OR (json_type(${prefix}, ${buildJsonExtractPath(key)}) = 'array' AND EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE regexp_i(?, value))))`);
        // Push the pattern again for the array branch
        params.push(value.source);
      } else {
        conditions.push(`(regexp(?, ${jsonExtract}) OR (json_type(${prefix}, ${buildJsonExtractPath(key)}) = 'array' AND EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE regexp(?, value))))`);
        params.push(value.source);
      }
    } else if (value === null || value === undefined) {
      // MongoDB: { field: null } and { field: undefined } both match
      // explicit null AND missing field
      const jsonExtract = buildJsonExtract(key, prefix);
      conditions.push(`(${jsonExtract} IS NULL OR json_type(${prefix}, ${buildJsonExtractPath(key)}) = 'null')`);
    } else {
      // Simple equality: handle both scalar equality AND array-contains-scalar
      const jsonExtract = buildJsonExtract(key, prefix);
      const serialized = serializeValue(value);
      if (typeof serialized === 'boolean') {
        // SQLite json_extract returns 1/0 for boolean
        const boolVal = serialized ? 1 : 0;
        params.push(boolVal);
        params.push(JSON.stringify(serialized));
        conditions.push(`(${jsonExtract} = ? OR (json_type(${prefix}, ${buildJsonExtractPath(key)}) = 'array' AND EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE value = ?)))`);
      } else if (typeof serialized === 'object' && serialized !== null) {
        // Date or nested object
        params.push(JSON.stringify(serialized));
        params.push(JSON.stringify(serialized));
        conditions.push(`(json(${jsonExtract}) = json(?) OR (json_type(${prefix}, ${buildJsonExtractPath(key)}) = 'array' AND EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE json(value) = json(?))))`);
      } else {
        params.push(serialized);
        params.push(serialized);
        conditions.push(`(${jsonExtract} = ? OR (json_type(${prefix}, ${buildJsonExtractPath(key)}) = 'array' AND EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE value = ?)))`);
      }
    }
  }

  return conditions.length > 0 ? conditions.join(' AND ') : '1';
}

/**
 * Build SQL conditions for MongoDB query operators.
 */
function buildOperatorClause(field, operators, params, isIdField = false) {
  const conditions = [];

  const jsonExtract = isIdField ? '_id' : buildJsonExtract(field);
  const jsonExtractPath = isIdField ? null : buildJsonExtractPath(field);

  for (const [ op, opValue ] of Object.entries(operators)) {
    switch (op) {
      case '$eq':
        if (isIdField) {
          if (opValue === null || opValue === undefined) {
            conditions.push('_id IS NULL');
          } else {
            params.push(opValue);
            conditions.push('_id = ?');
          }
        } else {
          const serialized = serializeValue(opValue);
          if (serialized === null || serialized === undefined) {
            // SQL: = NULL is always false, must use IS NULL
            conditions.push(`(${jsonExtract} IS NULL OR json_type(data, ${jsonExtractPath}) = 'null')`);
          } else if (typeof serialized === 'object' && serialized !== null) {
            params.push(JSON.stringify(serialized));
            conditions.push(`json(${jsonExtract}) = json(?)`);
          } else if (typeof serialized === 'boolean') {
            params.push(serialized ? 1 : 0);
            conditions.push(`${jsonExtract} = ?`);
          } else {
            params.push(serialized);
            conditions.push(`${jsonExtract} = ?`);
          }
        }
        break;

      case '$ne':
        if (isIdField) {
          if (opValue === null || opValue === undefined) {
            conditions.push('_id IS NOT NULL');
          } else {
            params.push(opValue);
            conditions.push('(_id IS NULL OR _id != ?)');
          }
        } else {
          const serialized = serializeValue(opValue);
          if (serialized === null || serialized === undefined) {
            // $ne: null means "field exists and is not null"
            // SQL: != NULL is always false, must use IS NOT NULL
            conditions.push(`(${jsonExtract} IS NOT NULL AND json_type(data, ${jsonExtractPath}) != 'null')`);
          } else if (typeof serialized === 'object' && serialized !== null) {
            params.push(JSON.stringify(serialized));
            conditions.push(`(${jsonExtract} IS NULL OR json(${jsonExtract}) != json(?))`);
          } else if (typeof serialized === 'boolean') {
            params.push(serialized ? 1 : 0);
            conditions.push(`(${jsonExtract} IS NULL OR ${jsonExtract} != ?)`);
          } else {
            params.push(serialized);
            conditions.push(`(${jsonExtract} IS NULL OR ${jsonExtract} != ?)`);
          }
        }
        break;

      case '$gt':
        if (isIdField) {
          params.push(opValue);
          conditions.push('_id > ?');
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`json_extract(data, '$.${escapeString(field)}.$date') > ?`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonExtract} > ?`);
        } else {
          params.push(opValue);
          conditions.push(`CAST(${jsonExtract} AS NUMERIC) > ?`);
        }
        break;

      case '$gte':
        if (isIdField) {
          params.push(opValue);
          conditions.push('_id >= ?');
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`json_extract(data, '$.${escapeString(field)}.$date') >= ?`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonExtract} >= ?`);
        } else {
          params.push(opValue);
          conditions.push(`CAST(${jsonExtract} AS NUMERIC) >= ?`);
        }
        break;

      case '$lt':
        if (isIdField) {
          params.push(opValue);
          conditions.push('_id < ?');
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`json_extract(data, '$.${escapeString(field)}.$date') < ?`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonExtract} < ?`);
        } else {
          params.push(opValue);
          conditions.push(`CAST(${jsonExtract} AS NUMERIC) < ?`);
        }
        break;

      case '$lte':
        if (isIdField) {
          params.push(opValue);
          conditions.push('_id <= ?');
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`json_extract(data, '$.${escapeString(field)}.$date') <= ?`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonExtract} <= ?`);
        } else {
          params.push(opValue);
          conditions.push(`CAST(${jsonExtract} AS NUMERIC) <= ?`);
        }
        break;

      case '$in':
        if (!Array.isArray(opValue)) {
          throw new Error('$in requires an array');
        }
        if (opValue.length === 0) {
          conditions.push('0');
        } else if (isIdField) {
          const placeholders = opValue.map(v => {
            params.push(v);
            return '?';
          });
          conditions.push(`_id IN (${placeholders.join(', ')})`);
        } else {
          const hasNull = opValue.includes(null);
          const nonNullValues = opValue.filter(v => v !== null);
          const parts = [];
          if (nonNullValues.length > 0) {
            // For each value, check if the field equals it
            // OR (if field is array) contains it
            const valueParts = nonNullValues.map(v => {
              const serialized = serializeValue(v);
              if (typeof serialized === 'boolean') {
                params.push(serialized ? 1 : 0);
                return `${jsonExtract} = ?`;
              } else if (typeof serialized === 'object' && serialized !== null) {
                params.push(JSON.stringify(serialized));
                return `json(${jsonExtract}) = json(?)`;
              } else {
                params.push(serialized);
                return `${jsonExtract} = ?`;
              }
            });
            // Also check if field is an array containing any of the values
            const arrayParts = nonNullValues.map(v => {
              const serialized = serializeValue(v);
              if (typeof serialized === 'boolean') {
                params.push(serialized ? 1 : 0);
                return `EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE value = ?)`;
              } else if (typeof serialized === 'object' && serialized !== null) {
                params.push(JSON.stringify(serialized));
                return `EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE json(value) = json(?))`;
              } else {
                params.push(serialized);
                return `EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE value = ?)`;
              }
            });
            parts.push(`(${valueParts.join(' OR ')} OR (json_type(data, ${jsonExtractPath}) = 'array' AND (${arrayParts.join(' OR ')})))`);
          }
          if (hasNull) {
            parts.push(`(${jsonExtract} IS NULL OR json_type(data, ${jsonExtractPath}) = 'null')`);
          }
          conditions.push(parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0]);
        }
        break;

      case '$nin':
        if (!Array.isArray(opValue)) {
          throw new Error('$nin requires an array');
        }
        if (opValue.length === 0) {
          conditions.push('1');
        } else if (isIdField) {
          const placeholders = opValue.map(v => {
            params.push(v);
            return '?';
          });
          conditions.push(`(_id IS NULL OR _id NOT IN (${placeholders.join(', ')}))`);
        } else {
          const hasNull = opValue.includes(null);
          const nonNullValues = opValue.filter(v => v !== null);
          const parts = [];
          if (nonNullValues.length > 0) {
            const valueParts = nonNullValues.map(v => {
              const serialized = serializeValue(v);
              if (typeof serialized === 'boolean') {
                params.push(serialized ? 1 : 0);
                return `${jsonExtract} != ?`;
              } else if (typeof serialized === 'object' && serialized !== null) {
                params.push(JSON.stringify(serialized));
                return `json(${jsonExtract}) != json(?)`;
              } else {
                params.push(serialized);
                return `${jsonExtract} != ?`;
              }
            });
            parts.push(`(${jsonExtract} IS NULL OR (${valueParts.join(' AND ')}))`);
          }
          if (hasNull) {
            parts.push(`(${jsonExtract} IS NOT NULL AND json_type(data, ${jsonExtractPath}) != 'null')`);
          } else if (nonNullValues.length === 0) {
            parts.push(`${jsonExtract} IS NULL`);
          }
          conditions.push(`(${parts.join(hasNull ? ' AND ' : ' OR ')})`);
        }
        break;

      case '$exists':
        if (isIdField) {
          conditions.push(opValue ? '_id IS NOT NULL' : '_id IS NULL');
        } else {
          if (opValue) {
            // $exists: true — field must be present in the JSON (even if null)
            conditions.push(`json_type(data, ${jsonExtractPath}) IS NOT NULL`);
          } else {
            // $exists: false — field must be absent from the JSON
            conditions.push(`json_type(data, ${jsonExtractPath}) IS NULL`);
          }
        }
        break;

      case '$not': {
        if (typeof opValue !== 'object' || opValue === null) {
          throw new Error('$not requires an object');
        }
        const negatedClause = buildOperatorClause(
          field, opValue, params, isIdField
        );
        conditions.push(`NOT (${negatedClause})`);
        break;
      }

      case '$regex': {
        const pattern = opValue instanceof RegExp
          ? opValue.source
          : String(opValue);
        params.push(pattern);
        const regexOptions = operators.$options || '';
        const caseInsensitive = regexOptions.includes('i');
        if (isIdField) {
          conditions.push(
            caseInsensitive ? 'regexp_i(?, _id)' : 'regexp(?, _id)'
          );
        } else {
          conditions.push(
            caseInsensitive ? `regexp_i(?, ${jsonExtract})` : `regexp(?, ${jsonExtract})`
          );
        }
        break;
      }

      case '$options':
        // Handled with $regex, skip
        break;

      case '$all':
        if (!Array.isArray(opValue)) {
          throw new Error('$all requires an array');
        }
        // Each value in the $all array must exist in the array field
        for (const item of opValue) {
          const serialized = serializeValue(item);
          params.push(typeof serialized === 'object' && serialized !== null ? JSON.stringify(serialized) : serialized);
          if (typeof serialized === 'boolean') {
            conditions.push(`EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE value = ?)`);
          } else if (typeof serialized === 'object' && serialized !== null) {
            conditions.push(`EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE json(value) = json(?))`);
          } else {
            conditions.push(`EXISTS(SELECT 1 FROM json_each(${jsonExtract}) WHERE value = ?)`);
          }
        }
        break;

      case '$size':
        params.push(opValue);
        conditions.push(
          `json_type(data, ${jsonExtractPath}) = 'array' AND json_array_length(${jsonExtract}) = ?`
        );
        break;

      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  return conditions.join(' AND ');
}

// Build ORDER BY clause for SQLite
function queryHasText(query) {
  if (!query || typeof query !== 'object' || !('$text' in query)) {
    return false;
  }
  const search = query.$text && query.$text.$search;
  if (typeof search !== 'string') {
    return false;
  }
  return search.trim().split(/\s+/).filter(w => w.length > 0).length > 0;
}

function buildOrderBy(sort, options = {}) {
  const clauses = [];

  if (sort && Object.keys(sort).length > 0) {
    for (const [ field, direction ] of Object.entries(sort)) {
      if (direction && typeof direction === 'object' && direction.$meta === 'textScore') {
        if (options.hasTextScore) {
          clauses.push('_score DESC');
        }
        continue;
      }
      if (direction && typeof direction === 'object' && direction.$meta) {
        continue;
      }
      if (field === '_id') {
        clauses.push(`_id ${direction === -1 ? 'DESC' : 'ASC'}`);
      } else {
        const jsonExtract = buildJsonExtract(field);
        clauses.push(`${jsonExtract} ${direction === -1 ? 'DESC' : 'ASC'}`);
      }
    }
  }

  // Use rowid as insertion-order tiebreaker (replaces postgres _order SERIAL).
  // When joining with FTS5, qualify with the main table name to avoid ambiguity.
  const rowidRef = options.mainTable ? `${options.mainTable}.rowid` : 'rowid';
  clauses.push(`${rowidRef} ASC`);
  return `ORDER BY ${clauses.join(', ')}`;
}

// =============================================================================
// In-memory query matching for aggregation $match
// =============================================================================

// Apply a $project stage in an aggregation pipeline.
// Unlike applyProjection for find(), this supports field references
// (values starting with '$') and explicit exclusion with 0.
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
      // Field reference: '$fieldName' or '$nested.field'
      const refPath = value.slice(1);
      const v = getNestedField(doc, refPath);
      if (v !== undefined) {
        setNestedField(result, key, v);
      }
    } else {
      // Literal value or expression — treat as literal
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

// =============================================================================
// Parse SQLite index definitions from sqlite_master
// =============================================================================

function parseIndexDef(sql) {
  if (!sql) {
    return {
      key: {},
      unique: false
    };
  }
  const unique = /\bUNIQUE\b/i.test(sql);
  const sparse = /\bWHERE\b/i.test(sql);

  const key = {};
  let type;

  // Extract expressions from CREATE INDEX ... ON tablename (expr1, expr2)
  // Normalize whitespace to simplify matching across multi-line SQL
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  const onMatch = normalizedSql.match(/\bON\b\s+\S+\s*\((.+)\)(?:\s+WHERE\b.*)?$/i);
  if (!onMatch) {
    return {
      key: {},
      unique,
      ...(sparse ? { sparse: true } : {})
    };
  }

  const exprList = onMatch[1];
  const exprs = splitExpressions(exprList);

  for (const expr of exprs) {
    // Strip outer parentheses that SQLite adds around expression indexes.
    // e.g. "(json_extract(data, '$.slug')) ASC" → "json_extract(data, '$.slug') ASC"
    let trimmed = stripOuterParens(expr.trim());

    if (/^_id\b/.test(trimmed)) {
      const direction = /\bDESC\b/i.test(trimmed) ? -1 : 1;
      key._id = direction;
      continue;
    }

    // Numeric type: CAST(... AS NUMERIC)
    if (/CAST\b.*\bAS\s+NUMERIC\b/i.test(trimmed)) {
      type = 'number';
      const fieldName = jsonExtractToFieldName(trimmed);
      if (fieldName) {
        const direction = /\bDESC\b/i.test(trimmed) ? -1 : 1;
        key[fieldName] = direction;
      }
      continue;
    }

    // Date type: json_extract(data, '$.field.$date')
    if (/\.\$date/i.test(trimmed)) {
      type = 'date';
      const fieldName = jsonExtractToFieldName(trimmed);
      if (fieldName) {
        const direction = /\bDESC\b/i.test(trimmed) ? -1 : 1;
        key[fieldName] = direction;
      }
      continue;
    }

    // Text index (COALESCE pattern)
    if (/\bCOALESCE\b/i.test(trimmed)) {
      const fieldPattern = /json_extract\s*\(\s*data\s*,\s*'(\$\.[^']+)'\s*\)/gi;
      let m;
      while ((m = fieldPattern.exec(trimmed)) !== null) {
        const path = m[1].replace(/^\$\./, '');
        key[path] = 'text';
      }
      continue;
    }

    // Default text type: json_extract(data, '$.field')
    const fieldName = jsonExtractToFieldName(trimmed);
    if (fieldName) {
      const direction = /\bDESC\b/i.test(trimmed) ? -1 : 1;
      key[fieldName] = direction;
    }
  }

  return {
    key,
    unique,
    ...(sparse ? { sparse: true } : {}),
    ...(type ? { type } : {})
  };
}

// Convert a json_extract expression back to a field name
function jsonExtractToFieldName(expr) {
  const match = expr.match(/json_extract\s*\(\s*data\s*,\s*'(\$\.[^']+)'\s*\)/i);
  if (!match) {
    return null;
  }
  let path = match[1].replace(/^\$\./, '');
  // Remove .$date suffix for date indexes
  path = path.replace(/\.\$date$/, '');
  return path || null;
}

// Strip one layer of outer parentheses from an expression, preserving
// any trailing ASC/DESC. SQLite wraps expression-index columns in
// extra parens, e.g. "(json_extract(data, '$.slug')) ASC".
function stripOuterParens(str) {
  if (!str.startsWith('(')) {
    return str;
  }
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') {
      depth++;
    } else if (str[i] === ')') {
      depth--;
      if (depth === 0) {
        const rest = str.slice(i + 1).trim();
        if (i > 0 && (/^(ASC|DESC)?$/i.test(rest))) {
          return str.slice(1, i) + (rest ? ' ' + rest : '');
        }
        return str;
      }
    }
  }
  return str;
}

function splitExpressions(str) {
  const results = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    }
    if (ch === ',' && depth === 0) {
      results.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    results.push(current);
  }
  return results;
}

// =============================================================================
// Cursor Implementation
// =============================================================================

class SqliteCursor {
  constructor(collection, query, options = {}) {
    this._collection = collection;
    this._query = query;
    this._projection = options.projection || null;
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._iterator = null;
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
    const val = validateInteger(n, 'limit');
    this._limit = val === 0 ? null : val;
    return this;
  }

  skip(n) {
    this._skip = validateInteger(n, 'skip');
    return this;
  }

  clone() {
    const cloned = new SqliteCursor(this._collection, this._query);
    cloned._projection = this._projection;
    cloned._sort = this._sort;
    cloned._limit = this._limit;
    cloned._skip = this._skip;
    return cloned;
  }

  async toArray() {
    this._collection._ensureTable();

    const params = [];
    const queryOptions = this._collection._queryOptions();
    const tableName = this._collection._quotedTableName();
    const whereClause = buildWhereClause(this._query, params, 'data', queryOptions);
    const hasText = queryHasText(this._query) && queryOptions.ftsTable;
    const orderBy = buildOrderBy(this._sort, {
      hasTextScore: hasText,
      mainTable: hasText ? tableName : null
    });

    let selectCols = `${tableName}._id, ${tableName}.data`;
    let sql;
    if (hasText) {
      // Build WHERE from query without $text (the FTS JOIN handles text matching)
      const nonTextQuery = { ...this._query };
      delete nonTextQuery.$text;
      const nonTextParams = [];
      const nonTextWhere = buildWhereClause(nonTextQuery, nonTextParams, 'data', queryOptions);

      const words = this._query.$text.$search.trim().split(/\s+/).filter(w => w.length > 0);
      const ftsQuery = words.map(w => `"${w.replace(/"/g, '""')}"`).join(' OR ');

      // bm25() returns negative values (lower = better), so negate for
      // higher = better, matching MongoDB/PostgreSQL conventions
      selectCols += `, -bm25(${queryOptions.ftsTable}) AS _score`;

      sql = `SELECT ${selectCols} FROM ${tableName} JOIN ${queryOptions.ftsTable} ON ${tableName}.rowid = ${queryOptions.ftsTable}.rowid WHERE ${queryOptions.ftsTable} MATCH ? AND ${nonTextWhere} ${orderBy}`;
      // Replace params with: ftsQuery first, then nonTextParams
      params.length = 0;
      params.push(ftsQuery, ...nonTextParams);
    } else {
      sql = `SELECT ${selectCols} FROM ${tableName} WHERE ${whereClause} ${orderBy}`;
    }

    if (this._limit != null) {
      sql += ` LIMIT ${this._limit}`;
    } else if (this._skip != null) {
      sql += ' LIMIT -1';
    }
    if (this._skip != null) {
      sql += ` OFFSET ${this._skip}`;
    }

    const rows = this._collection._db._sqlite.prepare(sql).all(...params);
    return rows.map(row => {
      const doc = deserializeDocument(row.data, row._id);
      const meta = row._score != null ? { textScore: row._score } : {};
      return this._projection ? applyProjection(doc, this._projection, meta) : doc;
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
    // Buffer all results on first call to avoid holding the database busy.
    // better-sqlite3 is synchronous and an active .iterate() cursor blocks
    // all other queries on the same connection.
    if (!this._buffer) {
      this._collection._ensureTable();

      const params = [];
      const queryOptions = this._collection._queryOptions();
      const tableName = this._collection._quotedTableName();
      const whereClause = buildWhereClause(this._query, params, 'data', queryOptions);
      const hasText = queryHasText(this._query) && queryOptions.ftsTable;
      const orderBy = buildOrderBy(this._sort, {
        hasTextScore: hasText,
        mainTable: hasText ? tableName : null
      });

      let selectCols = `${tableName}._id, ${tableName}.data`;
      let sql;
      if (hasText) {
        const nonTextQuery = { ...this._query };
        delete nonTextQuery.$text;
        const nonTextParams = [];
        const nonTextWhere = buildWhereClause(nonTextQuery, nonTextParams, 'data', queryOptions);

        const words = this._query.$text.$search.trim().split(/\s+/).filter(w => w.length > 0);
        const ftsQuery = words.map(w => `"${w.replace(/"/g, '""')}"`).join(' OR ');

        selectCols += `, -bm25(${queryOptions.ftsTable}) AS _score`;
        sql = `SELECT ${selectCols} FROM ${tableName} JOIN ${queryOptions.ftsTable} ON ${tableName}.rowid = ${queryOptions.ftsTable}.rowid WHERE ${queryOptions.ftsTable} MATCH ? AND ${nonTextWhere} ${orderBy}`;
        params.length = 0;
        params.push(ftsQuery, ...nonTextParams);
      } else {
        sql = `SELECT ${selectCols} FROM ${tableName} WHERE ${whereClause} ${orderBy}`;
      }

      if (this._limit != null) {
        sql += ` LIMIT ${this._limit}`;
      } else if (this._skip != null) {
        sql += ' LIMIT -1';
      }
      if (this._skip != null) {
        sql += ` OFFSET ${this._skip}`;
      }

      this._buffer = this._collection._db._sqlite.prepare(sql).all(...params);
      this._bufferIndex = 0;
    }

    if (this._bufferIndex >= this._buffer.length) {
      this._exhausted = true;
      this._buffer = null;
      return null;
    }

    const row = this._buffer[this._bufferIndex++];
    const doc = deserializeDocument(row.data, row._id);
    const meta = row._score != null ? { textScore: row._score } : {};
    return this._projection ? applyProjection(doc, this._projection, meta) : doc;
  }

  async hasNext() {
    if (this._exhausted) {
      return false;
    }
    if (!this._buffer) {
      // Force buffering by calling _next logic without consuming
      await this._next();
      if (this._exhausted) {
        return false;
      }
      // Put the item back
      this._bufferIndex--;
      return true;
    }
    return this._bufferIndex < this._buffer.length;
  }

  async close() {
    this._buffer = null;
    this._exhausted = true;
  }

  addCursorFlag() {
    return this;
  }

  [Symbol.asyncIterator]() {
    return {
      cursor: this,
      async next() {
        const doc = await this.cursor._next();
        if (doc === null) {
          return {
            done: true,
            value: undefined
          };
        }
        return {
          done: false,
          value: doc
        };
      }
    };
  }

  async count() {
    this._collection._ensureTable();

    const params = [];
    const tableName = this._collection._quotedTableName();
    const whereClause = buildWhereClause(this._query, params, 'data', this._collection._queryOptions());
    const sql = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`;
    const row = this._collection._db._sqlite.prepare(sql).get(...params);
    return row.count;
  }
}

// =============================================================================
// Aggregation Cursor (in-memory processing)
// =============================================================================

class SqliteAggregationCursor {
  constructor(collection, pipeline) {
    this._collection = collection;
    this._pipeline = pipeline;
  }

  async toArray() {
    let docs = await this._collection.find({}).toArray();

    for (const stage of this._pipeline) {
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
        // Resolve field references in object-valued _id (e.g. { docId: '$docId' })
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

// =============================================================================
// Collection Implementation
// =============================================================================

class SqliteCollection {
  constructor(db, name) {
    this._db = db;
    this._tableName = validateTableName(name);
    this._name = name;
    this._indexes = new Map();
    this._textFields = null;
    this._initialized = false;
  }

  _quotedTableName() {
    return `"${escapeIdentifier(this._tableName)}"`;
  }

  _ftsTableName() {
    return `"${escapeIdentifier(this._tableName + '_fts')}"`;
  }

  _queryOptions() {
    if (!this._textFields) {
      return {};
    }
    return {
      textFields: this._textFields,
      ftsTable: this._ftsTableName(),
      mainTable: this._quotedTableName()
    };
  }

  // Extract text field values from a document for FTS5 indexing.
  // Returns an array of string values in _textFields order, or null
  // if no FTS5 table exists.
  _extractFtsValues(doc) {
    if (!this._textFields) {
      return null;
    }
    return this._textFields.map(f => {
      const val = getNestedField(doc, f);
      return val != null ? String(val) : '';
    });
  }

  // Sync FTS5 table after inserting a document
  _syncFtsInsert(id, doc) {
    const values = this._extractFtsValues(doc);
    if (!values) {
      return;
    }
    const fts = this._ftsTableName();
    const placeholders = values.map(() => '?').join(', ');
    this._db._sqlite.prepare(
      `INSERT INTO ${fts} (rowid, ${this._textFields.map(f => `"${escapeIdentifier(f)}"`).join(', ')}) VALUES ((SELECT rowid FROM ${this._quotedTableName()} WHERE _id = ?), ${placeholders})`
    ).run(id, ...values);
  }

  // Delete a document's FTS5 entry by its _id.
  // With contentless_delete=1, we can delete by rowid without old values.
  _syncFtsDelete(id) {
    if (!this._textFields) {
      return;
    }
    const tableName = this._quotedTableName();
    const fts = this._ftsTableName();
    const row = this._db._sqlite.prepare(
      `SELECT rowid FROM ${tableName} WHERE _id = ?`
    ).get(id);
    if (!row) {
      return;
    }
    this._db._sqlite.prepare(
      `DELETE FROM ${fts} WHERE rowid = ?`
    ).run(row.rowid);
  }

  get collectionName() {
    return this._name;
  }

  get name() {
    return this._name;
  }

  _ensureTable() {
    if (this._initialized) {
      return;
    }

    const tableName = this._quotedTableName();
    this._db._sqlite.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        _id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
    this._initialized = true;
  }

  async insertOne(doc) {
    this._ensureTable();

    const id = doc._id != null ? String(doc._id) : generateId();
    const docWithoutId = { ...doc };
    delete docWithoutId._id;

    const tableName = this._quotedTableName();
    try {
      this._db._sqlite.prepare(
        `INSERT INTO ${tableName} (_id, data) VALUES (?, ?)`
      ).run(id, serializeDocument(docWithoutId));
      this._syncFtsInsert(id, doc);
      return {
        acknowledged: true,
        insertedId: id,
        insertedCount: 1,
        ops: [ {
          ...doc,
          _id: id
        } ],
        result: { ok: 1 }
      };
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE' || (e.message && e.message.includes('UNIQUE constraint failed'))) {
        throw makeDuplicateKeyError(e, this, {
          ...doc,
          _id: id
        });
      }
      throw e;
    }
  }

  async insertMany(docs) {
    this._ensureTable();

    const insertedIds = {};
    let insertedCount = 0;

    for (let i = 0; i < docs.length; i++) {
      const result = await this.insertOne(docs[i]);
      insertedIds[i] = result.insertedId;
      insertedCount++;
    }

    return {
      acknowledged: true,
      insertedCount,
      insertedIds,
      result: { ok: 1 }
    };
  }

  async findOne(query, options = {}) {
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());
    const sql = `SELECT _id, data FROM ${tableName} WHERE ${whereClause} LIMIT 1`;

    const row = this._db._sqlite.prepare(sql).get(...params);
    if (!row) {
      return null;
    }

    const doc = deserializeDocument(row.data, row._id);
    return options.projection ? applyProjection(doc, options.projection) : doc;
  }

  find(query, options) {
    return new SqliteCursor(this, query, options);
  }

  async updateOne(query, update, options = {}) {
    this._ensureTable();

    if (typeof options === 'function') {
      options = {};
    }

    // Single-statement fast path: when the update uses only simple
    // operators without upsert, execute a single UPDATE statement
    // instead of the read-modify-write cycle. $push, $pull and
    // $addToSet are included only when all their values are scalars
    // (strings, numbers, booleans). Skip if any touched field is
    // text-indexed (FTS sync requires the full read-modify-write path).
    if (!options.upsert) {
      const atomicOps = [
        '$inc', '$set', '$unset', '$currentDate',
        '$push', '$pull', '$addToSet'
      ];
      const ops = Object.keys(update);
      const isAtomicCompatible = ops.length > 0 &&
        ops.every(op => atomicOps.includes(op));
      if (isAtomicCompatible) {
        // $push/$pull/$addToSet only qualify when all values are scalars
        const allScalar = [ '$push', '$pull', '$addToSet' ].every(op => {
          if (!update[op]) {
            return true;
          }
          return Object.values(update[op]).every(v =>
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean'
          );
        });
        if (allScalar) {
          const textFields = this._textFields || [];
          const unsetKeys = Array.isArray(update.$unset)
            ? update.$unset
            : Object.keys(update.$unset || {});
          const allKeys = [
            ...Object.keys(update.$set || {}),
            ...Object.keys(update.$inc || {}),
            ...unsetKeys,
            ...Object.keys(update.$currentDate || {}),
            ...Object.keys(update.$push || {}),
            ...Object.keys(update.$pull || {}),
            ...Object.keys(update.$addToSet || {})
          ];
          const touchesTextFields =
            allKeys.some(f => textFields.includes(f));
          if (!touchesTextFields) {
            return this._atomicUpdateOne(query, update);
          }
        }
      }
    }

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    const selectSql = `SELECT _id, data FROM ${tableName} WHERE ${whereClause} LIMIT 1`;
    const selectResult = this._db._sqlite.prepare(selectSql).get(...params);

    if (!selectResult) {
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
          result: {
            nModified: 0,
            n: 1
          }
        };
      }
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        result: {
          nModified: 0,
          n: 0
        }
      };
    }

    const existing = deserializeDocument(selectResult.data, selectResult._id);
    const updated = applyUpdate(existing, update);
    const { _id, ...dataWithoutId } = updated;

    try {
      this._syncFtsDelete(selectResult._id);
      this._db._sqlite.prepare(
        `UPDATE ${tableName} SET data = ? WHERE _id = ?`
      ).run(serializeDocument(dataWithoutId), selectResult._id);
      this._syncFtsInsert(selectResult._id, updated);
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE' || (e.message && e.message.includes('UNIQUE constraint failed'))) {
        throw makeDuplicateKeyError(e, this, updated);
      }
      throw e;
    }

    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1,
      result: {
        nModified: 1,
        n: 1
      }
    };
  }

  _atomicUpdateOne(query, update) {
    const tableName = this._quotedTableName();

    // Build SET expression and its params first (they appear before WHERE in SQL)
    const setParams = [];
    let dataExpr = 'data';

    if (update.$set) {
      for (const [ field, value ] of Object.entries(update.$set)) {
        const jsonPath = toJsonPath(field);
        const serialized = serializeValue(value);
        setParams.push(JSON.stringify(serialized));
        dataExpr = `json_set(${dataExpr}, '${jsonPath}', json(?))`;
      }
    }

    if (update.$inc) {
      for (const [ field, value ] of Object.entries(update.$inc)) {
        const jsonPath = toJsonPath(field);
        setParams.push(value);
        dataExpr = `json_set(${dataExpr}, '${jsonPath}', COALESCE(json_extract(data, '${jsonPath}'), 0) + ?)`;
      }
    }

    if (update.$unset) {
      const fields = Array.isArray(update.$unset)
        ? update.$unset
        : Object.keys(update.$unset);
      for (const field of fields) {
        const jsonPath = toJsonPath(field);
        dataExpr = `json_remove(${dataExpr}, '${jsonPath}')`;
      }
    }

    if (update.$currentDate) {
      for (const [ field, value ] of Object.entries(update.$currentDate)) {
        if (value === true || (value && value.$type === 'date')) {
          const jsonPath = toJsonPath(field);
          const dateVal = JSON.stringify(serializeValue(new Date()));
          setParams.push(dateVal);
          dataExpr = `json_set(${dataExpr}, '${jsonPath}', json(?))`;
        }
      }
    }

    // $push: append scalar value to array
    if (update.$push) {
      for (const [ field, value ] of Object.entries(update.$push)) {
        const jsonPath = toJsonPath(field);
        setParams.push(value);
        const coalesced = `COALESCE(json_extract(data, '${jsonPath}'), json('[]'))`;
        dataExpr = `json_set(${dataExpr}, '${jsonPath}', json_insert(${coalesced}, '$[#]', ?))`;
      }
    }

    // $pull: remove scalar value from array
    if (update.$pull) {
      for (const [ field, value ] of Object.entries(update.$pull)) {
        const jsonPath = toJsonPath(field);
        setParams.push(value);
        dataExpr = `json_set(${dataExpr}, '${jsonPath}', ` +
          '(SELECT json_group_array(je.value) ' +
          `FROM json_each(COALESCE(json_extract(data, '${jsonPath}'), '[]')) AS je ` +
          'WHERE je.value != ?))';
      }
    }

    // $addToSet: add scalar value to array if not already present
    if (update.$addToSet) {
      for (const [ field, value ] of Object.entries(update.$addToSet)) {
        const jsonPath = toJsonPath(field);
        setParams.push(value, value);
        const coalesced = `COALESCE(json_extract(data, '${jsonPath}'), json('[]'))`;
        dataExpr = `json_set(${dataExpr}, '${jsonPath}', ` +
          `CASE WHEN EXISTS(SELECT 1 FROM json_each(${coalesced}) WHERE value = ?) ` +
          `THEN ${coalesced} ` +
          `ELSE json_insert(${coalesced}, '$[#]', ?) END)`;
      }
    }

    // Build WHERE clause params second
    const whereParams = [];
    const whereClause = buildWhereClause(query, whereParams, 'data', this._queryOptions());

    // Positional params: SET params first, then WHERE params
    const params = [ ...setParams, ...whereParams ];
    const sql = `UPDATE ${tableName} SET data = ${dataExpr} WHERE ${whereClause}`;
    try {
      const result = this._db._sqlite.prepare(sql).run(...params);
      const matched = result.changes > 0 ? 1 : 0;
      return {
        acknowledged: true,
        matchedCount: matched,
        modifiedCount: matched,
        result: {
          nModified: matched,
          n: matched
        }
      };
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE' || (e.message && e.message.includes('UNIQUE constraint failed'))) {
        // Build a pseudo-doc from $set values so makeDuplicateKeyError
        // can report the conflicting key values
        const pseudoDoc = {};
        if (update.$set) {
          for (const [ field, value ] of Object.entries(update.$set)) {
            setNestedField(pseudoDoc, field, value);
          }
        }
        throw makeDuplicateKeyError(e, this, pseudoDoc);
      }
      throw e;
    }
  }

  async updateMany(query, update, options = {}) {
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    const selectSql = `SELECT _id, data FROM ${tableName} WHERE ${whereClause}`;
    const rows = this._db._sqlite.prepare(selectSql).all(...params);

    if (rows.length === 0) {
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        result: {
          nModified: 0,
          n: 0
        }
      };
    }

    let modifiedCount = 0;
    const updateStmt = this._db._sqlite.prepare(
      `UPDATE ${tableName} SET data = ? WHERE _id = ?`
    );

    for (const row of rows) {
      const existing = deserializeDocument(row.data, row._id);
      const updated = applyUpdate(existing, update);
      const { _id, ...dataWithoutId } = updated;
      this._syncFtsDelete(row._id);
      updateStmt.run(serializeDocument(dataWithoutId), row._id);
      this._syncFtsInsert(row._id, updated);
      modifiedCount++;
    }

    return {
      acknowledged: true,
      matchedCount: rows.length,
      modifiedCount,
      result: {
        nModified: modifiedCount,
        n: rows.length
      }
    };
  }

  async replaceOne(query, replacement, options = {}) {
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    const selectSql = `SELECT _id FROM ${tableName} WHERE ${whereClause} LIMIT 1`;
    const selectResult = this._db._sqlite.prepare(selectSql).get(...params);

    if (!selectResult) {
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
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0
      };
    }

    const { _id, ...dataWithoutId } = replacement;
    try {
      this._syncFtsDelete(selectResult._id);
      this._db._sqlite.prepare(
        `UPDATE ${tableName} SET data = ? WHERE _id = ?`
      ).run(serializeDocument(dataWithoutId), selectResult._id);
      this._syncFtsInsert(selectResult._id, replacement);
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE' || (e.message && e.message.includes('UNIQUE constraint failed'))) {
        throw makeDuplicateKeyError(e, this, replacement);
      }
      throw e;
    }

    return {
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 1
    };
  }

  async deleteOne(query) {
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    if (this._textFields) {
      const fts = this._ftsTableName();
      const row = this._db._sqlite.prepare(
        `SELECT rowid FROM ${tableName} WHERE ${whereClause} LIMIT 1`
      ).get(...params);
      if (!row) {
        return {
          acknowledged: true,
          deletedCount: 0,
          result: { ok: 1 }
        };
      }
      this._db._sqlite.prepare(`DELETE FROM ${fts} WHERE rowid = ?`).run(row.rowid);
      this._db._sqlite.prepare(`DELETE FROM ${tableName} WHERE rowid = ?`).run(row.rowid);
      return {
        acknowledged: true,
        deletedCount: 1,
        result: { ok: 1 }
      };
    }

    // Even without _textFields set, clean up FTS entries if the FTS table exists
    const fts = this._ftsTableName();
    const ftsExists = this._db._sqlite.prepare(
      'SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=?'
    ).get(this._tableName + '_fts');
    if (ftsExists) {
      const row = this._db._sqlite.prepare(
        `SELECT rowid FROM ${tableName} WHERE ${whereClause} LIMIT 1`
      ).get(...params);
      if (!row) {
        return {
          acknowledged: true,
          deletedCount: 0,
          result: { ok: 1 }
        };
      }
      this._db._sqlite.prepare(`DELETE FROM ${fts} WHERE rowid = ?`).run(row.rowid);
      this._db._sqlite.prepare(`DELETE FROM ${tableName} WHERE rowid = ?`).run(row.rowid);
      return {
        acknowledged: true,
        deletedCount: 1,
        result: { ok: 1 }
      };
    }

    const result = this._db._sqlite.prepare(
      `DELETE FROM ${tableName} WHERE _id IN (
        SELECT _id FROM ${tableName} WHERE ${whereClause} LIMIT 1
      )`
    ).run(...params);

    return {
      acknowledged: true,
      deletedCount: result.changes,
      result: { ok: 1 }
    };
  }

  async deleteMany(query) {
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    if (this._textFields) {
      const fts = this._ftsTableName();
      const rows = this._db._sqlite.prepare(
        `SELECT rowid FROM ${tableName} WHERE ${whereClause}`
      ).all(...params);
      if (rows.length > 0) {
        const deleteFts = this._db._sqlite.prepare(`DELETE FROM ${fts} WHERE rowid = ?`);
        const deleteMain = this._db._sqlite.prepare(`DELETE FROM ${tableName} WHERE rowid = ?`);
        for (const row of rows) {
          deleteFts.run(row.rowid);
          deleteMain.run(row.rowid);
        }
      }
      return {
        acknowledged: true,
        deletedCount: rows.length,
        result: { ok: 1 }
      };
    }

    // Even without _textFields set (e.g. a separate connection that never
    // called createIndex), clean up FTS entries if the FTS table exists.
    // This prevents stale FTS data when external tools delete documents.
    const fts = this._ftsTableName();
    const ftsExists = this._db._sqlite.prepare(
      'SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=?'
    ).get(this._tableName + '_fts');
    if (ftsExists) {
      const rows = this._db._sqlite.prepare(
        `SELECT rowid FROM ${tableName} WHERE ${whereClause}`
      ).all(...params);
      if (rows.length > 0) {
        const deleteFts = this._db._sqlite.prepare(`DELETE FROM ${fts} WHERE rowid = ?`);
        const deleteMain = this._db._sqlite.prepare(`DELETE FROM ${tableName} WHERE rowid = ?`);
        for (const row of rows) {
          deleteFts.run(row.rowid);
          deleteMain.run(row.rowid);
        }
      }
      return {
        acknowledged: true,
        deletedCount: rows.length,
        result: { ok: 1 }
      };
    }

    const result = this._db._sqlite.prepare(
      `DELETE FROM ${tableName} WHERE ${whereClause}`
    ).run(...params);

    return {
      acknowledged: true,
      deletedCount: result.changes,
      result: { ok: 1 }
    };
  }

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
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());
    const sql = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`;

    const row = this._db._sqlite.prepare(sql).get(...params);
    return row.count;
  }

  async distinct(field, query = {}) {
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    if (field === '_id') {
      const sql = `SELECT DISTINCT _id as value FROM ${tableName} WHERE ${whereClause}`;
      const rows = this._db._sqlite.prepare(sql).all(...params);
      return rows.map(row => row.value).filter(v => v !== null);
    }

    const jsonExtract = buildJsonExtract(field);
    const jsonExtractPath = buildJsonExtractPath(field);
    // Flatten arrays like MongoDB's distinct(), preserving type info for booleans.
    // For arrays: json_each provides type; for scalars: json_type on the field itself.
    // Use UNION to combine both cases.
    const sql = `
      SELECT DISTINCT je.value as value, je.type as type FROM ${tableName}, json_each(${jsonExtract}) AS je
        WHERE ${whereClause} AND json_type(data, ${jsonExtractPath}) = 'array'
      UNION
      SELECT DISTINCT ${jsonExtract} as value, json_type(data, ${jsonExtractPath}) as type FROM ${tableName}
        WHERE ${whereClause} AND ${jsonExtract} IS NOT NULL AND json_type(data, ${jsonExtractPath}) != 'array'
    `;

    const rows = this._db._sqlite.prepare(sql).all(...params, ...params);

    return rows
      .map(row => {
        const v = row.value;
        if (v === null || v === undefined) {
          return null;
        }
        // Convert SQLite boolean representations back to JS booleans
        // json_type returns 'true'/'false' for boolean values
        if (row.type === 'true') {
          return true;
        }
        if (row.type === 'false') {
          return false;
        }
        return v;
      })
      .filter(v => v !== null);
  }

  aggregate(pipeline) {
    return new SqliteAggregationCursor(this, pipeline);
  }

  async bulkWrite(operations) {
    this._ensureTable();

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
    this._ensureTable();

    const params = [];
    const tableName = this._quotedTableName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    const selectSql = `SELECT _id, data FROM ${tableName} WHERE ${whereClause} LIMIT 1`;
    const selectResult = this._db._sqlite.prepare(selectSql).get(...params);

    if (!selectResult) {
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

    const existing = deserializeDocument(selectResult.data, selectResult._id);
    const updated = applyUpdate(existing, update);
    const { _id, ...dataWithoutId } = updated;

    this._syncFtsDelete(selectResult._id);
    this._db._sqlite.prepare(
      `UPDATE ${tableName} SET data = ? WHERE _id = ?`
    ).run(serializeDocument(dataWithoutId), selectResult._id);
    this._syncFtsInsert(selectResult._id, updated);

    return options.returnDocument === 'after' ? updated : existing;
  }

  async createIndex(keys, options = {}) {
    this._ensureTable();

    const keyEntries = Object.entries(keys);
    const indexType = options.type;

    const buildIndexPath = (field, type) => {
      if (type === 'date') {
        return `json_extract(data, '$.${escapeString(field)}.$date')`;
      }
      if (type === 'number') {
        return `CAST(json_extract(data, '$.${escapeString(field)}') AS NUMERIC)`;
      }
      return `json_extract(data, '$.${escapeString(field)}')`;
    };

    const safeFieldNames = keyEntries.map(([ k ]) => k.replace(/[^a-zA-Z0-9]/g, '_')).join('_');
    const indexName = options.name
      ? validateTableName(options.name.substring(0, 63))
      : `idx_${this._tableName}_${safeFieldNames}`.substring(0, 63);

    const mongoName = options.name || keyEntries.map(([ k, v ]) => `${k}_${v}`).join('_');

    this._indexes.set(indexName, {
      keys,
      options,
      mongoName
    });

    const tableName = this._quotedTableName();
    const escapedIndexName = escapeIdentifier(indexName);

    // Build WHERE clause for sparse indexes
    let whereClause = '';
    if (options.sparse) {
      const sparseConditions = keyEntries.map(([ field ]) => {
        if (field === '_id') {
          return '_id IS NOT NULL';
        }
        return `json_type(data, '$.${escapeString(field)}') IS NOT NULL`;
      });
      whereClause = ` WHERE ${sparseConditions.join(' AND ')}`;
    }

    // Handle text indexes — create an FTS5 virtual table
    const hasTextIndex = keyEntries.some(([ , v ]) => v === 'text');
    if (hasTextIndex) {
      let textFields = keyEntries.filter(([ , v ]) => v === 'text').map(([ k ]) => k);
      // MongoDB dumps store text indexes as { _fts: 'text', _ftsx: 1 }
      // The real field names are in options.weights
      if (textFields.length === 1 && textFields[0] === '_fts' && options.weights) {
        textFields = Object.keys(options.weights);
      }
      this._textFields = textFields;

      const fts = this._ftsTableName();
      const cols = textFields.map(f => `"${escapeIdentifier(f)}"`).join(', ');

      // Content-less FTS5 table — we manage inserts/deletes manually.
      // content='' avoids duplicating data, contentless_delete=1 allows
      // DELETE operations on the virtual table.
      this._db._sqlite.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${fts} USING fts5(${cols}, content='', contentless_delete=1)`
      );

      // Clear any stale FTS entries (important during DB restore where
      // deleteMany runs before createIndex sets _textFields, leaving
      // orphaned FTS entries that cause incorrect search results)
      this._db._sqlite.exec(`DELETE FROM ${fts}`);

      // Backfill existing documents into the FTS5 table
      const rows = this._db._sqlite.prepare(
        `SELECT rowid, _id, data FROM ${tableName}`
      ).all();
      if (rows.length > 0) {
        const insertFts = this._db._sqlite.prepare(
          `INSERT OR REPLACE INTO ${fts} (rowid, ${cols}) VALUES (?, ${textFields.map(() => '?').join(', ')})`
        );
        const backfill = this._db._sqlite.transaction(() => {
          for (const row of rows) {
            const doc = deserializeDocument(row.data, row._id);
            const values = this._extractFtsValues(doc);
            insertFts.run(row.rowid, ...values);
          }
        });
        backfill();
      }

      return indexName;
    }

    // Handle unique constraint
    if (options.unique) {
      const indexExprs = keyEntries.map(([ field ]) => {
        return field === '_id' ? '_id' : `(${buildIndexPath(field, indexType)})`;
      });

      this._db._sqlite.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS "${escapedIndexName}"
        ON ${tableName} (${indexExprs.join(', ')})${whereClause}
      `);
      return indexName;
    }

    // Handle regular indexes
    const indexExprs = keyEntries.map(([ field, direction ]) => {
      if (field === '_id') {
        return `_id ${direction === -1 ? 'DESC' : 'ASC'}`;
      }
      return `(${buildIndexPath(field, indexType)}) ${direction === -1 ? 'DESC' : 'ASC'}`;
    });

    this._db._sqlite.exec(`
      CREATE INDEX IF NOT EXISTS "${escapedIndexName}"
      ON ${tableName} (${indexExprs.join(', ')})${whereClause}
    `);

    return indexName;
  }

  async ensureIndex(keys, options) {
    return this.createIndex(keys, options);
  }

  async dropIndex(indexName) {
    let pgName = null;
    for (const [ pgKey, meta ] of this._indexes.entries()) {
      if (meta.mongoName === indexName) {
        pgName = pgKey;
        break;
      }
    }
    if (!pgName) {
      pgName = validateTableName(indexName);
    }
    this._indexes.delete(pgName);
    const escapedIndexName = escapeIdentifier(pgName);
    this._db._sqlite.exec(`DROP INDEX IF EXISTS "${escapedIndexName}"`);
  }

  async indexes() {
    this._ensureTable();

    const rows = this._db._sqlite.prepare(
      'SELECT name, sql FROM sqlite_master WHERE type = \'index\' AND tbl_name = ?'
    ).all(this._tableName);

    const indexes = [ {
      name: '_id_',
      key: { _id: 1 },
      unique: true
    } ];

    const seen = new Set();
    for (const row of rows) {
      // Skip auto-created indexes (like the PRIMARY KEY index)
      if (!row.sql) {
        continue;
      }

      seen.add(row.name);
      const storedIndex = this._indexes.get(row.name);
      if (storedIndex) {
        indexes.push({
          name: storedIndex.mongoName || row.name,
          key: storedIndex.keys,
          unique: storedIndex.options.unique || false,
          ...(storedIndex.options.sparse ? { sparse: true } : {}),
          ...(storedIndex.options.type ? { type: storedIndex.options.type } : {})
        });
      } else {
        indexes.push({
          name: row.name,
          ...parseIndexDef(row.sql)
        });
      }
    }

    // Include indexes tracked in _indexes but not in sqlite_master
    // (e.g. FTS5 virtual table text indexes)
    for (const [ name, storedIndex ] of this._indexes) {
      if (!seen.has(name)) {
        indexes.push({
          name: storedIndex.mongoName || name,
          key: storedIndex.keys,
          unique: storedIndex.options.unique || false,
          ...(storedIndex.options.sparse ? { sparse: true } : {}),
          ...(storedIndex.options.type ? { type: storedIndex.options.type } : {})
        });
      }
    }

    return indexes;
  }

  async indexInformation() {
    const indexes = await this.indexes();
    const info = {};
    for (const idx of indexes) {
      info[idx.name] = Object.entries(idx.key).map(([ k, v ]) => [ k, v ]);
    }
    return info;
  }

  async insert(docs) {
    if (Array.isArray(docs)) {
      return this.insertMany(docs);
    }
    return this.insertOne(docs);
  }

  initializeUnorderedBulkOp() {
    const collection = this;
    const operations = [];

    return {
      find(query) {
        return {
          updateOne(update) {
            operations.push({
              updateOne: {
                filter: query,
                update
              }
            });
          },
          update(update) {
            operations.push({
              updateMany: {
                filter: query,
                update
              }
            });
          },
          upsert() {
            return {
              updateOne(update) {
                operations.push({
                  updateOne: {
                    filter: query,
                    update,
                    upsert: true
                  }
                });
              },
              update(update) {
                operations.push({
                  updateMany: {
                    filter: query,
                    update,
                    upsert: true
                  }
                });
              },
              replaceOne(doc) {
                operations.push({
                  replaceOne: {
                    filter: query,
                    replacement: doc,
                    upsert: true
                  }
                });
              }
            };
          },
          deleteOne() {
            operations.push({ deleteOne: { filter: query } });
          },
          delete() {
            operations.push({ deleteMany: { filter: query } });
          }
        };
      },
      async execute() {
        return collection.bulkWrite(operations);
      }
    };
  }

  async drop() {
    if (this._textFields) {
      const fts = this._ftsTableName();
      this._db._sqlite.exec(`DROP TABLE IF EXISTS ${fts}`);
      this._textFields = null;
    }
    const tableName = this._quotedTableName();
    this._db._sqlite.exec(`DROP TABLE IF EXISTS ${tableName}`);
    this._initialized = false;
    this._indexes.clear();
  }

  async rename(newName) {
    const oldName = this._name;
    const newCollName = validateTableName(newName);
    const tableName = this._quotedTableName();
    const escapedNewTableName = escapeIdentifier(newCollName);

    // Rename FTS5 table first if it exists
    if (this._textFields) {
      const oldFts = this._ftsTableName();
      const newFtsName = escapeIdentifier(newCollName + '_fts');
      this._db._sqlite.exec(`ALTER TABLE ${oldFts} RENAME TO "${newFtsName}"`);
    }

    this._db._sqlite.exec(`ALTER TABLE ${tableName} RENAME TO "${escapedNewTableName}"`);

    this._tableName = newCollName;
    this._name = newName;

    this._db._collections.delete(oldName);
    this._db._collections.set(newName, this);
  }
}

// =============================================================================
// Database Implementation
// =============================================================================

class SqliteDb {
  constructor(client, name, sqliteInstance) {
    this._client = client;
    this._sqlite = sqliteInstance;
    this._name = name;
    this.databaseName = name;
    this._collections = new Map();
  }

  collection(name) {
    if (!this._collections.has(name)) {
      this._collections.set(name, new SqliteCollection(this, name));
    }
    return this._collections.get(name);
  }

  async createCollection(name) {
    const col = this.collection(name);
    col._ensureTable();
    return col;
  }

  admin() {
    const client = this._client;
    return {
      async listDatabases() {
        // List all sibling .db files in the directory as "databases"
        const dir = path.dirname(client._dbPath);
        const fs = require('fs');
        let files;
        try {
          files = fs.readdirSync(dir);
        } catch (e) {
          return { databases: [] };
        }
        const databases = files
          .filter(f => f.endsWith('.db'))
          .map(f => ({ name: f.replace(/\.db$/, '') }));
        return { databases };
      }
    };
  }

  async dropDatabase() {
    // Drop all tables
    const tables = this._sqlite.prepare(
      'SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\''
    ).all();
    for (const table of tables) {
      this._sqlite.exec(`DROP TABLE IF EXISTS "${escapeIdentifier(table.name)}"`);
    }
    // Also drop all indexes
    const indexes = this._sqlite.prepare(
      'SELECT name FROM sqlite_master WHERE type = \'index\' AND name NOT LIKE \'sqlite_%\''
    ).all();
    for (const idx of indexes) {
      this._sqlite.exec(`DROP INDEX IF EXISTS "${escapeIdentifier(idx.name)}"`);
    }
    this._collections.clear();
  }

  async collections() {
    const list = await this.listCollections().toArray();
    return list.map(entry => this.collection(entry.name));
  }

  listCollections() {
    const self = this;
    return {
      async toArray() {
        const rows = self._sqlite.prepare(
          'SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\' AND name NOT LIKE \'%\\_fts%\' ESCAPE \'\\\''
        ).all();
        return rows.map(row => ({ name: row.name }));
      }
    };
  }
}

// =============================================================================
// Client Implementation
// =============================================================================

class SqliteClient {
  constructor(sqliteInstance, dbPath, defaultDbName) {
    this._sqlite = sqliteInstance;
    this._dbPath = dbPath;
    this._defaultDbName = defaultDbName;
    this._databases = new Map();
    this._siblingDbs = new Map();
  }

  db(name) {
    if (!name) {
      if (!this._databases.has(this._defaultDbName)) {
        this._databases.set(
          this._defaultDbName,
          new SqliteDb(this, this._defaultDbName, this._sqlite)
        );
      }
      return this._databases.get(this._defaultDbName);
    }

    // For sibling databases, open a separate .db file in the same directory
    if (!this._databases.has(name)) {
      const dir = path.dirname(this._dbPath);
      const siblingPath = path.join(dir, `${name}.db`);
      let siblingDb;
      if (this._siblingDbs.has(siblingPath)) {
        siblingDb = this._siblingDbs.get(siblingPath);
      } else {
        siblingDb = new Database(siblingPath);
        _registerFunctions(siblingDb);
        this._siblingDbs.set(siblingPath, siblingDb);
      }
      this._databases.set(name, new SqliteDb(this, name, siblingDb));
    }
    return this._databases.get(name);
  }

  async close() {
    if (!this._closed) {
      this._closed = true;
      this._sqlite.close();
      for (const [ , db ] of this._siblingDbs) {
        db.close();
      }
    }
  }
}

// =============================================================================
// Register custom regexp/regexp_i functions
// =============================================================================

function _registerFunctions(db) {
  db.function('regexp', { deterministic: true }, (pattern, value) => {
    if (value === null || value === undefined) {
      return 0;
    }
    try {
      return new RegExp(pattern).test(String(value)) ? 1 : 0;
    } catch (e) {
      return 0;
    }
  });

  db.function('regexp_i', { deterministic: true }, (pattern, value) => {
    if (value === null || value === undefined) {
      return 0;
    }
    try {
      return new RegExp(pattern, 'i').test(String(value)) ? 1 : 0;
    } catch (e) {
      return 0;
    }
  });
}

// =============================================================================
// Module Export
// =============================================================================

module.exports = {
  name: 'sqlite',
  protocols: [ 'sqlite' ],

  async connect(uri, options = {}) {
    // Parse URI: sqlite:///path/to/file.db or sqlite://path/to/file.db
    const url = new URL(uri);
    let dbPath;
    if (url.hostname) {
      // sqlite://relative/path/to/file.db
      dbPath = url.hostname + url.pathname;
    } else {
      // sqlite:///absolute/path/to/file.db
      dbPath = url.pathname;
    }

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);

    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    // Set busy timeout to wait up to 5 seconds for locks
    db.pragma('busy_timeout = 5000');

    // Register custom functions
    _registerFunctions(db);

    const dbName = path.basename(dbPath, path.extname(dbPath));

    return new SqliteClient(db, dbPath, dbName);
  }
};
