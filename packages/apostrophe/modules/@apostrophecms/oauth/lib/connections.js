// Connections: one record for each tool a user approved, so that the user
// can see their connected tools and disconnect any of them.
//
// A connection's tokens (see lib/tokens.js) carry its id, and are what
// grants access. The record is what the user sees. It's created when the
// code is exchanged, and keeps the tool's name as it was then: a client
// known by its metadata document (CIMD) is only cached, and may be gone
// long before the connection is.
//
// The record is what makes a connection count: no token works without it,
// for a request or a refresh. So the user's list is always the whole
// truth, and removing the record ends the connection at once, even if
// deleting its tokens fails partway. Tokens issued while the connection is
// being ended are deleted too (see revokeGrant and checkStillConnected in
// lib/tokens.js).
//
// Nothing here is secret. The tool's name comes from the tool, and must be
// shown as text. The address it sends users back to can't be made up, so
// it's kept too, to tell a real tool from one that borrowed its name.

module.exports = (self) => {
  return {
    async ensureConnectionsCollection() {
      self.connections = self.apos.db.collection('aposOauthConnections');
      // Every query also checks `expiresAt`: the TTL index only tidies up
      await self.connections.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await self.connections.createIndex({ userId: 1 });
    },

    // Records the connection a code exchange starts
    async createConnection({
      grantId, code, connectionExpiresAt
    }) {
      await self.connections.insertOne({
        _id: grantId,
        userId: code.userId,
        clientId: code.clientId,
        clientName: code.clientName || null,
        redirectUri: code.redirectUri,
        resource: code.resource,
        scope: code.scope,
        approvedAt: code.createdAt,
        lastUsedAt: new Date(),
        expiresAt: connectionExpiresAt
      });
    },

    // The connection, if it hasn't ended. Notes that it was used
    async useConnection(grantId) {
      const now = new Date();
      const { matchedCount } = await self.connections.updateOne({
        _id: grantId,
        expiresAt: { $gt: now }
      }, {
        $set: { lastUsedAt: now }
      });
      return matchedCount === 1;
    },

    // The user's connections, most recently approved first, as the
    // settings page shows them
    async getConnections(userId) {
      const connections = await self.connections.find({
        userId,
        expiresAt: { $gt: new Date() }
      }).sort({ approvedAt: -1 }).toArray();
      return connections.map(connection => ({
        _id: connection._id,
        clientName: connection.clientName,
        // Who the tool is, as far as can be told: the host its metadata
        // document is served from, and where it sends the user back to
        clientHost: getClientHost(connection.clientId),
        redirectTo: self.describeRedirect(connection.redirectUri),
        approvedAt: connection.approvedAt,
        lastUsedAt: connection.lastUsedAt,
        expiresAt: connection.expiresAt
      }));
    },

    // Ends one of the user's connections. False if the user has no such
    // connection, which includes another user's
    async disconnect(req, grantId) {
      const connection = await self.connections.findOne({
        _id: grantId,
        userId: req.user._id
      });
      if (!connection) {
        return false;
      }
      await self.revokeGrant(grantId);
      self.logInfo(req, 'connection-removed', {
        username: req.user.username,
        clientId: connection.clientId,
        clientName: connection.clientName
      });
      return true;
    },

    // Every connection of a user, with its tokens. For a deleted user
    async removeUserConnections(userId) {
      await self.tokens.deleteMany({ userId });
      await self.connections.deleteMany({ userId });
    }
  };
};

function getClientHost(clientId) {
  try {
    const url = new URL(clientId);
    return (url.protocol === 'https:') ? url.host : null;
  } catch (e) {
    // A DCR client's id is not a URL
    return null;
  }
}
