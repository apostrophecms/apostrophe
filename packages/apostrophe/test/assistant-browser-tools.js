const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Browser tools on the scripted mock: a call checked on the server and
// suspended with a `browser` ask, the browser's answer validated and turned
// into the tool's result with the screen after it, which becomes the
// request's screen and that of the browser tab's other open requests. A
// hidden browser tab runs nothing: the server answers for it.

describe('Assistant: browser tools', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let note;
  let home;
  let script = null;
  // The locale each `t_where` call ran in
  const locales = [];
  // Holds `t_wait` until the test lets it go
  let gate = null;

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
            mock(req) {
              return script ? script(req) : { text: 'Done.' };
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
            self.apos.ai.addTool({
              name: 't_wait',
              description: 'Takes its time.',
              tags: [ 'assistant' ],
              kind: 'query',
              input: {
                type: 'object',
                properties: {}
              },
              handler: async () => {
                gate.started = true;
                await gate.promise;
                return { waited: true };
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
    gate = newGate();
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
        },
        // What a browser tab that went hidden answers
        whenHidden: {
          executed: false,
          reason: 'the user is in another browser tab'
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

  describe('hidden browser tabs, shared screens and stop', function () {
    const HIDDEN = {
      executed: false,
      reason: 'the user is in another browser tab'
    };

    it('answers every browser tool on the server while the owning browser tab is hidden', async function () {
      const [ widget ] = note.body.items;
      const calls = [
        [ 'read_screen', {}, { executed: true } ],
        [ 'navigate', { _id: home._id }, HIDDEN ],
        [ 'open_editor', { _id: note._id }, HIDDEN ],
        [ 'show_widgets', {
          _id: note._id,
          widgetIds: [ widget._id ]
        }, HIDDEN ],
        [ 't_show', { what: 'the hero' }, HIDDEN ]
      ];
      for (const [ name, input, expected ] of calls) {
        const req = userReq(editor);
        const chat = await apos.assistant.createChat(req);
        gate = newGate();
        script = sequence([ toolTurn('t_wait'), toolTurn(name, input), { text: 'Later.' } ]);
        await apos.assistant.send(req, chat._id, {
          message: `Call ${name}`,
          screen: {
            tabId: 'tab-1',
            url: '/somewhere'
          }
        });
        await waitFor(() => gate.started);
        // The editor moves to another browser tab while the run reads
        await apos.assistant.setVisible(req, {
          tabId: 'tab-1',
          visible: false
        });
        gate.open();
        const done = await waitForEnd(req, chat);
        assert.equal(done.status, 'completed', name);
        assert.equal(done.asks, null);
        assert.deepEqual(resultOf(done, `call-${name}`).output, {
          ...expected,
          answered: true,
          screen: {
            url: '/somewhere',
            locale: 'en',
            editing: false
          }
        }, name);
      }
    });

    it('takes a late answer after hiding, and the hidden answer the ask carries', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = sequence([
        toolTurn('t_show', { what: 'the hero' }),
        toolTurn('read_screen'),
        { text: 'Done.' }
      ]);
      await runToEnd(req, chat, 'Show me the hero');
      await apos.assistant.setVisible(req, {
        tabId: 'tab-1',
        visible: false
      });
      // An executor already running finishes and answers late
      await apos.assistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-t_show',
        answer: {
          executed: true,
          shown: [ 'hero' ]
        },
        screen: {
          tabId: 'tab-1',
          url: '/hero',
          visible: false
        }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.equal(resultOf(done, 'call-t_show').output.executed, true);
      // The next browser tool is answered on the server, from the stored
      // screen
      assert.deepEqual(resultOf(done, 'call-read_screen').output, {
        executed: true,
        answered: true,
        screen: {
          url: '/hero',
          locale: 'en',
          editing: false
        }
      });

      // An ask that reaches the browser tab after it went hidden: it answers
      // what the server would
      const other = await apos.assistant.createChat(req);
      script = sequence([ toolTurn('t_show', { what: 'the hero' }), { text: 'Later.' } ]);
      const waiting = await runToEnd(req, other, 'Show me the hero again');
      assert.equal(waiting.status, 'waiting');
      await apos.assistant.answer(req, other._id, {
        tabId: 'tab-1',
        callId: 'call-t_show',
        answer: waiting.asks[0].payload.whenHidden,
        screen: {
          tabId: 'tab-1',
          visible: false
        }
      });
      const later = await waitForEnd(req, other);
      assert.deepEqual(resultOf(later, 'call-t_show').output, {
        ...HIDDEN,
        answered: true,
        screen: {
          locale: 'en',
          editing: false
        }
      });
    });

    it('gives the browser tab\'s other open requests the new screen with their next tool result', async function () {
      const req = userReq(editor);
      const shows = await apos.assistant.createChat(req);
      const reads = await apos.assistant.createChat(req);
      const elsewhere = await apos.assistant.createChat(req);
      const turns = {
        [shows._id]: [ toolTurn('t_show', { what: 'the hero' }), { text: 'Shown.' } ],
        [reads._id]: [ toolTurn('t_wait'), toolTurn('t_where'), { text: 'Read.' } ],
        [elsewhere._id]: [ toolTurn('t_show', { what: 'the footer' }) ]
      };
      script = req => turns[apos.harness.getDoor(req).chat].shift() || { text: 'Done.' };
      await apos.assistant.send(req, reads._id, {
        message: 'Read things',
        screen: {
          tabId: 'tab-1',
          url: '/start'
        }
      });
      await waitFor(() => gate.started);
      await runToEnd(req, shows, 'Show me the hero');
      await runToEnd(req, elsewhere, 'Show me the footer', 'tab-2');

      await apos.assistant.answer(req, shows._id, {
        tabId: 'tab-1',
        callId: 'call-t_show',
        answer: {
          executed: true,
          shown: [ 'hero' ]
        },
        screen: {
          tabId: 'tab-1',
          url: '/hero'
        }
      });
      await waitForEnd(req, shows);
      const [ reading ] = await apos.assistant.getChatRequests(req, reads._id);
      assert.equal(reading.screen.url, '/hero');
      assert.equal(reading.screenChanged, true);
      // A request of another browser tab keeps its own
      const [ other ] = await apos.assistant.getChatRequests(req, elsewhere._id);
      assert.equal(other.screen.url, null);
      assert.equal(other.screenChanged, undefined);

      gate.open();
      const done = await waitForEnd(req, reads);
      assert.equal(done.status, 'completed');
      assert.deepEqual(resultOf(done, 'call-t_wait').output, {
        waited: true,
        screen: {
          url: '/hero',
          locale: 'en',
          editing: false
        }
      });
      // Once
      assert.deepEqual(resultOf(done, 'call-t_where').output, { locale: 'en' });
      assert.equal(done.screenChanged, undefined);
      await apos.assistant.skip(req, elsewhere._id, { tabId: 'tab-2' });
    });

    it('stops a request waiting on a browser ask, from any browser tab', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      // A browser ask and an action after it, which never starts
      script = sequence([ {
        content: [
          {
            type: 'toolCall',
            id: 'call-t_show',
            name: 't_show',
            input: { what: 'the hero' }
          },
          {
            type: 'toolCall',
            id: 'call-read_screen',
            name: 'read_screen',
            input: {}
          }
        ],
        finishReason: 'toolCalls',
        usage: {
          inputTokens: 10,
          outputTokens: 2
        }
      } ]);
      const waiting = await runToEnd(req, chat, 'Show me the hero');
      assert.equal(waiting.status, 'waiting');
      const stopped = await apos.assistant.stop(req, chat._id);
      assert.equal(stopped.status, 'stopped');
      assert.equal(stopped.asks, null);
      assert.deepEqual(stopped.messages.at(-1).content.map(part => part.output), [
        { answered: false },
        {
          executed: false,
          reason: 'stopped'
        }
      ]);
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest, null);
      // The browser tab's late answer finds nothing waiting
      await assert.rejects(apos.assistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-t_show',
        answer: { executed: true },
        screen: { tabId: 'tab-1' }
      }), { name: 'conflict' });
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
        args: {},
        whenHidden: { executed: true }
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

  async function runToEnd(req, chat, message, tabId = 'tab-1') {
    await apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId }
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

function newGate() {
  const gate = { started: false };
  gate.promise = new Promise(resolve => {
    gate.open = resolve;
  });
  return gate;
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
