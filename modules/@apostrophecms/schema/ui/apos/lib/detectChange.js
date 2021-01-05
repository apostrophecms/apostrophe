// Detect whether a document or document field has been changed,
// in a way that warrants confirmation before exiting a modal,
// or emitting an update event

import { isEqual } from 'lodash';

export function detectDocChange(schema, v1, v2) {
  return schema.some(field => {
    return detectFieldChange(field, v1[field.name], v2[field.name]);
  });
}

export function detectFieldChange(field, v1, v2) {
  v1 = localeFreeDocId(v1);
  v2 = localeFreeDocId(v2);
  if (isEqual(v1, v2)) {
    return false;
  } else if (!v1 && !v2) {
    return false;
  } else if (!v1 && Array.isArray(v2) && v2.length === 0) {
    return false;
  } else {
    console.log('different: ' + field.name, v1, v2);
    return true;
  }
  function localeFreeDocId(o) {
    if (o && o._docId) {
      o._docId = o._docId.replace(/:.*$/, '');
    }
    if ((o != null) && ((typeof o) === 'object')) {
      for (const [ key, val ] of Object.entries(o)) {
        o[key] = localeFreeDocId(val);
      }
    }
    return o;
  }
}
