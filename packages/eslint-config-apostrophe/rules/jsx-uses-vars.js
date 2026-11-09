// Marks components referenced in JSX (`<Item />`, `<Layout.Header />`) as
// used, so `no-unused-vars` does not report them. ESLint 10 tracks JSX
// references itself; ESLint 9 does not, and neostandard no longer ships
// `react/jsx-uses-vars` to fill the gap. Lowercase tags (`<div>`) are
// intrinsic elements, not variables, and are left alone.

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Mark variables used in JSX as used'
    },
    schema: []
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        let name = node.name;
        if (name.type === 'JSXNamespacedName') {
          return;
        }
        const member = name.type === 'JSXMemberExpression';
        while (name.type === 'JSXMemberExpression') {
          name = name.object;
        }
        if (name.type !== 'JSXIdentifier') {
          return;
        }
        if (!member && /^[a-z]/.test(name.name)) {
          return;
        }
        context.sourceCode.markVariableAsUsed(name.name, node);
      }
    };
  }
};
