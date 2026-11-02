---
"apostrophe": minor
---

Add AI localization (proof of concept). When `@apostrophecms/ai` has a provider configured, the Localize dialog asks "What do you want to localize?" and defaults to "Only new and modified content": an AI agent brings each locale's copy up to date with what changed in the source since it was last localized, translating it and keeping edits made in that locale alone, while documents new to a locale are copied and translated in full. Related documents follow the same policy. The dialog shows the agent's progress as it works and can stop it. The new `@apostrophecms/ai-localize` module registers the agent's tools with `apos.ai` under the `ai-localize` tag and keeps a record of each localization, written by AI passes and by the classic Localize flow alike.
