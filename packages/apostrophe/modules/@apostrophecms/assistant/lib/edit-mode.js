// The page in edit mode before the assistant writes it: a write to the
// document the editor's page shows, while the page is not in edit mode,
// first switches the page to edit mode, a screen-changing step of the
// browser tab that owns the request, so the write lands in the page's undo
// history. The step is an ask of kind `editMode`, answered by that browser
// tab; its answer is taken off the call's input before the write runs, and
// the write runs whatever the answer. A hidden browser tab, or a page that
// could not switch, gets the write without the step: the chat's revert
// takes it back.

const getCallDocumentIds = require('./call-documents');

const { getDocumentKey } = getCallDocumentIds;
const DOOR = 'assistant';

module.exports = (self) => {
  return {
    /**
     * Before a write tool of the assistant runs (`beforeToolCall`): when
     * the call writes the document the page shows and the page is not in
     * edit mode, suspends the call with an `editMode` ask. The answer
     * comes back as the call's input, which this takes off.
     *
     * @param {object} req
     * @param {object} payload The engine's `{ tool, args }`.
     */
    async checkEditMode(req, { tool, args }) {
      const door = self.apos.harness.getDoor(req);
      if (!self.active || (door?.door !== DOOR) || (tool.kind !== 'action') ||
        !tool.tags?.includes('content')) {
        return;
      }
      const { _context, ...validated } = args;
      if (_context.input?.editMode) {
        delete _context.input;
        return;
      }
      // Answered input of the call's own
      if (_context.input !== undefined) {
        return;
      }
      const { screen } = await self.requests.findOne({
        _id: door.requestId,
        ownerId: self.getOwnerId(req)
      }, { projection: { screen: 1 } }) || {};
      if (!screen?.document || screen.editing || (screen.visible === false)) {
        return;
      }
      const shown = getDocumentKey(req, screen.document._id);
      const writes = getCallDocumentIds(req, validated)
        .some(id => getDocumentKey(req, id) === shown);
      if (writes) {
        throw self.apos.error('aiInput', 'waiting for the page to enter edit mode', {
          kind: 'editMode',
          screenEffect: 'changes',
          whenHidden: {
            executed: false,
            reason: 'the user is in another browser tab'
          }
        });
      }
    },

    // The browser tab's answer to an `editMode` ask: whether the page
    // entered edit mode, and the screen after it, which becomes the
    // request's
    acceptEditModeAnswer(req, ask, answer, { screen }) {
      if (!screen) {
        throw self.apos.error('invalid', 'an edit mode answer carries the screen');
      }
      return {
        editMode: {
          executed: answer?.executed === true
        }
      };
    }
  };
};
