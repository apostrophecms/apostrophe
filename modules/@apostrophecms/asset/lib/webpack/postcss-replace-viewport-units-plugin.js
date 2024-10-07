/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  return {
    postcssPlugin: 'postcss-replace-viewport-units-plugin',
    Once (root, postcss) {
      root.walkRules(rule => {
        const declsWithContainerQueryRelativeUnits = [];

        rule.walkDecls(decl => {
          if (!decl.value.includes('vh') && !decl.value.includes('vw')) {
            return;
          }

          const declWithContainerQueryRelativeUnits = decl.clone({
            value: decl.value
              .replaceAll('vh', 'cqh')
              .replaceAll('vw', 'cqw')
          });

          declsWithContainerQueryRelativeUnits.push(declWithContainerQueryRelativeUnits);
        });

        if (!declsWithContainerQueryRelativeUnits.length) {
          return;
        }

        // Trailing space is wanted because otherwise postcss sticks `{` to the selector...
        // This doesn't happen when we are duplicating the rule, but when we are creating a new one.
        // It would have been working without the space, but it is nicer with it.
        const selector = `:where(body[data-breakpoint-preview-mode]) ${rule.selector} `;
        const prefixedRule = new postcss.Rule({
          selector,
          nodes: declsWithContainerQueryRelativeUnits
        });

        root.insertAfter(rule, prefixedRule);
      });
    }
  };
};

module.exports.postcss = true;
