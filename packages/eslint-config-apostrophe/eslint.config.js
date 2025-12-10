import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import neostandard from 'neostandard';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    '**/node_modules',
    '**/ui/public/**/*.js',
    '**/apos-build',
    '**/data',
    '**/public'
  ]),
  ...neostandard(),
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  },
  {
    rules: {
      'no-var': 'error',
      'object-shorthand': [ 'warn', 'properties' ],
      'accessor-pairs': [ 'error', {
        setWithoutGet: true,
        enforceForClassMembers: true
      } ],
      'array-callback-return': [ 'error', {
        allowImplicit: false,
        checkForEach: false
      } ],
      camelcase: [ 'error', { properties: 'never' } ],
      'constructor-super': 'error',
      curly: [ 'warn', 'all' ],
      'default-case-last': 'error',
      'dot-notation': [ 'error', { allowKeywords: true } ],
      eqeqeq: [ 'error', 'always', { null: 'ignore' } ],
      'func-call-spacing': [ 'error', 'never' ],
      'new-cap': [ 'error', {
        newIsCap: true,
        capIsNew: false,
        properties: true
      } ],
      'no-array-constructor': 'error',
      'no-async-promise-executor': 'error',
      'no-caller': 'error',
      'no-case-declarations': 'error',
      'no-class-assign': 'error',
      'no-compare-neg-zero': 'error',
      'no-cond-assign': 'error',
      'no-const-assign': 'error',
      'no-constant-condition': [ 'error', { checkLoops: false } ],
      'no-control-regex': 'error',
      'no-debugger': 'error',
      'no-delete-var': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-useless-backreference': 'error',
      'no-empty': [ 'error', { allowEmptyCatch: true } ],
      'no-empty-character-class': 'error',
      'no-empty-pattern': 'error',
      'no-eval': 'error',
      'no-ex-assign': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-extra-boolean-cast': 'error',
      'no-fallthrough': 'error',
      'no-func-assign': 'error',
      'no-global-assign': 'error',
      'no-implied-eval': 'error',
      'no-import-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-iterator': 'error',
      'no-labels': [ 'error', {
        allowLoop: false,
        allowSwitch: false
      } ],
      'no-lone-blocks': 'error',
      'no-loss-of-precision': 'error',
      'no-misleading-character-class': 'error',
      'no-prototype-builtins': 'error',
      'no-useless-catch': 'error',
      'no-mixed-operators': [ 'error', {
        groups: [ [ '==', '!=', '===', '!==', '>', '>=', '<', '<=' ], [ '&&', '||' ], [ 'in', 'instanceof' ] ],
        allowSamePrecedence: true
      } ],
      'no-multi-str': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-object': 'error',
      'no-new-symbol': 'error',
      'no-new-wrappers': 'error',
      'no-obj-calls': 'error',
      'no-octal': 'error',
      'no-octal-escape': 'error',
      'no-proto': 'error',
      'no-redeclare': [ 'error', { builtinGlobals: false } ],
      'no-regex-spaces': 'error',
      'no-return-assign': [ 'error', 'except-parens' ],
      'no-self-assign': [ 'error', { props: true } ],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-shadow-restricted-names': 'error',
      'no-sparse-arrays': 'error',
      'no-template-curly-in-string': 'error',
      'no-this-before-super': 'error',
      'no-throw-literal': 'off',
      'no-undef': 'error',
      'no-undef-init': 'error',
      'no-unexpected-multiline': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': [ 'error', { defaultAssignment: false } ],
      'no-unreachable': 'error',
      'no-unreachable-loop': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unused-expressions': [ 'error', {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true
      } ],
      'no-unused-vars': [ 'error', {
        varsIgnorePattern: '^_[^_].*$|^_$',
        args: 'none',
        ignoreRestSiblings: true,
        caughtErrors: 'none'
      } ],
      'no-use-before-define': [ 'error', {
        functions: false,
        classes: false,
        variables: false
      } ],
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-constructor': 'error',
      'no-useless-escape': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'no-with': 'error',
      'object-property-newline': [ 'warn', { allowAllPropertiesOnSameLine: false } ],
      'one-var': [ 'error', { initialized: 'never' } ],
      'prefer-const': [ 'error', { destructuring: 'all' } ],
      'prefer-promise-reject-errors': 'error',
      'prefer-regex-literals': [ 'error', { disallowRedundantWrapping: true } ],
      'symbol-description': 'error',
      'unicode-bom': [ 'error', 'never' ],
      'use-isnan': 'error',
      'valid-typeof': [ 'error', { requireStringLiterals: true } ],
      yoda: [ 'error', 'never' ],

      'import-x/export': 'error',
      'import-x/first': 'error',
      'import-x/no-absolute-path': [ 'error', {
        esmodule: true,
        commonjs: true,
        amd: false
      } ],
      'import-x/no-duplicates': 'error',
      'import-x/no-named-default': 'error',
      'import-x/no-webpack-loader-syntax': 'error',

      'n/handle-callback-err': [ 'error', '^(err|error)$' ],
      'n/no-callback-literal': 'off',
      'n/no-deprecated-api': 'error',
      'n/no-exports-assign': 'error',
      'n/no-new-require': 'error',
      'n/no-path-concat': 'off',
      'n/process-exit-as-throw': 'error',

      'promise/param-names': 'error',

      '@stylistic/array-bracket-spacing': [ 'warn', 'always' ],
      '@stylistic/arrow-spacing': [ 'error', {
        before: true,
        after: true
      } ],
      '@stylistic/block-spacing': [ 'error', 'always' ],
      '@stylistic/brace-style': [ 'warn', '1tbs' ],
      '@stylistic/comma-dangle': [ 'error', {
        arrays: 'never',
        objects: 'never',
        imports: 'never',
        exports: 'never',
        functions: 'never'
      } ],
      '@stylistic/comma-spacing': [ 'error', {
        before: false,
        after: true
      } ],
      '@stylistic/comma-style': [ 'error', 'last' ],
      '@stylistic/computed-property-spacing': [ 'error', 'never' ],
      '@stylistic/dot-location': [ 'error', 'property' ],
      '@stylistic/eol-last': 'error',
      '@stylistic/generator-star-spacing': [ 'error', {
        before: true,
        after: true
      } ],
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1,
          VariableDeclarator: 1,
          outerIIFEBody: 1,
          MemberExpression: 1,
          FunctionDeclaration: {
            parameters: 1,
            body: 1
          },
          FunctionExpression: {
            parameters: 1,
            body: 1
          },
          CallExpression: { arguments: 1 },
          ArrayExpression: 1,
          ObjectExpression: 1,
          ImportDeclaration: 1,
          flatTernaryExpressions: false,
          ignoreComments: false,
          ignoredNodes: [ 'TemplateLiteral *' ]
        }
      ],
      '@stylistic/key-spacing': [ 'error', {
        beforeColon: false,
        afterColon: true
      } ],
      '@stylistic/keyword-spacing': [ 'error', {
        before: true,
        after: true
      } ],
      '@stylistic/lines-between-class-members': [ 'error', 'always', { exceptAfterSingleLine: true } ],
      '@stylistic/multiline-ternary': [ 'error', 'always-multiline' ],
      '@stylistic/new-parens': 'error',
      '@stylistic/no-extra-parens': [ 'error', 'functions' ],
      '@stylistic/no-floating-decimal': 'error',
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': [ 'error', {
        max: 1,
        maxEOF: 0
      } ],
      '@stylistic/no-tabs': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-whitespace-before-property': 'error',
      '@stylistic/object-curly-newline': [ 'warn', {
        ObjectExpression: {
          minProperties: 2,
          consistent: true,
          multiline: true
        },
        ObjectPattern: {
          minProperties: 3,
          consistent: true,
          multiline: true
        },
        ImportDeclaration: {
          minProperties: 3,
          consistent: true,
          multiline: true
        },
        ExportDeclaration: {
          minProperties: 3,
          consistent: true,
          multiline: true
        }
      } ],
      '@stylistic/object-curly-spacing': [ 'error', 'always' ],
      '@stylistic/operator-linebreak': [ 'error', 'after', {
        overrides: {
          '?': 'before',
          ':': 'before',
          '|>': 'before'
        }
      } ],
      '@stylistic/padded-blocks': 'off',
      '@stylistic/quote-props': [ 'error', 'as-needed' ],
      '@stylistic/quotes': [ 'warn', 'single' ],
      '@stylistic/rest-spread-spacing': [ 'error', 'never' ],
      '@stylistic/semi': [ 'error', 'always' ],
      '@stylistic/semi-spacing': [ 'error', {
        before: false,
        after: true
      } ],
      '@stylistic/space-before-blocks': [ 'error', 'always' ],
      '@stylistic/space-before-function-paren': 'off',
      '@stylistic/space-in-parens': [ 'error', 'never' ],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/space-unary-ops': [ 'error', {
        words: true,
        nonwords: false
      } ],
      '@stylistic/spaced-comment': [ 'error', 'always', {
        line: { markers: [ '*package', '!', '/', ',', '=' ] },
        block: {
          balanced: true,
          markers: [ '*package', '!', ',', ':', '::', 'flow-include' ],
          exceptions: [ '*' ]
        }
      } ],
      '@stylistic/template-curly-spacing': [ 'error', 'never' ],
      '@stylistic/template-tag-spacing': [ 'error', 'never' ],
      '@stylistic/wrap-iife': [ 'error', 'any', { functionPrototypeMethods: true } ],
      '@stylistic/yield-star-spacing': [ 'error', 'both' ]
    }
  },
  {
    // Do not warn about line length in Vue files, already handled by vue/max-len
    ignores: [ '**/*.vue' ],
    rules: {
      '@stylistic/max-len': [ 'warn', {
        code: 90,
        ignoreRegExpLiterals: true,
        ignoreTemplateLiterals: true,
        ignoreStrings: true,
        ignoreUrls: true
      } ]
    }
  },
  {
    files: [ '**/*.vue' ],
    rules: {
      'vue/max-len': [ 'warn', {
        code: 90,
        ignoreRegExpLiterals: true,
        ignoreTemplateLiterals: true,
        ignoreStrings: true,
        ignoreUrls: true,
        ignoreHTMLAttributeValues: true,
        ignoreHTMLTextContents: true
      } ]
    }
  },
  {
    files: [ '**/ui/**/*.js', '**/*.vue' ],
    languageOptions: {
      globals: {
        ...globals.browser,
        apos: 'readonly'
      }
    },
    rules: {
      'no-console': 'error'
    }
  },
  {
    files: [ 'test/**/*.js', '**/*.cy.js' ],
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    },
    rules: {
      'no-console': 'error'
    }
  }
]);
