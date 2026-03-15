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
    throw new Error('Invalid table name: must be a non-empty string up to 63 characters');
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
  return str.replace(/'/g, '\'\'');
}

// Validate and format an integer (for LIMIT, OFFSET)
function validateInteger(value, name) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return num;
}

// Create a MongoDB-compatible duplicate key error from a PostgreSQL 23505 error
function makeDuplicateKeyError(pgError) {
  let field = null;
  let value = null;
  // Parse PostgreSQL detail to extract keyValue for MongoDB compatibility
  // Detail format: Key ((data ->> 'field'::text))=(value) already exists.
  // or for _id: Key (_id)=(value) already exists.
  // Note: PostgreSQL wraps expression indexes in double parens
  if (pgError.detail) {
    const match = pgError.detail.match(/Key \((.+?)\)=\((.+?)\) already exists/);
    if (match) {
      const expr = match[1];
      value = match[2];
      if (expr === '_id') {
        field = '_id';
      } else {
        // Try to map the PostgreSQL expression back to a field name
        // e.g., (data ->> 'username'::text) -> username
        const fieldMatch = expr.match(/>>\s*'([^']+)'/);
        if (fieldMatch) {
          field = fieldMatch[1];
        }
      }
    }
  }
  const message = field && value
    ? `Duplicate key error: ${field} "${value}" already exists`
    : 'Duplicate key error';
  const error = new Error(message);
  error.code = 11000;
  if (field && value) {
    error.keyValue = { [field]: value };
  }
  return error;
}

// Generate a MongoDB-style ObjectId-like string
function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

