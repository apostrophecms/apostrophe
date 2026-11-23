// Delete the "/" that opened the rich text insert menu, along with anything
// typed after it to pick a choice.

export default function removeSlash(editor) {
  const { selection } = editor.state;
  const { $to } = selection;
  if (!selection.empty || !$to.parent.isTextblock) {
    return;
  }
  const before = $to.parent.textBetween(0, $to.parentOffset);
  // The menu opens only on a blank line, so the line up to the cursor is
  // the slash and the query
  if (before.startsWith('/')) {
    editor.commands.deleteRange({
      from: $to.start(),
      to: $to.pos
    });
    return;
  }
  if (before.endsWith('/')) {
    editor.commands.deleteRange({
      from: $to.pos - 1,
      to: $to.pos
    });
  }
}
