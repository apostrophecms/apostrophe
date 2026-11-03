---
"eslint-config-apostrophe": major
---

Supports ESLint 10 as well as ESLint 9, and lints server-side JSX templates the way the documentation writes them: double-quoted attributes, no `key` prop on mapped elements, and either layout for a multi-line ternary. Components used only in JSX are no longer reported as unused on ESLint 9. Single-quoted JSX attributes are now errors; `eslint --fix` converts them. Requires Node.js 22.13 or later, following `neostandard` 0.14.
