/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  // Work with options here

  return {
    postcssPlugin: 'postcss-replace-viewport-units-plugin',
    Root (root, postcss) {
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

        const prefixedRule = rule.clone({
          selector: `:where(body[data-breakpoint-preview-mode]) ${rule.selector}`
        });
        prefixedRule.removeAll();
        prefixedRule.append(...declsWithContainerQueryRelativeUnits);

        root.insertAfter(rule, prefixedRule);
      });
    }
  };
};

module.exports.postcss = true;
