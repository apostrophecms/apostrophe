// Shared helper functions used by both the SQLite and PostgreSQL adapters.
// These operate on plain JavaScript objects and have no database-specific logic.

// =============================================================================
// Value Serialization (Date handling)
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
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  const doc = convertDates(parsed);
  if (doc === parsed) {
    // No dates found — shallow copy to add _id without mutating parsed data
    return {
      _id: id,
      ...doc
    };
  }
  doc._id = id;
  return doc;
}

// =============================================================================
// Nested Field Operations
// =============================================================================

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
  if (parts.includes('__proto__')) {
    return;
  }
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
// Projection (in-memory)
// =============================================================================

function applyProjection(doc, projection, meta = {}) {
  if (!projection || Object.keys(projection).length === 0) {
    return doc;
  }

  // Separate $meta projections (e.g. score: { $meta: 'textScore' })
  // from regular field projections
  const metaFields = Object.entries(projection).filter(
    ([ k, v ]) => v && typeof v === 'object' && v.$meta
  );
  const fields = Object.entries(projection).filter(
    ([ k, v ]) => !(v && typeof v === 'object' && v.$meta)
  );

  const applyMeta = (result) => {
    for (const [ field, spec ] of metaFields) {
      if (spec.$meta === 'textScore' && meta.textScore != null) {
        result[field] = meta.textScore;
      }
    }
    return result;
  };

  if (fields.length === 0) {
    return applyMeta({ ...doc });
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
    return applyMeta(result);
  } else {
    const result = JSON.parse(JSON.stringify(doc));
    for (const [ field, include ] of fields) {
      if (!include) {
        unsetNestedField(result, field);
      }
    }
    return applyMeta(result);
  }
}

// =============================================================================
// Update Operations (in-memory)
// =============================================================================

function applyUpdate(doc, update) {
  // Pipeline-form update: array of stages like [{ $unset: [...] }, { $set: {...} }]
  if (Array.isArray(update)) {
    let result = { ...doc };
    for (const stage of update) {
      result = applyUpdate(result, stage);
    }
    return result;
  }

  const result = { ...doc };

  for (const [ op, fields ] of Object.entries(update)) {
    switch (op) {
      case '$set':
        for (const [ field, value ] of Object.entries(fields)) {
          setNestedField(result, field, value);
        }
        break;
      case '$unset':
        if (Array.isArray(fields)) {
          // Pipeline form: $unset takes an array of field names
          for (const field of fields) {
            unsetNestedField(result, field);
          }
        } else {
          for (const field of Object.keys(fields)) {
            unsetNestedField(result, field);
          }
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
      case '$rename':
        for (const [ oldField, newField ] of Object.entries(fields)) {
          const value = getNestedField(result, oldField);
          if (value !== undefined) {
            unsetNestedField(result, oldField);
            setNestedField(result, newField, value);
          }
        }
        break;
      default:
        throw new Error(`Unsupported update operator: ${op}`);
    }
  }

  return result;
}

// =============================================================================
// Anchored-Literal Prefix Extraction (for indexable regex queries)
// =============================================================================

// Characters that are regex metacharacters when unescaped. Anything not in
// this set is a literal and can contribute to the prefix.
const REGEX_META = new Set([ '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '^', '$', '\\' ]);

// Extract the literal prefix from a regex rooted at the start of the string,
// for use as an indexable range predicate. Returns an object
// { prefix, anchored } where `prefix` is the literal string that every match
// must begin with, and `anchored` indicates the regex begins with `^`.
//
// Returns { prefix: '', anchored: false } when no useful rewrite is possible
// (unanchored regex, case-insensitive regex, or the regex begins with a
// metacharacter).
//
// Example:
//   extractAnchoredLiteralPrefix(/^\/parent\/child\/./)
//     -> { prefix: '/parent/child/', anchored: true }
//   extractAnchoredLiteralPrefix(/^foo.*bar/)
//     -> { prefix: 'foo', anchored: true }
//   extractAnchoredLiteralPrefix(/foo/)
//     -> { prefix: '', anchored: false }
function extractAnchoredLiteralPrefix(regex) {
  if (!(regex instanceof RegExp)) {
    return {
      prefix: '',
      anchored: false
    };
  }
  // Case-insensitive regex cannot align with a case-sensitive btree range scan.
  if (regex.ignoreCase) {
    return {
      prefix: '',
      anchored: false
    };
  }
  const source = regex.source;
  if (source.length === 0 || source[0] !== '^') {
    return {
      prefix: '',
      anchored: false
    };
  }
  let i = 1;
  let prefix = '';
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      // Escape sequence: the next character may be a literal or a character class
      if (i + 1 >= source.length) {
        break;
      }
      const next = source[i + 1];
      // Single-character escapes for a literal character (\. \/ \- \( \\ etc.)
      // — anything that is a regex metacharacter, plus '/' and similar. These
      // contribute the escaped character itself to the prefix.
      if (REGEX_META.has(next) || next === '/' || next === '-' || next === '=' || next === '!' || next === ':' || next === ',' || next === '#' || next === ' ' || next === '"' || next === '\'' || next === '<' || next === '>' || next === '@' || next === '~' || next === '`' || next === '%' || next === '&' || next === ';') {
        prefix += next;
        i += 2;
        continue;
      }
      // Any other escape (\d, \w, \s, \b, \n, \t, \uXXXX, \xXX, etc.) is not
      // a simple literal — stop here.
      break;
    }
    if (REGEX_META.has(ch)) {
      // Unescaped metacharacter ends the literal prefix. Quantifiers (`?`,
      // `*`, `{`) make the *preceding* literal optional or zero-or-more, so
      // that character is not guaranteed to appear in matches and must be
      // dropped from the prefix. `+` guarantees at least one occurrence of
      // the preceding literal, so the literal stays.
      if ((ch === '?' || ch === '*' || ch === '{') && prefix.length > 0) {
        prefix = prefix.slice(0, -1);
      }
      break;
    }
    prefix += ch;
    i++;
  }
  return {
    prefix,
    anchored: true
  };
}

// Given a literal prefix P, return the exclusive upper bound string U such
// that a string S starts with P iff P <= S < U. Returns null when no safe
// upper bound can be constructed (empty prefix, or last char is the maximum
// BMP code point 0xFFFF). Callers should treat a null result as "emit only
// the lower-bound predicate".
function prefixUpperBound(prefix) {
  if (!prefix) {
    return null;
  }
  const lastCode = prefix.charCodeAt(prefix.length - 1);
  if (lastCode === 0xFFFF) {
    return null;
  }
  return prefix.slice(0, -1) + String.fromCharCode(lastCode + 1);
}

function validateInteger(value, name) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return num;
}

module.exports = {
  serializeValue,
  serializeDocument,
  convertDates,
  deserializeDocument,
  getNestedField,
  setNestedField,
  unsetNestedField,
  deepEqual,
  applyProjection,
  applyUpdate,
  extractAnchoredLiteralPrefix,
  prefixUpperBound,
  validateInteger
};
