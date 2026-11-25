// The door context of a request.
//
// A door (the assistant, the MCP server) calls `withDoor` once per request
// and passes the `req` it returns to `apos.ai.generate`; every tool
// handler runs on a clone of it, so each write finds who is asking without
// anything in the tool arguments. A write without a door context, from a
// plain `generate` call, is not recorded in the change log.
//
// No tool of the harness allows or refuses a call by the door's name: what a
// door adds for its own model (the assistant's gates and browser tools) is
// that door's code. So a server job that runs a model unattended needs no
// door: it gets the write path every AI write shares and nothing a door
// adds, and never takes a door's name to get past a rule.

const DOOR_KEYS = [
  'door', 'lockId', 'family', 'chat', 'requestId', 'model', 'revert', 'seen', 'deferSeen',
  'pendingSeen'
];

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
     * @param {string} context.requestId The id of the request, the change log
     *   entries' key.
     * @param {string} [context.chat] The id of the chat, for the assistant.
     * @param {{ provider: string, model: string }} [context.model] The model
     *   the request runs on.
     * @param {boolean} [context.revert] The request reverts earlier changes:
     *   its saves are the user's own, not AI's.
     * @param {Map<string, string>} [context.seen] The `updatedAt` of each
     *   document the door's earlier requests read or wrote, by `_id`. A
     *   write to a document saved since is refused; the request's own reads
     *   and writes are added as they happen (see `rememberSeen`).
     * @param {boolean} [context.deferSeen] Reads are added only by
     *   `commitSeen`, for a door whose model calls tools in steps: a write
     *   of a read's own step was written from what the model read before.
     * @param {Map<string, string>} [context.pendingSeen] With `deferSeen`,
     *   reads an earlier run of the request kept aside and never added: its
     *   step waited, and its calls run on this request.
     * @returns {object} The `req` clone.
     */
    withDoor(req, context) {
      const unknown = Object.keys(context || {})
        .filter(key => !DOOR_KEYS.includes(key));
      if (unknown.length) {
        throw self.apos.error('invalid', `unknown door context keys: ${unknown.join(', ')}`);
      }
      const {
        door, lockId, family, chat, requestId, model, revert, seen, deferSeen, pendingSeen
      } = context;
      for (const [ name, value ] of Object.entries({
        door,
        lockId,
        requestId
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
      if ((deferSeen !== undefined) && (typeof deferSeen !== 'boolean')) {
        throw self.apos.error('invalid', '"deferSeen" must be a boolean');
      }
      if ((seen !== undefined) && !(seen instanceof Map)) {
        throw self.apos.error('invalid', '"seen" must be a Map');
      }
      if ((pendingSeen !== undefined) && (!deferSeen || !(pendingSeen instanceof Map))) {
        throw self.apos.error('invalid', '"pendingSeen" must be a Map, with "deferSeen"');
      }
      return req.clone({
        aposHarnessDoor: Object.freeze({
          door,
          lockId,
          requestId,
          seen: new Map(seen),
          ...(deferSeen && { pendingSeen: new Map(pendingSeen) }),
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
    },

    // Remembers, for the door of `req`, the `updatedAt` of a document it
    // read or wrote, and tells the door (`documentSeen`), which may keep
    // the door's `seen` for its next requests. A document without one (a
    // projection) is not remembered: its next write is not checked. A
    // `read` of a door with `deferSeen` waits for `commitSeen`
    async rememberSeen(req, doc, { read = false } = {}) {
      const door = self.getDoor(req);
      const time = new Date(doc.updatedAt ?? NaN).getTime();
      if (!door || isNaN(time)) {
        return;
      }
      const updatedAt = new Date(time).toISOString();
      if (read && door.pendingSeen) {
        door.pendingSeen.set(doc._id, updatedAt);
        return;
      }
      // An older read of the same step never replaces a write's stamp
      door.pendingSeen?.delete(doc._id);
      door.seen.set(doc._id, updatedAt);
      await self.emit('documentSeen', req, doc._id);
    },

    // Adds the reads `rememberSeen` kept aside to the door's `seen`
    async commitSeen(req) {
      const door = self.getDoor(req);
      if (!door?.pendingSeen?.size) {
        return;
      }
      const pending = [ ...door.pendingSeen ];
      door.pendingSeen.clear();
      for (const [ _id, updatedAt ] of pending) {
        door.seen.set(_id, updatedAt);
        await self.emit('documentSeen', req, _id);
      }
    }
  };
};
