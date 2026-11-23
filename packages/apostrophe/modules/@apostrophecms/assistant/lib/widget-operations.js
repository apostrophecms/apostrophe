// Widget menu entries that hand the selected widgets to the assistant: a
// click opens the panel with a prompt about them, for the editor to finish
// and send. The browser side is ui/apos/lib/widget-operations.js.

module.exports = (self) => {
  return {
    /**
     * Adds an entry to every widget type's "More options" menu, offered for
     * one widget or several, once the assistant is active. A click opens the
     * panel with `prompt` in front of the active chat tab's draft and the
     * caret in it, the widgets being the selection already.
     *
     * Call it in a module's `init`.
     *
     * @param {string} name
     * @param {object} operation
     * @param {string} operation.label The entry's i18n key.
     * @param {string} [operation.icon]
     * @param {string} operation.prompt The prompt's i18n key, in the admin UI
     *   language. It receives `count`, the number of widgets (so it may have
     *   a plural form), and the caret goes where its translation has
     *   `{{ caret }}`, else at its end.
     */
    addWidgetOperation(name, {
      label, icon, prompt
    }) {
      if (!label || !prompt) {
        throw self.apos.error('invalid',
          `The assistant's widget operation "${name}" needs a label and a prompt.`);
      }
      self.widgetOperations[name] = {
        label,
        icon,
        prompt
      };
    }
  };
};
