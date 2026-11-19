const assert = require('assert').strict;
const crypto = require('node:crypto');
const {
  startAuthorization,
  exchangeAuthorization,
  refreshAuthorization
} = require('@modelcontextprotocol/client');
const t = require('../test-lib/test.js');
const {
  ACTION, BASE_URL, RESOURCE, createOauthApos, getUrl
} = require('./utils/oauth.js');

// The OAuth server's S4: the token endpoint exchanges a code for tokens and
// replaces a refresh token with new ones, and the revoke endpoint ends a
// connection. The happy paths are driven by the MCP SDK's client, as an MCP
// client would drive them; the refusals by hand, to send what the SDK won't.

const AUTHORIZE = `${ACTION}/authorize`;
const TOKEN = `${ACTION}/token`;
const REVOKE = `${ACTION}/revoke`;
const REDIRECT_URI = 'https://tool.example.com/callback';
const RESOURCE_URL = `${BASE_URL}${RESOURCE}`;

describe('OAuth: tokens', function () {
  this.timeout(t.timeout);

  let apos;
  let client;
  let otherClient;
  let metadata;
  let editorCookie;

  before(async function () {
    apos = await createOauthApos(module);
    await t.createUser(apos, 'editor', { username: 'editor' });
    await t.createUser(apos, 'editor', { username: 'leaver' });
    editorCookie = await getCookie('editor');
    client = await apos.oauth.registerClient({
      client_name: 'Test tool',
      redirect_uris: [ REDIRECT_URI ]
    });
    otherClient = await apos.oauth.registerClient({
      client_name: 'Other tool',
      redirect_uris: [ REDIRECT_URI ]
    });
    metadata = apos.oauth.getAuthorizationServerMetadata();
  });

  after(async function () {
    await t.destroy(apos);
  });

  async function getCookie(username) {
    const jar = await t.loginAs(apos, username);
    return jar.getCookieStringSync(apos.http.getBase());
  }

  // The SDK insists on an https token endpoint, so the site's public URL
  // is sent to the local server
  function fetchFn(url, init) {
    return fetch(getUrl(apos, String(url)), init);
  }

  // Runs the authorize step as `cookie`'s user, and approves. Returns
  // `{ code, codeVerifier, iss }`
  async function getCode({
    cookie = editorCookie, clientInformation = client, resource = RESOURCE_URL
  } = {}) {
    const { authorizationUrl, codeVerifier } = await startAuthorization(BASE_URL, {
      metadata,
      clientInformation,
      redirectUrl: REDIRECT_URI,
      state: 'the-state',
      ...(resource && { resource: new URL(resource) })
    });
    const page = await fetch(getUrl(apos, authorizationUrl.href), {
      redirect: 'manual',
      headers: { cookie }
    });
    assert.equal(page.status, 200);
    const approval = (await page.text()).match(/name="approval" value="([^"]+)"/)[1];
    const decision = await fetch(getUrl(apos, AUTHORIZE), {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie
      },
      body: new URLSearchParams({
        approval,
        decision: 'approve'
      }).toString()
    });
    assert.equal(decision.status, 303);
    const callback = new URL(decision.headers.get('location'));
    return {
      code: callback.searchParams.get('code'),
      iss: callback.searchParams.get('iss'),
      codeVerifier
    };
  }

  // Exchanges a code through the SDK, as an MCP client does
  async function getTokens(options) {
    const {
      code, codeVerifier, iss
    } = await getCode(options);
    return exchangeAuthorization(BASE_URL, {
      metadata,
      clientInformation: (options && options.clientInformation) || client,
      authorizationCode: code,
      iss,
      codeVerifier,
      redirectUri: REDIRECT_URI,
      resource: new URL(RESOURCE_URL),
      fetchFn
    });
  }

  function refresh(refreshToken, options = {}) {
    return refreshAuthorization(BASE_URL, {
      metadata,
      clientInformation: client,
      refreshToken,
      resource: new URL(RESOURCE_URL),
      fetchFn,
      ...options
    });
  }

  // A form post to `path`, by hand. Returns `{ status, headers, body }`
  async function post(path, params, { query = '', headers = {} } = {}) {
    const response = await fetch(getUrl(apos, `${path}${query}`), {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...headers
      },
      body: new URLSearchParams(params).toString()
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json()
    };
  }

  // Disables, or enables again, the user "leaver"
  function setDisabled(disabled) {
    return apos.doc.db.updateOne({ username: 'leaver' }, { $set: { disabled } });
  }

  function verify(token, resource = RESOURCE_URL) {
    return apos.oauth.verifyAccessToken(token, { resource });
  }

  // After two requests raced with the same code or refresh token: at most
  // one got tokens, and none of them works
  async function assertRaceEnded(results) {
    const won = results.filter(result => result.status === 200);
    assert.ok(won.length <= 1, JSON.stringify(results.map(result => result.body)));
    for (const result of results.filter(result => result.status !== 200)) {
      assert.equal(result.body.error, 'invalid_grant');
    }
    for (const { body } of won) {
      assert.equal(await verify(body.access_token), null);
      const refreshed = await post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: body.refresh_token
      });
      assert.equal(refreshed.body.error, 'invalid_grant');
      const stored = await apos.oauth.tokens.findOne({
        _id: apos.oauth.hashSecret(body.access_token)
      });
      assert.equal(stored, null);
    }
  }

  async function assertRejects(promise, error) {
    await assert.rejects(promise, (e) => {
      assert.equal(e.code || e.error, error, e.stack);
      return true;
    });
  }

  describe('the code exchange', function () {
    it('issues tokens for a code, through the MCP SDK', async function () {
      const tokens = await getTokens();
      assert.equal(tokens.token_type.toLowerCase(), 'bearer');
      assert.equal(tokens.expires_in, 3600);
      assert.equal(typeof tokens.access_token, 'string');
      assert.equal(typeof tokens.refresh_token, 'string');
      assert.notEqual(tokens.access_token, tokens.refresh_token);
      assert.equal(tokens.scope, 'content');
    });

    it('stores only the tokens\' hashes', async function () {
      const tokens = await getTokens();
      const docs = await apos.oauth.tokens.find({
        _id: {
          $in: [
            apos.oauth.hashSecret(tokens.access_token),
            apos.oauth.hashSecret(tokens.refresh_token)
          ]
        }
      }).toArray();
      assert.equal(docs.length, 2);
      const text = JSON.stringify(docs);
      assert.ok(!text.includes(tokens.access_token));
      assert.ok(!text.includes(tokens.refresh_token));
      assert.equal(docs[0].grantId, docs[1].grantId);
    });

    it('answers with no-store', async function () {
      const { code, codeVerifier } = await getCode();
      const response = await post(TOKEN, {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code,
        code_verifier: codeVerifier,
        redirect_uri: REDIRECT_URI,
        resource: RESOURCE_URL
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('pragma'), 'no-cache');
    });

    it('issues an access token that acts as the user, for the resource only', async function () {
      const tokens = await getTokens();
      const result = await verify(tokens.access_token);
      assert.equal(result.user.username, 'editor');
      assert.equal(result.clientId, client.client_id);
      assert.equal(result.scope, 'content');
      assert(await apos.oauth.connections.findOne({ _id: result.connectionId }));
      assert.equal(await verify(tokens.access_token, `${BASE_URL}/api/v1/elsewhere`), null);
      assert.equal(await verify(tokens.refresh_token), null);
      assert.equal(await verify('not-a-token'), null);
      assert.equal(await verify(undefined), null);
    });

    it('takes a code once, and revokes what it issued if it comes back', async function () {
      const { code, codeVerifier } = await getCode();
      const params = {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code,
        code_verifier: codeVerifier,
        resource: RESOURCE_URL
      };
      const first = await post(TOKEN, params);
      assert.equal(first.status, 200);
      assert.ok(await verify(first.body.access_token));
      const second = await post(TOKEN, params);
      assert.equal(second.status, 400);
      assert.equal(second.body.error, 'invalid_grant');
      assert.equal(await verify(first.body.access_token), null);
      const refreshed = await post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: first.body.refresh_token
      });
      assert.equal(refreshed.body.error, 'invalid_grant');
    });

    it('takes a code once when two requests race for it, and ends what it started', async function () {
      // A second use ends the connection, whichever request comes first,
      // and however the two interleave
      for (let i = 0; i < 10; i++) {
        const { code, codeVerifier } = await getCode();
        const params = {
          grant_type: 'authorization_code',
          client_id: client.client_id,
          code,
          code_verifier: codeVerifier
        };
        const results = await Promise.all([ post(TOKEN, params), post(TOKEN, params) ]);
        await assertRaceEnded(results);
      }
    });

    it('refuses a wrong code verifier, and uses the code up', async function () {
      const { code, codeVerifier } = await getCode();
      const params = {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code
      };
      const wrong = await post(TOKEN, {
        ...params,
        code_verifier: crypto.randomBytes(32).toString('base64url')
      });
      assert.equal(wrong.status, 400);
      assert.equal(wrong.body.error, 'invalid_grant');
      const right = await post(TOKEN, {
        ...params,
        code_verifier: codeVerifier
      });
      assert.equal(right.body.error, 'invalid_grant');
    });

    it('refuses a code verifier that is not 43 to 128 unreserved characters', async function () {
      const { code } = await getCode();
      const response = await post(TOKEN, {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code,
        code_verifier: 'short'
      });
      assert.equal(response.body.error, 'invalid_request');
    });

    it('refuses a code issued to another client', async function () {
      const { code, codeVerifier } = await getCode();
      const response = await post(TOKEN, {
        grant_type: 'authorization_code',
        client_id: otherClient.client_id,
        code,
        code_verifier: codeVerifier
      });
      assert.equal(response.body.error, 'invalid_grant');
    });

    it('refuses a redirect URI the code was not issued for', async function () {
      const { code, codeVerifier } = await getCode();
      const response = await post(TOKEN, {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code,
        code_verifier: codeVerifier,
        redirect_uri: 'https://tool.example.com/elsewhere'
      });
      assert.equal(response.body.error, 'invalid_grant');
    });

    it('refuses a resource the user did not approve', async function () {
      const { code, codeVerifier } = await getCode();
      const response = await post(TOKEN, {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code,
        code_verifier: codeVerifier,
        resource: `${BASE_URL}/api/v1/elsewhere`
      });
      assert.equal(response.body.error, 'invalid_target');
    });

    it('refuses an expired code', async function () {
      const { code, codeVerifier } = await getCode();
      await apos.oauth.codes.updateOne(
        { _id: apos.oauth.hashSecret(code) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );
      const response = await post(TOKEN, {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code,
        code_verifier: codeVerifier
      });
      assert.equal(response.body.error, 'invalid_grant');
    });

    it('refuses a code for a user who can no longer log in', async function () {
      const cookie = await getCookie('leaver');
      const { code, codeVerifier } = await getCode({ cookie });
      await setDisabled(true);
      try {
        const response = await post(TOKEN, {
          grant_type: 'authorization_code',
          client_id: client.client_id,
          code,
          code_verifier: codeVerifier
        });
        assert.equal(response.body.error, 'invalid_grant');
      } finally {
        await setDisabled(false);
      }
    });
  });

  describe('the request', function () {
    it('refuses an unknown grant type', async function () {
      const response = await post(TOKEN, {
        grant_type: 'client_credentials',
        client_id: client.client_id
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'unsupported_grant_type');
    });

    it('requires client_id', async function () {
      const response = await post(TOKEN, { grant_type: 'refresh_token' });
      assert.equal(response.body.error, 'invalid_request');
    });

    it('refuses parameters in the URL', async function () {
      const { code, codeVerifier } = await getCode();
      const response = await post(TOKEN, {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code_verifier: codeVerifier
      }, { query: `?code=${code}` });
      assert.equal(response.body.error, 'invalid_request');
    });

    it('refuses a parameter sent twice', async function () {
      const response = await fetch(getUrl(apos, TOKEN), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&client_id=${client.client_id}&refresh_token=a&refresh_token=b`
      });
      assert.equal((await response.json()).error, 'invalid_request');
    });

    it('refuses a client secret: clients are public', async function () {
      const basic = await post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: 'x'
      }, {
        headers: { authorization: `Basic ${Buffer.from('a:b').toString('base64')}` }
      });
      assert.equal(basic.status, 401);
      assert.equal(basic.body.error, 'invalid_client');
      const posted = await post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: client.client_id,
        client_secret: 'secret',
        refresh_token: 'x'
      });
      assert.equal(posted.body.error, 'invalid_client');
    });

    it('refuses a body that is too large', async function () {
      const response = await post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: 'x'.repeat(20000)
      });
      assert.equal(response.status, 413);
      assert.equal(response.body.error, 'invalid_request');
    });

    it('needs no CSRF token or session', async function () {
      const response = await post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: 'unknown'
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'invalid_grant');
    });
  });

  describe('refresh', function () {
    it('replaces both tokens, through the MCP SDK', async function () {
      const first = await getTokens();
      const second = await refresh(first.refresh_token);
      assert.notEqual(second.access_token, first.access_token);
      assert.notEqual(second.refresh_token, first.refresh_token);
      assert.equal(second.scope, 'content');
      assert.ok(await verify(second.access_token));
      // The old access token lasts out its hour
      assert.ok(await verify(first.access_token));
      const third = await refresh(second.refresh_token);
      assert.ok(await verify(third.access_token));
      // Still the one connection, for a resource that keeps state for it
      const { connectionId } = await verify(first.access_token);
      assert.equal((await verify(third.access_token)).connectionId, connectionId);
      const other = await getTokens();
      assert.notEqual((await verify(other.access_token)).connectionId, connectionId);
    });

    it('revokes the whole connection when a replaced refresh token comes back', async function () {
      const first = await getTokens();
      const second = await refresh(first.refresh_token);
      await assertRejects(refresh(first.refresh_token), 'invalid_grant');
      assert.equal(await verify(first.access_token), null);
      assert.equal(await verify(second.access_token), null);
      await assertRejects(refresh(second.refresh_token), 'invalid_grant');
    });

    it('replaces a refresh token once when two requests race for it, and ends the connection', async function () {
      for (let i = 0; i < 10; i++) {
        const first = await getTokens();
        const params = {
          grant_type: 'refresh_token',
          client_id: client.client_id,
          refresh_token: first.refresh_token
        };
        const results = await Promise.all([ post(TOKEN, params), post(TOKEN, params) ]);
        await assertRaceEnded(results);
        assert.equal(await verify(first.access_token), null);
      }
    });

    it('leaves other connections alone', async function () {
      const mine = await getTokens();
      const another = await getTokens();
      await refresh(mine.refresh_token);
      await assertRejects(refresh(mine.refresh_token), 'invalid_grant');
      assert.ok(await verify(another.access_token));
    });

    it('refuses a refresh token issued to another client', async function () {
      const { refresh_token: refreshToken } = await getTokens();
      const response = await post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: otherClient.client_id,
        refresh_token: refreshToken
      });
      assert.equal(response.body.error, 'invalid_grant');
    });

    it('refuses an access token', async function () {
      const { access_token: accessToken } = await getTokens();
      await assertRejects(refresh(accessToken), 'invalid_grant');
    });

    it('refuses a resource the user did not approve', async function () {
      const { refresh_token: refreshToken } = await getTokens();
      await assertRejects(refresh(refreshToken, {
        resource: new URL(`${BASE_URL}/api/v1/elsewhere`)
      }), 'invalid_target');
    });

    it('refuses a scope wider than the one granted', async function () {
      const { refresh_token: refreshToken } = await getTokens();
      await assertRejects(refresh(refreshToken, { scope: 'content admin' }), 'invalid_scope');
    });

    it('takes the scope granted, named again', async function () {
      const { refresh_token: refreshToken } = await getTokens();
      const tokens = await refresh(refreshToken, { scope: 'content' });
      assert.equal(tokens.scope, 'content');
    });

    it('refuses an expired refresh token', async function () {
      const { refresh_token: refreshToken } = await getTokens();
      await apos.oauth.tokens.updateOne(
        { _id: apos.oauth.hashSecret(refreshToken) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );
      await assertRejects(refresh(refreshToken), 'invalid_grant');
    });

    it('ends the connection of a user who can no longer log in', async function () {
      const cookie = await getCookie('leaver');
      const tokens = await getTokens({ cookie });
      assert.ok(await verify(tokens.access_token));
      await setDisabled(true);
      try {
        assert.equal(await verify(tokens.access_token), null);
        await assertRejects(refresh(tokens.refresh_token), 'invalid_grant');
      } finally {
        await setDisabled(false);
      }
      // Revoked, not just refused while the user was disabled
      assert.equal(await verify(tokens.access_token), null);
    });
  });

  describe('lifetimes', function () {
    const DAY = 24 * 60 * 60 * 1000;

    // Runs `fn` with the module's options changed, then puts them back
    async function withOptions(options, fn) {
      const originals = {};
      for (const name of Object.keys(options)) {
        originals[name] = apos.oauth.options[name];
      }
      Object.assign(apos.oauth.options, options);
      try {
        return await fn();
      } finally {
        Object.assign(apos.oauth.options, originals);
      }
    }

    function getToken(token) {
      return apos.oauth.tokens.findOne({ _id: apos.oauth.hashSecret(token) });
    }

    it('defaults to an hour for access tokens and 30 days for the connection', async function () {
      const tokens = await getTokens();
      assert.equal(tokens.expires_in, 3600);
      const access = await getToken(tokens.access_token);
      const refresh = await getToken(tokens.refresh_token);
      const hours = (access.expiresAt - access.createdAt) / (60 * 60 * 1000);
      assert.ok(Math.abs(hours - 1) < 0.01, String(hours));
      const days = (refresh.expiresAt - refresh.createdAt) / DAY;
      assert.ok(Math.abs(days - 30) < 0.01, String(days));
    });

    it('takes the lifetimes from the options', async function () {
      await withOptions({
        accessTokenLifetime: 120,
        connectionLifetime: 7 * 24 * 60 * 60
      }, async () => {
        const tokens = await getTokens();
        assert.equal(tokens.expires_in, 120);
        const refresh = await getToken(tokens.refresh_token);
        const days = (refresh.expiresAt - refresh.createdAt) / DAY;
        assert.ok(Math.abs(days - 7) < 0.01, String(days));
      });
    });

    it('counts the connection from the approval, however often it is refreshed', async function () {
      const first = await getTokens();
      const end = (await getToken(first.refresh_token)).expiresAt.getTime();
      const second = await refresh(first.refresh_token);
      const third = await refresh(second.refresh_token);
      for (const tokens of [ second, third ]) {
        const doc = await getToken(tokens.refresh_token);
        assert.equal(doc.expiresAt.getTime(), end);
        assert.equal(doc.connectionExpiresAt.getTime(), end);
      }
    });

    it('cuts an access token off at the end of the connection', async function () {
      const first = await getTokens();
      const end = new Date(Date.now() + (10 * 60 * 1000));
      await apos.oauth.tokens.updateOne(
        { _id: apos.oauth.hashSecret(first.refresh_token) },
        {
          $set: {
            expiresAt: end,
            connectionExpiresAt: end
          }
        }
      );
      const second = await refresh(first.refresh_token);
      const seconds = second.expires_in;
      assert.ok((seconds <= 600) && (seconds > 590), String(seconds));
      const access = await getToken(second.access_token);
      assert.equal(access.expiresAt.getTime(), end.getTime());
    });

    it('sends the user back to approve again once the connection ends', async function () {
      const first = await getTokens();
      const past = new Date(Date.now() - 1000);
      await apos.oauth.tokens.updateMany(
        { _id: apos.oauth.hashSecret(first.refresh_token) },
        {
          $set: {
            expiresAt: past,
            connectionExpiresAt: past
          }
        }
      );
      await assertRejects(refresh(first.refresh_token), 'invalid_grant');
    });

    it('refuses a code that outlived a connection shorter than a code', async function () {
      await withOptions({
        accessTokenLifetime: 60,
        connectionLifetime: 60
      }, async () => {
        const { code, codeVerifier } = await getCode();
        await apos.oauth.codes.updateOne(
          { _id: apos.oauth.hashSecret(code) },
          { $set: { createdAt: new Date(Date.now() - (2 * 60 * 1000)) } }
        );
        const response = await post(TOKEN, {
          grant_type: 'authorization_code',
          client_id: client.client_id,
          code,
          code_verifier: codeVerifier
        });
        assert.equal(response.body.error, 'invalid_grant');
        assert.match(response.body.error_description, /approve again/);
      });
    });

    it('refuses lifetimes that are not a positive whole number of seconds', async function () {
      for (const name of [ 'accessTokenLifetime', 'connectionLifetime' ]) {
        for (const value of [ 0, -1, 1.5, '3600', null ]) {
          await withOptions({ [name]: value }, () => {
            assert.throws(
              () => apos.oauth.validateOptions(),
              new RegExp(`${name} option must be a whole number`),
              `${name}: ${value}`
            );
          });
        }
      }
    });

    it('refuses an access token lifetime longer than the connection', async function () {
      await withOptions({
        accessTokenLifetime: 7200,
        connectionLifetime: 3600
      }, () => {
        assert.throws(() => apos.oauth.validateOptions(), /must not be longer than its connectionLifetime/);
      });
    });
  });

  describe('revoke', function () {
    it('revokes the whole connection, from either token', async function () {
      for (const which of [ 'access_token', 'refresh_token' ]) {
        const tokens = await getTokens();
        const response = await post(REVOKE, {
          token: tokens[which],
          client_id: client.client_id
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(await verify(tokens.access_token), null);
        await assertRejects(refresh(tokens.refresh_token), 'invalid_grant');
      }
    });

    it('answers 200 for a token it doesn\'t know', async function () {
      const response = await post(REVOKE, {
        token: 'unknown',
        client_id: client.client_id
      });
      assert.equal(response.status, 200);
    });

    it('revokes nothing for another client, and says nothing about it', async function () {
      const tokens = await getTokens();
      const response = await post(REVOKE, {
        token: tokens.access_token,
        client_id: otherClient.client_id
      });
      assert.equal(response.status, 200);
      assert.ok(await verify(tokens.access_token));
    });

    it('requires the token', async function () {
      const response = await post(REVOKE, { client_id: client.client_id });
      assert.equal(response.status, 400);
      assert.equal(response.body.error, 'invalid_request');
    });
  });

  describe('the log', function () {
    // Records the module's log entries while `fn` runs, as
    // `{ severity, req, type, data }`
    async function captureLog(fn) {
      const entries = [];
      const originals = {};
      for (const severity of [ 'Info', 'Warn', 'Error' ]) {
        const name = `log${severity}`;
        originals[name] = apos.oauth[name];
        apos.oauth[name] = (...args) => {
          const req = (args[0] && (typeof args[0].t === 'function')) ? args.shift() : null;
          const [ type, ...rest ] = args;
          entries.push({
            severity: severity.toLowerCase(),
            req,
            type,
            data: rest.find(arg => arg && (typeof arg === 'object')) || {}
          });
        };
      }
      try {
        await fn();
      } finally {
        Object.assign(apos.oauth, originals);
      }
      return entries;
    }

    // Keys the logger keeps for itself (lib/logger/render.js)
    const RESERVED_KEYS = [ 'site', 'module', 'scope', 'severity', 'type', 'msg' ];

    function findEntry(entries, type) {
      const entry = entries.find(entry => entry.type === type);
      assert.ok(entry, `no ${type} entry in ${JSON.stringify(entries.map(entry => entry.type))}`);
      for (const key of Object.keys(entry.data)) {
        assert.ok(!RESERVED_KEYS.includes(key), `${type} uses the logger's reserved key "${key}"`);
      }
      return entry;
    }

    // No token or code may reach the log
    function assertNoSecrets(entries, secrets) {
      const text = JSON.stringify(entries.map(({ req, ...entry }) => ({
        ...entry,
        url: req && req.url
      })));
      for (const secret of secrets) {
        assert.ok(!text.includes(secret), 'a secret reached the log');
      }
    }

    it('records tokens issued and refreshed, without the tokens', async function () {
      const {
        code, codeVerifier, iss
      } = await getCode();
      let tokens;
      let refreshed;
      const entries = await captureLog(async () => {
        tokens = await exchangeAuthorization(BASE_URL, {
          metadata,
          clientInformation: client,
          authorizationCode: code,
          iss,
          codeVerifier,
          redirectUri: REDIRECT_URI,
          resource: new URL(RESOURCE_URL),
          fetchFn
        });
        refreshed = await refresh(tokens.refresh_token);
      });
      const issued = findEntry(entries, 'token-issued');
      assert.equal(issued.severity, 'info');
      assert.deepEqual(issued.data, {
        username: 'editor',
        clientId: client.client_id,
        resource: RESOURCE_URL,
        scopes: 'content'
      });
      const refreshedEntry = findEntry(entries, 'token-refreshed');
      assert.equal(refreshedEntry.severity, 'info');
      assertNoSecrets(entries, [
        code, codeVerifier, tokens.access_token, tokens.refresh_token,
        refreshed.access_token, refreshed.refresh_token
      ]);
    });

    it('warns of a code used twice', async function () {
      const { code, codeVerifier } = await getCode();
      const params = {
        grant_type: 'authorization_code',
        client_id: client.client_id,
        code,
        code_verifier: codeVerifier
      };
      await post(TOKEN, params);
      const entries = await captureLog(() => post(TOKEN, params));
      const entry = findEntry(entries, 'code-reused');
      assert.equal(entry.severity, 'warn');
      assert.equal(entry.data.clientId, client.client_id);
      assertNoSecrets(entries, [ code ]);
    });

    it('warns of a refresh token used twice', async function () {
      const { refresh_token: refreshToken } = await getTokens();
      await refresh(refreshToken);
      const entries = await captureLog(() => refresh(refreshToken).catch(() => {}));
      const entry = findEntry(entries, 'refresh-token-reused');
      assert.equal(entry.severity, 'warn');
      assertNoSecrets(entries, [ refreshToken ]);
    });

    it('records a revocation', async function () {
      const tokens = await getTokens();
      const entries = await captureLog(() => post(REVOKE, {
        token: tokens.refresh_token,
        client_id: client.client_id
      }));
      const entry = findEntry(entries, 'token-revoked');
      assert.equal(entry.severity, 'info');
      assertNoSecrets(entries, [ tokens.refresh_token ]);
    });

    it('logs nothing for an ordinary refusal', async function () {
      const entries = await captureLog(() => post(TOKEN, {
        grant_type: 'refresh_token',
        client_id: client.client_id,
        refresh_token: 'unknown'
      }));
      assert.deepEqual(entries, []);
    });
  });
});
