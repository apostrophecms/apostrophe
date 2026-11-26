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
  'askBeforeOverwrite', 'client', 'pendingSeen'
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
     * @param {boolean} [context.askBeforeOverwrite] A write refused because
     *   the document was saved since the read always says who saved it.
     *   With this, after another user's save the model is told to say what
     *   they changed and write only if the user asks; after the same user's,
     *   to read it again and build on it. For a door with no confirmation of
     *   its own, such as MCP; without it, the refusal says to read the
     *   document again before writing it.
     * @param {object} [context.client] The outside tool the request comes
     *   from, for a door that serves several, such as MCP. Recorded on the
     *   request's change-log entries, which outlive the tool's connection.
     *   `id` is the tool's client id: for a tool that registered itself,
     *   a random string that means nothing once the connection is gone.
     *   `name` is the name the tool gave itself, never checked, so it must
     *   never be shown as proof of which tool it was. What can be checked
     *   is `clientHost`, the host the tool's metadata document is served
     *   from (null for a tool that registered itself), and `redirectTo`,
     *   where it sends users back to, as `{ host, local }`, as "Connected
     *   tools" shows them.
     * @param {string} context.client.id
     * @param {string|null} [context.client.name]
     * @param {string|null} [context.client.clientHost]
     * @param {{ host: string, local: boolean }|null} [context.client.redirectTo]
     * @returns {object} The `req` clone.
     */
    withDoor(req, context) {
      const unknown = Object.keys(context || {})
        .filter(key => !DOOR_KEYS.includes(key));
      if (unknown.length) {
        throw self.apos.error('invalid', `unknown door context keys: ${unknown.join(', ')}`);
      }
      const {
        door, lockId, family, chat, requestId, model, revert, seen, deferSeen,
        askBeforeOverwrite, client, pendingSeen
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
      if ((askBeforeOverwrite !== undefined) && (typeof askBeforeOverwrite !== 'boolean')) {
        throw self.apos.error('invalid', '"askBeforeOverwrite" must be a boolean');
      }
      if ((client !== undefined) && !(
        (typeof client?.id === 'string') && client.id &&
        [ 'name', 'clientHost' ].every(
          key => (client[key] == null) || (typeof client[key] === 'string')
        ) &&
        ((client.redirectTo == null) || (typeof client.redirectTo.host === 'string'))
      )) {
        throw self.apos.error(
          'invalid',
          '"client" must be { id, name, clientHost, redirectTo }'
        );
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
          ...(askBeforeOverwrite && { askBeforeOverwrite }),
          ...(client && {
            client: Object.freeze({
              id: client.id,
              name: client.name || null,
              clientHost: client.clientHost || null,
              redirectTo: client.redirectTo
                ? Object.freeze({
                  host: client.redirectTo.host,
                  local: Boolean(client.redirectTo.local)
                })
                : null
            })
          }),
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
