An ESLint configuration for ApostropheCMS core and officials modules.

Add the following to your `.eslintrc` file to use in your project:

```javascript
{
  "extends": "apostrophe"
}
```

## Contributing

To contribute to this config or run tests, clone the repository and run `npm install`. You can then run `npm test` to run the basic tests.

## Viewing differences between the standard configuration and ours

From this project's root, run

```
npm run compare
```

This will print a report in your terminal which shows which rules we not added to our config and which rules we have specifically modified.

All missing rules should be added to the `.eslintrc.json` with a definition even if we agree with the standard. This ensures that we are aware of any new rules or changed defintions that are made to the standard and will allow us to lock down the rule definitions that we agree with.

## Changelog

New major versions will be used whenever a new rule is added that returns an `error` on failure. This is to avoid breaking projects using this configuration as they do normal package updates. If a new rule is added that is simply set to `warn`, minor versions may be used since this should not break build, but only create warning messages for you to resolve or override with rules in your project configuration.

- 3.4.1 (2020-10-21): Updates `eslint-plugin-import`.
- 3.4.0 (2020-08-26): Adds a script to check what rules from `eslint-config-standard` that we are not yet setting in this config. The goal of this is to make sure that any new rules we work with are intentional, rather than unexpectedly inherited from `eslint-config-standard`. Also copies over missing eslint rules with the configurations from `eslint-config-standard`. There should be no functional changes in linting.
- 3.3.0: Adds a warning enforcing a single space inside of array brackets.
- 3.2.0: Adds a warning for the `quotes` rule to enforce single quotes. This should change to an error in the next major version.
- 3.1.0: Adds a warning for the `curly` and `brace-style` rules to avoid single line blocks. Also `object-curly-newline` and `object-property-newline` rules to have similar treatment for objects. Adds the changelog versioning guidelines.
- 3.0.0: Adds a warning for the `no-var` rule.
- 2.0.2: packaging issue, no changes.
- 2.0.1: use `import/no-extraneous-dependencies` to detect `require` calls that are not backed by a real dependency of this project or module.
- 2.0.0: initial release.
