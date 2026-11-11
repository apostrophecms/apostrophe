---
"apostrophe": patch
---

Each module now gets its own copy of the nested objects and arrays in the options it inherits, so a module that changes something like `self.options.nested.value` no longer changes the options of its base class and sibling subclasses. Functions and class instances in options are still shared by reference.
