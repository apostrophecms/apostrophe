---
"apostrophe": patch
---

The rich text link dialog now respects a project-level `def` for the `updateTitle` field. Before this fix, the "Update Title" checkbox for links to pages and pieces was always checked by default. To make it unchecked by default, configure it in `modules/@apostrophecms/rich-text-widget/index.js`:

```js
module.exports = {
  linkFields(self) {
    return {
      add: {
        updateTitle: {
          ...self.linkFields.updateTitle,
          def: false
        }
      }
    };
  }
};
```

Also, editing a link whose page or piece no longer exists now switches the dialog to "URL" as intended.

When "Update Title" is checked, the rendered link text is now fully replaced by the linked page or piece title even if the link text contains formatting such as bold or italic. Before, the title was inserted next to the formatted text.
