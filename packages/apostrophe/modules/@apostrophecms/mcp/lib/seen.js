// What each connection has seen of each document, for the harness's
// stale-write guard. The harness refuses a door's write to a document saved
// since the door last read or wrote it, using the door's `seen` map (see
// `withDoor`). The assistant keeps that map for a whole chat. Each MCP tool
// call is a request of its own, so the map is kept here, per connection, and
// handed to every call's door: a read in one call guards a write in a later
// one.
//
// A connection is an OAuth connection (`connectionId` from
// `verifyAccessToken`), which lasts across refreshes until the user approves
// the tool again, or `dev` for the development token.
//
// One row per connection and document, not one map per connection: a tool
// may call several tools at once, and saving a whole map would let one call
// drop another's entry. Rows end with the OAuth connection lifetime, counted
// from the last read or write, and a connection keeps only its `seenLimit`
// most recent (100 by default). A row that ended or was dropped only means
// that document's next write isn't checked.

module.exports = (self) => {
  return {
    async ensureSeenCollection() {
      self.seen = self.apos.db.collection('aposMcpSeen');
      await self.seen.createIndex({ connection: 1 });
      await self.seen.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    },

    // The `seen` map for `connection`'s next door: `updatedAt` by `_id`.
    // Drops the connection's rows beyond the `seenLimit` most recently seen.
    // A call may add more than that, so the limit holds from the next call
    async getSeen(connection) {
      const limit = self.options.seenLimit;
      const rows = await self.seen.find({
        connection,
        // The TTL index removes ended rows only every minute or so
        expiresAt: { $gt: new Date() }
      }).sort({ seenAt: -1 }).toArray();
      const dropped = rows.splice(limit);
      if (dropped.length) {
        await self.seen.deleteMany({
          _id: { $in: dropped.map(row => row._id) }
        });
      }
      return new Map(rows.map(row => [ row.docId, row.updatedAt ]));
    },

    // Keeps what the door of `req` now has for `docId`. Called for each
    // document the harness remembers (`documentSeen`)
    async storeSeen(req, docId) {
      const door = self.apos.harness.getDoor(req);
      const connection = req.aposMcpConnection;
      const updatedAt = door?.seen.get(docId);
      if ((door?.door !== 'mcp') || !connection || !updatedAt) {
        return;
      }
      await self.seen.updateOne({ _id: `${connection}:${docId}` }, {
        $set: {
          connection,
          docId,
          updatedAt,
          seenAt: new Date(),
          expiresAt: new Date(Date.now() + self.getSeenLifetime() * 1000)
        }
      }, { upsert: true });
    },

    // In seconds: as long as an OAuth connection lasts
    getSeenLifetime() {
      return self.apos.oauth.options.connectionLifetime;
    }
  };
};
