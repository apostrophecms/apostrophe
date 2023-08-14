// Detect whether a document or document field has been changed,
// in a way that warrants confirmation before exiting a modal,
// or emitting an update event
// Optionally returns an array of differeing field names

import { isEqual } from 'lodash';

export function detectDocChange(schema, v1, v2, options = {}) {
  // Handle null docs
  if (!v1) {
    // If there is no v1 then it's a change if there is a v2
    return !!v2;
  }
  if (!v2) {
    // If there is no v2 then it's a change if there was a v1
    return !!v1;
  }
  if (options.differences) {
    const differences = [];
    schema.forEach(field => {
      if (detectFieldChange(field, v1[field.name], v2[field.name])) {
        differences.push(field.name);
      }
    });
    return differences;
  } else {
    return schema.some(field => {
      return detectFieldChange(field, v1[field.name], v2[field.name]);
    });
  }
}

export function detectFieldChange(field, v1, v2) {
  if (field.type === 'relationshipReverse') {
    return false;
  }
  if (field.type === 'relationship') {
    v1 = relevantRelationship(v1);
    v2 = relevantRelationship(v2);
  } else {
    v1 = relevant(v1);
    v2 = relevant(v2);
  }
  if (isEqual(v1, v2)) {
    return false;
  } else if (!v1 && !v2) {
    // False values from select,
    // radio and boolean fields are
    // detected as a change when selected.
    if (
      (v1 === false && v2 !== false) ||
      (v1 !== false && v2 === false)
    ) {
      return true;
    }
    return false;
  } else if (!v1 && Array.isArray(v2) && v2.length === 0) {
    return false;
  } else {
    return true;
  }
  function relevant(o) {
    if ((o != null) && ((typeof o) === 'object')) {
      const newObject = {};
      for (const [ key, val ] of Object.entries(o)) {
        if (key === '_docId') {
          newObject._docId = o._docId.replace(/:.*$/, '');
        } else if (key === '_id') {
          // So draft and published can be compared
          newObject._id = o._id.replace(/:[\w-]+:[\w]+$/, '');
        } else if (key.substring(0, 1) === '_') {
          // Different results for temporary properties
          // don't matter, except for relationships
          if (Array.isArray(o[key])) {
            newObject[key] = relevantRelationship(o[key]);
          } else {
            continue;
          }
        } else {
          newObject[key] = relevant(val);
        }
      }
      return newObject;
    }
    return o;
  }
  function relevantRelationship(a) {
    if (!Array.isArray(a)) {
      return [];
    }
    return a.map(item => ({
      // So draft and published can be compared
      _id: item._id.replace(/:[\w-]+:[\w]+$/, ''),
      _fields: relevant(item._fields)
    }));
  }
}
