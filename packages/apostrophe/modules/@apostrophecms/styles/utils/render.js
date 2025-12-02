const customRenderers = require('./customRenderers.js');
// Render a stylesheet from a given schema and doc. Returns
// a string. No dependencies, so it can be used both front and back end

module.exports = function(schema, doc) {
  const styles = new Map();

  const subset = schema.filter(field => field.selector);
  for (let field of subset) {
    let selectors = field.selector;
    let properties = field.property;
    let fieldValue = doc[field.name];
    const fieldUnit = field.unit || '';

    if (!fieldValue && fieldValue !== 0) {
      continue;
    }

    if (fieldValue && typeof fieldValue === 'string' && fieldValue.startsWith('--')) {
      fieldValue = `var(${fieldValue})`;
    }

    if ((typeof selectors) === 'string') {
      selectors = [ selectors ];
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
        rules.push(key.concat('{', [ ...value.values() ].join(';'), '}'));
      }
    });

    return rules.join('');
  };

  return stringifyRules(styles);
};
