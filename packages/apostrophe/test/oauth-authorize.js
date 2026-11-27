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
// Spelled out, not taken from the module, so a change to it shows here
const PAGE_POLICY = 'default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; ' +
  'frame-ancestors \'none\'';

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
    client = await apos.modules['@apostrophecms/oauth'].registerClient({
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

  // Checks the error page and returns its HTML
  async function assertErrorPage(response, status, pattern) {
    assert.equal(response.status, status);
    assert.equal(response.headers.get('location'), null);
    const html = await response.text();
    assert.match(html, /data-oauth-error/);
    if (pattern) {
      assert.match(html, pattern);
    }
    return html;
  }

  // The page's parts, as text
  function getErrorParts(html) {
    const get = (pattern) => {
      const matches = html.match(pattern);
      return matches && matches[1].replace(/\s+/g, ' ').trim();
    };
    return {
      heading: get(/<h1>([\s\S]*?)<\/h1>/),
      reason: get(/data-oauth-error>([\s\S]*?)<\/p>/),
      nothingShared: /data-oauth-nothing-shared/.test(html),
      details: get(/<details data-oauth-error-details>([\s\S]*?)<\/details>/)
    };
  }

  describe('errors shown, not sent', function () {
    it('stops at an unknown client', async function () {
      const html = await assertErrorPage(await authorize({ client_id: 'unknown' }), 400);
      const parts = getErrorParts(html);
      assert.equal(parts.heading, 'A tool&#39;s request was blocked');
      assert.match(parts.reason, /doesn&#39;t recognize the tool/);
      assert.ok(parts.nothingShared);
      assert.match(html, /contact the tool&#39;s developer/);
      assert.match(parts.details, /<code>invalid_client<\/code>/);
      assert.match(parts.details, /&quot;unknown&quot;/);
      await assertErrorPage(await authorize({ client_id: undefined }), 400);
    });

    it('stops at a redirect URI the client did not register', async function () {
      for (const uri of [
        'https://evil.example.com/callback',
        'https://tool.example.com/callback/more',
        undefined
      ]) {
        const html = await assertErrorPage(await authorize({ redirect_uri: uri }), 400);
        const parts = getErrorParts(html);
        // The client is known, so the heading names it, escaped
        assert.equal(parts.heading, 'Couldn&#39;t connect Test &lt;script&gt;alert(1)&lt;/script&gt; tool');
        assert.doesNotMatch(html, /<script>alert/);
        assert.match(parts.reason, /hasn&#39;t registered/);
        assert.match(parts.reason, /protect your account/);
        assert.ok(parts.nothingShared);
        assert.match(parts.details, /<code>invalid_request<\/code>/);
        if (uri) {
          assert.ok(parts.details.includes(uri), parts.details);
        }
      }
    });

    it('stops at a client metadata document it can\'t use, and keeps the cause for developers', async function () {
      const fetchDocument = apos.modules['@apostrophecms/oauth'].fetchClientMetadataDocument;
      apos.modules['@apostrophecms/oauth'].fetchClientMetadataDocument = async () => {
        throw Object.assign(new Error('the response status was 404'), { aboutDocument: true });
      };
      try {
        const html = await assertErrorPage(await authorize({
          client_id: 'https://tool.example.com/client.json'
        }), 400);
        const parts = getErrorParts(html);
        assert.equal(parts.heading, 'A tool&#39;s request was blocked');
        assert.match(parts.reason, /couldn&#39;t read the information the tool published/);
        // The developer's message is only in the details
        assert.doesNotMatch(parts.reason, /status was 404/);
        assert.match(parts.details, /<code>invalid_client<\/code>/);
        assert.match(parts.details, /status was 404/);
      } finally {
        apos.modules['@apostrophecms/oauth'].fetchClientMetadataDocument = fetchDocument;
      }
    });

    it('shows an unexpected error as the site\'s, promising nothing', async function () {
      const getClient = apos.modules['@apostrophecms/oauth'].getClient;
      apos.modules['@apostrophecms/oauth'].getClient = async () => {
        throw new Error('the database is down');
      };
      try {
        const html = await assertErrorPage(await authorize(), 500, /Something went wrong on this site/);
        const parts = getErrorParts(html);
        assert.equal(parts.heading, 'Couldn&#39;t connect the tool');
        assert.equal(parts.nothingShared, false);
        assert.match(html, /contact this site&#39;s administrator/);
        assert.equal(parts.details, null);
        assert.doesNotMatch(html, /database is down/);
      } finally {
        apos.modules['@apostrophecms/oauth'].getClient = getClient;
      }
    });

    it('escapes what the request sent in the details', async function () {
      const html = await assertErrorPage(await authorize({ client_id: '<img src=x onerror=alert(1)>' }), 400);
      assert.doesNotMatch(html, /<img/);
      assert.match(getErrorParts(html).details, /&lt;img src=x onerror=alert\(1\)&gt;/);
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

    it('has the login page\'s project header, as does the error page, escaped', async function () {
      const getProjectHeader = apos.login.getProjectHeader;
      apos.login.getProjectHeader = () => ({
        env: 'staging',
        name: 'My <i>project</i>'
      });
      try {
        for (const response of [
          await authorize(),
          await authorize({ client_id: 'unknown' })
        ]) {
          const html = await response.text();
          assert.match(html, /<span class="env env--staging" data-oauth-env>staging<\/span>/);
          assert.match(html, /My &lt;i&gt;project&lt;\/i&gt;/);
        }
      } finally {
        apos.login.getProjectHeader = getProjectHeader;
      }
      // The same as the login page's context
      const html = await (await authorize()).text();
      const { env, name } = apos.login.getProjectHeader();
      assert.ok(html.includes(`data-oauth-env>${env}<`), env);
      assert.ok(html.includes(name), name);
    });

    it('says the tool acts within the user\'s permissions', async function () {
      const html = await (await authorize()).text();
      assert.match(html, /it acts as you on cms\.example\.com, and can never do more than your own permissions allow/);
    });

    it('shows the resource\'s own description, escaped', async function () {
      const html = await (await authorize()).text();
      assert.match(html, /data-oauth-resource-description>It can read &lt;your&gt; content \(en\)\.</);
    });

    it('takes the site\'s only resource for a request without one', async function () {
      // As claude.ai asks: no resource parameter
      const response = await authorize({ resource: undefined });
      const approval = await getApprovalId(response.clone());
      assert.match(await response.text(), /data-oauth-resource-description>It can read &lt;your&gt; content/);
      const { params: sent } = getRedirect(await decide({
        approval,
        decision: 'approve'
      }));
      const stored = await apos.modules['@apostrophecms/oauth'].codes.findOne({
        _id: apos.modules['@apostrophecms/oauth'].hashSecret(sent.code)
      });
      assert.equal(stored.resource, `${BASE_URL}${RESOURCE}`);
    });

    it('can\'t be framed, cached or leak its URL, and loads nothing', async function () {
      for (const response of [
        await authorize(),
        await authorize({ client_id: 'unknown' })
      ]) {
        assert.equal(response.headers.get('x-frame-options'), 'DENY');
        assert.equal(response.headers.get('content-security-policy'), PAGE_POLICY);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      }
    });

    it('has no script, no outside resource and no form-action limit, which the policy relies on', async function () {
      const html = await (await authorize()).text();
      assert.doesNotMatch(html, /<script|<link|<img|<iframe|url\(|@import|\son\w+=/i);
      // A form-action limit would stop the redirect to the tool
      assert.doesNotMatch(PAGE_POLICY, /form-action/);
    });

    it('offers "Not you?" and says where to disconnect later', async function () {
      const html = await (await authorize()).text();
      assert.match(html, /<button type="submit" form="oauth-decision" name="decision" value="switch"[^>]*>Not you\?<\/button>/);
      assert.match(html, /<form [^>]*id="oauth-decision"/);
      assert.match(html, /data-oauth-disconnect>You can disconnect it at any time from Connected tools/);
    });

    it('offers no "Not you?" without a login page to send the user to', async function () {
      const getLoginUrl = apos.login.getLoginUrl;
      apos.login.getLoginUrl = () => null;
      try {
        const html = await (await authorize()).text();
        assert.doesNotMatch(html, /data-oauth-switch-user/);
        await getApprovalId(await authorize());
      } finally {
        apos.login.getLoginUrl = getLoginUrl;
      }
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

      assert.equal(await apos.modules['@apostrophecms/oauth'].codes.countDocuments({ _id: sent.code }), 0);
      const stored = await apos.modules['@apostrophecms/oauth'].codes.findOne({
        _id: apos.modules['@apostrophecms/oauth'].hashSecret(sent.code)
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
      const before = await apos.modules['@apostrophecms/oauth'].codes.countDocuments({});
      const approval = await getApprovalId(await authorize());
      const { params: sent } = getRedirect(await decide({
        approval,
        decision: 'deny'
      }));
      assert.equal(sent.error, 'access_denied');
      assert.equal(sent.state, 'the-state');
      assert.equal(sent.code, undefined);
      assert.equal(await apos.modules['@apostrophecms/oauth'].codes.countDocuments({}), before);
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

    it('"Not you?": logs out, sends the user to log in, and back to the same request', async function () {
      // A session of its own: this one ends
      const cookie = await getCookie('editor');
      const approval = await getApprovalId(await authorize({}, cookie));
      const response = await decide({
        approval,
        decision: 'switch'
      }, cookie);
      assert.equal(response.status, 303);
      const login = new URL(response.headers.get('location'), getUrl(apos, '/'));
      assert.equal(login.pathname, '/login');
      const returnTo = login.searchParams.get('returnTo');
      assert.equal(returnTo, `${AUTHORIZE}?${params()}`);

      // Logged out, and the approval used up, with nothing for the client
      assert.equal(await apos.modules['@apostrophecms/oauth'].pendingApprovals.countDocuments({ _id: approval }), 0);
      const again = await authorize({}, cookie);
      assert.equal(again.status, 302);
      assert.match(again.headers.get('location'), /^\/login\?/);

      // Whoever logs in next sees the same request, as themselves
      const html = await (await fetch(getUrl(apos, returnTo), {
        headers: { cookie: otherCookie }
      })).text();
      assert.match(html, /\(other\)/);
      assert.match(html, /name="approval"/);
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
      await apos.modules['@apostrophecms/oauth'].pendingApprovals.updateOne(
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
      const html = await assertErrorPage(await decide({
        approval,
        decision: 'approve'
      }, null), 401, /no longer logged in/);
      const parts = getErrorParts(html);
      assert.equal(parts.heading, 'Couldn&#39;t connect the tool');
      assert.ok(parts.nothingShared);
      assert.match(html, /Go back to the tool and start again/);
      assert.equal(parts.details, null);
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

  describe('the log', function () {
    // Records the module's log entries while `fn` runs, as
    // `{ severity, req, type, data }`
    async function captureLog(fn) {
      const entries = [];
      const originals = {};
      for (const severity of [ 'Info', 'Warn', 'Error' ]) {
        const name = `log${severity}`;
        originals[name] = apos.modules['@apostrophecms/oauth'][name];
        apos.modules['@apostrophecms/oauth'][name] = (...args) => {
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
        Object.assign(apos.modules['@apostrophecms/oauth'], originals);
      }
      return entries;
    }

    // Keys the logger keeps for itself (lib/logger/render.js): a field with
    // one of these names is left out of the line, or overwritten. `stack` is
    // allowed, since it's meant for the logger
    const RESERVED_KEYS = [ 'site', 'module', 'scope', 'severity', 'type', 'msg' ];

    function findEntry(entries, type) {
      const entry = entries.find(entry => entry.type === type);
      assert.ok(entry, `no ${type} entry in ${JSON.stringify(entries.map(entry => entry.type))}`);
      for (const key of Object.keys(entry.data)) {
        assert.ok(!RESERVED_KEYS.includes(key), `${type} uses the logger's reserved key "${key}"`);
      }
      return entry;
    }

    it('warns of an unknown client', async function () {
      const entries = await captureLog(async () => {
        await authorize({ client_id: 'unknown' });
      });
      const entry = findEntry(entries, 'unknown-client');
      assert.equal(entry.severity, 'warn');
      assert.ok(entry.req);
      assert.equal(entry.data.clientId, 'unknown');
    });

    it('warns of a redirect URI the client did not register', async function () {
      const entries = await captureLog(async () => {
        await authorize({ redirect_uri: 'https://evil.example.com/callback' });
      });
      const entry = findEntry(entries, 'redirect-uri-mismatch');
      assert.equal(entry.severity, 'warn');
      assert.equal(entry.data.clientId, client.client_id);
      assert.equal(entry.data.clientName, client.client_name);
      assert.equal(entry.data.redirectUri, 'https://evil.example.com/callback');
    });

    it('cuts a long value from the request', async function () {
      const entries = await captureLog(async () => {
        await authorize({ redirect_uri: `https://evil.example.com/${'a'.repeat(5000)}` });
      });
      assert.equal(findEntry(entries, 'redirect-uri-mismatch').data.redirectUri.length, 2000);
    });

    it('keeps the whole cause of a document it couldn\'t fetch, which the page leaves out', async function () {
      const fetchDocument = apos.modules['@apostrophecms/oauth'].fetchClientMetadataDocument;
      apos.modules['@apostrophecms/oauth'].fetchClientMetadataDocument = async () => {
        throw new Error('intranet.example resolves to 10.1.2.3, which is not a public address');
      };
      let html;
      try {
        const entries = await captureLog(async () => {
          html = await (await authorize({
            client_id: 'https://tool.example.com/client.json'
          })).text();
        });
        const entry = findEntry(entries, 'client-document-failed');
        assert.equal(entry.severity, 'warn');
        assert.equal(entry.data.clientId, 'https://tool.example.com/client.json');
        assert.match(entry.data.cause, /resolves to 10\.1\.2\.3/);
      } finally {
        apos.modules['@apostrophecms/oauth'].fetchClientMetadataDocument = fetchDocument;
      }
      assert.doesNotMatch(html, /10\.1\.2\.3|resolves/);
      assert.match(getErrorParts(html).details, /its address could not be reached/);
    });

    it('records an approval, without the code', async function () {
      const approval = await getApprovalId(await authorize());
      let redirect;
      const entries = await captureLog(async () => {
        redirect = getRedirect(await decide({
          approval,
          decision: 'approve'
        }));
      });
      const entry = findEntry(entries, 'approved');
      assert.equal(entry.severity, 'info');
      assert.deepEqual(entry.data, {
        username: 'editor',
        clientId: client.client_id,
        clientName: client.client_name,
        resource: `${BASE_URL}${RESOURCE}`,
        scopes: 'content'
      });
      const logged = JSON.stringify(entries.map(entry => entry.data));
      assert.ok(!logged.includes(redirect.params.code));
      assert.ok(!logged.includes(approval));
    });

    it('records a refusal', async function () {
      const approval = await getApprovalId(await authorize());
      const entries = await captureLog(async () => {
        await decide({
          approval,
          decision: 'deny'
        });
      });
      const entry = findEntry(entries, 'declined');
      assert.equal(entry.severity, 'info');
      assert.equal(entry.data.username, 'editor');
      assert.equal(entry.data.clientId, client.client_id);
    });

    it('records a "Not you?"', async function () {
      const cookie = await getCookie('editor');
      const approval = await getApprovalId(await authorize({}, cookie));
      const entries = await captureLog(async () => {
        await decide({
          approval,
          decision: 'switch'
        }, cookie);
      });
      const entry = findEntry(entries, 'switched-user');
      assert.equal(entry.severity, 'info');
      assert.equal(entry.data.username, 'editor');
      assert.equal(entry.data.clientId, client.client_id);
    });

    it('records an approval taken twice', async function () {
      const approval = await getApprovalId(await authorize());
      await decide({
        approval,
        decision: 'approve'
      });
      const entries = await captureLog(async () => {
        await decide({
          approval,
          decision: 'approve'
        });
      });
      const entry = findEntry(entries, 'approval-expired-or-reused');
      assert.equal(entry.severity, 'info');
      assert.equal(entry.data.username, 'editor');
    });

    it('logs an unexpected error with its request', async function () {
      const getClient = apos.modules['@apostrophecms/oauth'].getClient;
      apos.modules['@apostrophecms/oauth'].getClient = async () => {
        throw new Error('the database is down');
      };
      try {
        const entries = await captureLog(async () => {
          await authorize();
        });
        const entry = findEntry(entries, 'oauth-page-error');
        assert.equal(entry.severity, 'error');
        assert.ok(entry.req);
        assert.match(entry.data.stack, /database is down/);
      } finally {
        apos.modules['@apostrophecms/oauth'].getClient = getClient;
      }
    });
  });

  describe('a form it can\'t read', function () {
    it('shows the error page for a form that is too large', async function () {
      const response = await fetch(getUrl(apos, AUTHORIZE), {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: editorCookie
        },
        body: `approval=${'a'.repeat(20000)}&decision=approve`
      });
      const html = await assertErrorPage(response, 413, /approval form couldn&#39;t be read/);
      assert.match(html, /Go back to the tool and start again/);
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

describe('OAuth: authorize, on a site with its own security headers', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await createOauthApos(module, {
      modules: {
        // As @apostrophecms/security-headers does: a policy for every
        // response, set in middleware before any route runs
        'site-wide-headers': {
          middleware() {
            return {
              sendHeaders(req, res, next) {
                res.setHeader('Content-Security-Policy', 'default-src \'self\'; frame-src \'self\'');
                res.setHeader('X-Frame-Options', 'SAMEORIGIN');
                return next();
              }
            };
          }
        }
      }
    });
    await t.createUser(apos, 'editor', { username: 'editor' });
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('replaces the site\'s policy with its stricter one, and still sends the user back to the tool', async function () {
    const jar = await t.loginAs(apos, 'editor');
    const cookie = jar.getCookieStringSync(apos.http.getBase());
    const redirectUri = 'https://tool.example.com/callback';
    const client = await apos.modules['@apostrophecms/oauth'].registerClient({
      client_name: 'Test tool',
      redirect_uris: [ redirectUri ]
    });
    const search = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      state: 'the-state',
      resource: `${BASE_URL}${RESOURCE}`
    });
    const page = await fetch(getUrl(apos, `${AUTHORIZE}?${search}`), {
      redirect: 'manual',
      headers: { cookie }
    });
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-security-policy'), PAGE_POLICY);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
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
    assert.ok(decision.headers.get('location').startsWith(`${redirectUri}?code=`));
  });

  it('leaves the site\'s headers alone elsewhere', async function () {
    const response = await fetch(getUrl(apos, '/'));
    assert.equal(response.headers.get('content-security-policy'), 'default-src \'self\'; frame-src \'self\'');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  });
});

describe('OAuth: authorize, on a site with two resources', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    apos = await createOauthApos(module, {
      modules: {
        'second-resource': {
          init(self) {
            self.apos.modules['@apostrophecms/oauth'].addResource('/api/v1/second-resource', { name: 'Second resource' });
          }
        }
      }
    });
    await t.createUser(apos, 'editor', { username: 'editor' });
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('takes no resource for a request without one, so no resource accepts its tokens', async function () {
    const jar = await t.loginAs(apos, 'editor');
    const cookie = jar.getCookieStringSync(apos.http.getBase());
    const redirectUri = 'https://tool.example.com/callback';
    const client = await apos.modules['@apostrophecms/oauth'].registerClient({
      client_name: 'Test tool',
      redirect_uris: [ redirectUri ]
    });
    const search = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      state: 'the-state'
    });
    const page = await fetch(getUrl(apos, `${AUTHORIZE}?${search}`), {
      redirect: 'manual',
      headers: { cookie }
    });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.doesNotMatch(html, /data-oauth-resource-description/);
    const approval = html.match(/name="approval" value="([^"]+)"/)[1];
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
    const code = new URL(decision.headers.get('location')).searchParams.get('code');
    const stored = await apos.modules['@apostrophecms/oauth'].codes.findOne({ _id: apos.modules['@apostrophecms/oauth'].hashSecret(code) });
    assert.equal(stored.resource, null);
  });
});
