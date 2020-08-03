// A small library of functions for cloning and manipulating
// objects while respecting rules like Apostrophe's "_ means a temporary property"
// policy, support for dot and @ notation, MongoDB-style patching, etc. This library
// is located here to allow easy import from both browser and server side. The methods
// of this library are available on the `apos.util` object on the server side.

const _ = require('lodash');

module.exports = {
  clonePermanent,
  get,
  set,
  findNestedObjectById,
  findNestedObjectAndDotPathById,
  applyPatchOperators,
  resolveAtReference
};

// Clone the given object recursively, discarding all
// properties whose names begin with `_` except
// for `_id`. Returns the clone.
//
// This removes the output of joins and
// other dynamic loaders, so that dynamically available
// content is not stored redundantly in MongoDB.
//
// If the object is an array, the clone is also an array.
//
// Date objects are cloned as such. All other non-JSON
// objects are cloned as plain JSON objects.
//
// If `keepScalars` is true, properties beginning with `_`
// are kept as long as they are not objects. This is useful
// when using `clonePermanent` to limit JSON inserted into
// browser attributes, rather than filtering for the database.
// Preserving simple string properties like `._url` is usually
// a good thing in the former case.
//
// Arrays are cloned as such only if they are true arrays
// (Array.isArray returns true). Otherwise all objects with
// a length property would be treated as arrays, which is
// an unrealistic restriction on apostrophe doc schemas.

function clonePermanent(o, keepScalars) {
  let c;
  let isArray = Array.isArray(o);
  if (isArray) {
    c = [];
  } else {
    c = {};
  }
  function iterator(val, key) {
    // careful, don't crash on numeric keys
    if (typeof key === 'string') {
      if (key.charAt(0) === '_' && key !== '_id') {
        if (!keepScalars || typeof val === 'object') {
          return;
        }
      }
    }
    if (val === null || val === undefined) {
      // typeof(null) is object, sigh
      c[key] = null;
    } else if (typeof val !== 'object') {
      c[key] = val;
    } else if (val instanceof Date) {
      c[key] = new Date(val);
    } else {
      c[key] = clonePermanent(val, keepScalars);
    }
  }
  if (isArray) {
    o.forEach(iterator);
  } else {
    Object.keys(o).forEach(key => iterator(o[key], key, o));
  }
  return c;
}

// fetch the value at the given path from the object or
// array `o`. `path` supports dot notation like MongoDB, and
// in addition if the first component begins with `@xyz` the
// sub-object within `o` with an `_id` property equal to `xyz`
// is found and returned, no matter how deeply nested it is.

function get(o, path) {
  let i;
  path = path.split('.');
  for (i = 0; (i < path.length); i++) {
    let p = path[i];
    if ((i === 0) && (p.charAt(0) === '@')) {
      o = findNestedObjectById(o, p.substring(1));
    } else {
      o = o[p];
    }
  }
  return o;
}

// set the value at the given path within the object or
// array `o`. `path` supports dot notation like MongoDB. In
// addition if the first component begins with `@xyz` the
// sub-object within `o` with an `_id` property equal to `xyz`.
// is located, no matter how deeply nested it is. If that is
// the only component of the path the sub-object is replaced
// with v. If there are further components via dot notation,
// they are honored to locate the final location for `v`.
//
// The `@` syntax works only for locating sub-objects. You may
// not pass `@abc` where `abc` is the `_id` of `o` itself.
function set(o, path, v) {
  let i;
  let p;
  let matches;
  if (path.charAt(0) === '@') {
    matches = path.match(/^@([^.]+)(.*)$/);
    if (!matches) {
      throw new Error(`@ syntax used without an id: ${path}`);
    }
    let found = findNestedObjectAndDotPathById(o, matches[1]);
    if (found) {
      if (matches[2].length) {
        o = found.object;
        path = matches[2].substring(1);
      } else {
        path = found.dotPath;
      }
    } else {
      return;
    }
  }
  path = path.split('.');
  for (i = 0; (i < (path.length - 1)); i++) {
    p = path[i];
    o = o[p];
  }
  p = path[i];
  o[p] = v;
}

