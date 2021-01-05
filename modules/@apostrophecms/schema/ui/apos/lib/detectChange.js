// Detect whether a document or document field has been changed,
// in a way that warrants confirmation before exiting a modal,
// or emitting an update event

import { isEqualWith } from 'lodash';

export function detectDocChange(schema, v1, v2) {
  return schema.some(field => {
    return detectFieldChange(field, v1[field.name], v2[field.name]);
  });
}

export function detectFieldChange(field, v1, v2) {
  if (isEqualWith(v1, v2, compare)) {
    return false;
  } else if (!v1 && !v2) {
    return false;
  } else if (!v1 && Array.isArray(v2) && v2.length === 0) {
    return false;
  } else {
    console.log('different: ' + field.name, v1, v2);
    return true;
  }
  function compare(v1, v2) {
    if (v1 && v1._docId) {
      // Allow comparison of locales/modes without false positives
      // due to the locale and mode appearing in _docId
      v1 = {
        ...v1,
        _docId: v1._docId.replace(/:.*$/, '')
      };
    }
    if (v2 && v2._docId) {
      v2 = {
        ...v2,
        _docId: v2._docId.replace(/:.*$/, '')
      };
    }
    return isEqualWith(v1, v2, compare);
  }
}
