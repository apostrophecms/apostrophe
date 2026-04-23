// PostgreSQL Adapter for MongoDB-compatible interface
// Stores documents as JSONB with _id as primary key

const { Pool } = require('pg');
const crypto = require('crypto');
const {
  serializeValue,
  serializeDocument,
  deserializeDocument,
  getNestedField,
  setNestedField,
  deepEqual,
  applyProjection,
  applyUpdate,
  extractAnchoredLiteralPrefix,
  prefixUpperBound,
  validateInteger
} = require('../lib/shared');
const { AggregationCursor } = require('../lib/aggregation-cursor');

// =============================================================================
// PROFILING: Accumulated timing data for performance analysis
// Enable with POSTGRES_PROFILE=1 environment variable
// Print report with: require('.../postgres').profileReport()
// =============================================================================

const PROFILING = !!process.env.POSTGRES_PROFILE;

const profile = {
  buildWhereClause: {
    calls: 0,
    totalMs: 0
  },
  buildOrderBy: {
    calls: 0,
    totalMs: 0
  },
  serializeDocument: {
    calls: 0,
    totalMs: 0
  },
  convertDates: {
    calls: 0,
    totalMs: 0
  },
  applyProjection: {
    calls: 0,
    totalMs: 0
  },
  applyUpdate: {
    calls: 0,
    totalMs: 0
  },
  pgQuery: {
    calls: 0,
    totalMs: 0
  },
  ensureTable: {
    calls: 0,
    totalMs: 0
  },
  findOne: {
    calls: 0,
    totalMs: 0
  },
  findToArray: {
    calls: 0,
    totalMs: 0
  },
  cursorNext: {
    calls: 0,
    totalMs: 0
  },
  updateOne: {
    calls: 0,
    totalMs: 0
  },
  insertOne: {
    calls: 0,
    totalMs: 0
  },
  countDocuments: {
    calls: 0,
    totalMs: 0
  },
  distinct: {
    calls: 0,
    totalMs: 0
  }
};

// Per-query tracking: SQL text -> { calls, totalMs }
const queryProfile = {};

function profileStart() {
  if (!PROFILING) {
    return 0;
  }
  return performance.now();
}

function profileEnd(category, start) {
  if (!PROFILING) {
    return;
  }
  const elapsed = performance.now() - start;
  profile[category].calls++;
  profile[category].totalMs += elapsed;
}

function profileQuery(sql, start) {
  if (!PROFILING) {
    return;
  }
  const elapsed = performance.now() - start;
  profile.pgQuery.calls++;
  profile.pgQuery.totalMs += elapsed;
  // Normalize SQL for grouping: collapse $N params and specific values
  const normalized = sql.replace(/\$\d+/g, '$?').replace(/\s+/g, ' ').trim().substring(0, 120);
  if (!queryProfile[normalized]) {
    queryProfile[normalized] = {
      calls: 0,
      totalMs: 0
    };
  }
  queryProfile[normalized].calls++;
  queryProfile[normalized].totalMs += elapsed;
}

function profileReport() {
  console.log('\n=== PostgreSQL Adapter Profile ===\n');

  // High-level categories
  console.log('--- Cumulative time by category ---');
  const sorted = Object.entries(profile)
    .filter(([ , v ]) => v.calls > 0)
    .sort((a, b) => b[1].totalMs - a[1].totalMs);
  for (const [ name, data ] of sorted) {
    console.log(`  ${name.padEnd(20)} ${data.totalMs.toFixed(1).padStart(8)}ms  (${data.calls} calls, ${(data.totalMs / data.calls).toFixed(3)}ms avg)`);
  }

  // Per-query breakdown
  console.log('\n--- Top queries by total time ---');
  const querySorted = Object.entries(queryProfile)
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .slice(0, 20);
  for (const [ sql, data ] of querySorted) {
    console.log(`  ${data.totalMs.toFixed(1).padStart(8)}ms  (${String(data.calls).padStart(4)} calls, ${(data.totalMs / data.calls).toFixed(3)}ms avg)  ${sql}`);
  }

  console.log('\n=== End Profile ===\n');
}

