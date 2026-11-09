// The door context of a request.
//
// A door (the assistant, the MCP server) calls `withDoor` once per request
// and passes the request it returns to `apos.ai.generate`; every tool
// handler runs on a clone of it, so each write finds who is asking without
// anything in the tool arguments. A write without a door context, from a
// plain `generate` call, is not recorded in the change log.

const DOOR_KEYS = [ 'door', 'lockId', 'family', 'chat', 'request', 'model', 'revert' ];

module.exports = (self) => {
  return {
    /**
     * A clone of `req` carrying the context of a door's request, for the
     * door to pass to `apos.ai.generate` or `generateJob`.
     *
     * @param {object} req
     * @param {object} context
     * @param {string} context.door The door's name: `assistant`, `mcp`.
     * @param {string} context.lockId The lock id every write of the request
     *   locks with: the chat's id, or one per MCP connection.
     * @param {string} [context.family] The lock family, the browser tab whose
     *   page lock the request's writes share.
     * @param {string} context.request The id of the request, the change log
     *   entries' key.
     * @param {string} [context.chat] The id of the chat, for the assistant.
     * @param {{ provider: string, model: string }} [context.model] The model
     *   the request runs on.
     * @param {boolean} [context.revert] The request reverts earlier changes:
     *   its saves are the user's own, not AI's.
     * @returns {object} The request clone.
     */
    withDoor(req, context) {
      const unknown = Object.keys(context || {})
        .filter(key => !DOOR_KEYS.includes(key));
      if (unknown.length) {
        throw self.apos.error('invalid', `unknown door context keys: ${unknown.join(', ')}`);
      }
      const {
        door, lockId, family, chat, request, model, revert
      } = context;
      for (const [ name, value ] of Object.entries({
        door,
        lockId,
        request
      })) {
        if (typeof value !== 'string' || !value) {
          throw self.apos.error('invalid', `the door context needs "${name}"`);
        }
      }
      for (const [ name, value ] of Object.entries({
        family,
        chat
      })) {
        if ((value !== undefined) && ((typeof value !== 'string') || !value)) {
          throw self.apos.error('invalid', `"${name}" must be a non-empty string`);
        }
      }
      if (family === lockId) {
        throw self.apos.error('invalid', 'a lock cannot be its own family');
      }
      if ((model !== undefined) &&
        ((typeof model?.provider !== 'string') || (typeof model?.model !== 'string'))) {
        throw self.apos.error('invalid', '"model" must be { provider, model }');
      }
      if ((revert !== undefined) && (typeof revert !== 'boolean')) {
        throw self.apos.error('invalid', '"revert" must be a boolean');
      }
      return req.clone({
        aposHarnessDoor: Object.freeze({
          door,
          lockId,
          request,
          ...(family && { family }),
          ...(chat && { chat }),
          ...(revert && { revert }),
          ...(model && {
            model: {
              provider: model.provider,
              model: model.model
            }
          })
        })
      });
    },

    // The door context `withDoor` set on `req`, `null` for a plain call
    getDoor(req) {
      return req.aposHarnessDoor || null;
    }
  };
};
