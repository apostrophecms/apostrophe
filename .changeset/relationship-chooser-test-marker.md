---
"apostrophe": patch
---

Relationship chooser modals (pages, pieces and images) carry a `data-apos-test="relationship-chooser:<field label>"` attribute, so end-to-end tests can find them now that the field label is no longer rendered as a `title` attribute on the modal.