// Within the given object (typically a doc or widget),
// find a subobject with the given `_id` property.
// Can be nested at any depth.
//
// Useful to locate a specific widget within a doc.

function findNestedObjectById(object, _id) {
  let key;
  let val;
  let result;
  for (key in object) {
    val = object[key];
    if (val && typeof val === 'object') {
      if (val._id === _id) {
        return val;
      }
      result = findNestedObjectById(val, _id);
      if (result) {
        return result;
      }
    }
  }
}

// Within the given object (typically a doc or widget),
// find a subobject with the given `_id` property.
// Can be nested at any depth.
//
// Useful to locate a specific widget within a doc.
//
// Returns an object like this: `{ object: { ... }, dotPath: 'dot.path.of.object' }`
//
// Ignore the `_dotPath` argument to this method; it is used for recursion.
function findNestedObjectAndDotPathById(object, id, _dotPath) {
  let key;
  let val;
  let result;
  let subPath;
  _dotPath = _dotPath || [];
  for (key in object) {
    val = object[key];
    if (val && typeof val === 'object') {
      subPath = _dotPath.concat(key);
      if (val._id === id) {
        return {
          object: val,
          dotPath: subPath.join('.')
        };
      }
      result = findNestedObjectAndDotPathById(val, id, subPath);
      if (result) {
        return result;
      }
    }
  }
}

// Support for patching in-memory objects using MongoDB-style operators, dot notation
// and @ notation as described below, as well as simple properties intended
// to directly replace properties of `existing`. On exit, `patch` will contain
// only simple properties intended to directly replace properites of `existing`,
// and can thus be used to update it simply with Object.assign, or passed to
// `convert` if the input is untrusted.
//
// Where needed, copies content from `existing` based on the operators, dot notation
// references and @ notation references present in `patch`.
//
// When this operation is complete every top level object impacted by the patch
// will be present in the returned object. Implements Mongo-style `$push`, $pullAll`
// and `$pullAllById` in addition to dot notation and support for the use of
// `@_id` syntax in the first component of a path. `$push` includes
// support for `$each`, `$position`, and the apostrophe-specific
// `$before` and `$after` which take the `_id` of an existing object
// in the array to insert before or after, as an alternative to
// `$position`. Like MongoDB, Apostrophe requires `$each` when
// using `$position`, `$before` or `$after`. For durability,
// if `$position`, `$before` or `$after` has an invalid value
// the insertion takes place at the end of the existing array.
//
// May be called with untrusted user input. After doing so,
// `schema.subsetSchemaForPatch` should then be used together with
// `convert` to update a trusted object with the untrusted data
// returned by this method.

