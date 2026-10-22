# stylelint-config-apostrophe

> An stylelint configuration for the Apostrophe team.

Extends `stylelint-config-standard`

This config also leverages the following plugins to fine tune our rules.

```json
"stylelint-order"
"stylelint-declaration-strict-value"
"stylelint-scss"
"stylelint-selector-bem-pattern"
```

## Installation

```bash
npm i stylelint-config-apostrophe --save-dev
```

## Package versions

Choose the appropriate for your application `stylelint-config-apostrophe` version based on the `stylelint` dependency introduced on a project level:

| Stylelint       | Apostrophe config |
| :-------------- | ----------------: |
| >= v13.8.x < 14 |            v1.x.x |
| v14.x.x         |            v2.x.x |
| v16.x.x         |            v2.x.x |

[Migrating to stylelint v14](https://stylelint.io/migration-guide/to-14/)

## Usage

If you've installed `stylelint-config-apostrophe` locally within your project, just set your `stylelint` config to:

```json
{
  "extends": "stylelint-config-apostrophe"
}
```

In order to also use the `stylelint-selector-bem-pattern` rules, you'll also need to configure this rule at a project level.

If using our build tools you can configure this as in your `webpack.config` by setting the `prefix` option of the `prefixer` setting. You may also use the `ignore` option to allow vendor prefixes to be allowed.

```js
prefixer: {
  prefix: 'my-project',
  ignore: [ /apos-/ ]
}
```

If you're not using our build tools, you may simply configure your rules in your `.stylelintrc` file per the instructions from the [`stylelint-selector-bem-pattern` plugin](https://github.com/simonsmith/stylelint-selector-bem-pattern#usage).

## Viewing differences between the standard configuration and ours

From this project's root, run

```
npm run compare
```

This will print a report in your terminal which shows which rules we not added to our config and which rules we have specifically modified.

All missing rules should be added to the `.stylelintrc.json` with a definition even if we agree with the standard. This ensures that we are aware of any new rules or changed definitions that are made to the standard and will allow us to lock down the rule definitions that we agree with.
