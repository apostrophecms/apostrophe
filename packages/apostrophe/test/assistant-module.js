const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The assistant is off by default: unless it is enabled and the AI engine
// is active, it adds no routes, no halo and no browser data, and creates no
// collections. Its options are checked at startup.

const COLLECTIONS = [ 'aposChats', 'aposChatRequests' ];

describe('Assistant: module and options', function () {
  this.timeout(t.timeout);

  afterEach(function () {
    delete process.env.APOS_AI_MOCK;
  });

  it('adds nothing when not enabled', async function () {
    process.env.APOS_AI_MOCK = '1';
    await withApos({}, async (apos) => {
      assert.equal(apos.aposAssistant.active, false);
      await assertAbsent(apos);
      assert.equal(apos.ai.getTool('read_screen'), undefined);
      assert.equal(apos.ai.getTool('t_show'), undefined);
    }, { modules: browserToolModule('keeps') });
  });

  it('adds nothing when enabled with no active AI engine', async function () {
    await withApos({ enabled: true }, async (apos) => {
      assert.equal(apos.ai.active, false);
      assert.equal(apos.aposAssistant.active, false);
      await assertAbsent(apos);
    });
  });

  it('is active when enabled with an active AI engine', async function () {
    process.env.APOS_AI_MOCK = '1';
    await withApos({ enabled: true }, async (apos) => {
      assert.equal(apos.aposAssistant.active, true);
      const jar = await login(apos);
      const { chats } = await apos.http.get('/api/v1/@apostrophecms/assistant/chat', { jar });
      assert.deepEqual(chats, []);
      const names = await getCollectionNames(apos);
      for (const name of COLLECTIONS) {
        assert(names.includes(name), name);
      }
    });
  });

  it('shows the halo and sends its browser data to editors only once active', async function () {
    process.env.APOS_AI_MOCK = '1';
    await withApos({ enabled: true }, async (apos) => {
      const triggers = apos.modal.triggers.filter(trigger => trigger.name === 'assistant');
      assert.equal(triggers.length, 1);
      assert.equal(triggers[0].componentName, 'AposAssistant');
      const data = await apos.template.getBodyData(apos.task.getReq());
      assert(data.modules['@apostrophecms/modal'].triggers
        .some(trigger => trigger.name === 'assistant'));
      assert.deepEqual(data.modules['@apostrophecms/assistant'], {
        action: '/api/v1/@apostrophecms/assistant',
        // One locale: no Localize in widget menus
        widgetOperations: {},
        usageDisplay: 'tokens',
        modelDisplay: false,
        screenWait: 15000,
        // With no provider routed, every kind of file
        attachments: {
          canUpload: true,
          maxBytes: 8 * 1024 * 1024,
          maxTextBytes: 2 * 1024 * 1024,
          textExtensions: [ 'css', 'json', 'tokens', 'md', 'markdown' ],
          maxCount: 4,
          extensions: [
            'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'heic', 'heif', 'svg', 'pdf',
            'html', 'htm', 'css', 'json', 'tokens', 'md', 'markdown'
          ],
          unreadable: {}
        },
        alias: 'aposAssistant'
      });
      // Attaching takes the right to upload a file
      const guest = await apos.template.getBodyData(apos.task.getReq({
        user: {
          _id: 'guest',
          role: 'guest'
        }
      }));
      assert.equal(guest.modules['@apostrophecms/assistant'].attachments.canUpload, false);
      const anonymous = await apos.template.getBodyData(apos.task.getAnonReq());
      assert.equal(anonymous.modules['@apostrophecms/modal'], undefined);
      assert.equal(anonymous.modules['@apostrophecms/assistant'], undefined);
    });
  });

  it('leaves the vendor and model out of the requests it sends unless modelDisplay is set', async function () {
    process.env.APOS_AI_MOCK = '1';
    const request = {
      _id: 'r1',
      provider: 'fake',
      model: 'fake-large',
      messages: []
    };
    await withApos({ enabled: true }, (apos) => {
      const rendered = apos.aposAssistant.renderRequest(request);
      assert.equal(rendered._id, 'r1');
      assert.equal('provider' in rendered, false);
      assert.equal('model' in rendered, false);
    });
    await withApos({
      enabled: true,
      modelDisplay: true
    }, (apos) => {
      const rendered = apos.aposAssistant.renderRequest(request);
      assert.equal(rendered.provider, 'fake');
      assert.equal(rendered.model, 'fake-large');
    });
  });

  it('sends a request as the thread shows it: the reply and steps, never the transcript', async function () {
    process.env.APOS_AI_MOCK = '1';
    const request = {
      _id: 'r1',
      ownerId: 'u1',
      schemaVersion: 1,
      chatId: 'c1',
      message: 'Hello',
      status: 'completed',
      screen: { url: '/' },
      screenChanged: true,
      prior: 2,
      jobId: 'j1',
      replyMentions: [],
      messages: [
        {
          role: 'user',
          content: [ {
            type: 'text',
            text: 'Hello'
          } ]
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Let me look.'
            },
            {
              type: 'toolCall',
              id: 'call-1',
              name: 'list_types',
              input: { all: true }
            }
          ]
        },
        {
          role: 'tool',
          content: [ {
            type: 'toolResult',
            toolCallId: 'call-1',
            output: { types: [ 'page' ] }
          } ]
        },
        {
          role: 'assistant',
          content: [ {
            type: 'text',
            text: 'There are **pages**.'
          } ]
        }
      ]
    };
    await withApos({ enabled: true }, (apos) => {
      const rendered = apos.aposAssistant.renderRequest(request);
      for (const name of [ 'messages', 'screen', 'screenChanged', 'prior', 'jobId',
        'replyMentions', 'ownerId', 'schemaVersion' ]) {
        assert.equal(name in rendered, false, name);
      }
      assert.equal(rendered.message, 'Hello');
      assert(rendered.reply.includes('<strong>pages</strong>'));
      assert(!rendered.reply.includes('Let me look'));
      assert.deepEqual(rendered.steps, [ {
        id: 'call-1',
        name: 'list_types',
        label: 'apostrophe:aiToolListTypes'
      } ]);
      assert.deepEqual(apos.aposAssistant.renderStep(request, 'call-1'), {
        input: JSON.stringify({ all: true }, null, 2),
        output: JSON.stringify({ types: [ 'page' ] }, null, 2),
        error: null
      });
      assert.equal(apos.aposAssistant.renderStep(request, 'call-2'), null);
      assert.equal(apos.aposAssistant.renderRequest({ messages: [] }).reply, null);
    });
  });

  it('refuses an effort option naming no effort level at startup', async function () {
    process.env.APOS_AI_MOCK = '1';
    for (const name of [ 'effort', 'titleEffort', 'delegationEffort', 'summaryEffort' ]) {
      await assert.rejects(
        withApos({
          enabled: true,
          [name]: 'nope'
        }, () => {}, { provider: true }),
        new RegExp(`${name} option names the effort level "nope"`)
      );
    }
  });

  it('accepts the configured effort levels and titleEffort "none"', async function () {
    process.env.APOS_AI_MOCK = '1';
    await withApos({
      enabled: true,
      effort: 'high',
      titleEffort: 'none',
      delegationEffort: 'medium',
      summaryEffort: 'low'
    }, (apos) => {
      assert.equal(apos.aposAssistant.active, true);
    }, { provider: true });
  });

  it('refuses options of the wrong shape at startup', async function () {
    const cases = [
      [ { enabled: 'yes' }, /enabled option must be a boolean/ ],
      [ { modelDisplay: 1 }, /modelDisplay option must be a boolean/ ],
      [ { maxSteps: 0 }, /maxSteps option must be a positive integer/ ],
      [ { screenWait: 1.5 }, /screenWait option must be a positive integer/ ],
      [ { attachmentMaxBytes: 0 }, /attachmentMaxBytes option must be a positive integer/ ],
      [ { attachmentMaxTextBytes: -1 }, /attachmentMaxTextBytes option must be a positive integer/ ],
      [ { attachmentMaxCount: 'four' }, /attachmentMaxCount option must be a positive integer/ ],
      [ { usageDisplay: 'cost' }, /usageDisplay option must be one of: tokens, none/ ],
      [ { titleEffort: '' }, /titleEffort option must be the name of an effort level/ ],
      [ { contextLimit: 0 }, /contextLimit option must be a positive integer/ ],
      [
        { contextLimit: 26000 },
        /contextLimit option times contextThreshold percent must be at least 20000 tokens/
      ],
      [
        {
          contextThreshold: 10,
          contextLimit: 100000
        },
        /contextLimit option times contextThreshold percent must be at least 20000 tokens/
      ],
      [ { contextThreshold: 9 }, /contextThreshold option must be a whole number from 10 to 90/ ],
      [ { contextThreshold: 91 }, /contextThreshold option must be a whole number from 10 to 90/ ],
      [ { contextThreshold: 75.5 }, /contextThreshold option must be a whole number from 10 to 90/ ]
    ];
    for (const [ options, pattern ] of cases) {
      await assert.rejects(withApos(options, () => {}), pattern);
    }
  });

  it('refuses a browser tool with no screen effect at startup', async function () {
    await assert.rejects(
      withApos({ enabled: true }, () => {}, { modules: browserToolModule('moves') }),
      /The browser tool "t_show" needs a screenEffect: keeps or changes/
    );
  });

  it('refuses a browser tool whose hidden answer says nothing of "executed"', async function () {
    await assert.rejects(
      withApos({ enabled: true }, () => {}, {
        modules: browserToolModule('keeps', { whenHidden: { reason: 'hidden' } })
      }),
      /The browser tool "t_show" answers "executed" when its browser tab is hidden/
    );
  });
});