function applyPatchOperators(patch, existing) {
  const clonedBases = {};
  if (patch.$push) {
    append(patch.$push);
  } else if (patch.$pullAll) {
    _.each(patch.$pullAll, function(val, key) {
      cloneOriginalBase(key);
      set(patch, key, _.differenceWith(get(patch, key) || [], Array.isArray(val) ? val : [], function(a, b) {
        return _.isEqual(a, b);
      }));
    });
  } else if (patch.$pullAllById) {
    _.each(patch.$pullAllById, function(val, key) {
      cloneOriginalBase(key);
      if (!Array.isArray(val)) {
        val = [ val ];
      }
      set(patch, key, _.differenceWith(get(patch, key) || [], Array.isArray(val) ? val : [], function(a, b) {
        return a._id === b;
      }));
    });
  } else if (patch.$move) {
    _.each(patch.$move, function(val, key) {
      cloneOriginalBase(key);
      if ((val == null) || (!((typeof val) === 'object'))) {
        return;
      }
      const existing = get(patch, key) || [];
      const index = existing.findIndex(item => item._id === val.$item);
      if (index === -1) {
        return;
      }
      const itemValue = existing[index];
      existing.splice(index, 1);
      if (val.$before) {
        const beforeIndex = existing.findIndex(item => item._id === val.$before);
        if (beforeIndex !== -1) {
          existing.splice(beforeIndex, 0, itemValue);
        } else {
          existing.splice(index, 0, itemValue);
        }
      } else if (val.$after) {
        const afterIndex = existing.findIndex(item => item._id === val.$after);
        if (afterIndex !== -1) {
          existing.splice(afterIndex + 1, 0, itemValue);
        } else {
          existing.splice(index, 0, itemValue);
        }
      } else {
        existing.splice(index, 0, itemValue);
      }
    });
  }
  _.each(patch, function(val, key) {
    if (key.charAt(0) !== '$') {
      key = resolveAtReference(existing, key);
      // Simple replacement with a dot path
      if (key.indexOf('.') !== -1) {
        cloneOriginalBase(key);
        set(patch, key, val);
      }
    }
  });
  function append(data) {
    _.each(data, function(val, key) {
      cloneOriginalBase(key);
      if (val && val.$each) {
        const each = Array.isArray(val.$each) ? val.$each : [];
        let existing = get(patch, key) || [];
        if (!Array.isArray(existing)) {
          const e = new Error('existing property is not an array');
          e.data = {
            dotPath: key
          };
          e.name = 'invalid';
          throw e;
        }
        let position;
        if (_.has(val, '$position')) {
          position = ((typeof val.$position) === 'number') ? Math.floor(val.$position) : 0;
          if ((position < 0) || (position > existing.length)) {
            position = existing.length;
          }
        } else if (_.has(val, '$before')) {
          position = _.findIndex(existing, item => item._id === val.$before);
          if (position === -1) {
            position = existing.length;
          }
        } else if (_.has(val, '$after')) {
          position = _.findIndex(existing, item => item._id === val.$after);
          if (position === -1) {
            position = existing.length;
          } else {
            // after
            position++;
          }
        } else {
          position = existing.length;
        }
        const updated = existing.slice(0, position).concat(each).concat(existing.slice(position));
        set(patch, key, updated);
      } else {
        let existing = get(patch, key) || [];
        existing.push(val);
        set(patch, key, existing);
      }
    });
  }
  function cloneOriginalBase(key) {
    if (key.charAt(0) === '@') {
      let _id = key.substring(1);
      const dot = _id.indexOf('.');
      if (dot !== -1) {
        _id = _id.substring(0, dot);
      }
      const result = findNestedObjectAndDotPathById(existing, _id);
      if (!result) {
        const e = new Error('@ reference invalid');
        e.data = {
          '@path': key
        };
        e.name = 'invalid';
        throw e;
      }
      key = result.dotPath;
    }
    if (key.indexOf('.') === -1) {
      // No need, we are replacing the base
    }
    const base = key.split('.')[0];
    if (!clonedBases[base]) {
      if (_.has(existing, base)) {
        patch[base] = clonePermanent(existing[base]);
      }
      clonedBases[base] = true;
    }
  }
}

// Returns `path` with any @ reference present resolved to a full
// dot path pointing to a property or sub-property of `o` whose
// `_id` matches the reference. If the reference cannot be resolved
// path is returned as-is. If there is no @ reference path is returned as-is.
function resolveAtReference(o, path) {
  path = path.split('.');
  if (path[0] && (path[0].charAt(0) === '@')) {
    const info = findNestedObjectAndDotPathById(o, path[0].substring(1));
    if (!info) {
      return path.join('.');
    }
    if (path.length > 1) {
      return info.dotPath + '.' + (path.slice(1).join('.'));
    } else {
      return info.dotPath;
    }
  } else {
    return path.join('.');
  }
}
