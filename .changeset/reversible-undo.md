---
"apostrophe": minor
---

Undo and redo on the page now reverse the edit itself, rather than replaying every edit made since the page was loaded and then rendering the whole page again.

What that means while editing:

- **The page stays where it is.** Only the widget or field that changed is updated, so nothing else on the page is torn down and rebuilt around you. Undo no longer flashes, and the scroll position no longer has to be pinned to stop the page jumping.
- **Undo shows you what it did.** The change is scrolled into view if it is off screen, and briefly outlined. Until now there was nothing to go to: an undo could quietly change something you could not see.
- **Each press is one small save.** Undo used to send the whole history — the page as it was when you started, plus every edit since, which could be hundreds of patches — and the server had to re-check the entire document each time, so undo got slower the longer you worked. Now it sends a single change, which takes the server's fast path for a single widget.
- **Typing comes back a burst at a time**, and the same burst whether you undo inside a rich text editor or from the admin bar. It used to be taken back in arbitrary once-a-second slices when undone from outside the editor.
- **Rich text history survives the page being rendered again.** Editing a piece, or anything else that refreshes the main content area, used to destroy every editor on the page and the typing history with it. The history now holds the editing steps rather than the editor, so it also survives deleting a widget and undoing that deletion — which used to lose everything you had typed in it.
- **Undoing typing no longer throws away your redo.** A rich text editor kept a second history of its own, which could disagree with the page's: undoing typing in one widget wiped the redo of edits elsewhere, and undo appeared to do nothing at all once the editor's own history ran out.
- **An undo can no longer be quietly undone by an autosave** that was still in flight. History changes go through the same queue as every other edit, in order, so an undo made while offline still reaches the server when the connection is back.
- **The publish and discard controls tell the truth afterwards.** Undoing everything you did leaves nothing to publish and no draft to discard, where the admin bar used to go on offering both.
- **The history is bounded**, so a long editing session no longer accumulates without limit.

Two things are deliberately unchanged. A rich text editor in a modal keeps its own undo history, since there is no page history there to join. And code that reports edits the old way, with a bare patch, still works exactly as it did, undone by replaying the history and rendering the page again.

For developers: `context-edited` accepts `{ patch, inverse, target }`, where `inverse` is the patch that takes the edit back and `target` describes what was edited (`widgetId`, `anchorId` or `patchKey`). A bare patch, as emitted until now, is still accepted.
