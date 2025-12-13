// Render a stylesheet from a given schema and doc.
// Some basic rules:
// - Do not mutate the schema or doc.
// - Explicitly validate the schema, the renders don't do that
//   because of performance reasons.
// - Reuse the response as much as possible as it is a relatively
//   expensive operation.

/**
 * @typedef {Object} SchemaField
 * @property {string} name - The field name
 * @property {string} type - The field type (e.g., 'string', 'object', 'range')
 * @property {string|string[]} [selector] - CSS selector(s) for this field
 * @property {string|string[]} [property] - CSS property/properties to apply
 * @property {string} [unit] - Unit to append to value (e.g., 'px', 'em')
 * @property {string} [valueTemplate] - Template string with %VALUE% placeholder
 * @property {string} [mediaQuery] - Media query condition
 * @property {string} [class] - Class reference
 * @property {boolean} [important] - Whether to add !important flag
 * @property {SchemaField[]} [schema] - Optional subfields for some types
 * @property {Object} [if] - Conditional logic for field rendering
 */

/**
 * @typedef {Object} NormalizedField
 * @property {string[]} selectors - CSS selectors for this style
 * @property {string[]} properties - CSS properties to apply
 * @property {any} value - The field value to apply
 * @property {string} unit - The unit to append to the value
 * @property {SchemaField} raw - The original field object
 * @property {string} [valueTemplate] - Optional template for the value
 * @property {string} [mediaQuery] - Optional media query condition
 * @property {boolean} [important] - Whether to add !important flag
 */

/**
 * @typedef {Object} NormalizedObjectField
 * @property {string[]} selectors - CSS selectors for this style
 * @property {string[]} properties - CSS properties to apply
 * @property {any} value - The field value to apply
 * @property {SchemaField} raw - The original field object
 * @property {NormalizedField[]} subfields - Normalized subfields from object schema
 * @property {string} [valueTemplate] - Optional template for the value
 * @property {string} [mediaQuery] - Optional media query condition
 * @property {boolean} [important] - Whether to add !important flag
 */

/**
 * @typedef {Object} RuntimeStorage
 * @property {Set<string>} classes - Set of class names to be applied
 * @property {Map<string, Set<string>|Map<string, Set<string>>>} styles - Map
 *   of selectors to CSS rules, or media query strings to nested selector maps
 * @property {Set<boolean>} [inlineVotes] - Set of boolean votes to determine
 *   if styles should be inline (only used in scoped styles)
 */

import { klona } from 'klona';
import customRules from './customRules.mjs';

export default renderGlobalStyles;
export { renderGlobalStyles, renderScopedStyles };

// Exported for testing purposes
export const NORMALIZERS = {
  _: normalize,
  object: normalizeObject
};
export const EXTRACTORS = {
  _: extract,
  object: extractObject
};
const FILTERS = {
  _: filter,
  object: filterObject
};

/**
 * Renders CSS stylesheet from a schema and document object.
 *
 * @param {SchemaField[]} schema - Array of field schema definitions
 * @param {Object} doc - Document containing field values
 * @param {Object} options - Rendering options
 * @param {Function} [options.checkIfConditionsFn] - Universal function to
 *  evaluate field conditions
 * @returns {{ css: string; classes: string[] }} Compiled CSS stylesheet and classes
 */
function renderGlobalStyles(schema, doc, {
  checkIfConditionsFn
} = {}) {
  const storage = {
    classes: new Set(),
    styles: new Map()
  };
  const withConditions = filterConditionalFields(
    klona(schema),
    doc,
    {
      checkFn: checkIfConditionsFn
    }
  );

  for (const field of withConditions.schema) {
    const filter = FILTERS[field.type] || FILTERS._;
    if (!filter(field, doc)) {
      continue;
    }
    const normalizer = NORMALIZERS[field.type] || NORMALIZERS._;
    const extractor = EXTRACTORS[field.type] || EXTRACTORS._;
    const normalzied = normalizer(field, doc, {
      storage
    });
    extractor(normalzied, storage);
  }

  return {
    css: stringifyRules(storage.styles),
    classes: [ ...storage.classes ]
  };
};

/**
 * Renders CSS stylesheet from a schema and document object, scoped
 * to a root selector or as inline styles.
 *
 * @param {SchemaField[]} schema - Array of field schema definitions
 * @param {Object} doc - Document containing field values
 * @param {Object} options - Rendering options
 * @param {string} [options.rootSelector] - Root selector to prepend to all selectors
 * @param {Function} [options.checkIfConditionsFn] - Universal function to
 *  evaluate field conditions
 * @returns {{ css: string; classes: string[]; inline: string }} Compiled CSS
 *  stylesheet, classes, and inline styles
 */
