// An editor's save of fields the assistant wrote into its open editor: the
// save carries each request's marker and the fields' paths in the document
// (core's `_outside`, see `apos.doc.launderOutside`). A marker counts when
// its request is one of the user's own, owned by the browser tab that
// saves; the save is then marked for the change log, which records those
// fields as each request's rows (see the harness's `recordChange`). The save
// itself stays the user's, never AI. The editor usually saves after the
// request ended, so an ended request counts too: at worst a forged marker
// names the user's own typing as their own assistant's.

const DOOR = 'assistant';
const LIVE = [ 'running', 'stopping', 'waiting' ];

module.exports = (self) => {
  return {
    /**
     * Marks `req` for the change log when its write body carries fields the
     * user's requests wrote from outside: `req.aposSaveMarker` with one
     * `outside` part per request, `{ requestId, chat, fields, ended }`.
     * Does nothing otherwise.
     *
     * @param {object} req A REST write of a document.
     */
    async markOutsideSave(req) {
      const outside = self.apos.doc.launderOutside(req.body?._outside);
      if (!outside?.tabId || !req.user) {
        return;
      }
      const fieldsById = new Map();
      for (const { marker, fields } of outside.parts) {
        if (marker.requestId) {
          fieldsById.set(marker.requestId, [
            ...(fieldsById.get(marker.requestId) || []),
            ...fields
          ]);
        }
      }
      if (!fieldsById.size) {
        return;
      }
      const requests = await self.requests.find({
        _id: { $in: [ ...fieldsById.keys() ] },
        ownerId: req.user._id,
        tabId: outside.tabId
      }, {
        projection: {
          chatId: 1,
          status: 1
        }
      }).toArray();
      if (!requests.length) {
        return;
      }
      const parts = requests.map(request => ({
        requestId: request._id,
        chat: request.chatId,
        fields: [ ...new Set(fieldsById.get(request._id)) ],
        ended: !LIVE.includes(request.status)
      }));
      req.aposSaveMarker = {
        door: DOOR,
        requestId: parts[0].requestId,
        chat: parts[0].chat,
        outside: parts
      };
    }
  };
};
