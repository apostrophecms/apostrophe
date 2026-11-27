const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  ACTION, BASE_URL, RESOURCE, connect, createOauthApos, getUrl
} = require('./utils/oauth.js');

// Connections: a record for each tool a user approved, which the user can
// list and end from their personal settings. The record is what makes a
// connection count, so ending it ends the tokens at once.

const CONNECTIONS = `${ACTION}/connections`;
const RESOURCE_URL = `${BASE_URL}${RESOURCE}`;

describe('OAuth: connections', function () {
  this.timeout(t.timeout);

  let apos;
  let client;
  let otherClient;
  let editor;
  let other;

  before(async function () {
    apos = await createOauthApos(module);
    await t.createUser(apos, 'editor', { username: 'editor' });
    await t.createUser(apos, 'editor', { username: 'other' });
    editor = await login('editor');
    other = await login('other');
    client = await apos.modules['@apostrophecms/oauth'].registerClient({
      client_name: 'Test <b>tool</b>',
      redirect_uris: [ 'https://tool.example.com/callback' ]
    });
    otherClient = await apos.modules['@apostrophecms/oauth'].registerClient({
      client_name: 'Other tool',
      redirect_uris: [ 'http://127.0.0.1/callback' ]
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  async function login(username) {
    const jar = await t.loginAs(apos, username);
    return {
      jar,
      cookie: jar.getCookieStringSync(apos.http.getBase())
    };
  }

  function connectAs(user, tool = client) {
    return connect(apos, {
      client: tool,
      cookie: user.cookie
    });
  }

  async function list(user) {
    const { connections } = await apos.http.get(CONNECTIONS, { jar: user.jar });
    return connections;
  }

  function disconnect(user, id) {
    return apos.http.delete(`${CONNECTIONS}/${encodeURIComponent(id)}`, { jar: user.jar });
  }

  function verify(token) {
    return apos.modules['@apostrophecms/oauth'].verifyAccessToken(token, { resource: RESOURCE_URL });
  }

  function refresh(tokens, tool = client) {
    return fetch(getUrl(apos, `${ACTION}/token`), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: tool.client_id,
        refresh_token: tokens.refresh_token
      }).toString()
    }).then(response => response.json());
  }

  // The connection a token belongs to
  async function getConnectionId(tokens) {
    const doc = await apos.modules['@apostrophecms/oauth'].tokens.findOne({
      _id: apos.modules['@apostrophecms/oauth'].hashSecret(tokens.access_token)
    });
    return doc.grantId;
  }

  async function clear() {
    await apos.modules['@apostrophecms/oauth'].connections.deleteMany({});
    await apos.modules['@apostrophecms/oauth'].tokens.deleteMany({});
  }

  describe('the list', function () {
    beforeEach(clear);

    it('shows each connection the user approved, as the tool named itself then', async function () {
      const before = Date.now();
      await connectAs(editor);
      const [ connection, ...rest ] = await list(editor);
      assert.equal(rest.length, 0);
      assert.deepEqual(Object.keys(connection).sort(), [
        '_id', 'approvedAt', 'clientHost', 'clientName', 'expiresAt', 'lastUsedAt', 'redirectTo'
      ]);
      // As the tool sent it: the settings page shows it as text
      assert.equal(connection.clientName, 'Test <b>tool</b>');
      assert.equal(connection.clientHost, null);
      assert.deepEqual(connection.redirectTo, {
        host: 'tool.example.com',
        local: false
      });
      const approvedAt = new Date(connection.approvedAt).getTime();
      const recent = (approvedAt >= before - 1000) && (approvedAt <= Date.now());
      assert.ok(recent, connection.approvedAt);
      const days = (new Date(connection.expiresAt) - approvedAt) / (24 * 60 * 60 * 1000);
      assert.ok(Math.abs(days - 30) < 0.01, String(days));
    });

    it('shows a tool approved twice as two connections, the latest first', async function () {
      const first = await connectAs(editor);
      const second = await connectAs(editor, otherClient);
      const connections = await list(editor);
      assert.deepEqual(
        connections.map(connection => connection._id),
        [ await getConnectionId(second), await getConnectionId(first) ]
      );
      assert.deepEqual(connections[0].redirectTo, {
        host: '127.0.0.1',
        local: true
      });
    });

    it('shows only the user\'s own connections', async function () {
      await connectAs(editor);
      await connectAs(other);
      assert.equal((await list(editor)).length, 1);
      assert.equal((await list(other)).length, 1);
    });

    it('keeps the tool\'s name after the site forgets the tool', async function () {
      // As a cached client metadata document expires
      const passing = await apos.modules['@apostrophecms/oauth'].registerClient({
        client_name: 'Passing tool',
        redirect_uris: [ 'https://passing.example.com/callback' ]
      });
      await connectAs(editor, passing);
      await apos.modules['@apostrophecms/oauth'].clients.deleteOne({ _id: passing.client_id });
      assert.equal((await list(editor))[0].clientName, 'Passing tool');
    });

    it('notes when the tool last refreshed its tokens', async function () {
      const tokens = await connectAs(editor);
      const id = await getConnectionId(tokens);
      const long = new Date(Date.now() - (24 * 60 * 60 * 1000));
      await apos.modules['@apostrophecms/oauth'].connections.updateOne({ _id: id }, { $set: { lastUsedAt: long } });
      const refreshed = await refresh(tokens);
      assert.ok(refreshed.access_token);
      const [ connection ] = await list(editor);
      assert.ok(new Date(connection.lastUsedAt) > long);
    });

    it('leaves out a connection that has ended', async function () {
      const tokens = await connectAs(editor);
      await apos.modules['@apostrophecms/oauth'].connections.updateOne(
        { _id: await getConnectionId(tokens) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );
      assert.deepEqual(await list(editor), []);
    });

    it('is for logged-in users only', async function () {
      await assert.rejects(apos.http.get(CONNECTIONS), { status: 403 });
    });
  });

  describe('disconnecting', function () {
    beforeEach(clear);

    it('ends the connection at once: its tokens stop working, and it leaves the list', async function () {
      const tokens = await connectAs(editor);
      const kept = await connectAs(editor, otherClient);
      assert.ok(await verify(tokens.access_token));
      await disconnect(editor, await getConnectionId(tokens));
      assert.equal(await verify(tokens.access_token), null);
      assert.equal((await refresh(tokens)).error, 'invalid_grant');
      const connections = await list(editor);
      assert.deepEqual(connections.map(connection => connection._id), [
        await getConnectionId(kept)
      ]);
      assert.ok(await verify(kept.access_token));
    });

    it('can\'t end another user\'s connection, and says only that it found none', async function () {
      const tokens = await connectAs(other);
      const id = await getConnectionId(tokens);
      await assert.rejects(disconnect(editor, id), { status: 404 });
      await assert.rejects(disconnect(editor, 'no-such-connection'), { status: 404 });
      assert.ok(await verify(tokens.access_token));
    });

    it('is for logged-in users only, with Apostrophe\'s CSRF check', async function () {
      const tokens = await connectAs(editor);
      const id = await getConnectionId(tokens);
      await assert.rejects(apos.http.delete(`${CONNECTIONS}/${id}`), { status: 403 });
      // The session cookie alone, as a cross-site request would send it
      const response = await fetch(getUrl(apos, `${CONNECTIONS}/${id}`), {
        method: 'DELETE',
        headers: { cookie: editor.cookie }
      });
      assert.equal(response.status, 403);
      assert.ok(await verify(tokens.access_token));
    });

    it('logs the disconnection', async function () {
      const tokens = await connectAs(editor);
      const entries = [];
      const original = apos.modules['@apostrophecms/oauth'].logInfo;
      apos.modules['@apostrophecms/oauth'].logInfo = (req, type, data) => entries.push({
        type,
        data
      });
      try {
        await disconnect(editor, await getConnectionId(tokens));
      } finally {
        apos.modules['@apostrophecms/oauth'].logInfo = original;
      }
      assert.deepEqual(entries, [ {
        type: 'connection-removed',
        data: {
          username: 'editor',
          clientId: client.client_id,
          clientName: 'Test <b>tool</b>'
        }
      } ]);
    });
  });

  describe('the record is what counts', function () {
    beforeEach(clear);

    it('accepts no token, for a request or a refresh, once the record is gone', async function () {
      const tokens = await connectAs(editor);
      const id = await getConnectionId(tokens);
      // As if deleting the tokens had failed partway
      await apos.modules['@apostrophecms/oauth'].connections.deleteOne({ _id: id });
      assert.equal(await verify(tokens.access_token), null);
      assert.equal((await refresh(tokens)).error, 'invalid_grant');
      // The refresh found them, and finished the job
      assert.equal(await apos.modules['@apostrophecms/oauth'].tokens.countDocuments({ grantId: id }), 0);
    });

    it('ends a connection whose code or refresh token was used twice', async function () {
      const tokens = await connectAs(editor);
      const second = await refresh(tokens);
      assert.ok(second.access_token);
      assert.equal((await refresh(tokens)).error, 'invalid_grant');
      assert.deepEqual(await list(editor), []);
    });
  });

  describe('the user menu', function () {
    it('offers "Connected tools" beside Log Out, opening the connections modal', function () {
      const item = apos.adminBar.items
        .find(item => item.action === '@apostrophecms/oauth:connections');
      assert.ok(item);
      assert.equal(item.label, 'apostrophe:oauthConnections');
      assert.equal(item.options.user, true);
      const modal = apos.modal.modals
        .find(modal => modal.itemName === '@apostrophecms/oauth:connections');
      assert.equal(modal.componentName, 'AposOauthConnections');
      assert.deepEqual(modal.props, { action: CONNECTIONS });
    });
  });

  describe('a deleted user', function () {
    it('takes their connections and tokens along', async function () {
      await t.createUser(apos, 'editor', { username: 'leaving' });
      const leaving = await login('leaving');
      const tokens = await connectAs(leaving);
      const user = await apos.user.find(apos.task.getReq(), { username: 'leaving' }).toObject();
      assert.equal(await apos.modules['@apostrophecms/oauth'].connections.countDocuments({ userId: user._id }), 1);
      await apos.user.delete(apos.task.getReq(), user);
      assert.equal(await apos.modules['@apostrophecms/oauth'].connections.countDocuments({ userId: user._id }), 0);
      assert.equal(await apos.modules['@apostrophecms/oauth'].tokens.countDocuments({ userId: user._id }), 0);
      assert.equal(await verify(tokens.access_token), null);
    });
  });
});

describe('OAuth: connections, while the server is off', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await createOauthApos(module, { oauth: { enabled: false } });
    await t.createUser(apos, 'editor', { username: 'editor' });
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('offers no "Connected tools" and no connections API', async function () {
    assert.equal(
      apos.adminBar.items.some(item => item.action === '@apostrophecms/oauth:connections'),
      false
    );
    assert.equal(
      apos.modal.modals.some(modal => modal.itemName === '@apostrophecms/oauth:connections'),
      false
    );
    const jar = await t.loginAs(apos, 'editor');
    await assert.rejects(apos.http.get(CONNECTIONS, { jar }), { status: 404 });
  });
});
