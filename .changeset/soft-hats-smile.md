---
"@apostrophecms/cli": major
---

**Breaking:** `apos create` is now an interactive guided installer (it delegates to `create-apostrophe`). The `<shortname>` positional argument and the `--starter` and `--mongodb-uri` options have been removed - project name, starter kit, and database are now chosen through prompts. For scripted installs, use `npm create apostrophe@latest -- --unattended` instead.

