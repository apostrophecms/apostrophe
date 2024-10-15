/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  return {
    postcssPlugin: 'postcss-replace-viewport-units-plugin',
    Once (root, postcss) {
      root.walkRules(rule => {
        const declsToCopy = [];

        rule.walkDecls(decl => {
          if (!decl.value.includes('vh') && !decl.value.includes('vw')) {
            return;
          }

          const clonedDeclWithContainerQueryUnits = decl.clone({
            value: decl.value
              .replaceAll('vh', 'cqh')
              .replaceAll('vw', 'cqw')
          });

          declsToCopy.push(clonedDeclWithContainerQueryUnits);
        });

        if (!declsToCopy.length) {
          return;
        }

        const prefixedRule = new postcss.Rule({
          selector: `:where(body[data-breakpoint-preview-mode]) ${rule.selector}`,
          nodes: declsToCopy
        });

        root.insertAfter(rule, prefixedRule);
      });
    }
  };
};

module.exports.postcss = true;
