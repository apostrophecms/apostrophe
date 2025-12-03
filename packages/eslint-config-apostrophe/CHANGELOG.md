## 6.0.2 (2025-09-16)

### Fixes

- Ignore `apos-build`, `data` and `public` directories recursively.

## 6.0.1 (2025-09-09)

### Fixes

- Apply `vue/max-len` rule to vue files only.

## 6.0.0 (2025-09-09)

### Breaking changes

- Migration to `eslint@9` and `neostandard`.

## 5.0.0 (2024-03-31)

### Adds

- Adds `eslint-plugin-vue` to the dependencies.

### Changes

- No console in tests.
- Same config for frontend js and vue.

## 4.3.0 (2024-02-14)

### Adds

- Global macros for vue 3.

### Changes

- Makes max-len a warning, updates its options.

## 4.2.1 (2024-01-10)

### Fixes

- Removed logic to automatically detect out of date eslint plugins.
Unfortunately this is [not safe in current Node.js if any of those
plugins use the `exports` feature in `package.json`](https://github.com/nodejs/node/issues/33460),
which led to install failures for a related module.

## 4.2.0 (2023-11-29)

### Adds

- Adds max-len rule

## 4.1.0 - 2023-08-03

### Adds

- Use latest eslint-config-standard

## 4.0.0 - 2023-06-21

### Changes

- Upgraded dependencies
- Swapped eslint-plugin-node for eslint-plugin-n which is what standard now uses

### Adds

- Added missing rules no-var, object-shorthand, array-callback-return, default-case-last, multiline-ternary, no-useless-backreference, no-empty, no-import-assign, no-loss-of-precision, no-unreachable-loop, prefer-regex-literals, n/handle-callback-err, n/no-callback-literal, n/no-deprecated-api, n/no-exports-assign, n/no-new-require, n/no-path-concat, n/process-exit-as-throw

### Fixes

- Fixed `compare` check which was returning some false positives

## 3.4.2 2022-04-20

Use semver range to pin to a major version of eslint-config-standard that supports eslint 7.
