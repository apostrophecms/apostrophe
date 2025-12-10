import customRenderers from './customRenderers.mjs';
// Render a stylesheet from a given schema and doc. Returns
// a string. No dependencies, so it can be used both front and back end

function renderStyles(schema, doc, {
  rootSelector = null,
  rootValueTemplate
} = {}) {
  const styles = new Map();

  for (let field of schema) {
    let selectors = field.selector;
    let properties = field.property;
    let fieldValue = doc[field.name];
    const fieldUnit = field.unit || '';

    if (field.type === 'object') {
      return renderStyles(
        field.schema,
        doc[field.name] || {},
        {
          rootValueTemplate: field.valueTemplate,
          rootSelector: rootSelector
            ? `${rootSelector} ${field.selector || ''}`.trim()
            : field.selector
        }
      );
    }

    // TODO: objects can recursively ask for rendering without
    // property if they own valueTemplate and property definitions.
    if (!properties) {
      continue;
    }

    if (!fieldValue && fieldValue !== 0) {
      continue;
    }

    if (fieldValue && typeof fieldValue === 'string' && fieldValue.startsWith('--')) {
      fieldValue = `var(${fieldValue})`;
    }

    if (selectors && (typeof selectors) === 'string') {
      selectors = [ selectors ];
    }
    // Handle:
    // - widget level rootSelector
    // - object field level rootSelector
    // - field level selector(s)
    if (rootSelector) {
      selectors = selectors
        ? selectors.map(s => `${rootSelector} ${s}`)
        : [ rootSelector ];
    }
    // FIXME: add support for widgets render without selectors.
    if (!selectors) {
      console.warn('FIXME: support inline styles?', field.name);
      continue;
    }

    if ((typeof properties) === 'string') {
      properties = [ properties ];
    }

    properties.forEach(property => {
      selectors.forEach(selector => {
        let currentStyles = styles;

        if (field.mediaQuery) {
          const mediaQuery = `@media ${field.mediaQuery}`;
          styles.set(mediaQuery, styles.get(mediaQuery) || new Map());
          currentStyles = styles.get(mediaQuery);
        }

        let rule;

        if (customRenderers[field.type]) {
          ({ field, rule } = customRenderers[field.type](field, fieldValue));
        } else {
          rule = `${property}: ${fieldValue}${fieldUnit}`;
          if (field.valueTemplate) {
            const regex = /%VALUE%/gi;
            const value = field.valueTemplate.replace(regex, fieldValue + fieldUnit);
            rule = `${property}: ${value}`;
          }
        }

        if (field.important) {
          rule += ' !important';
        }

        currentStyles.set(selector, (currentStyles.get(selector) || new Set()).add(rule));
      });
    });
  }

  const stringifyRules = (source) => {
    const rules = [];

    source.forEach((value, key) => {
      if (key.startsWith('@media')) {
        const nestedRules = stringifyRules(value);
        rules.push(key.concat('{', nestedRules, '}'));
      } else {
        rules.push(key.concat('{', [ ...value.values() ].join(';'), ';}'));
      }
    });

    return rules.join('');
  };

  return stringifyRules(styles);
};

export default renderStyles;
