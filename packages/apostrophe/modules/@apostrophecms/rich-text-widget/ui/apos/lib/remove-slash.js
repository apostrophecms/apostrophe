// Delete the trailing "/" that opened the rich text insert menu.

export default function removeSlash(editor) {
  const state = editor.state;
  const { $to } = state.selection;
  if (state.selection.empty && $to?.nodeBefore?.text) {
    const text = $to.nodeBefore.text;
    if (text.slice(-1) === '/') {
      const pos = editor.view.state.selection.$anchor.pos;
      // Select the slash so an insert operation can replace it
      editor.commands.setTextSelection({
        from: pos - 1,
        to: pos
      });
      editor.commands.deleteSelection();
    }
  }
}
