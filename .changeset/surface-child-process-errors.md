---
'create-apostrophe': patch
---

Fixed the installer reporting a failed step with no explanation. On failure it printed "See the messages above for the underlying error", but the failing child process's output was captured and discarded, so there were no messages above — nothing was left to go on but a stage name and an error code. Failures of `npm install` and of the `@apostrophecms/user:add` / `@apostrophecms/user:change-password` tasks now print the tail of the child's own output (the last 30 lines, since that is where the actual error is). This matters most at the admin-account step: it is the first thing that boots the newly generated project's Apostrophe, so a startup problem of any kind — a bad database connection string, a missing dependency — surfaces there and was previously invisible. The output is written to the terminal only; telemetry continues to receive nothing but the symbolic error code.
