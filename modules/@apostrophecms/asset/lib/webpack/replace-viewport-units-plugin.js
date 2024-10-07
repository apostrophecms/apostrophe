/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  // Work with options here

  return {
    postcssPlugin: 'TEST BAGUETTE',
    Root (root, postcss) {
      root.walkRules(rule => {
        const declsWithContainerQueryRelativeUnits = [];

        rule.walkDecls(decl => {
          if (!decl.value.includes('vh') && !decl.value.includes('vw')) {
            return;
          }
          const value = decl.value
            .replaceAll('vh', 'cqh')
            .replaceAll('vw', 'cqw');
          console.log('🚀 ~ Root ~ value:', value);

          declsWithContainerQueryRelativeUnits.push(decl.clone({ value }));
        });

        if (!declsWithContainerQueryRelativeUnits.length) {
          return;
        }
        console.dir(declsWithContainerQueryRelativeUnits, { depth: 9 });

        const prefixedRule = rule.clone({
          selector: `:where(body[data-breakpoint-preview-mode]) ${rule.selector}`
        });
        prefixedRule.append(...declsWithContainerQueryRelativeUnits);

        root.insertAfter(rule, prefixedRule);
      });
    }
  };
};

module.exports.postcss = true;