function renderScopedStyles(schema, doc, {
  rootSelector = null,
  checkIfConditionsFn,
  subset = null
} = {}) {
  const storage = {
    classes: new Set(),
    styles: new Map(),
    inlineVotes: new Set()
  };
  const withConditions = filterConditionalFields(
    klona(schema),
    doc,
    {
      checkFn: checkIfConditionsFn,
      subset
    }
  );

  for (const field of withConditions.schema) {
    const filter = FILTERS[field.type] || FILTERS._;
    if (!filter(field, doc)) {
      continue;
    }
    const normalizer = NORMALIZERS[field.type] || NORMALIZERS._;
    const extractor = EXTRACTORS[field.type] || EXTRACTORS._;
    const normalzied = normalizer(field, doc, {
      rootSelector,
      storage
    });
    extractor(normalzied, storage);
  }

  const isInline = [ ...storage.inlineVotes ].every(vote => vote === true);

  if (isInline) {
    return {
      css: '',
      classes: [ ...storage.classes ],
      inline: stringifyRules(storage.styles, true)
    };
  }

  return {
    css: stringifyRules(storage.styles),
    classes: [ ...storage.classes ],
    inline: ''
  };
};

/**
 * Filters schema fields based on conditional logic, removing fields
 * whose conditions evaluate to false.
 *
 * @param {SchemaField[]} schema - Array of field schema definitions
 * @param {Object} doc - Document containing field values
 * @param {Object} options
 * @param {Function} options.checkFn - Function to evaluate field conditions,
 *   usually the universal core function
 * @param {string[]|null} [options.subset] - Optional subset of field names used
 *   to reduce the original schema before evaluating conditions
 * @returns {{ conditions: Object<string, boolean>; schema: SchemaField[] }}
 *   Object containing the evaluated conditions map and filtered schema
 */
function filterConditionalFields(
  schema, doc, { checkFn, subset }
) {
  const subsetSchema = Array.isArray(subset)
    ? schema.filter(field => subset.includes(field.name))
    : schema;
  const conditions = getConditions(
    checkFn,
    subsetSchema,
    doc
  );

  return {
    conditions,
    schema: subsetSchema.filter(field => {
      if (conditions[field.name] === false) {
        return false;
      }
      if (field.schema?.length > 0) {
        field.schema = field.schema.filter(subfield => {
          if (conditions[`${field.name}.${subfield.name}`] === false) {
            return false;
          }
          return true;
        });
        if (field.schema.length === 0) {
          return false;
        }
      }

      return true;
    })
  };
}

/**
 * Evaluates conditional expressions for each field in the schema.
 * Supports one level of nesting for object fields with subfields.
 *
 * @param {Function} checkIfConditions - The universal core function to evaluate
 *   field conditions
 * @param {SchemaField[]} schema - Array of field schema definitions
 * @param {Object} doc - Document containing field values
 * @returns {Object<string, boolean>} Map of field names (or "field.subfield"
 *   for nested fields) to their evaluated condition results
 */
function getConditions(
  checkIfConditions, schema, doc
) {
  const conditionType = 'if';

  // Simulate parent values
  const parentValues = Object.fromEntries(
    Object.entries(doc).map(([ key, value ]) => {
      return [ `<${key}`, value ];
    })
  );
  const result = {};

  for (const field of schema) {
    if (field[conditionType]) {
      result[field.name] = checkIfConditions(
        doc,
        field[conditionType]
      );
    }
    if (field.schema?.length > 0) {
      for (const subfield of field.schema) {
        if (subfield[conditionType]) {
          result[`${field.name}.${subfield.name}`] = checkIfConditions(
            {
              ...parentValues,
              ...doc[field.name] || {}
            },
            subfield[conditionType]
          );
        }
      }
    }
  }

  return result;
}

/**
 * For a given field (schema) and doc, determine if it should be processed
 * as a style field.
 *
 * @param {SchemaField} field
 * @param {Object} doc
 * @returns {NormalizedField}
 */
function filter(field, doc) {
  if (field.class) {
    return true;
  }
  if (!doc[field.name] && doc[field.name] !== 0) {
    return false;
  }
  const hasProperty = Array.isArray(field.property)
    ? field.property.length > 0
    : !!field.property;
  const hasSelector = Array.isArray(field.selector)
    ? field.selector.length > 0
    : !!field.selector;
  if (!hasProperty && !hasSelector) {
    return false;
  }
  return true;
}

/**
 * For a given object field (schema) and doc, determine if it should be processed
 * as an object style field.
 *
 * @param {SchemaField} field
 * @param {Object} doc
 * @returns {boolean}
 */
function filterObject(field, doc) {
  if (field.type !== 'object') {
    return false;
  }
  if (!Array.isArray(field.schema) || field.schema.length === 0) {
    return false;
  }
  if (!doc[field.name]) {
    return false;
  }
  if (field.property && field.valueTemplate) {
    return true;
  }
  return field.schema.some(subfield => {
    return filter(subfield, doc[field.name] || {});
  });
}

