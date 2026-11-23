const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const {
  PATH, TOKEN, createMcpApos, getUrl, initializeMessage, withClient, post, readJsonOrSse
} = require('./utils/mcp.js');

// The MCP server is off by default and adds no route. Enabled, it serves
// the current spec and 2025-era clients from one route, through
// Apostrophe's own middleware: the JSON body parser, the CSRF check (MCP
// clients send no cookies) and the CORS headers on /api/v1.

describe('MCP: module and transport', function () {
  this.timeout(t.timeout);

  describe('disabled', function () {
    let apos;

    before(async function () {
      apos = await t.create({ root: module });
    });

    after(async function () {
      await t.destroy(apos);
    });

    // A 404 shows there is no route: on an enabled site the same GET
    // reaches the SDK, which answers 405 (see "hands a GET to the SDK").
    // A GET, not a POST: with the module disabled, a cookie-less POST meets
    // the CSRF check first and gets 403 whether or not the route exists
    it('has no route', async function () {
      const response = await fetch(getUrl(apos));
      assert.equal(response.status, 404);
      assert.equal(apos.mcp.httpHandler, undefined);
    });
  });

  describe('enabled', function () {
    let apos;

    before(async function () {
      apos = await createMcpApos(module, {
        modules: {
          // Guidance for MCP alone, and for the assistant alone
          'mcp-recipe': {
            extend: '@apostrophecms/piece-type',
            options: {
              aiWhen: 'A recipe.',
              aiHowMcp: 'Read the dishes before the prices.'
            }
          },
          'assistant-recipe': {
            extend: '@apostrophecms/piece-type',
            options: {
              aiWhen: 'A recipe for the assistant.',
              aiHowAssistant: 'Open the editor first.'
            }
          }
        }
      });
    });

    after(async function () {
      await t.destroy(apos);
    });

    it('connects a 2026-07-28 client and sends the site guidance', async function () {
      await withClient(apos, 'auto', (client) => {
        assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');
        assert.equal(client.getServerVersion().name, apos.shortName);
        assert.equal(client.getInstructions(), expectedInstructions(apos));
      });
    });

    it('connects a 2025-era client and sends the site guidance', async function () {
      await withClient(apos, 'legacy', (client) => {
        assert.match(client.getNegotiatedProtocolVersion(), /^2025-/);
        assert.equal(client.getInstructions(), expectedInstructions(apos));
      });
    });

    it('marks the types with guidance for the mcp door', async function () {
      await withClient(apos, 'auto', (client) => {
        const instructions = client.getInstructions();
        assert.match(instructions, /^mcp-recipe: A recipe\. \(aiHow\)$/m);
        assert.match(instructions, /^assistant-recipe: A recipe for the assistant\.$/m);
      });
    });

    it('answers a POST with no CSRF cookie', async function () {
      const response = await post(apos);
      assert.equal(response.status, 200);
      const body = await readJsonOrSse(response);
      assert.equal(body.id, 1);
      assert(body.result.protocolVersion);
    });

    it('answers a POST with a query string or a trailing slash', async function () {
      for (const path of [ `${PATH}?client=test`, `${PATH}/`, `${PATH}/?client=test` ]) {
        const response = await post(apos, {}, initializeMessage(), path);
        assert.equal(response.status, 200, path);
      }
    });

    // With no token: the express module's login-token check would refuse
    // the development token first, with a 401
    it('keeps the CSRF check below the route\'s path', async function () {
      const response = await post(apos, { authorization: null }, initializeMessage(), `${PATH}/other`);
      assert.equal(response.status, 403);
      assert.equal((await response.json()).message, 'CSRF exception');
    });

    it('hands a GET to the SDK', async function () {
      const response = await fetch(getUrl(apos), {
        headers: { authorization: `Bearer ${TOKEN}` }
      });
      assert.equal(response.status, 405);
    });

    it('refuses a browser Origin it does not allow', async function () {
      const response = await post(apos, { origin: 'https://evil.example' });
      assert.equal(response.status, 403);
    });

    it('accepts an allowed browser Origin', async function () {
      const response = await post(apos, { origin: 'http://localhost:3000' });
      assert.equal(response.status, 200);
    });
  });

  describe('options', function () {
    it('refuses options of the wrong shape at startup', async function () {
      const cases = [
        [ { enabled: 'yes' }, /enabled option must be a boolean/ ],
        [ { allowedOrigins: 'example.com' }, /allowedOrigins option must be an array/ ],
        [ { allowedOrigins: [ '' ] }, /allowedOrigins option must be an array/ ]
      ];
      for (const [ options, pattern ] of cases) {
        // Captured by a module that inits before this one, which throws
        // in its own init
        let apos;
        await assert.rejects(async () => {
          apos = await t.create({
            root: module,
            exit: 'throw',
            modules: {
              '@apostrophecms/harness': {
                init(self) {
                  apos = self.apos;
                }
              },
              '@apostrophecms/mcp': { options }
            }
          });
        }, pattern);
        await t.destroy(apos);
      }
    });
  });
});

// As the connected user's request builds them, through the mcp door
function expectedInstructions(apos) {
  return apos.aposHarness.getInstructions(apos.aposHarness.withDoor(apos.task.getReq(), {
    door: 'mcp',
    lockId: 'instructions',
    requestId: 'instructions'
  }));
}
