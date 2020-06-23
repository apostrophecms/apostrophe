## Coding style

### UI component naming

We generally aim to follow [Vue best practices](https://vuejs.org/v2/style-guide/) regarding component naming. Specifically:
- Apostrophe UI components should be named with pascale case and name-spaced with `Apos`, e.g., `AposComponent`, `AposModal`.
- Single-instance components (where only one will ever exist) should be name-spaced with `TheApos`, e.g., `TheAposAdminBar`.
- Tightly coupled components should share name-spacing to reflect their relationships, e.g, `AposModal`, `AposModalHeader`, `AposModalBody`