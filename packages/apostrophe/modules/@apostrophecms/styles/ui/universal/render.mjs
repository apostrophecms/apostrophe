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
 * @property {string} [class] - Optional class reference
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

const conditionTypes = [ 'if', 'requiredIf' ];
export const getConditionTypesObject = () => Object
  .fromEntries(conditionTypes.map((key) => ([ key, {} ])));

/**
 * Renders CSS stylesheet from a schema and document object.
 *
 * @param {SchemaField[]} schema - Array of field schema definitions
 * @param {Object} doc - Document containing field values
 * @param {Object} options - Rendering options
 * @param {string} [options.rootSelector] - Root selector to prepend to
 *  all selectors
 * @param {Function} [options.checkIfConditionsFn] - Universal function to
 *  evaluate field conditions
 * @returns {{ css: string; classes: string[] }} Compiled CSS stylesheet and classes
 */
function renderGlobalStyles(schema, doc, {
  rootSelector = null,
  checkIfConditionsFn
} = {}) {
  const storage = {
    classes: new Set(),
    styles: new Map()
  };

  for (const field of schema) {
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
  checkIfConditionsFn
} = {}) {
  const storage = {
    classes: new Set(),
    styles: new Map(),
    inlineVotes: new Set()
  };

  for (const field of schema) {
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

// FIXME: filter the schema by conditionals here in the next ticket
// function filterConditionalFields(
//   checkIfConditions, schema, doc, parentConditions = {}
// ) {
//   const result = getConditionTypesObject();

//   for (const field of schema) {
//     for (const conditionType of conditionTypes) {
//       if (field[conditionType]) {
//         result[conditionType][field.name] = checkIfConditions(
//           doc,
//           field[conditionType]
//         );
//       }
//     }
//   }

//   return result;
// }

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
 * @param {String} options.rootSelector
 * @param {Boolean} [options.forceRoot] - Whether to force attach root selector
 * @param {RuntimeStorage} [options.storage]
 * @returns {NormalizedField}
 */
function normalize(field, doc, {
  rootSelector,
  forceRoot = false,
  storage
} = {}) {
  let selectors = [];
  let properties = [];
  let fieldValue = doc[field.name];
  let canBeInline = true;
  const fieldUnit = field.unit || '';

  // FIXME: compute and store classes here when appropriate

  if (!properties) {
    properties = [];
  }

  if (!fieldValue && fieldValue !== 0) {
    fieldValue = null;
  }

  if (fieldValue && typeof fieldValue === 'string' && fieldValue.startsWith('--')) {
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
    ...field.mediaQuery && { mediaQuery: field.mediaQuery },
    ...field.class && { class: field.class },
    ...field.important && { important: field.important }
  };
}

/**
 * Prepare an object field for rendering by normalizing it to a standard structure.
 *
 * @param {SchemaField} field
 * @param {Object} doc
 * @param {Object} options
 * @param {String} options.rootSelector
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
  delete normalized.class;

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
          const regex = /%VALUE%/gi;
          const value = normalized.valueTemplate.replace(
            regex,
            normalized.value + normalized.unit
          );
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
  normalized.subfields.forEach(subfield => {
    extract(subfield, storage);
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
      rules.push([ ...value.values() ].join(';') + ';');
      return;
    }
    if (key.startsWith('@media')) {
      const nestedRules = stringifyRules(value);
      rules.push(key.concat('{', nestedRules, '}'));
    } else {
      rules.push(key.concat('{', [ ...value.values() ].join(';'), ';}'));
    }
  });

  return rules.join('');
};
