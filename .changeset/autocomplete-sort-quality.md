---
"apostrophe": patch
---

Fixes the order of relationship autocomplete suggestions, which were sorted by `relationshipSuggestionSort` (most recently updated first, by default) rather than by search quality. Without this, for instance, "About Us" was not the first result when typing "about." This is why the search quality signal is so important that it must preempt other sort criteria when autocomplete prompts are present, as it already does elsewhere. The relationship input now sends `relationshipSuggestionSort` only when listing suggestions for an empty input.