// Parse a PostgreSQL index definition (from pg_indexes.indexdef) back into
// our abstract index metadata: { key, unique, sparse, type }.
// This only handles the patterns our own createIndex generates — it is not
// a general SQL parser.
function parseIndexDef(indexdef) {
  const unique = /\bUNIQUE\b/.test(indexdef);
  const sparse = /\bWHERE\b/.test(indexdef);
  const isGin = /\bUSING gin\b/.test(indexdef);

  if (isGin) {
    // Text index: USING gin(to_tsvector('english', coalesce(data->>'field', '') ...))
    // PostgreSQL normalizes to: COALESCE((data ->> 'field'::text), ''::text)
    const key = {};
    const fieldPattern = /coalesce\(\s*\(*(data(?:\s*->\s*'[^']*'(?:::text)?)*\s*->>\s*'[^']*'(?:::text)?)\)*\s*,\s*''(?:::text)?\s*\)/gi;
    let m;
    while ((m = fieldPattern.exec(indexdef)) !== null) {
      const fieldName = jsonPathToFieldName(m[1]);
      if (fieldName) {
        key[fieldName] = 'text';
      }
    }
    return {
      key,
      unique,
      ...(sparse ? { sparse: true } : {})
    };
  }

  // Regular or unique index: extract expressions from the column list
  // The column list is inside the last pair of parentheses before an
  // optional WHERE clause
  let colSection = indexdef;
  const wherePos = colSection.indexOf(' WHERE ');
  if (wherePos !== -1) {
    colSection = colSection.substring(0, wherePos);
  }
  // Find the last opening paren that starts the column list
  // For: CREATE INDEX ... ON tablename (expr1, expr2)
  // or:  CREATE INDEX ... ON tablename USING btree (expr1, expr2)
  const onMatch = colSection.match(/\bON\b\s+\S+\s+(?:USING \w+\s+)?\((.+)\)\s*$/);
  if (!onMatch) {
    return {
      key: {},
      unique,
      ...(sparse ? { sparse: true } : {})
    };
  }

  const exprList = onMatch[1];
  const key = {};
  let type;

  // Split on commas that are not inside parentheses
  const exprs = splitExpressions(exprList);

  for (const expr of exprs) {
    const trimmed = expr.trim();

    // Check for _id column
    if (/^_id\b/.test(trimmed)) {
      const direction = /\bDESC\b/.test(trimmed) ? -1 : 1;
      key._id = direction;
      continue;
    }

    // Numeric type: ((data->>'field')::numeric) or nested variant
    const numericMatch = trimmed.match(/::numeric/);
    if (numericMatch) {
      type = 'number';
      const fieldName = jsonPathToFieldName(trimmed);
      if (fieldName) {
        const direction = /\bDESC\b/.test(trimmed) ? -1 : 1;
        key[fieldName] = direction;
      }
      continue;
    }

    // Date type: data->'field'->>'$date' (or PostgreSQL normalized:
    // (data -> 'createdAt'::text) ->> '$date'::text)
    const dateMatch = trimmed.match(/->>?\s*'\$date'/);
    if (dateMatch) {
      type = 'date';
      // The jsonPathToFieldName helper already skips $date segments,
      // so we can pass the whole expression
      const fieldName = jsonPathToFieldName(trimmed);
      if (fieldName) {
        const direction = /\bDESC\b/.test(trimmed) ? -1 : 1;
        key[fieldName] = direction;
      }
      continue;
    }

    // Default text type: data->>'field' or data->'a'->>'b'
    const fieldName = jsonPathToFieldName(trimmed);
    if (fieldName) {
      const direction = /\bDESC\b/.test(trimmed) ? -1 : 1;
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

// Convert a JSONB path expression like data->>'slug' or data->'user'->>'name'
// back into a dot-separated field name like 'slug' or 'user.name'.
// Handles PostgreSQL's normalized output which adds spaces, ::text casts,
// and extra parentheses (e.g. ((data ->> 'a'::text))).
function jsonPathToFieldName(expr) {
  // Remove outer parens, ::text and ::numeric casts, ASC/DESC
  let cleaned = expr
    .replace(/\(+/g, '')
    .replace(/\)+/g, '')
    .replace(/::(?:text|numeric)/g, '')
    .replace(/\s+(ASC|DESC)\s*$/i, '')
    .trim();

  // Must start with 'data'
  if (!cleaned.startsWith('data')) {
    return null;
  }
  // Remove the 'data' prefix
  cleaned = cleaned.substring(4);

  const parts = [];
  // Match ->> 'name' or -> 'name' segments (with optional spaces around arrows)
  const segmentPattern = /\s*->>\s*'([^']*)'\s*|\s*->\s*'([^']*)'\s*/g;
  let m;
  while ((m = segmentPattern.exec(cleaned)) !== null) {
    // ->> captures in group 1, -> captures in group 2
    const name = m[1] !== undefined ? m[1] : m[2];
    // Skip the $date pseudo-field used for date indexes
    if (name === '$date') {
      continue;
    }
    parts.push(name);
  }

  return parts.length > 0 ? parts.join('.') : null;
}

// Split a comma-separated expression list, respecting parentheses nesting.
// E.g. "((data->>'a')::numeric) DESC, (data->>'b') ASC" → two expressions.
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

  for (const [ key, value ] of Object.entries(query || {})) {
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
    } else if (key === '$text') {
      // Full-text search: { $text: { $search: "term" } }
      // Search against the text index fields stored in the table.
      // We use PostgreSQL's to_tsvector/to_tsquery for this.
      const searchTerm = value.$search;
      if (typeof searchTerm !== 'string') {
        throw new Error('$text.$search must be a string');
      }
      // Convert search string to tsquery format: split words and join with &
      const words = searchTerm.trim().split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) {
        conditions.push('FALSE');
      } else {
        // Build a text search across the common text-indexed fields
        // ApostropheCMS indexes: highSearchText, lowSearchText, title, searchBoost
        const textExpr = [
          'coalesce(data->>\'highSearchText\', \'\')',
          'coalesce(data->>\'lowSearchText\', \'\')',
          'coalesce(data->>\'title\', \'\')',
          'coalesce(data->>\'searchBoost\', \'\')'
        ].join(' || \' \' || ');
        // MongoDB $text uses OR semantics: any word matches
        params.push(words.map(w => w.replace(/[&|!():*<>'"]/g, ' ')).join(' | '));
        conditions.push(`to_tsvector('english', ${textExpr}) @@ to_tsquery('english', $${params.length})`);
      }
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
      const jsonPath = buildJsonPath(key, prefix);
      params.push(value.source);
      const flags = value.ignoreCase ? '*' : '';
      const regexOp = `~${flags}`;
      // Match scalar text OR any element of an array (MongoDB behavior)
      conditions.push(`(${prefix}->>'${escapeString(key)}' ${regexOp} $${params.length} OR (jsonb_typeof(${jsonPath}) = 'array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(${jsonPath}) elem WHERE elem ${regexOp} $${params.length})))`);
    } else if (value === null) {
      // MongoDB: { field: null } matches both explicit null AND missing field
      const jsonPath = buildJsonPath(key, prefix);
      conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} = 'null'::jsonb)`);
    } else {
      // Simple equality: use per-field @> which handles both scalar
      // equality AND array-contains-scalar in one operation, replacing
      // the previous two-branch OR with a single containment check.
      const jsonPath = buildJsonPath(key, prefix);
      const serialized = serializeValue(value);
      params.push(JSON.stringify(serialized));
      conditions.push(`${jsonPath} @> $${params.length}::jsonb`);
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

  for (const [ op, opValue ] of Object.entries(operators)) {
    switch (op) {
      case '$eq':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id = $${params.length}`);
        } else {
          params.push(JSON.stringify(serializeValue(opValue)));
          conditions.push(`${jsonPath} = $${params.length}::jsonb`);
        }
        break;

      case '$ne':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`(_id IS NULL OR _id != $${params.length})`);
        } else {
          params.push(JSON.stringify(serializeValue(opValue)));
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
          // Single array parameter allows PostgreSQL to cache the plan
          // regardless of how many IDs are passed
          params.push(opValue);
          conditions.push(`_id = ANY($${params.length}::text[])`);
        } else {
          const hasNull = opValue.includes(null);
          const nonNullValues = opValue.filter(v => v !== null);
          const parts = [];
          if (nonNullValues.length > 0) {
            params.push(JSON.stringify(nonNullValues.map(serializeValue)));
            const paramRef = `$${params.length}`;
            // Match scalar values directly
            parts.push(`${jsonPath} IN (SELECT jsonb_array_elements(${paramRef}::jsonb))`);
            // Also match if the field is an array containing any of the values.
            // Uses @> to avoid expanding the field's array elements (single
            // subquery instead of nested double subquery)
            parts.push(
              `(jsonb_typeof(${jsonPath}) = 'array'` +
              ` AND EXISTS(SELECT 1 FROM jsonb_array_elements(${paramRef}::jsonb) v` +
              ` WHERE ${jsonPath} @> v))`
            );
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
            params.push(JSON.stringify(nonNullValues.map(serializeValue)));
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
            `_id ~${caseInsensitive ? '*' : ''} $${params.length}`
          );
        } else {
          conditions.push(
            `${jsonTextPath} ~${caseInsensitive ? '*' : ''} $${params.length}`
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
  const clauses = [];

  if (sort && Object.keys(sort).length > 0) {
    for (const [ field, direction ] of Object.entries(sort)) {
      // Skip $meta sort fields (e.g. textScore: { $meta: 'textScore' })
      if (direction && typeof direction === 'object' && direction.$meta) {
        continue;
      }
      if (field === '_id') {
        clauses.push(`_id ${direction === -1 ? 'DESC' : 'ASC'}`);
      } else {
        const jsonPath = buildJsonTextPath(field);
        clauses.push(`${jsonPath} ${direction === -1 ? 'DESC' : 'ASC'}`);
      }
    }
  }

  // Always add _order as final tiebreaker to match MongoDB's
  // insertion-order stability among equal sort keys
  clauses.push('_order ASC');
  return `ORDER BY ${clauses.join(', ')}`;
}

// =============================================================================
// Update Operations (in-memory, no SQL injection risk)
// =============================================================================

function applyUpdate(doc, update) {
  const result = { ...doc };

  for (const [ op, fields ] of Object.entries(update)) {
    switch (op) {
      case '$set':
        for (const [ field, value ] of Object.entries(fields)) {
          setNestedField(result, field, value);
        }
        break;
      case '$unset':
        for (const field of Object.keys(fields)) {
          unsetNestedField(result, field);
        }
        break;
      case '$inc':
        for (const [ field, value ] of Object.entries(fields)) {
          const current = getNestedField(result, field) || 0;
          setNestedField(result, field, current + value);
        }
        break;
      case '$push':
        for (const [ field, value ] of Object.entries(fields)) {
          const arr = getNestedField(result, field) || [];
          arr.push(value);
          setNestedField(result, field, arr);
        }
        break;
      case '$pull':
        for (const [ field, value ] of Object.entries(fields)) {
          const arr = getNestedField(result, field) || [];
          setNestedField(result, field, arr.filter(item => !deepEqual(item, value)));
        }
        break;
      case '$addToSet':
        for (const [ field, value ] of Object.entries(fields)) {
          const arr = getNestedField(result, field) || [];
          if (!arr.some(item => deepEqual(item, value))) {
            arr.push(value);
          }
          setNestedField(result, field, arr);
        }
        break;
      case '$currentDate':
        for (const [ field, value ] of Object.entries(fields)) {
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
    if (current == null) {
      return undefined;
    }
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
    if (current[parts[i]] == null) {
      return;
    }
    current = current[parts[i]];
  }
  delete current[parts[parts.length - 1]];
}

function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

// =============================================================================
// Document Serialization (Date handling)
// =============================================================================

// Recursively convert Date objects to { $date: ... } wrapper and
// undefined to null (matching MongoDB's BSON behavior where undefined
// is stored as null). This is called before JSON.stringify because
// JSON.stringify calls toJSON() on Dates before any replacer sees them,
// and omits properties with undefined values.
function serializeValue(obj) {
  if (obj === undefined) {
    return null;
  }
  if (obj === null) {
    return null;
  }
  if (obj instanceof Date) {
    return { $date: obj.toISOString() };
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeValue);
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [ key, value ] of Object.entries(obj)) {
      result[key] = serializeValue(value);
    }
    return result;
  }
  return obj;
}

function serializeDocument(doc) {
  return JSON.stringify(serializeValue(doc));
}

// Convert $date wrappers back to Date objects, returning the original
// object reference when no conversions occurred in a subtree.
// Most document subtrees (rich text, widget configs) have zero dates,
// so this avoids rebuilding the entire object tree on every read.
function convertDates(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj.$date) {
    return new Date(obj.$date);
  }
  if (Array.isArray(obj)) {
    let changed = false;
    const result = obj.map(item => {
      const c = convertDates(item);
      if (c !== item) {
        changed = true;
      }
      return c;
    });
    return changed ? result : obj;
  }
  let changed = false;
  const result = {};
  for (const [ key, value ] of Object.entries(obj)) {
    const c = convertDates(value);
    result[key] = c;
    if (c !== value) {
      changed = true;
    }
  }
  return changed ? result : obj;
}

function deserializeDocument(data, id) {
  // data might be a string or object depending on pg configuration
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  const doc = convertDates(parsed);
  if (doc === parsed) {
    // No dates found — shallow copy to add _id without mutating parsed data
    return { _id: id, ...doc };
  }
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

  // Filter out $meta projections (e.g. textScore: { $meta: 'textScore' })
  // These are MongoDB-specific and don't apply to our storage model
  const fields = Object.entries(projection).filter(
    ([ k, v ]) => !(v && typeof v === 'object' && v.$meta)
  );
  if (fields.length === 0) {
    return doc;
  }
  const isInclusion = fields.some(([ k, v ]) => v && k !== '_id');

  if (isInclusion) {
    const result = {};
    for (const [ field, include ] of fields) {
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
    for (const [ field, include ] of fields) {
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
    // MongoDB convention: limit(0) means no limit
    const val = validateInteger(n, 'limit');
    this._limit = val === 0 ? null : val;
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
    const qualifiedName = this._collection._qualifiedName();
    const whereClause = buildWhereClause(this._query, params);
    const orderBy = buildOrderBy(this._sort);

    let sql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause} ${orderBy}`;

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
      const qualifiedName = this._collection._qualifiedName();
      const whereClause = buildWhereClause(this._query, params);
      const orderBy = buildOrderBy(this._sort);

      let sql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause} ${orderBy}`;
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

  addCursorFlag() {
    // No-op for PostgreSQL — flags like noCursorTimeout are MongoDB-specific
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
    await this._collection._ensureTable();

    const params = [];
    const qualifiedName = this._collection._qualifiedName();
    const whereClause = buildWhereClause(this._query, params);
    const sql = `SELECT COUNT(*) as count FROM ${qualifiedName} WHERE ${whereClause}`;
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
      const [ op, value ] = Object.entries(stage)[0];

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

// In-memory query matching for aggregation $match
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

// =============================================================================
// Collection Implementation
// =============================================================================

class PostgresCollection {
  constructor(db, name) {
    this._db = db;
    this._pool = db._pool;
    this._tableName = validateTableName(name);
    this._schema = db._schema || null;
    this._name = name;
    this._indexes = new Map();
    this._initialized = false;
  }

  // Returns the schema-qualified table name for use in SQL.
  // In multi-schema mode: "schemaname"."tablename"
  // In simple mode: "tablename"
  _qualifiedName() {
    const table = `"${escapeIdentifier(this._tableName)}"`;
    if (this._schema) {
      return `"${escapeIdentifier(this._schema)}".${table}`;
    }
    return table;
  }

  get collectionName() {
    return this._name;
  }

  get name() {
    return this._name;
  }

  async _ensureTable() {
    if (this._initialized) {
      return;
    }

    // In multi-schema mode, ensure the schema exists
    if (this._schema) {
      await this._pool.query(
        `CREATE SCHEMA IF NOT EXISTS "${escapeIdentifier(this._schema)}"`
      );
    }

    const qualifiedName = this._qualifiedName();
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS ${qualifiedName} (
        _id TEXT PRIMARY KEY,
        _order SERIAL,
        data JSONB NOT NULL
      )
    `);
    // Add _order column to tables created before it existed
    try {
      await this._pool.query(`
        ALTER TABLE ${qualifiedName} ADD COLUMN IF NOT EXISTS _order SERIAL
      `);
    } catch (e) {
      // Column already exists, ignore
    }
    this._initialized = true;
  }

  async insertOne(doc) {
    await this._ensureTable();

    const id = doc._id != null ? String(doc._id) : generateId();
    const docWithoutId = { ...doc };
    delete docWithoutId._id;

    const qualifiedName = this._qualifiedName();
    try {
      await this._pool.query(
        `INSERT INTO ${qualifiedName} (_id, data) VALUES ($1, $2)`,
        [ id, serializeDocument(docWithoutId) ]
      );
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
      if (e.code === '23505') {
        throw makeDuplicateKeyError(e);
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

    return {
      acknowledged: true,
      insertedCount,
      insertedIds,
      result: { ok: 1 }
    };
  }

  async findOne(query, options = {}) {
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);
    const sql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause} LIMIT 1`;

    const result = await this._pool.query(sql, params);
    if (result.rows.length === 0) {
      return null;
    }

    const doc = deserializeDocument(result.rows[0].data, result.rows[0]._id);
    return options.projection ? applyProjection(doc, options.projection) : doc;
  }

  find(query) {
    return new PostgresCursor(this, query);
  }

  async updateOne(query, update, options = {}) {
    await this._ensureTable();

    // Handle legacy callback as third argument (ignore the callback, PostgreSQL
    // adapter is Promise-based)
    if (typeof options === 'function') {
      options = {};
    }

    // Check if we can use atomic SQL (only $inc and/or $set, no upsert)
    if (!options.upsert) {
      const ops = Object.keys(update);
      const isAtomicCompatible = ops.length > 0 && ops.every(op => op === '$inc' || op === '$set');
      if (isAtomicCompatible) {
        return this._atomicUpdateOne(query, update);
      }
    }

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause} LIMIT 1`;
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

    const row = selectResult.rows[0];
    const existing = deserializeDocument(row.data, row._id);
    const updated = applyUpdate(existing, update);
    const { _id, ...dataWithoutId } = updated;

    try {
      await this._pool.query(
        `UPDATE ${qualifiedName} SET data = $1 WHERE _id = $2`,
        [ serializeDocument(dataWithoutId), selectResult.rows[0]._id ]
      );
    } catch (e) {
      if (e.code === '23505') {
        throw makeDuplicateKeyError(e);
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

  // Atomic update using SQL expressions for $inc and $set (no read-modify-write race)
  async _atomicUpdateOne(query, update) {
    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    // Build a chain of jsonb_set calls for atomic update
    let dataExpr = 'data';

    // Handle $set: set fields to specific values
    if (update.$set) {
      for (const [ field, value ] of Object.entries(update.$set)) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        const serialized = serializeValue(value);
        params.push(JSON.stringify(serialized));
        dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, $${params.length}::jsonb, true)`;
      }
    }

    // Handle $inc: atomically increment numeric fields
    if (update.$inc) {
      for (const [ field, value ] of Object.entries(update.$inc)) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        // Build the JSON path for reading the current value
        let readPath = 'data';
        for (let i = 0; i < pathArray.length - 1; i++) {
          readPath += `->'${escapeString(pathArray[i])}'`;
        }
        readPath += `->>'${escapeString(pathArray[pathArray.length - 1])}'`;
        params.push(value);
        dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, to_jsonb(COALESCE((${readPath})::numeric, 0) + $${params.length}), true)`;
      }
    }

    const sql = `UPDATE ${qualifiedName} SET data = ${dataExpr} WHERE ${whereClause}`;
    try {
      const result = await this._pool.query(sql, params);
      const matched = result.rowCount > 0 ? 1 : 0;
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
      if (e.code === '23505') {
        throw makeDuplicateKeyError(e);
      }
      throw e;
    }
  }

  async updateMany(query, update, options = {}) {
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause}`;
    const selectResult = await this._pool.query(selectSql, params);

    if (selectResult.rows.length === 0) {
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
    for (const row of selectResult.rows) {
      const existing = deserializeDocument(row.data, row._id);
      const updated = applyUpdate(existing, update);
      const { _id, ...dataWithoutId } = updated;

      await this._pool.query(
        `UPDATE ${qualifiedName} SET data = $1 WHERE _id = $2`,
        [ serializeDocument(dataWithoutId), row._id ]
      );
      modifiedCount++;
    }

    return {
      acknowledged: true,
      matchedCount: selectResult.rows.length,
      modifiedCount,
      result: {
        nModified: modifiedCount,
        n: selectResult.rows.length
      }
    };
  }

  async replaceOne(query, replacement, options = {}) {
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id FROM ${qualifiedName} WHERE ${whereClause} LIMIT 1`;
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
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0
      };
    }

    const { _id, ...dataWithoutId } = replacement;
    try {
      await this._pool.query(
        `UPDATE ${qualifiedName} SET data = $1 WHERE _id = $2`,
        [ serializeDocument(dataWithoutId), selectResult.rows[0]._id ]
      );
    } catch (e) {
      if (e.code === '23505') {
        throw makeDuplicateKeyError(e);
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
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    const result = await this._pool.query(
      `DELETE FROM ${qualifiedName} WHERE _id IN (
        SELECT _id FROM ${qualifiedName} WHERE ${whereClause} LIMIT 1
      )`,
      params
    );

    return {
      acknowledged: true,
      deletedCount: result.rowCount,
      result: { ok: 1 }
    };
  }

  async deleteMany(query) {
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    const result = await this._pool.query(
      `DELETE FROM ${qualifiedName} WHERE ${whereClause}`,
      params
    );

    return {
      acknowledged: true,
      deletedCount: result.rowCount,
      result: { ok: 1 }
    };
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
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);
    const sql = `SELECT COUNT(*) as count FROM ${qualifiedName} WHERE ${whereClause}`;

    const result = await this._pool.query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  async distinct(field, query = {}) {
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    if (field === '_id') {
      const sql = `SELECT DISTINCT _id as value FROM ${qualifiedName} WHERE ${whereClause}`;
      const result = await this._pool.query(sql, params);
      return result.rows.map(row => row.value).filter(v => v !== null);
    }

    const jsonPath = buildJsonPath(field);
    // MongoDB's distinct() automatically flattens arrays.
    // Use LATERAL with jsonb_array_elements to unwind array values,
    // and fall back to the value itself for scalars.
    // Use jsonb_array_elements (not _text) to preserve types for non-string values.
    const sql = `SELECT DISTINCT elem as value FROM ${qualifiedName}, LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(${jsonPath}) = 'array' THEN ${jsonPath} ELSE jsonb_build_array(${jsonPath}) END
    ) AS elem WHERE ${whereClause} AND ${jsonPath} IS NOT NULL`;
    const result = await this._pool.query(sql, params);

    return result.rows
      .map(row => {
        const v = row.value;
        if (v === null || v === undefined) {
          return null;
        }
        // pg driver parses jsonb automatically, returning JS types.
        // For jsonb strings, we already get JS strings.
        // For jsonb numbers/booleans/objects, we get those types.
        // No additional parsing needed.
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
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params);

    const selectSql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause} LIMIT 1`;
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

    const row = selectResult.rows[0];
    const existing = deserializeDocument(row.data, row._id);
    const updated = applyUpdate(existing, update);
    const { _id, ...dataWithoutId } = updated;

    await this._pool.query(
      `UPDATE ${qualifiedName} SET data = $1 WHERE _id = $2`,
      [ serializeDocument(dataWithoutId), selectResult.rows[0]._id ]
    );

    return options.returnDocument === 'after' ? updated : existing;
  }

  /**
   * Create an index on one or more fields.
   *
   * @param {Object} keys - Fields to index,
   *   e.g. { fieldName: 1 } or { fieldName: -1 }
   * @param {Object} options - Index options
   * @param {string} [options.name] - Custom index name
   * @param {boolean} [options.unique] - Unique index
   * @param {boolean} [options.sparse] - Sparse/partial index
   *   (only index docs where field exists)
   * @param {string} [options.type] - Field type for range
   *   query optimization:
   *   - 'number': numeric cast for $gt/$lt on numbers
   *   - 'date': date extraction for $gt/$lt on dates
   *   - undefined: text (for $eq, $in, $regex)
   *
   * IMPORTANT: The `type` option is required for
   * PostgreSQL to efficiently use indexes on range
   * queries ($gt, $gte, $lt, $lte). MongoDB ignores it.
   *
   * @example
   * // Text/equality index (default) - efficient for $eq, $in, $regex
   * await collection.createIndex({ slug: 1 });
   *
   * // Numeric index - efficient for $gt, $lt on numbers
   * await collection.createIndex({ price: 1 }, { type: 'number' });
   *
   * // Date index - for $gt, $lt on dates
   * await collection.createIndex(
   *   { createdAt: 1 }, { type: 'date' }
   * );
   *
   * // Unique sparse date index
   * await collection.createIndex(
   *   { publishedAt: 1 },
   *   { type: 'date', unique: true, sparse: true }
   * );
   */
  async createIndex(keys, options = {}) {
    await this._ensureTable();

    const keyEntries = Object.entries(keys);
    const indexType = options.type; // 'number', 'date', or undefined (text)

    // Helper to build JSON path expression for index
    // (handles nested fields like 'user.name').
    // The type parameter determines the expression
    // for range query optimization
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
    const safeFieldNames = keyEntries.map(([ k ]) => k.replace(/[^a-zA-Z0-9]/g, '_')).join('_');
    const indexName = options.name
      ? validateTableName(options.name)
      : `idx_${this._tableName}_${safeFieldNames}`.substring(0, 63);

    // Generate MongoDB-compatible index name for indexInformation() compatibility
    const mongoName = options.name || keyEntries.map(([ k, v ]) => `${k}_${v}`).join('_');

    // Store index metadata
    this._indexes.set(indexName, {
      keys,
      options,
      mongoName
    });

    const qualifiedName = this._qualifiedName();
    const escapedIndexName = escapeIdentifier(indexName);

    // Build WHERE clause for sparse indexes (PostgreSQL partial index)
    let whereClause = '';
    if (options.sparse) {
      const sparseConditions = keyEntries.map(([ field ]) => {
        if (field === '_id') {
          return '_id IS NOT NULL';
        }
        return `${buildIndexPathJsonb(field)} IS NOT NULL`;
      });
      whereClause = ` WHERE ${sparseConditions.join(' AND ')}`;
    }

    // Handle text indexes (full-text search, always uses text extraction)
    const hasTextIndex = keyEntries.some(([ , v ]) => v === 'text');
    if (hasTextIndex) {
      const textFields = keyEntries.filter(([ , v ]) => v === 'text').map(([ k ]) => k);
      const tsvectorExpr = textFields
        .map(f => `coalesce(${buildIndexPath(f, null)}, '')`)
        .join(' || \' \' || ');

      await this._pool.query(`
        CREATE INDEX IF NOT EXISTS "${escapedIndexName}"
        ON ${qualifiedName}
        USING gin(to_tsvector('english', ${tsvectorExpr}))${whereClause}
      `);
      return indexName;
    }

    // Handle unique constraint
    if (options.unique) {
      const indexExprs = keyEntries.map(([ field ]) => {
        return field === '_id' ? '_id' : `(${buildIndexPath(field, indexType)})`;
      });

      await this._pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "${escapedIndexName}"
        ON ${qualifiedName} (${indexExprs.join(', ')})${whereClause}
      `);
      return indexName;
    }

    // Handle regular indexes (single or compound)
    const indexExprs = keyEntries.map(([ field, direction ]) => {
      if (field === '_id') {
        return `_id ${direction === -1 ? 'DESC' : 'ASC'}`;
      }
      return `(${buildIndexPath(field, indexType)}) ${direction === -1 ? 'DESC' : 'ASC'}`;
    });

    await this._pool.query(`
      CREATE INDEX IF NOT EXISTS "${escapedIndexName}"
      ON ${qualifiedName} (${indexExprs.join(', ')})${whereClause}
    `);

    return indexName;
  }

  async dropIndex(indexName) {
    // Look up by MongoDB-compatible name first (in case caller uses that)
    let pgName = null;
    for (const [ pgKey, meta ] of this._indexes.entries()) {
      if (meta.mongoName === indexName) {
        pgName = pgKey;
        break;
      }
    }
    if (!pgName) {
      // Try as a direct postgres index name
      pgName = validateTableName(indexName);
    }
    this._indexes.delete(pgName);
    const escapedIndexName = escapeIdentifier(pgName);
    if (this._schema) {
      await this._pool.query(
        `DROP INDEX IF EXISTS "${escapeIdentifier(this._schema)}"."${escapedIndexName}"`
      );
    } else {
      await this._pool.query(`DROP INDEX IF EXISTS "${escapedIndexName}"`);
    }
  }

  async indexes() {
    await this._ensureTable();

    const schemaName = this._schema || 'public';
    const result = await this._pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2
    `, [ schemaName, this._tableName ]);

    const indexes = [ {
      name: '_id_',
      key: { _id: 1 },
      unique: true
    } ];

    for (const row of result.rows) {
      if (row.indexname === `${this._tableName}_pkey`) {
        continue;
      }

      const storedIndex = this._indexes.get(row.indexname);
      if (storedIndex) {
        indexes.push({
          name: storedIndex.mongoName || row.indexname,
          key: storedIndex.keys,
          unique: storedIndex.options.unique || false,
          ...(storedIndex.options.sparse ? { sparse: true } : {}),
          ...(storedIndex.options.type ? { type: storedIndex.options.type } : {})
        });
      } else {
        indexes.push({
          name: row.indexname,
          ...parseIndexDef(row.indexdef)
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

  // Legacy MongoDB method: insert (alias for insertOne or insertMany)
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
    const qualifiedName = this._qualifiedName();
    await this._pool.query(`DROP TABLE IF EXISTS ${qualifiedName}`);
    this._initialized = false;
    this._indexes.clear();
  }

  async rename(newName) {
    const oldName = this._name;
    const newCollName = validateTableName(newName);
    const qualifiedName = this._qualifiedName();
    const escapedNewTableName = escapeIdentifier(newCollName);
    await this._pool.query(`ALTER TABLE ${qualifiedName} RENAME TO "${escapedNewTableName}"`);

    // Update internal state
    this._tableName = newCollName;
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
  constructor(client, name, schema) {
    this._client = client;
    this._pool = client._pool;
    this._name = name;
    this._schema = schema || null;
    this._multiSchema = client._multiSchema || false;
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

  admin() {
    const pool = this._pool;
    const multiSchema = this._multiSchema;
    const name = this._name;
    return {
      async listDatabases() {
        if (multiSchema) {
          // List all non-system schemas as "databases"
          const result = await pool.query(`
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name NOT IN ('public', 'information_schema', 'pg_catalog', 'pg_toast')
            AND schema_name NOT LIKE 'pg_%'
          `);
          const databases = result.rows.map(row => ({
            name: row.schema_name
          }));
          return { databases };
        }
        // Simple mode: just return this database
        return { databases: [ { name } ] };
      }
    };
  }

  async dropDatabase() {
    if (!this._name) {
      return;
    }
    if (this._multiSchema && this._schema) {
      // Multi-schema mode: drop the schema
      await this._pool.query(
        `DROP SCHEMA IF EXISTS "${escapeIdentifier(this._schema)}" CASCADE`
      );
    } else {
      // Simple mode: drop all tables in public schema
      const result = await this._pool.query(
        'SELECT tablename FROM pg_tables WHERE schemaname = \'public\''
      );
      for (const row of result.rows) {
        await this._pool.query(
          `DROP TABLE IF EXISTS "${escapeIdentifier(row.tablename)}" CASCADE`
        );
      }
    }
    this._collections.clear();
  }

  async collections() {
    const list = await this.listCollections().toArray();
    return list.map(entry => this.collection(entry.name));
  }

  listCollections() {
    const self = this;
    const schemaName = this._schema || 'public';
    return {
      async toArray() {
        const result = await self._pool.query(`
          SELECT tablename as name
          FROM pg_tables
          WHERE schemaname = $1
        `, [ schemaName ]);
        return result.rows.map(row => ({
          name: row.name
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
    this._multiSchema = options._multiSchema || false;
    this._defaultSchema = options._defaultSchema || null;
    this._databases = new Map();
  }

  db(name) {
    if (!this._multiSchema) {
      // Simple mode: all names map to the same database (public schema).
      // The name is stored for identification but all share the same tables.
      const dbName = name || this._defaultDb;
      if (!this._databases.has(dbName)) {
        this._databases.set(dbName, new PostgresDb(this, dbName, null));
      }
      return this._databases.get(dbName);
    }
    // Multi-schema mode: each name gets its own schema
    const dbName = name || this._defaultDb;
    if (!this._databases.has(dbName)) {
      this._databases.set(dbName, new PostgresDb(this, dbName, dbName));
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
  protocols: [ 'postgres', 'postgresql', 'multipostgres' ],

  /**
   * Connect to PostgreSQL and return a client with MongoDB-compatible interface.
   *
   * Supports two modes:
   * - postgres:// — Simple single-database mode, unprefixed tables in public schema
   * - multipostgres:// — Multi-schema mode for multisite.
   *   URI: multipostgres://host/realdb-schemaname
   *   Last hyphen-separated component is the default schema,
   *   everything before is the real PostgreSQL database name.
   *
   * @param {string} uri - Connection URI
   * @param {Object} [options={}] - Additional pg Pool options
   * @returns {Promise<PostgresClient>} Client with db(), close() methods
   */
  async connect(uri, options = {}) {
    const url = new URL(uri);
    let database;
    let multiSchema = false;
    let defaultSchema = null;
    let connectionUri = uri;

    if (url.protocol === 'multipostgres:') {
      // Multi-schema mode: multipostgres://host/realdb-schemaname
      multiSchema = true;
      const path = url.pathname.slice(1); // e.g. 'shared-db-dashboard'
      const lastHyphen = path.lastIndexOf('-');
      if (lastHyphen === -1) {
        throw new Error(
          'multipostgres:// URI must contain at least one hyphen in the path: ' +
          'multipostgres://host/realdb-schemaname'
        );
      }
      const realDb = path.substring(0, lastHyphen);
      defaultSchema = path.substring(lastHyphen + 1);
      database = defaultSchema;

      // Rewrite URI to postgres:// for the actual pg Pool connection
      const connUrl = new URL(uri);
      connUrl.protocol = 'postgres:';
      connUrl.pathname = '/' + realDb;
      connectionUri = connUrl.toString();
    } else {
      // Simple single-database mode
      database = url.pathname.slice(1) || undefined;
    }

    let pool = new Pool({
      connectionString: connectionUri,
      ...options
    });

    // Test connection, creating the database if it doesn't exist
    // (matching MongoDB's implicit database creation behavior)
    try {
      await pool.query('SELECT 1');
    } catch (e) {
      // 3D000 = invalid_catalog_name (database does not exist)
      const pgDatabase = new URL(connectionUri).pathname.slice(1);
      if (e.code === '3D000' && pgDatabase) {
        await pool.end();
        // Connect to the default 'postgres' database to create the target
        const adminUrl = new URL(connectionUri);
        adminUrl.pathname = '/postgres';
        const adminPool = new Pool({
          connectionString: adminUrl.toString(),
          ...options
        });
        try {
          await adminPool.query(`CREATE DATABASE "${escapeIdentifier(pgDatabase)}"`);
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
          connectionString: connectionUri,
          ...options
        });
        await pool.query('SELECT 1');
      } else {
        throw e;
      }
    }

    return new PostgresClient(pool, database, uri, {
      ...options,
      _multiSchema: multiSchema,
      _defaultSchema: defaultSchema
    });
  }
};
