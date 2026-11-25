---
"apostrophe": minor
---

Improvements to the rich text insert menu (the "/" menu).

Features:

- In a rich text widget, the menu now offers the other widgets its area accepts, with the descriptions the area's own "add" menu shows. Choosing one splits the rich text widget at the slash and places the new widget between the two halves, or simply before or after the rich text widget when the slash is on its first or last line. A widget with an editor modal is added only once the modal is saved. Undo takes the whole change back in one step. Rich text fields, which are not widgets in an area, do not offer widgets.
- Typing after the slash now narrows the menu to a choice: when what was typed starts the label of just one choice, ignoring case, that choice is selected and Enter inserts it. Backspace shortens what was typed, and the menu closes once no label starts with it. While the menu is open, the slash and the text typed after it are lightly shaded. Choosing an item removes them along with it.

Fixes:

- The menu no longer picks up the text alignment of the page around it. Placed in a section the site centers, its titles were centered while their descriptions were not.
- The menu no longer opens underneath the "+" buttons and other controls of the widget it belongs to.
- The menu no longer shifts or slides as you type, stays clear of the admin bar, and scrolls when its list is long.
- The menu opens only when a slash is typed on a blank line. Backspacing "/foo" to "/" no longer brings it back, and a slash after other text no longer opens it.
- Escape closes the menu and leaves you typing after the slash, instead of also leaving the widget. Escape closes the menu even when the cursor is in the text rather than in the menu, and a Backspace typed quickly after Escape deletes one character rather than the whole slash.
- The menu's inline image is now labeled "Inline Image", to tell it apart from the image widget.
- Redoing an edit that changed a rich text widget's text from outside the editor, such as an area-level undo, now shows the redone text in the editor.