/**
 * Prepare a field for rendering by normalizing it to a standard structure.
 *
 * @param {SchemaField} field
 * @param {Object} doc
 * @param {Object} options
 * @param {String} options.rootSelector - Root selector from parent object field or
 *   root scope.
 * @param {Boolean} [options.forceRoot] - Whether to force attach root selector
 * @param {String} [options.rootMediaQuery] - Media query from parent object field
 * @param {RuntimeStorage} [options.storage]
 * @returns {NormalizedField}
 */
function normalize(field, doc, {
  rootSelector,
  rootMediaQuery,
  forceRoot = false,
  storage
} = {}) {
  let selectors = [];
  let properties = [];
  let fieldValue = doc[field.name];
  let canBeInline = true;
  const fieldUnit = field.unit || '';
  const fieldMediaQuery = field.mediaQuery || rootMediaQuery;

  if (field.class) {
    applyFieldClass(field.class, fieldValue, storage);
    return {
      raw: field,
      selectors,
      properties,
      value: fieldValue,
      unit: ''
    };
  }

  if (!properties) {
    properties = [];
  }

  if (!fieldValue && fieldValue !== 0) {
    fieldValue = null;
  }

  if (typeof fieldValue === 'string' && fieldValue.startsWith('--')) {
    fieldValue = `var(${fieldValue})`;
  }

  if (Array.isArray(field.selector)) {
    selectors = field.selector;
  } else if (field.selector && (typeof field.selector) === 'string') {
    selectors = [ field.selector ];
  }

  // This is a safe check, even when there is a root selector coming
  // from an object, because the object field itself will yield
  // a `false` here and thus force `inline: false` for the entire schema.
  if (selectors.length > 0) {
    canBeInline = false;
  }

  if (Array.isArray(field.property)) {
    properties = field.property;
  } else if (field.property && (typeof field.property) === 'string') {
    properties = [ field.property ];
  }

  // Attach the root selector for non style fields ONLY by force
  if (rootSelector && typeof rootSelector === 'string') {
    rootSelector = [ rootSelector ];
  }
  if (rootSelector?.length > 0) {
    const shouldAttachRoot = forceRoot || properties.length > 0;
    selectors = selectors.length > 0
      ? selectors.map(s => rootSelector.map(r => `${r} ${s}`)).flat()
      : (shouldAttachRoot ? rootSelector : []);
  }

  if (field.mediaQuery) {
    canBeInline = false;
  }

  if (storage?.inlineVotes) {
    storage.inlineVotes.add(canBeInline);
  }

  return {
    raw: field,
    selectors,
    properties,
    value: fieldValue,
    unit: fieldUnit,
    ...field.valueTemplate && { valueTemplate: field.valueTemplate },
    ...fieldMediaQuery && { mediaQuery: fieldMediaQuery },
    ...field.important && { important: field.important }
  };
}

/**
 * Prepare an object field for rendering by normalizing it to a standard structure.
 *
 * @param {SchemaField} field
 * @param {Object} doc
 * @param {Object} options
 * @param {String} options.rootSelector - Root selector from root scope.
 * @param {RuntimeStorage} options.storage
 * @returns {NormalizedObjectField}
 */
function normalizeObject(field, doc, {
  rootSelector,
  storage
} = {}) {
  const subfields = [];
  const normalized = normalize(field, doc, {
    rootSelector,
    forceRoot: true,
    storage
  });
  delete normalized.unit;

  const schema = field.schema.filter(subfield => {
    return filter(subfield, doc[field.name] || {});
  });

  for (const subfield of schema) {
    subfields.push(
      normalize(
        subfield,
        doc[field.name] || {},
        {
          rootSelector: normalized.selectors,
          rootMediaQuery: normalized.mediaQuery,
          storage
        }
      )
    );
  }

  return {
    ...normalized,
    subfields
  };
}

/**
 * Extract CSS rules from a normalized field and populate the central styles map
 * with the selectors and corresponding rules.
 *
 * @param {NormalizedField} normalized
 * @param {Object} doc
 * @param {RuntimeStorage} storage
 */
