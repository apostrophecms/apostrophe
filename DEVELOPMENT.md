## Coding style

### UI component naming

We generally aim to follow [Vue best practices](https://vuejs.org/v2/style-guide/) regarding component naming. Specifically:
- Apostrophe UI components should be named with pascal case and name-spaced with `Apos`, e.g., `AposComponent`, `AposModal`.
- Single-instance components (where only one will ever exist) should be name-spaced with `TheApos`, e.g., `TheAposAdminBar`.
- Tightly coupled components should share name-spacing to reflect their relationships, e.g, `AposModal`, `AposModalHeader`, `AposModalBody`

## Analyzing bundle size

It is possible to analyze the size of the webpack bundle:

```
APOS_BUNDLE_ANALYZER=1 node app @apostrophecms/assets:build
```

This will display a visualization in your browser.

As of this writing, we are not optimizing the webpack build for production, so expect to see big numbers.
