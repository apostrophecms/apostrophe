---
"apostrophe": minor
---

Several people can now edit the same page or piece at once. Instead of "take control?", everyone editing sees who else is there, each person's latest change pointed out in their color (the marker fades away after a few seconds), and other people's cursors in rich text. Two people can type in the same rich text widget, or the same field edited in place, at the same time. Every change is saved and everyone ends up with the same content, whatever order the changes reach the server in.

This is on by default for every doc type, via the new `collaborative` option of `@apostrophecms/doc-type`. Users are opted out, since they are security sensitive, and keep the exclusive lock, as does any type that sets `collaborative: false`.

How it works: every edit is applied at once in the browser that made it and sent to the server, which puts everyone's edits in order and broadcasts them to everyone else through notification channels, over the existing notification long poll. No WebSocket is needed. Area and widget changes are patches that name widgets by id. Text is kept in step with `prosemirror-collab`, and saved by whoever typed last once they pause. The document editor modal and widget editor modals save only what the user changed, field by field and widget by widget, so that edits made by others at the same time survive. Undo takes back only your own changes. Before publishing, everyone's unsaved typing is saved first.

The new `@apostrophecms/collab` module implements this and has options for tuning it: `stepsExpireAfter`, `presenceTimeout`, `flushTimeout` and `excludeTypes`.
