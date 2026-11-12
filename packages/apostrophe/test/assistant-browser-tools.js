const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Browser tools on the scripted mock: a call checked on the server and
// suspended with a `browser` ask, the browser's answer validated and turned
// into the tool's result with the screen after it, which becomes the
// request's screen.

describe('Assistant: browser tools', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let note;
  let home;
  let script = null;
  // The locale each `t_where` call ran in
  const locales = [];

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: { prefix: '/fr' }
            }
          }
        },
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock() {
              return script ? script() : { text: 'Done.' };
            }
          },
          init(self) {
            self.apos.ai.addAdapter(fakeAdapter());
          }
        },
        '@apostrophecms/assistant': {
          options: {
            enabled: true,
            titleEffort: 'none'
          }
        },
        'assistant-note': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        },
        'assistant-test-tools': {
          init(self) {
            self.apos.assistant.addBrowserTool({
              name: 't_show',
              description: 'Shows things.',
              screenEffect: 'changes',
              input: {
                type: 'object',
                properties: {
                  what: { type: 'string' }
                },
                required: [ 'what' ]
              },
              schema: {
                type: 'object',
                properties: {
                  shown: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              },
              async prepare(req, args) {
                if (args.what === 'nothing') {
                  throw self.apos.error('aiToolError', 'there is nothing to show');
                }
                return {
                  ...args,
                  prepared: true
                };
              }
            });
            self.apos.ai.addTool({
              name: 't_where',
              description: 'Says which locale the run works in.',
              tags: [ 'assistant' ],
              kind: 'query',
              input: {
                type: 'object',
                properties: {}
              },
              handler: async (req) => {
                locales.push(req.locale);
                return { locale: req.locale };
              }
            });
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    note = await apos.modules['assistant-note'].insert(apos.task.getReq(), {
      title: 'A note',
      body: {
        metaType: 'area',
        items: [ 'One', 'Two' ].map(text => ({
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: `<p>${text}</p>`
        }))
      }
    });
    home = await apos.page.find(apos.task.getReq({ mode: 'draft' }), { slug: '/' }).toObject();
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    locales.length = 0;
  });

  it('registers browser tools as actions for the assistant\'s door only', async function () {
    const names = [ 'navigate', 'open_editor', 'read_screen', 'show_widgets', 't_show' ];
    for (const name of names) {
      const tool = apos.ai.getTool(name);
      assert.deepEqual(tool.tags, [ 'assistant', 'browser' ]);
      assert.equal(tool.kind, 'action');
    }
    const assistant = apos.harness.getDoorTools('assistant').map(tool => tool.name);
    const mcp = apos.harness.getDoorTools('mcp').map(tool => tool.name);
    assert(names.every(name => assistant.includes(name)));
    assert(names.every(name => !mcp.includes(name)));
  });

  it('suspends the run with a browser ask, the call prepared on the server', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    script = sequence([ toolTurn('t_show', { what: 'the hero' }) ]);
    const waiting = await runToEnd(req, chat, 'Show me the hero');
    assert.equal(waiting.status, 'waiting');
    assert.deepEqual(waiting.asks, [ {
      callId: 'call-t_show',
      name: 't_show',
      kind: 'browser',
      payload: {
        kind: 'browser',
        screenEffect: 'changes',
        args: {
          what: 'the hero',
          prepared: true
        }
      }
    } ]);
    await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
  });

  it('refuses a call its preparation refuses, with the reason the model reads', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    script = sequence([ toolTurn('t_show', { what: 'nothing' }), { text: 'Nothing.' } ]);
    const done = await runToEnd(req, chat, 'Show me nothing');
    assert.equal(done.status, 'completed');
    assert.equal(done.asks, null);
    assert.match(resultOf(done, 'call-t_show').error, /there is nothing to show/);
  });

  it('continues with the browser\'s answer and the screen after it, which becomes the request\'s', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    script = sequence([
      toolTurn('t_show', { what: 'the hero' }),
      toolTurn('t_where'),
      { text: 'Shown.' }
    ]);
    await runToEnd(req, chat, 'Show me the hero');
    // The browser tab answers from a French page
    await apos.assistant.answer(userReq(editor, 'fr'), chat._id, {
      tabId: 'tab-1',
      callId: 'call-t_show',
      answer: {
        executed: true,
        shown: [ 'hero' ]
      },
      screen: {
        tabId: 'tab-1',
        url: '/fr/',
        editing: true
      }
    });
    const done = await waitForEnd(req, chat);
    assert.equal(done.status, 'completed');
    assert.deepEqual(resultOf(done, 'call-t_show').output, {
      executed: true,
      shown: [ 'hero' ],
      answered: true,
      screen: {
        url: '/fr/',
        locale: 'fr',
        editing: true
      }
    });
    assert.equal(done.screen.url, '/fr/');
    assert.equal(done.screen.locale, 'fr');
    assert.deepEqual(locales, [ 'fr' ]);
  });

  it('refuses a malformed answer and keeps the ask waiting', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    script = sequence([ toolTurn('t_show', { what: 'the hero' }), { text: 'Shown.' } ]);
    await runToEnd(req, chat, 'Show me the hero');
    const screen = { tabId: 'tab-1' };
    const refused = [
      [ { shown: [ 'hero' ] }, screen ],
      [ {
        executed: true,
        extra: 1
      }, screen ],
      [ {
        executed: true,
        shown: 'hero'
      }, screen ],
      [ {
        executed: false,
        reason: 'x'.repeat(301)
      }, screen ],
      [ 'shown', screen ],
      [ { executed: true }, undefined ],
      [ { executed: true }, { tabId: 'tab-2' } ]
    ];
    for (const [ value, posted ] of refused) {
      await assert.rejects(apos.assistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-t_show',
        answer: value,
        screen: posted
      }), { name: 'invalid' });
    }
    assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest.status, 'waiting');
    await apos.assistant.answer(req, chat._id, {
      tabId: 'tab-1',
      callId: 'call-t_show',
      answer: {
        executed: false,
        reason: 'The widget is not on this page.'
      },
      screen
    });
    const done = await waitForEnd(req, chat);
    assert.equal(done.status, 'completed');
    assert.deepEqual(resultOf(done, 'call-t_show').output, {
      executed: false,
      reason: 'The widget is not on this page.',
      answered: true,
      screen: {
        locale: 'en',
        editing: false
      }
    });
  });

  describe('the standard set', function () {
    it('prepares where navigate goes: a document\'s page or a URL of this site', async function () {
      assert.deepEqual(await askOf('navigate', { _id: home._id }), {
        _id: home._id,
        url: home._url
      });
      assert.deepEqual(await askOf('navigate', { url: '/about?x=1' }), { url: '/about?x=1' });
      assert.deepEqual(await askOf('navigate', { url: 'http://localhost:3000/a' }), {
        url: 'http://localhost:3000/a'
      });
      assert.match(await refusalOf('navigate', {}), /either "_id" or "url"/);
      assert.match(await refusalOf('navigate', {
        _id: home._id,
        url: '/'
      }), /either "_id" or "url"/);
      for (const url of [ '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'about' ]) {
        assert.match(await refusalOf('navigate', { url }), /"url" is a URL of this site/);
      }
      assert.match(await refusalOf('navigate', { _id: note._id }), /"A note" has no page of its own/);
      assert.match(await refusalOf('navigate', { _id: 'nope' }), /no document "nope"/);
    });

    it('prepares the editor open_editor opens: a document\'s or one of its widgets\'', async function () {
      const [ widget ] = note.body.items;
      assert.deepEqual(await askOf('open_editor', { _id: note._id }), {
        _id: note._id.replace(':published', ':draft'),
        type: 'assistant-note',
        until: 'open'
      });
      assert.deepEqual(await askOf('open_editor', {
        _id: note._id,
        widgetId: widget._id,
        until: 'closed'
      }), {
        _id: note._id.replace(':published', ':draft'),
        type: 'assistant-note',
        widgetId: widget._id,
        until: 'closed'
      });
      assert.match(await refusalOf('open_editor', {
        _id: note._id,
        widgetId: note.body._id
      }), /"A note" has no widget/);
    });

    it('prepares the widgets show_widgets selects, every one in the document', async function () {
      const ids = note.body.items.map(widget => widget._id);
      assert.deepEqual(await askOf('show_widgets', {
        _id: note._id,
        widgetIds: ids
      }), {
        _id: note._id.replace(':published', ':draft'),
        widgetIds: ids
      });
      assert.match(await refusalOf('show_widgets', {
        _id: note._id,
        widgetIds: [ ids[0], 'nope' ]
      }), /"A note" has no widget "nope"/);
    });

    it('asks read_screen of the browser, keeping the screen', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = sequence([ toolTurn('read_screen') ]);
      const waiting = await runToEnd(req, chat, 'Where am I?');
      assert.deepEqual(waiting.asks[0].payload, {
        kind: 'browser',
        screenEffect: 'keeps',
        args: {}
      });
      await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    // The arguments the browser receives for one call of `name`
    async function askOf(name, input) {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = sequence([ toolTurn(name, input) ]);
      const waiting = await runToEnd(req, chat, `Call ${name}`);
      assert.equal(waiting.status, 'waiting', JSON.stringify(waiting.messages.at(-1)));
      await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
      return waiting.asks[0].payload.args;
    }

    // The error the model reads for one call of `name`
    async function refusalOf(name, input) {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = sequence([ toolTurn(name, input), { text: 'Refused.' } ]);
      const done = await runToEnd(req, chat, `Call ${name}`);
      assert.equal(done.status, 'completed');
      return resultOf(done, `call-${name}`).error;
    }
  });

  function userReq(user, locale = 'en') {
    return apos.task.getReq({
      user,
      mode: 'draft',
      locale
    });
  }

  async function runToEnd(req, chat, message) {
    await apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId: 'tab-1' }
    });
    return waitForEnd(req, chat);
  }

  // The chat's latest request once its run has ended (or waits), and the
  // run's end handler with it
  async function waitForEnd(req, chat) {
    let request;
    await waitFor(async () => {
      const requests = await apos.assistant.getChatRequests(req, chat._id);
      request = requests.at(-1);
      const open = (await apos.assistant.getChat(req, chat._id)).openRequest;
      const job = request?.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: request.jobId });
      return request && (request.status !== 'running') &&
        ((open === null) || (open.status === 'waiting')) && (!job || job.ended);
    });
    return request;
  }

  // The turns in order, then the default
  function sequence(turns) {
    const queue = [ ...turns ];
    return () => queue.shift() || { text: 'Done.' };
  }
});

function resultOf(request, callId) {
  return request.messages
    .flatMap(message => (message.role === 'tool') ? message.content : [])
    .find(part => part.toolCallId === callId);
}

function toolTurn(name, input = {}) {
  return {
    content: [ {
      type: 'toolCall',
      id: `call-${name}`,
      name,
      input
    } ],
    finishReason: 'toolCalls',
    usage: {
      inputTokens: 10,
      outputTokens: 2
    }
  };
}

async function waitFor(condition, deadline = Date.now() + 10000) {
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for the condition');
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
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