function profileReset() {
  for (const key of Object.keys(profile)) {
    profile[key].calls = 0;
    profile[key].totalMs = 0;
  }
  for (const key of Object.keys(queryProfile)) {
    delete queryProfile[key];
  }
}

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

// Sanitize a caller-supplied index name so it is safe to use as a
// PostgreSQL identifier. Unlike validateTableName() (which rejects unsafe
// input as a security measure against malicious table names), index names
// frequently arrive from cross-backend JSONL dumps — MongoDB's
// default/auto-generated index names contain characters like "." that are
// illegal PostgreSQL identifiers. Silently replacing those characters
// with "_" is safe: the name is an internal identifier, not user data,
// and the adapter is the one consulting the _indexes map by the sanitized
// form.
function sanitizeIndexName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    return null;
  }
  const truncated = name.substring(0, 63);
  const sanitized = truncated.replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(sanitized)) {
    return '_' + sanitized.substring(0, 62);
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

  // Strip COLLATE "C" annotations so the existing expression patterns match
  // regardless of whether the JSON path has an explicit collation (introduced
  // to make byte-wise comparisons match MongoDB semantics).
  indexdef = indexdef.replace(/\s*COLLATE\s+"[^"]+"/gi, '');

  if (isGin) {
    // Text index: USING gin(to_tsvector('simple', coalesce(data->>'field', '') ...))
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
//   const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());
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

// Build JSON text path for nested fields (returns text, not jsonb).
//
// The result is wrapped with `COLLATE "C"` so string comparisons and sorts
// follow byte-wise Unicode code point order, matching MongoDB's default
// (non-collated) string semantics. Without this, Postgres would use the
// database/OS locale (typically en_US.UTF-8) which produces user-visible
// divergences from MongoDB in $gt/$lt/sort/range queries and also defeats
// btree indexes built on the same expression whenever predicates and
// indexes disagree on collation.
function buildJsonTextPath(field, prefix = 'data') {
  const parts = field.split('.');
  let path = prefix;
  for (let i = 0; i < parts.length - 1; i++) {
    path += jsonArrow(parts[i]);
  }
  // Last segment uses ->> for text extraction
  const last = parts[parts.length - 1];
  path += /^\d+$/.test(last) ? `->>${last}` : `->>'${escapeString(last)}'`;
  return `(${path}) COLLATE "C"`;
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
// Build a SQL condition matching `textExpr` against `regex`.
//
// When the regex is anchored and begins with a literal prefix, emit
// `textExpr >= P AND textExpr < upper(P) AND textExpr ~ src`. The range
// predicate is btree-indexable; the residual regex preserves correctness
// for any trailing pattern. MUTATES `params`.
function buildRegexMatchSql(textExpr, regex, params) {
  const flags = regex.ignoreCase ? '*' : '';
  const { prefix } = extractAnchoredLiteralPrefix(regex);
  const parts = [];
  if (prefix) {
    params.push(prefix);
    parts.push(`${textExpr} >= $${params.length}`);
    const upper = prefixUpperBound(prefix);
    if (upper !== null) {
      params.push(upper);
      parts.push(`${textExpr} < $${params.length}`);
    }
  }
  params.push(regex.source);
  parts.push(`${textExpr} ~${flags} $${params.length}`);
  return parts.length > 1 ? `(${parts.join(' AND ')})` : parts[0];
}

function buildWhereClause(query, params, prefix = 'data', options = {}) {
  const _pStart = profileStart();
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
      // Full-text search: { $text: { $search: "term" } }
      // Search against the text index fields stored in the table.
      // We use PostgreSQL's to_tsvector/to_tsquery for this.
      const searchTerm = value.$search;
      if (typeof searchTerm !== 'string') {
        throw new Error('$text.$search must be a string');
      }
      const textFields = options.textFields || [
        'highSearchText', 'lowSearchText', 'title', 'searchBoost'
      ];
      const tsvectorExpr = buildTsvectorExpr(textFields);
      const tsqueryExpr = buildTsqueryParam(searchTerm, params);
      if (!tsqueryExpr) {
        conditions.push('FALSE');
      } else {
        conditions.push(`${tsvectorExpr} @@ ${tsqueryExpr}`);
      }
    } else if (key === '_id') {
      // _id is a separate column, handle specially
      if (value instanceof RegExp) {
        conditions.push(buildRegexMatchSql('_id', value, params));
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
      const textExpr = buildJsonTextPath(key, prefix);
      // Scalar match uses the indexable range + residual regex rewrite.
      const scalarMatch = buildRegexMatchSql(textExpr, value, params);
      // Array-element fallback (regex only — no per-element index to exploit).
      const flags = value.ignoreCase ? '*' : '';
      params.push(value.source);
      const arrayMatch = `(jsonb_typeof(${jsonPath}) = 'array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(${jsonPath}) elem WHERE elem ~${flags} $${params.length}))`;
      conditions.push(`(${scalarMatch} OR ${arrayMatch})`);
    } else if (value === null || value === undefined) {
      // MongoDB: { field: null } and { field: undefined } both match
      // explicit null AND missing field
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

  profileEnd('buildWhereClause', _pStart);
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
          if (opValue === null || opValue === undefined) {
            conditions.push('_id IS NULL');
          } else {
            params.push(opValue);
            conditions.push(`_id = $${params.length}`);
          }
        } else {
          if (opValue === null || opValue === undefined) {
            // $eq: null matches both missing fields and explicit null values
            conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} = 'null'::jsonb)`);
          } else {
            params.push(JSON.stringify(serializeValue(opValue)));
            conditions.push(`${jsonPath} = $${params.length}::jsonb`);
          }
        }
        break;

      case '$ne':
        if (isIdField) {
          if (opValue === null || opValue === undefined) {
            conditions.push('_id IS NOT NULL');
          } else {
            params.push(opValue);
            conditions.push(`(_id IS NULL OR _id != $${params.length})`);
          }
        } else {
          if (opValue === null || opValue === undefined) {
            // $ne: null means "field exists and is not null"
            // Must exclude both missing fields (IS NULL) and JSON null values
            conditions.push(`(${jsonPath} IS NOT NULL AND ${jsonPath} != 'null'::jsonb)`);
          } else {
            params.push(JSON.stringify(serializeValue(opValue)));
            conditions.push(`(${jsonPath} IS NULL OR ${jsonPath} != $${params.length}::jsonb)`);
          }
        }
        break;

      case '$gt':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id > $${params.length}`);
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' > $${params.length}`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonTextPath} > $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(NULLIF(${jsonTextPath}, ''))::numeric > $${params.length}`);
        }
        break;

      case '$gte':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id >= $${params.length}`);
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' >= $${params.length}`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonTextPath} >= $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(NULLIF(${jsonTextPath}, ''))::numeric >= $${params.length}`);
        }
        break;

      case '$lt':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id < $${params.length}`);
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' < $${params.length}`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonTextPath} < $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(NULLIF(${jsonTextPath}, ''))::numeric < $${params.length}`);
        }
        break;

      case '$lte':
        if (isIdField) {
          params.push(opValue);
          conditions.push(`_id <= $${params.length}`);
        } else if (opValue instanceof Date) {
          params.push(opValue.toISOString());
          conditions.push(`${jsonPath}->>'$date' <= $${params.length}`);
        } else if (typeof opValue === 'string') {
          params.push(opValue);
          conditions.push(`${jsonTextPath} <= $${params.length}`);
        } else {
          params.push(opValue);
          conditions.push(`(NULLIF(${jsonTextPath}, ''))::numeric <= $${params.length}`);
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
          const regexValues = opValue.filter(v => v instanceof RegExp);
          const nonNullValues = opValue.filter(v => v !== null && !(v instanceof RegExp));
          const parts = [];
          if (nonNullValues.length > 0) {
            params.push(nonNullValues.map(v => JSON.stringify(serializeValue(v))));
            parts.push(`${jsonPath} @> ANY($${params.length}::jsonb[])`);
          }
          if (hasNull) {
            parts.push(`${jsonPath} IS NULL`);
          }
          // MongoDB supports RegExp values inside $in for pattern matching
          for (const regex of regexValues) {
            parts.push(buildRegexMatchSql(jsonTextPath, regex, params));
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
            params.push(nonNullValues.map(v => JSON.stringify(serializeValue(v))));
            parts.push(`NOT ${jsonPath} @> ANY($${params.length}::jsonb[])`);
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
        const regexOptions = operators.$options || '';
        const caseInsensitive = regexOptions.includes('i');
        // Reconstruct a RegExp so the helper can analyze the pattern uniformly.
        let regex;
        try {
          regex = new RegExp(pattern, caseInsensitive ? 'i' : '');
        } catch (e) {
          // Fall back to direct emission if the pattern isn't a valid JS RegExp
          params.push(pattern);
          conditions.push(
            `${isIdField ? '_id' : jsonTextPath} ~${caseInsensitive ? '*' : ''} $${params.length}`
          );
          break;
        }
        conditions.push(
          buildRegexMatchSql(isIdField ? '_id' : jsonTextPath, regex, params)
        );
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

      case '$size':
        params.push(opValue);
        conditions.push(
          `jsonb_typeof(${jsonPath}) = 'array' AND jsonb_array_length(${jsonPath}) = $${params.length}`
        );
        break;

      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  return conditions.join(' AND ');
}

// Build the tsvector SQL expression for a given list of text fields.
// Used by both the WHERE clause ($text matching) and SELECT (ts_rank scoring).
function buildTsvectorExpr(textFields) {
  const parts = textFields.map(f => {
    const fieldParts = f.split('.');
    let path = 'data';
    for (let i = 0; i < fieldParts.length - 1; i++) {
      path += `->'${escapeString(fieldParts[i])}'`;
    }
    path += `->>'${escapeString(fieldParts[fieldParts.length - 1])}'`;
    // COLLATE "C" here is ignored for the tsvector output but keeps this
    // expression textually identical to the CREATE INDEX expression
    // produced by createIndex so the planner can match the gin index.
    return `coalesce((${path}) COLLATE "C", '')`;
  });
  return `to_tsvector('simple', ${parts.join(' || \' \' || ')})`;
}

// Build the tsquery SQL expression from a search string.
// Returns { expr, params } where expr contains $N placeholders.
function buildTsqueryParam(searchTerm, params) {
  const words = searchTerm.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return null;
  }
  params.push(words.map(w => w.replace(/[&|!():*<>'"]/g, ' ')).join(' | '));
  return `to_tsquery('simple', $${params.length})`;
}

// Check if a query object contains a $text operator with a non-empty search string.
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

// Build ORDER BY clause
function buildOrderBy(sort, options = {}) {
  const _pStart = profileStart();
  const clauses = [];

  if (sort && Object.keys(sort).length > 0) {
    for (const [ field, direction ] of Object.entries(sort)) {
      if (direction && typeof direction === 'object' && direction.$meta === 'textScore') {
        // Sort by text search relevance score (descending — higher is better)
        if (options.hasTextScore) {
          clauses.push('_score DESC');
        }
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
  profileEnd('buildOrderBy', _pStart);
  return `ORDER BY ${clauses.join(', ')}`;
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

  // Build the SELECT SQL + params that this cursor would execute. Shared
  // by toArray/_next and exposed via explain() so tests and callers can
  // introspect the planned query without re-deriving the SQL by hand.
  _buildFindSql() {
    const params = [];
    const queryOptions = this._collection._queryOptions();
    const qualifiedName = this._collection._qualifiedName();
    const whereClause = buildWhereClause(this._query, params, 'data', queryOptions);
    const hasText = queryHasText(this._query);
    const orderBy = buildOrderBy(this._sort, { hasTextScore: hasText });

    // When a $text query is active, compute ts_rank as _score
    let selectCols = '_id, data';
    if (hasText) {
      const textFields = queryOptions.textFields || [
        'highSearchText', 'lowSearchText', 'title', 'searchBoost'
      ];
      const tsvectorExpr = buildTsvectorExpr(textFields);
      const tsqueryExpr = buildTsqueryParam(this._query.$text.$search, params);
      if (tsqueryExpr) {
        selectCols += `, ts_rank(${tsvectorExpr}, ${tsqueryExpr}) AS _score`;
      }
    }

    let sql = `SELECT ${selectCols} FROM ${qualifiedName} WHERE ${whereClause} ${orderBy}`;
    if (this._limit != null) {
      sql += ` LIMIT ${this._limit}`;
    }
    if (this._skip != null) {
      sql += ` OFFSET ${this._skip}`;
    }
    return {
      sql,
      params
    };
  }

  // Returns the SQL and parameter values the adapter would execute for
  // this cursor's current query/sort/limit/skip/projection. Useful for
  // EXPLAIN-based tests and for debugging query planner behavior. The
  // returned SQL uses the adapter's native placeholder style ($N for
  // PostgreSQL).
  async explain() {
    await this._collection._ensureTable();
    return this._buildFindSql();
  }

  async toArray() {
    const _pStart = profileStart();
    await this._collection._ensureTable();

    const { sql, params } = this._buildFindSql();

    const _qStart = profileStart();
    const result = await this._collection._pool.query(sql, params);
    profileQuery(sql, _qStart);
    const rows = result.rows.map(row => {
      const doc = deserializeDocument(row.data, row._id);
      const meta = row._score != null ? { textScore: parseFloat(row._score) } : {};
      return this._projection ? applyProjection(doc, this._projection, meta) : doc;
    });
    profileEnd('findToArray', _pStart);
    return rows;
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
    if (this._peeked !== undefined) {
      const doc = this._peeked;
      this._peeked = undefined;
      if (doc === null) {
        this._exhausted = true;
      }
      return doc;
    }
    if (this._exhausted) {
      return null;
    }
    if (!this._cursorClient) {
      await this._collection._ensureTable();
      this._cursorClient = await this._collection._pool.connect();
      this._cursorName = `cur_${generateId()}`;

      const { sql, params } = this._buildFindSql();

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
    const meta = row._score != null ? { textScore: parseFloat(row._score) } : {};
    return this._projection ? applyProjection(doc, this._projection, meta) : doc;
  }

  async hasNext() {
    if (this._exhausted) {
      return false;
    }
    if (this._peeked !== undefined) {
      return this._peeked !== null;
    }
    this._peeked = await this._next();
    return this._peeked !== null;
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
    const _pStart = profileStart();
    await this._collection._ensureTable();

    const params = [];
    const qualifiedName = this._collection._qualifiedName();
    const whereClause = buildWhereClause(this._query, params, 'data', this._collection._queryOptions());
    const sql = `SELECT COUNT(*) as count FROM ${qualifiedName} WHERE ${whereClause}`;
    const _qStart = profileStart();
    const result = await this._collection._pool.query(sql, params);
    profileQuery(sql, _qStart);
    profileEnd('countDocuments', _pStart);
    return parseInt(result.rows[0].count, 10);
  }
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
    this._textFields = null;
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

  _queryOptions() {
    return this._textFields ? { textFields: this._textFields } : {};
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
    const _pStart = profileStart();

    // In multi-schema mode, ensure the schema exists
    if (this._schema) {
      await this._pool.query(
        `CREATE SCHEMA IF NOT EXISTS "${escapeIdentifier(this._schema)}"`
      );
    }

    const qualifiedName = this._qualifiedName();
    await this._pool.query(`
      CREATE TABLE IF NOT EXISTS ${qualifiedName} (
        _id TEXT COLLATE "C" PRIMARY KEY,
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
    profileEnd('ensureTable', _pStart);
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
    const _pStart = profileStart();
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());
    const sql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause} LIMIT 1`;

    const _qStart = profileStart();
    const result = await this._pool.query(sql, params);
    profileQuery(sql, _qStart);
    if (result.rows.length === 0) {
      profileEnd('findOne', _pStart);
      return null;
    }

    const doc = deserializeDocument(result.rows[0].data, result.rows[0]._id);
    const final = options.projection ? applyProjection(doc, options.projection) : doc;
    profileEnd('findOne', _pStart);
    return final;
  }

  find(query, options) {
    return new PostgresCursor(this, query, options);
  }

  async updateOne(query, update, options = {}) {
    const _pStart = profileStart();
    await this._ensureTable();

    // Handle legacy callback as third argument (ignore the callback, PostgreSQL
    // adapter is Promise-based)
    if (typeof options === 'function') {
      options = {};
    }

    // Single-statement fast path: when the update uses only simple
    // operators without upsert, execute a single UPDATE statement
    // instead of the read-modify-write cycle. $push, $pull and
    // $addToSet are included only when all their values are scalars.
    if (!options.upsert) {
      const atomicOps = [
        '$inc', '$set', '$unset', '$currentDate',
        '$push', '$pull', '$addToSet'
      ];
      const ops = Object.keys(update);
      const isAtomicCompatible = ops.length > 0 &&
        ops.every(op => atomicOps.includes(op));
      if (isAtomicCompatible) {
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
          const result = await this._atomicUpdateOne(query, update);
          profileEnd('updateOne', _pStart);
          return result;
        }
      }
    }

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    const selectSql = `SELECT _id, data FROM ${qualifiedName} WHERE ${whereClause} LIMIT 1`;
    const _qStart = profileStart();
    const selectResult = await this._pool.query(selectSql, params);
    profileQuery(selectSql, _qStart);

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

  // Atomic update using SQL expressions for $inc, $set, $unset,
  // $currentDate, $push, $pull, $addToSet (no read-modify-write race)
  async _atomicUpdateOne(query, update) {
    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    // Build a chain of jsonb_set / #- calls for atomic update
    let dataExpr = 'data';

    if (update.$set) {
      for (const [ field, value ] of Object.entries(update.$set)) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        const serialized = serializeValue(value);
        params.push(JSON.stringify(serialized));
        dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, $${params.length}::jsonb, true)`;
      }
    }

    if (update.$inc) {
      for (const [ field, value ] of Object.entries(update.$inc)) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        let readPath = 'data';
        for (let i = 0; i < pathArray.length - 1; i++) {
          readPath += `->'${escapeString(pathArray[i])}'`;
        }
        readPath += `->>'${escapeString(pathArray[pathArray.length - 1])}'`;
        params.push(value);
        dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, to_jsonb(COALESCE((${readPath})::numeric, 0) + $${params.length}), true)`;
      }
    }

    if (update.$unset) {
      const fields = Array.isArray(update.$unset)
        ? update.$unset
        : Object.keys(update.$unset);
      for (const field of fields) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        dataExpr = `(${dataExpr}) #- ${pathLiteral}`;
      }
    }

    if (update.$currentDate) {
      for (const [ field, value ] of Object.entries(update.$currentDate)) {
        if (value === true || (value && value.$type === 'date')) {
          const pathArray = field.split('.');
          const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
          const dateVal = JSON.stringify(serializeValue(new Date()));
          params.push(dateVal);
          dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, $${params.length}::jsonb, true)`;
        }
      }
    }

    // $push: append scalar value to array
    if (update.$push) {
      for (const [ field, value ] of Object.entries(update.$push)) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        const readPath = pathArray.map(p => `'${escapeString(p)}'`).join('->');
        const coalesced = `COALESCE(data->${readPath}, '[]'::jsonb)`;
        params.push(JSON.stringify(value));
        dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, ${coalesced} || $${params.length}::jsonb, true)`;
      }
    }

    // $pull: remove scalar value from array
    if (update.$pull) {
      for (const [ field, value ] of Object.entries(update.$pull)) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        const readPath = pathArray.map(p => `'${escapeString(p)}'`).join('->');
        params.push(JSON.stringify(value));
        dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, ` +
          '(SELECT COALESCE(jsonb_agg(elem), \'[]\'::jsonb) ' +
          `FROM jsonb_array_elements(COALESCE(data->${readPath}, '[]'::jsonb)) AS elem ` +
          `WHERE elem != $${params.length}::jsonb), true)`;
      }
    }

    // $addToSet: add scalar value to array if not already present
    if (update.$addToSet) {
      for (const [ field, value ] of Object.entries(update.$addToSet)) {
        const pathArray = field.split('.');
        const pathLiteral = `'{${pathArray.map(p => escapeString(p)).join(',')}}'`;
        const readPath = pathArray.map(p => `'${escapeString(p)}'`).join('->');
        const coalesced = `COALESCE(data->${readPath}, '[]'::jsonb)`;
        params.push(JSON.stringify(value));
        dataExpr = `jsonb_set(${dataExpr}, ${pathLiteral}, ` +
          `CASE WHEN ${coalesced} @> $${params.length}::jsonb ` +
          `THEN ${coalesced} ` +
          `ELSE ${coalesced} || $${params.length}::jsonb END, true)`;
      }
    }

    const sql = `UPDATE ${qualifiedName} SET data = ${dataExpr} WHERE ${whereClause}`;
    try {
      const _qStart = profileStart();
      const result = await this._pool.query(sql, params);
      profileQuery(sql, _qStart);
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
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

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
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

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
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

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
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

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
    const _pStart = profileStart();
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());
    const sql = `SELECT COUNT(*) as count FROM ${qualifiedName} WHERE ${whereClause}`;

    const _qStart = profileStart();
    const result = await this._pool.query(sql, params);
    profileQuery(sql, _qStart);
    profileEnd('countDocuments', _pStart);
    return parseInt(result.rows[0].count, 10);
  }

  async distinct(field, query = {}) {
    const _pStart = profileStart();
    await this._ensureTable();

    const params = [];
    const qualifiedName = this._qualifiedName();
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

    if (field === '_id') {
      const sql = `SELECT DISTINCT _id as value FROM ${qualifiedName} WHERE ${whereClause}`;
      const _qStart = profileStart();
      const result = await this._pool.query(sql, params);
      profileQuery(sql, _qStart);
      profileEnd('distinct', _pStart);
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
    const _qStart = profileStart();
    const result = await this._pool.query(sql, params);
    profileQuery(sql, _qStart);

    const values = result.rows
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
    profileEnd('distinct', _pStart);
    return values;
  }

  aggregate(pipeline) {
    return new AggregationCursor(this, pipeline);
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
    const whereClause = buildWhereClause(query, params, 'data', this._queryOptions());

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

      // Default: text extraction for equality/text queries.
      //
      // Wrapped with COLLATE "C" to match buildJsonTextPath so that query
      // predicates and this index expression agree on collation; otherwise
      // the planner cannot use the index for range/equality comparisons.
      // Byte-wise ordering also matches MongoDB's default string semantics.
      if (parts.length === 1) {
        return `(data->>'${escapeString(parts[0])}') COLLATE "C"`;
      }
      // For nested: data->'user'->>'name'
      let path = 'data';
      for (let i = 0; i < parts.length - 1; i++) {
        path += `->'${escapeString(parts[i])}'`;
      }
      path += `->>'${escapeString(parts[parts.length - 1])}'`;
      return `(${path}) COLLATE "C"`;
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
      ? sanitizeIndexName(options.name)
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
      let textFields = keyEntries.filter(([ , v ]) => v === 'text').map(([ k ]) => k);
      // MongoDB dumps store text indexes as { _fts: 'text', _ftsx: 1 }
      // The real field names are in options.weights
      if (textFields.length === 1 && textFields[0] === '_fts' && options.weights) {
        textFields = Object.keys(options.weights);
      }
      // Store the text index fields so $text queries use them
      this._textFields = textFields;
      const tsvectorExpr = textFields
        .map(f => `coalesce(${buildIndexPath(f, null)}, '')`)
        .join(' || \' \' || ');

      await this._pool.query(`
        CREATE INDEX IF NOT EXISTS "${escapedIndexName}"
        ON ${qualifiedName}
        USING gin(to_tsvector('simple', ${tsvectorExpr}))${whereClause}
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

  async ensureIndex(keys, options) {
    return this.createIndex(keys, options);
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
      // Try as a direct postgres index name. Use the same sanitizer as
      // createIndex so a name like "slug_unique" created via createIndex
      // can be dropped with the same string, and MongoDB-style names with
      // illegal characters don't throw.
      pgName = sanitizeIndexName(indexName);
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
    const realDb = this._client._realDb;
    return {
      async listDatabases() {
        if (multiSchema) {
          // List all non-system schemas as virtual "databases",
          // prefixed with the real PostgreSQL database name
          const result = await pool.query(`
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name NOT IN ('public', 'information_schema', 'pg_catalog', 'pg_toast')
            AND schema_name NOT LIKE 'pg_%'
          `);
          const databases = result.rows.map(row => ({
            name: realDb + '-' + row.schema_name
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
    this._realDb = options._realDb || null;
    this._databases = new Map();
  }

  db(name) {
    if (!this._multiSchema) {
      // Simple mode: only the database from the connection URI is allowed.
      if (name && name !== this._defaultDb) {
        throw new Error(
          `Cannot switch to database "${name}" in simple postgres:// mode.\n` +
          'All database names would share the same tables, causing data collisions.\n' +
          'Use a multipostgres:// URI for independent per-name data (via schemas).'
        );
      }
      if (!this._databases.has(this._defaultDb)) {
        this._databases.set(this._defaultDb, new PostgresDb(this, this._defaultDb, null));
      }
      return this._databases.get(this._defaultDb);
    }
    // Multi-schema mode: the virtual database name must start with
    // the real PostgreSQL database name followed by a hyphen.
    // The schema is derived from what follows that prefix.
    const dbName = name || this._defaultDb;
    const prefix = this._realDb + '-';
    if (!dbName.startsWith(prefix)) {
      throw new Error(
        `Invalid virtual database name "${dbName}": must start with "${prefix}".`
      );
    }
    const schema = dbName.substring(prefix.length);
    if (!this._databases.has(dbName)) {
      this._databases.set(dbName, new PostgresDb(this, dbName, schema));
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
    let realDb = null;
    let connectionUri = uri;

    if (url.protocol === 'multipostgres:') {
      // Multi-schema mode: multipostgres://host/realdb-schemaname
      // The full path is the virtual "database name" (like MongoDB's database name).
      // The real PostgreSQL database is everything before the last hyphen.
      // The default schema is everything after the last hyphen.
      multiSchema = true;
      const path = url.pathname.slice(1); // e.g. 'shared-db-dashboard'
      const lastHyphen = path.lastIndexOf('-');
      if (lastHyphen === -1) {
        throw new Error(
          'multipostgres:// URI must contain at least one hyphen in the path: ' +
          'multipostgres://host/realdb-schemaname'
        );
      }
      realDb = path.substring(0, lastHyphen);
      defaultSchema = path.substring(lastHyphen + 1);
      // The virtual database name is the full path, matching MongoDB conventions
      database = path;

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
      _defaultSchema: defaultSchema,
      _realDb: realDb
    });
  },
  profileReport,
  profileReset
};
