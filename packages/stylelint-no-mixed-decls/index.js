const stylelint = require('stylelint');

const ruleName = '@apostrophecms/stylelint-no-mixed-decls';
const messages = stylelint.utils.ruleMessages(ruleName, {
  mixed: 'Cannot mix declarations and nested rules. Group them together or wrap declarations in a nested "& { }" block. See https://sass-lang.com/documentation/breaking-changes/mixed-decls/'
});

module.exports = stylelint.createPlugin(ruleName, (primary, secondaryOptions) => {
  return (root, result) => {
    root.walkRules(rule => {
      let seenNested = false;

      rule.each(node => {
        if (isNested(node)) {
          seenNested = true;
          return;
        }

        if (isDecl(node) && seenNested) {
          stylelint.utils.report({
            message: messages.mixed,
            node,
            result,
            ruleName
          });
        }

        // If the incuded mixin is known to contain nested rules,
        // we can skip checking it and just set `seenNested` to true.
        // Any declarations after this point will be
        // reported, even the ones inside the mixin.
        if (isInclude(node)) {
          const nameWithoutArgs = node.params.replace(/\(.*$/, '');

          // If the mixin is known to contain nested rules because
          // it's listed as such in the options:
          if (secondaryOptions?.['contain-nested']?.includes(nameWithoutArgs)) {
            seenNested = true;
            return;
          }

          // Otherwise, we need to find the mixin definition:
          root.walkAtRules('mixin', mixinRule => {
            if (mixinRule.params !== node.params) {
              return;
            }

            mixinRule.each(mixinNode => {
              // If the mixin is actually seen to contain nested rules:
              if (isNested(mixinNode)) {
                seenNested = true;
                return;
              }

              // If the mixin itself contains declarations after nested rules:
              if (isDecl(mixinNode) && seenNested) {
                stylelint.utils.report({
                  message: messages.mixed,
                  node: mixinNode,
                  result,
                  ruleName
                });
              }
            });
          });
        }
      });
    });
  };
});

module.exports.ruleName = ruleName;
module.exports.messages = messages;

function isDecl(node) {
  return node.type === 'decl';
}

// Note: a `.` in the selector is not considered a nested rule,
// at least, it's not considered as mixed content in Sass.
function isNested(node) {
  return node.type === 'rule' && /^&([^.])*$/.test(node.selector);
}

function isInclude(node) {
  return node.type === 'atrule' && node.name === 'include';
}