// A module adding a browser tool with this screen effect
function browserToolModule(screenEffect, extra = {}) {
  return {
    'assistant-test-tools': {
      init(self) {
        self.apos.aposAssistant.addBrowserTool({
          name: 't_show',
          description: 'Shows things.',
          screenEffect,
          input: {
            type: 'object',
            properties: {}
          },
          ...extra
        });
      }
    }
  };
}

// A startup failure throws instead of exiting. The instance is captured for
// cleanup by the AI engine's init, which runs before the assistant's
async function withApos(options, fn, { provider = false, modules = {} } = {}) {
  let apos;
  try {
    await t.create({
      root: module,
      exit: 'throw',
      modules: {
        '@apostrophecms/ai': {
          ...(provider && {
            options: {
              providers: { fake: {} }
            }
          }),
          init(self) {
            apos = self.apos;
            if (provider) {
              self.apos.ai.addAdapter(fakeAdapter());
            }
          }
        },
        '@apostrophecms/assistant': { options },
        ...modules
      }
    });
    await fn(apos);
  } finally {
    await t.destroy(apos);
  }
}

async function assertAbsent(apos) {
  const jar = await login(apos);
  await assert.rejects(
    apos.http.get('/api/v1/@apostrophecms/assistant/chat', { jar }),
    { status: 404 }
  );
  assert.equal(apos.aposAssistant.chats, undefined);
  assert(!apos.modal.triggers.some(trigger => trigger.name === 'assistant'));
  const data = await apos.template.getBodyData(apos.task.getReq());
  assert.equal(data.modules['@apostrophecms/assistant'], undefined);
  const names = await getCollectionNames(apos);
  for (const name of COLLECTIONS) {
    assert(!names.includes(name), name);
  }
}

async function login(apos) {
  await t.createAdmin(apos, { username: 'editor' });
  return t.loginAs(apos, 'editor');
}

async function getCollectionNames(apos) {
  const collections = await apos.db.listCollections().toArray();
  return collections.map(collection => collection.name);
}

function fakeAdapter() {
  return {
    name: 'fake',
    label: 'Fake',
    capabilities: {
      text: true,
      tools: true,
      structured: true
    },
    effort: {
      low: { model: 'fake-small' },
      medium: { model: 'fake-medium' },
      high: { model: 'fake-large' }
    },
    models: {},
    validate() {},
    async chat() {
      throw new Error('never called under APOS_AI_MOCK');
    }
  };
}
