const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  BASE_URL, PATH, TOKEN, USERNAME, createMcpApos, getUrl, post, withClient
} = require('./utils/mcp.js');
const { ACTION, connect } = require('./utils/oauth.js');

// The MCP route is an OAuth protected resource: it turns the OAuth server
// on, takes that server's access tokens issued for it, and points a tool
// without one at its metadata. Each connection keeps what it has seen of
// each document across calls, so the harness's stale-write guard works over
// MCP as it does in an assistant chat.

const RESOURCE_URL = `${BASE_URL}${PATH}`;
const OTHER = '/api/v1/mcp-other-resource';
const REDIRECT_URI = 'https://tool.example.com/callback';

describe('MCP: OAuth', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let client;
  let cookie;
  // The `req.user` of each request that reached the SDK's server factory
  let users;

  before(async function () {
    apos = await createMcpApos(module, {
      role: 'editor',
      modules: {
        'mcp-article': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: { type: 'string' }
            }
          }
        },
        // Another resource, whose tokens the MCP route must refuse
        'mcp-other-resource': {
          init(self) {
            self.apos.modules['@apostrophecms/oauth'].addResource(OTHER, { name: 'Other' });
          }
        }
      }
    });
    editor = await apos.user.find(apos.task.getReq(), { username: USERNAME }).toObject();
    await t.createUser(apos, 'editor', {
      username: 'bob',
      title: 'Bob'
    });
    cookie = (await t.loginAs(apos, USERNAME)).getCookieStringSync(apos.http.getBase());
    client = await apos.modules['@apostrophecms/oauth'].registerClient({
      client_name: 'Test tool',
      redirect_uris: [ REDIRECT_URI ]
    });
    const createServer = apos.modules['@apostrophecms/mcp'].createServer;
    apos.modules['@apostrophecms/mcp'].createServer = (req) => {
      users.push(req.user);
      return createServer(req);
    };
  });

  beforeEach(function () {
    users = [];
  });

  after(async function () {
    await t.destroy(apos);
  });

  describe('tokens', function () {
    it('turns the OAuth server on, and publishes the route\'s metadata', async function () {
      assert.equal(apos.modules['@apostrophecms/oauth'].isEnabled(), true);
      const response = await fetch(getUrl(apos, `/.well-known/oauth-protected-resource${PATH}`));
      assert.equal(response.status, 200);
      const metadata = await response.json();
      assert.equal(metadata.resource, RESOURCE_URL);
      assert.deepEqual(metadata.authorization_servers, [ BASE_URL ]);
      assert.equal(metadata.resource_name, 'Apostrophe MCP server');
    });

    it('says what a connected tool can do on the approval page', async function () {
      const description = apos.modules['@apostrophecms/oauth'].getResourceDescription(
        apos.task.getReq(),
        RESOURCE_URL
      );
      assert.match(description, /saved as drafts/);
      assert.match(description, /autopublish/);
      assert.match(description, /users or groups/);
    });

    it('points a request with no token at the route\'s metadata', async function () {
      const response = await post(apos, { authorization: null });
      assert.equal(response.status, 401);
      const header = response.headers.get('www-authenticate');
      assert.match(header, new RegExp(`resource_metadata="${BASE_URL}/\\.well-known/oauth-protected-resource${PATH}"`));
      assert(!header.includes('error='));
    });

    it('acts as the user who approved the tool', async function () {
      const tokens = await connectTool();
      const { tools } = await withClient(apos, 'auto', mcp => mcp.listTools(), {
        token: tokens.access_token
      });
      assert(tools.length);
      assert(users.length);
      assert(users.every(user => user.username === USERNAME));
    });

    it('takes a refreshed access token', async function () {
      const first = await connectTool();
      const second = await refreshTool(first.refresh_token);
      const response = await post(apos, { authorization: `Bearer ${second.access_token}` });
      assert.equal(response.status, 200);
    });

    it('refuses a token issued for another resource', async function () {
      const tokens = await connectTool(`${BASE_URL}${OTHER}`);
      await assertRefused(tokens.access_token);
    });

    it('refuses an expired token', async function () {
      const tokens = await connectTool();
      await apos.modules['@apostrophecms/oauth'].tokens.updateOne(
        { _id: apos.modules['@apostrophecms/oauth'].hashSecret(tokens.access_token) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );
      await assertRefused(tokens.access_token);
    });

    it('refuses a revoked token', async function () {
      const tokens = await connectTool();
      const response = await fetch(getUrl(apos, `${ACTION}/revoke`), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: tokens.access_token,
          client_id: client.client_id
        }).toString()
      });
      assert.equal(response.status, 200);
      await assertRefused(tokens.access_token);
    });

    it('refuses a token of a connection the user ended', async function () {
      const tokens = await connectTool();
      const { connectionId } = await apos.modules['@apostrophecms/oauth'].verifyAccessToken(tokens.access_token, {
        resource: RESOURCE_URL
      });
      assert.equal(await apos.modules['@apostrophecms/oauth'].disconnect(userReq(), connectionId), true);
      await assertRefused(tokens.access_token);
    });

    it('refuses a refresh token sent as an access token', async function () {
      const tokens = await connectTool();
      await assertRefused(tokens.refresh_token);
    });

    it('records the connected tool on the change log', async function () {
      const { access_token: token } = await connectTool();
      const article = await insertArticle();
      await read(token, article._id);
      const { requestId } = await update(token, article._id, 'Logged');

      const [ entry ] = await apos.aposHarness.changes.find({ requestId }).toArray();
      assert.equal(entry.door, 'mcp');
      assert.deepEqual(entry.client, {
        id: client.client_id,
        name: 'Test tool'
      });

      // A publish is an entry of its own, and names the tool too
      const publish = await call(token, 'publish_document', {
        targets: [ { _id: article._id } ]
      });
      assert.equal(publish.published[0].status, 'published');
      const [ published ] = await apos.aposHarness.changes
        .find({ requestId: publish.requestId })
        .toArray();
      assert.equal(published.effect, 'publish');
      assert.deepEqual(published.client, entry.client);
    });

    it('still takes the development token', async function () {
      const response = await post(apos);
      assert.equal(response.status, 200);
      assert.equal(users[0].username, USERNAME);
    });
  });

  // The harness refuses a write to a document saved since the door read it.
  // Each MCP call is a request of its own, so what a connection has seen is
  // kept between calls
  describe('the stale-write guard', function () {
    it('refuses a write after someone else saved what an earlier call read', async function () {
      const { access_token: token } = await connectTool();
      const article = await insertArticle();
      await read(token, article._id);
      await editAsBob(article._id);

      const refused = await update(token, article._id, 'Over MCP');
      assert.deepEqual(refused.written, []);
      assert.equal(refused.refused[0].reason, 'changed');
      // MCP asks before overwriting: no confirmation step of its own
      assert.ok(refused.refused[0].savedBy);
      assert.match(refused.refused[0].message, /only if the user asks you to/);
      assert.equal((await findDraft(article._id)).body, 'Bob\'s');

      // Read again, it writes
      await read(token, article._id);
      const written = await update(token, article._id, 'Over MCP');
      assert.equal(written.written.length, 1);
      assert.equal((await findDraft(article._id)).body, 'Over MCP');
    });

    it('takes its own writes as seen', async function () {
      const { access_token: token } = await connectTool();
      const article = await insertArticle();
      await read(token, article._id);
      assert.equal((await update(token, article._id, 'First')).written.length, 1);
      assert.equal((await update(token, article._id, 'Second')).written.length, 1);
      await editAsBob(article._id);
      assert.equal((await update(token, article._id, 'Third')).refused[0].reason, 'changed');
    });

    it('keeps what a connection saw across a refresh', async function () {
      const first = await connectTool();
      const article = await insertArticle();
      await read(first.access_token, article._id);
      await editAsBob(article._id);
      const second = await refreshTool(first.refresh_token);
      const result = await update(second.access_token, article._id, 'Over MCP');
      assert.equal(result.refused[0].reason, 'changed');
    });

    it('keeps each connection\'s own: another connection\'s read guards nothing', async function () {
      const reader = await connectTool();
      const writer = await connectTool();
      const article = await insertArticle();
      await read(reader.access_token, article._id);
      await editAsBob(article._id);
      // The writer never read it, so there is nothing to check against
      const result = await update(writer.access_token, article._id, 'Over MCP');
      assert.equal(result.written.length, 1);
    });

    it('guards the development token\'s calls too', async function () {
      const article = await insertArticle();
      await read(TOKEN, article._id);
      await editAsBob(article._id);
      const result = await update(TOKEN, article._id, 'Over MCP');
      assert.equal(result.refused[0].reason, 'changed');
    });

    it('remembers only the seenLimit most recently seen documents', async function () {
      const { access_token: token } = await connectTool();
      const { connectionId } = await apos.modules['@apostrophecms/oauth'].verifyAccessToken(token, {
        resource: RESOURCE_URL
      });
      const [ oldest, middle, newest ] = [
        await insertArticle(),
        await insertArticle(),
        await insertArticle()
      ];
      apos.modules['@apostrophecms/mcp'].options.seenLimit = 2;
      try {
        for (const article of [ oldest, middle, newest ]) {
          await read(token, article._id);
        }
        await editAsBob(oldest._id);
        await editAsBob(newest._id);
        // This call drops the oldest row first, so its write isn't checked
        assert.equal((await update(token, oldest._id, 'Over MCP')).written.length, 1);
        const refused = await update(token, newest._id, 'Over MCP');
        assert.equal(refused.refused[0].reason, 'changed');
        // The oldest's write made it the most recent; the next call dropped
        // the middle one
        const rows = await apos.modules['@apostrophecms/mcp'].seen.find({ connection: connectionId }).toArray();
        assert.deepEqual(
          rows.map(row => row.docId).sort(),
          [ oldest._id, newest._id ].sort()
        );
        assert(!rows.some(row => row.docId === middle._id));
      } finally {
        apos.modules['@apostrophecms/mcp'].options.seenLimit = 100;
      }
    });

    it('keeps a row per document read, ending with the connection lifetime', async function () {
      const { access_token: token } = await connectTool();
      const { connectionId } = await apos.modules['@apostrophecms/oauth'].verifyAccessToken(token, {
        resource: RESOURCE_URL
      });
      const article = await insertArticle();
      await read(token, article._id);
      const rows = await apos.modules['@apostrophecms/mcp'].seen.find({ connection: connectionId }).toArray();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].docId, article._id);
      const lifetime = apos.modules['@apostrophecms/oauth'].options.connectionLifetime * 1000;
      const left = rows[0].expiresAt.getTime() - Date.now();
      assert(left > lifetime - 60 * 1000 && left <= lifetime);
    });
  });

  function connectTool(resource = RESOURCE_URL) {
    return connect(apos, {
      client,
      cookie,
      resource
    });
  }

  async function refreshTool(refreshToken) {
    const response = await fetch(getUrl(apos, `${ACTION}/token`), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: refreshToken,
        resource: RESOURCE_URL
      }).toString()
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  async function assertRefused(token) {
    const response = await post(apos, { authorization: `Bearer ${token}` });
    assert.equal(response.status, 401);
    const header = response.headers.get('www-authenticate');
    assert.match(header, /error="invalid_token"/);
    assert.match(header, /resource_metadata="/);
    assert.equal(users.length, 0);
  }

  function userReq() {
    return apos.task.getReq({
      user: editor,
      mode: 'draft'
    });
  }

  async function insertArticle() {
    return apos.modules['mcp-article'].insert(apos.task.getReq({ mode: 'draft' }), {
      title: 'An article',
      body: 'Original'
    });
  }

  async function editAsBob(_id) {
    const bob = await apos.user.find(apos.task.getReq(), { username: 'bob' }).toObject();
    const req = apos.task.getReq({
      user: bob,
      mode: 'draft'
    });
    const draft = await apos.modules['mcp-article'].findOneForEditing(req, { _id });
    draft.body = 'Bob\'s';
    await apos.modules['mcp-article'].update(req, draft);
  }

  function findDraft(_id) {
    return apos.doc.db.findOne({ _id });
  }

  async function call(token, name, args) {
    const result = await withClient(apos, 'auto', mcp => mcp.callTool({
      name,
      arguments: args
    }), { token });
    assert.equal(result.isError, undefined, result.content?.[0]?.text);
    return result.structuredContent;
  }

  function read(token, _id) {
    return call(token, 'get_document', { _id });
  }

  function update(token, _id, body) {
    return call(token, 'update_document', {
      targets: [ {
        _id,
        values: { body }
      } ]
    });
  }
});

// A site that turned the OAuth server off: the route stays on the
// development token, and its 401 points nowhere
describe('MCP: with the OAuth server turned off', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await createMcpApos(module, {
      modules: {
        '@apostrophecms/oauth': {
          options: { enabled: false }
        }
      }
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('takes the development token, and answers others with a plain challenge', async function () {
    assert.equal(apos.modules['@apostrophecms/oauth'].isEnabled(), false);
    assert.equal(apos.modules['@apostrophecms/mcp'].oauthResource, false);
    assert.equal((await post(apos)).status, 200);
    const response = await post(apos, { authorization: 'Bearer some-other-token' });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer error="invalid_token"');
  });

  it('publishes no metadata', async function () {
    const response = await fetch(getUrl(apos, `/.well-known/oauth-protected-resource${PATH}`));
    assert.equal(response.status, 404);
  });
});