function extract(normalized, storage) {
  if (normalized.class) {
    return;
  }
  const styles = storage.styles;
  normalized.properties.forEach(property => {
    normalized.selectors.forEach(selector => {
      let currentStyles = styles;

      if (normalized.mediaQuery) {
        const mediaQuery = `@media ${normalized.mediaQuery}`;
        styles.set(mediaQuery, styles.get(mediaQuery) || new Map());
        currentStyles = styles.get(mediaQuery);
      }

      let rule;

      if (customRules[normalized.raw.type]) {
        ({ field: normalized, rule } = customRules[normalized.raw.type]({
          field: normalized,
          property
        }));
      } else {
        rule = `${property}: ${normalized.value}${normalized.unit}`;
        if (normalized.valueTemplate) {
          const value = interpolate(
            normalized.valueTemplate,
            normalized.value,
            {
              unit: normalized.unit,
              subfields: normalized.raw.schema
            }
          );
          if (!value) {
            return;
          }
          rule = `${property}: ${value}`;
        }
      }

      if (normalized.important) {
        rule += ' !important';
      }

      currentStyles.set(
        selector, (currentStyles.get(selector) || new Set()).add(rule)
      );
    });
  });
}

/**
 * Extract CSS rules from a normalized object field and populate the central
 * styles map with the selectors and corresponding rules.
 *
 * @param {NormalizedObjectField} normalized
 * @param {Object} doc
 * @param {RuntimeStorage} storage
 */
function extractObject(normalized, storage) {
  if (normalized.valueTemplate) {
    extract(normalized, storage);
  }
  normalized.subfields.forEach(subfield => {
    extract(subfield, storage);
  });
}

/**
 * Interpolate values into a template string.
 * Simple mode replaces %VALUE% with primitive values. The mode is determined
 * by the absence of subfields in options.
 * Advanced mode replaces %key% placeholders with corresponding values from
 * the value object, validating that all referenced keys exist in the
 * provided schema.
 *
 * @param {string} template - Template string with placeholders
 * @param {any} value - Primitive value or object with key-value pairs
 * @param {Object} options - Interpolation options
 * @param {string} [options.unit=''] - Unit to append to value (simple mode only)
 * @param {SchemaField[]} [options.subfields] - Schema to validate object keys against
 * @returns {string} Interpolated string, or empty string if required keys are missing
 */
function interpolate(template, value, {
  unit = '', subfields
} = {}) {
  if (!Array.isArray(subfields)) {
    return template.replace(/%VALUE%/gi, String(value ?? '') + unit);
  }

  if (!subfields.length) {
    return '';
  }

  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const keyPattern = /%([^%]+)%/g;
  const referencedKeys = new Set();
  let match;

  while ((match = keyPattern.exec(template)) !== null) {
    referencedKeys.add(match[1]);
  }

  const subfieldsByName = new Map(subfields.map(field => [ field.name, field ]));
  for (const key of referencedKeys) {
    if (!subfieldsByName.has(key)) {
      return '';
    }
  }

  return template
    .replace(/%([^%]+)%/g, (_, key) => {
      const subfield = subfieldsByName.get(key);
      const subfieldValue = value[key] ?? '';
      const subfieldUnit = subfield.unit || '';

      // Recursively interpolate if subfield has a valueTemplate
      if (subfield.valueTemplate) {
        return interpolate(subfield.valueTemplate, subfieldValue, {
          unit: subfieldUnit
        });
      }

      return String(subfieldValue) + subfieldUnit;
    });
}

/**
 * Converts the styles map into a stringified CSS stylesheet.
 *
 * @param {Map<string, string|Map<string,string>>} styles
 * @param {boolean} [inline=false] - Whether to render styles as inline
 * @returns {string} Stringified CSS rules
 */
function stringifyRules(styles, inline = false) {
  const rules = [];

  styles.forEach((value, key) => {
    if (inline) {
      rules.push(normalizeRules(value.values()).join(';') + ';');
      return;
    }
    if (key.startsWith('@media')) {
      const nestedRules = stringifyRules(value);
      rules.push(key.concat('{', nestedRules, '}'));
    } else {
      rules.push(key.concat('{', normalizeRules(value.values()).join(';'), ';}'));
    }
  });

  return rules.join('');

  // Remove any trailing `;` from each rule
  function normalizeRules(rules) {
    return [ ...rules ].map(rule => {
      return (rule.endsWith(';') ? rule.slice(0, -1) : rule).trim();
    })
      .filter(rule => rule.length > 0);
  }
};

/**
 * Prepare a field for rendering by normalizing it to a standard structure.
 *
 * @param {string|null} [fieldClass] The value of the class property from the field schema
 * @param {any} value
 * @param {RuntimeStorage} [storage]
 * @returns {NormalizedField}
 */
function applyFieldClass(fieldClass, value, storage) {
  if (!value || !fieldClass || !storage?.classes) {
    return false;
  }

  if (typeof fieldClass === 'string' && !!value) {
    storage.classes.add(fieldClass);
    return true;
  }

  if (fieldClass !== true) {
    return false;
  }

  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string') {
        storage.classes.add(v);
      }
    }
    return value.length > 0;
  } else if (typeof value === 'string') {
    storage.classes.add(value);
    return true;
  }

  return false;
}
