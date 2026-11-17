const assert = require('assert').strict;
const crypto = require('node:crypto');
const t = require('../test-lib/test.js');
const {
  ACTION, BASE_URL, RESOURCE, createOauthApos, getUrl
} = require('./utils/oauth.js');

// The OAuth server's S3: the authorize endpoint checks the client and its
// redirect URI before anything else, sends a user who isn't logged in to log
// in and back, shows the approval page, and sends the user back to the
// client with a one-time code, or with access_denied.

const AUTHORIZE = `${ACTION}/authorize`;
const REDIRECT_URI = 'https://tool.example.com/callback';
const VERIFIER = 'a-verifier-of-at-least-43-characters-0123456789';
const CHALLENGE = crypto.createHash('sha256').update(VERIFIER).digest('base64url');

describe('OAuth: authorize', function () {
  this.timeout(t.timeout);

  let apos;
  let client;
  let editorCookie;
  let otherCookie;

  before(async function () {
    apos = await createOauthApos(module);
    await t.createUser(apos, 'editor', {
      username: 'editor',
      title: 'Ed <b>Itor</b>'
    });
    await t.createUser(apos, 'editor', { username: 'other' });
    editorCookie = await getCookie('editor');
    otherCookie = await getCookie('other');
    client = await apos.oauth.registerClient({
      client_name: 'Test <script>alert(1)</script> tool',
      redirect_uris: [ REDIRECT_URI, 'http://127.0.0.1/callback' ]
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  async function getCookie(username) {
    const jar = await t.loginAs(apos, username);
    return jar.getCookieStringSync(apos.http.getBase());
  }

  function params(overrides = {}) {
    const values = {
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      state: 'the-state',
      resource: `${BASE_URL}${RESOURCE}`,
      ...overrides
    };
    const search = new URLSearchParams();
    for (const [ name, value ] of Object.entries(values)) {
      for (const item of [ value ].flat()) {
        if (item !== undefined) {
          search.append(name, item);
        }
      }
    }
    return search.toString();
  }

  function authorize(overrides, cookie = editorCookie) {
    return fetch(getUrl(apos, `${AUTHORIZE}?${params(overrides)}`), {
      redirect: 'manual',
      headers: cookie ? { cookie } : {}
    });
  }

  function decide(body, cookie = editorCookie) {
    return fetch(getUrl(apos, AUTHORIZE), {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(cookie && { cookie })
      },
      body: new URLSearchParams(body).toString()
    });
  }

  // The approval page's approval id
  async function getApprovalId(response) {
    assert.equal(response.status, 200);
    const html = await response.text();
    const matches = html.match(/name="approval" value="([^"]+)"/);
    assert.ok(matches, html);
    return matches[1];
  }

  // The client's redirect, as `{ url, params }`
  function getRedirect(response) {
    assert.equal(response.status, 303);
    const url = new URL(response.headers.get('location'));
    return {
      url: `${url.origin}${url.pathname}`,
      params: Object.fromEntries(url.searchParams)
    };
  }

  async function assertErrorPage(response, status, pattern) {
    assert.equal(response.status, status);
    assert.equal(response.headers.get('location'), null);
    const html = await response.text();
    assert.match(html, /data-oauth-error/);
    if (pattern) {
      assert.match(html, pattern);
    }
  }

  describe('errors shown, not sent', function () {
    it('stops at an unknown client', async function () {
      await assertErrorPage(await authorize({ client_id: 'unknown' }), 400, /isn&#39;t registered|isn't registered/);
      await assertErrorPage(await authorize({ client_id: undefined }), 400);
    });

    it('stops at a redirect URI the client did not register', async function () {
      for (const uri of [
        'https://evil.example.com/callback',
        'https://tool.example.com/callback/more',
        undefined
      ]) {
        await assertErrorPage(await authorize({ redirect_uri: uri }), 400, /didn&#39;t register|didn't register/);
      }
    });

    it('stops at a client metadata document it can\'t use', async function () {
      const fetchDocument = apos.oauth.fetchClientMetadataDocument;
      apos.oauth.fetchClientMetadataDocument = async () => {
        throw new Error('the response status was 404');
      };
      try {
        await assertErrorPage(await authorize({
          client_id: 'https://tool.example.com/client.json'
        }), 400, /status was 404/);
      } finally {
        apos.oauth.fetchClientMetadataDocument = fetchDocument;
      }
    });
  });

  describe('errors sent back to the client', function () {
    async function assertSentBack(overrides, error) {
      const { url, params: sent } = getRedirect(await authorize(overrides));
      assert.equal(url, REDIRECT_URI);
      assert.equal(sent.error, error, JSON.stringify(overrides));
      assert.equal(sent.state, 'the-state');
      assert.equal(sent.iss, BASE_URL);
      assert.equal(sent.code, undefined);
    }

    it('requires response_type code', async function () {
      await assertSentBack({ response_type: 'token' }, 'unsupported_response_type');
      await assertSentBack({ response_type: undefined }, 'unsupported_response_type');
    });

    it('requires PKCE with S256', async function () {
      await assertSentBack({ code_challenge: undefined }, 'invalid_request');
      await assertSentBack({ code_challenge_method: 'plain' }, 'invalid_request');
      await assertSentBack({ code_challenge_method: undefined }, 'invalid_request');
      await assertSentBack({ code_challenge: 'too-short' }, 'invalid_request');
    });

    it('refuses a parameter sent twice', async function () {
      await assertSentBack({ scope: [ 'content', 'content' ] }, 'invalid_request');
    });

    it('refuses a scope the client may not ask for', async function () {
      await assertSentBack({ scope: 'content admin' }, 'invalid_scope');
    });

    it('refuses a resource that is not this site\'s', async function () {
      await assertSentBack({ resource: 'https://elsewhere.example.com/mcp' }, 'invalid_target');
      await assertSentBack({ resource: `${BASE_URL}/api/v1/@apostrophecms/page` }, 'invalid_target');
    });
  });

  describe('not logged in', function () {
    it('sends the user to log in, and back', async function () {
      const response = await authorize({}, null);
      assert.equal(response.status, 302);
      const login = new URL(response.headers.get('location'), getUrl(apos, '/'));
      assert.equal(login.pathname, '/login');
      const returnTo = login.searchParams.get('returnTo');
      assert.equal(returnTo, `${AUTHORIZE}?${params()}`);

      // Once logged in, the login page sends the user back
      const back = await fetch(getUrl(apos, `/login?returnTo=${encodeURIComponent(returnTo)}`), {
        redirect: 'manual',
        headers: { cookie: editorCookie }
      });
      assert.equal(back.status, 302);
      const location = back.headers.get('location');
      assert.equal(location, returnTo);
      await getApprovalId(await fetch(getUrl(apos, location), {
        headers: { cookie: editorCookie }
      }));
    });
  });

  describe('the approval page', function () {
    it('names the tool, the site and the user, escaped', async function () {
      const response = await authorize();
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Test &lt;script&gt;alert\(1\)&lt;\/script&gt; tool wants to connect/);
      assert.doesNotMatch(html, /<script>alert/);
      assert.match(html, /cms\.example\.com/);
      assert.match(html, /Ed &lt;b&gt;Itor&lt;\/b&gt; \(editor\)/);
      assert.match(html, /tool\.example\.com/);
    });

    it('says the tool acts within the user\'s permissions', async function () {
      const html = await (await authorize()).text();
      assert.match(html, /it acts as you on cms\.example\.com, and can never do more than your own permissions allow/);
    });

    it('shows the resource\'s own description, escaped', async function () {
      const html = await (await authorize()).text();
      assert.match(html, /data-oauth-resource-description>It can read &lt;your&gt; content \(en\)\.</);
    });

    it('shows no resource description for a request without a resource', async function () {
      const html = await (await authorize({ resource: undefined })).text();
      assert.match(html, /never do more than your own permissions allow/);
      assert.doesNotMatch(html, /data-oauth-resource-description/);
    });

    it('can\'t be framed, cached or leak its URL', async function () {
      const response = await authorize();
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('content-security-policy'), 'frame-ancestors \'none\'');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    });

    it('describes a loopback redirect as this computer', async function () {
      const response = await authorize({ redirect_uri: 'http://127.0.0.1:51234/callback' });
      assert.match(await response.text(), /127\.0\.0\.1:51234, on this computer/);
    });
  });

  describe('the decision', function () {
    it('approves: sends a one-time code back, and stores only its hash', async function () {
      const approval = await getApprovalId(await authorize());
      const { url, params: sent } = getRedirect(await decide({
        approval,
        decision: 'approve'
      }));
      assert.equal(url, REDIRECT_URI);
      assert.equal(sent.state, 'the-state');
      assert.equal(sent.iss, BASE_URL);
      assert.match(sent.code, /^[\w-]{43}$/);

      assert.equal(await apos.oauth.codes.countDocuments({ _id: sent.code }), 0);
      const stored = await apos.oauth.codes.findOne({
        _id: apos.oauth.hashSecret(sent.code)
      });
      const editor = await apos.user.find(apos.task.getReq(), { username: 'editor' }).toObject();
      assert.equal(stored.userId, editor._id);
      assert.equal(stored.clientId, client.client_id);
      assert.equal(stored.redirectUri, REDIRECT_URI);
      assert.equal(stored.scope, 'content');
      assert.equal(stored.resource, `${BASE_URL}${RESOURCE}`);
      assert.equal(stored.codeChallenge, CHALLENGE);
      const minutes = (stored.expiresAt - stored.createdAt) / 60000;
      assert.ok(Math.abs(minutes - 10) < 0.1, String(minutes));
    });

    it('declines: sends access_denied back, and no code', async function () {
      const before = await apos.oauth.codes.countDocuments({});
      const approval = await getApprovalId(await authorize());
      const { params: sent } = getRedirect(await decide({
        approval,
        decision: 'deny'
      }));
      assert.equal(sent.error, 'access_denied');
      assert.equal(sent.state, 'the-state');
      assert.equal(sent.code, undefined);
      assert.equal(await apos.oauth.codes.countDocuments({}), before);
    });

    it('sends a loopback client back to the port it asked for', async function () {
      const approval = await getApprovalId(await authorize({
        redirect_uri: 'http://127.0.0.1:51234/callback'
      }));
      const { url } = getRedirect(await decide({
        approval,
        decision: 'approve'
      }));
      assert.equal(url, 'http://127.0.0.1:51234/callback');
    });

    it('takes each approval once', async function () {
      const approval = await getApprovalId(await authorize());
      getRedirect(await decide({
        approval,
        decision: 'approve'
      }));
      await assertErrorPage(await decide({
        approval,
        decision: 'approve'
      }), 400, /expired or was already used/);
    });

    it('takes an approval only from the user who saw it', async function () {
      const approval = await getApprovalId(await authorize());
      await assertErrorPage(await decide({
        approval,
        decision: 'approve'
      }, otherCookie), 400, /expired or was already used/);
    });

    it('takes no approval once it expires', async function () {
      const approval = await getApprovalId(await authorize());
      await apos.oauth.pendingApprovals.updateOne(
        { _id: approval },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );
      await assertErrorPage(await decide({
        approval,
        decision: 'approve'
      }), 400, /expired or was already used/);
    });

    it('takes no decision from a user who is not logged in', async function () {
      const approval = await getApprovalId(await authorize());
      await assertErrorPage(await decide({
        approval,
        decision: 'approve'
      }, null), 401);
    });

    it('takes no approval id that is not a string', async function () {
      const response = await fetch(getUrl(apos, AUTHORIZE), {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: editorCookie
        },
        body: 'approval=a&approval=b&decision=approve'
      });
      await assertErrorPage(response, 400);
    });
  });
});

describe('Login: return to', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await t.create({ root: module });
    await t.createUser(apos, 'editor', { username: 'editor' });
  });

  after(async function () {
    await t.destroy(apos);
  });

  function returnTo(value) {
    return apos.login.getReturnTo({ query: { returnTo: value } });
  }

  it('takes a path on this site', function () {
    assert.equal(returnTo('/'), '/');
    assert.equal(returnTo('/some/page?x=1&y=%2F#top'), '/some/page?x=1&y=%2F#top');
    assert.equal(returnTo('/api/v1/@apostrophecms/oauth/authorize?a=b'), '/api/v1/@apostrophecms/oauth/authorize?a=b');
  });

  it('takes nothing that could leave the site', function () {
    for (const value of [
      'https://evil.example.com/',
      '//evil.example.com/',
      '/\\evil.example.com/',
      '\\\\evil.example.com/',
      '/\t/evil.example.com/',
      '/\n/evil.example.com',
      'javascript:alert(1)',
      'relative/path',
      '',
      [ '/a', '/b' ],
      { x: 1 },
      undefined,
      `/${'x'.repeat(2000)}`
    ]) {
      assert.equal(returnTo(value), null, JSON.stringify(value));
    }
  });

  it('sends a logged-in user to the return path, or home', async function () {
    const jar = await t.loginAs(apos, 'editor');
    const cookie = jar.getCookieStringSync(apos.http.getBase());
    for (const [ value, expected ] of [
      [ '/some/page?x=1', '/some/page?x=1' ],
      [ '//evil.example.com/', '/' ],
      [ undefined, '/' ]
    ]) {
      const query = (value === undefined) ? '' : `?returnTo=${encodeURIComponent(value)}`;
      const response = await fetch(getUrl(apos, `/login${query}`), {
        redirect: 'manual',
        headers: { cookie }
      });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), expected);
    }
  });

  it('gives the login page the return path', async function () {
    const response = await fetch(getUrl(apos, `/login?returnTo=${encodeURIComponent('/some/page')}`));
    const html = await response.text();
    assert.match(html, /"returnTo":"\\\/some\\\/page"|"returnTo":"\/some\/page"/);
  });
});
