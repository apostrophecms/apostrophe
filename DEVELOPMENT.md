## Coding style

### UI component naming

We generally aim to follow [Vue best practices](https://vuejs.org/v2/style-guide/) regarding component naming. Specifically:
- Apostrophe UI components should be named with pascal case and name-spaced with `Apos`, e.g., `AposComponent`, `AposModal`.
- Single-instance components (where only one will ever exist) should be name-spaced with `TheApos`, e.g., `TheAposAdminBar`.
- Tightly coupled components should share name-spacing to reflect their relationships, e.g, `AposModal`, `AposModalHeader`, `AposModalBody`

### UI component styles

As a rule, all user interface components should have their styles scoped (using the `scoped` attribute). This helps us write simpler CSS selectors and avoide a certain amount of style "bleed" across components. Global styles, and styles for top level Vue apps (e.g., `TheAposNotifications`), should be in `.scss` files and imported into the import file: `/modules/@apostrophecms/ui/ui/apos/scss/imports.scss`.

## Analyzing bundle size

It is possible to analyze the size of the admin UI webpack bundle:

```
APOS_BUNDLE_ANALYZER=1 node app @apostrophecms/asset:build
```

This will display a visualization in your browser.

As of this writing, we are not optimizing the webpack build for production, so expect to see big numbers.
