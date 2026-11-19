const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Long chats on the scripted mock: the budget, the measure, replay that
// never breaks on a cut-off request, and old reads cleared before a send
// once a chat is past its threshold.

describe('Assistant: long chats', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let script = null;
  const calls = [];

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock(req, request) {
              // Snapshot: the loop keeps growing request.messages
              calls.push({
                ...request,
                messages: [ ...request.messages ]
              });
              return script ? script(request) : { text: 'Done.' };
            }
          },
          init(self) {
            self.apos.ai.addAdapter(fakeAdapter());
          }
        },
        '@apostrophecms/assistant': {
          options: {
            enabled: true,
            effort: 'high',
            titleEffort: 'none',
            contextLimit: 10000,
            contextThreshold: 50
          }
        },
        'assistant-long-chat-tools': {
          init(self) {
            self.apos.ai.addTool({
              name: 't_read',
              description: 'Reads a long text.',
              tags: [ 'assistant' ],
              kind: 'query',
              input: {
                type: 'object',
                properties: { page: { type: 'string' } }
              },
              handler: async (req, { page }) => ({
                page,
                text: `${page}: ${'words '.repeat(400)}`
              })
            });
            self.apos.ai.addTool({
              name: 't_act',
              description: 'Changes something.',
              tags: [ 'assistant' ],
              kind: 'action',
              input: {
                type: 'object',
                properties: {}
              },
              handler: async () => ({ done: 'changed' })
            });
            self.apos.ai.addTool({
              name: 't_break',
              description: 'Breaks.',
              tags: [ 'assistant' ],
              kind: 'action',
              input: {
                type: 'object',
                properties: {}
              },
              handler: async () => {
                throw new Error('the tool broke');
              }
            });
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'long-chat-editor' });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    calls.length = 0;
  });

  describe('the budget', function () {
    it('is the model\'s window when contextLimit is above it, contextLimit otherwise or without a window', function () {
      // fake-large declares 8000, below the 10000 limit
      assert.equal(apos.assistant.getBudget(), 8000);
      assert.equal(apos.assistant.getThreshold(), 4000);
      apos.assistant.options.contextLimit = 6000;
      try {
        assert.equal(apos.assistant.getBudget(), 6000);
        // fake-medium declares no window
        apos.assistant.options.effort = 'medium';
        assert.equal(apos.assistant.getBudget(), 6000);
      } finally {
        apos.assistant.options.contextLimit = 10000;
        apos.assistant.options.effort = 'high';
      }
    });
  });

  describe('the measure', function () {
    const reply = text => ({
      role: 'assistant',
      content: [ {
        type: 'text',
        text
      } ]
    });
    let message;

    before(async function () {
      message = {
        message: 'Hi',
        screen: await apos.assistant.verifyScreen(userReq(), { tabId: 'tab-1' })
      };
    });

    it('starts from the provider\'s count of the latest request\'s last step', function () {
      const earlier = [
        {
          _id: 'r0',
          sequence: 0,
          lastStepUsage: {
            inputTokens: 999,
            outputTokens: 1
          },
          messages: [ reply('old') ]
        },
        {
          _id: 'r1',
          sequence: 1,
          lastStepUsage: {
            inputTokens: 3000,
            outputTokens: 20
          },
          messages: [ reply('x'.repeat(40)) ]
        }
      ];
      // The reply is the last step's output, already counted
      assert.equal(
        apos.assistant.measureSend({}, earlier, message),
        3020 + apos.assistant.estimateTokens([ apos.assistant.getUserMessage(message) ])
      );
    });

    it('adds what came after the last step and from requests without a count', function () {
      const results = {
        role: 'tool',
        content: [ {
          type: 'toolResult',
          toolCallId: 'c1',
          output: { text: 'y'.repeat(400) }
        } ]
      };
      const earlier = [
        {
          _id: 'r0',
          sequence: 0,
          lastStepUsage: {
            inputTokens: 3000,
            outputTokens: 20
          },
          messages: [ reply('calling'), results ]
        },
        {
          _id: 'r1',
          sequence: 1,
          messages: [ reply('z'.repeat(100)) ]
        }
      ];
      assert.equal(
        apos.assistant.measureSend({}, earlier, message),
        3020 + apos.assistant.estimateTokens([
          results,
          earlier[1].messages[0],
          apos.assistant.getUserMessage(message)
        ])
      );
    });

    it('starts from a checkpoint made after the latest count', function () {
      const earlier = [ {
        _id: 'r0',
        sequence: 0,
        lastStepUsage: {
          inputTokens: 9000,
          outputTokens: 20
        },
        messages: [ reply('old') ]
      } ];
      const chat = {
        checkpoints: [ {
          sequence: 1,
          calls: [],
          media: [],
          before: 9100,
          after: 2500
        } ]
      };
      assert.equal(
        apos.assistant.measureSend(chat, earlier, message),
        2500 + apos.assistant.estimateTokens([ apos.assistant.getUserMessage(message) ])
      );
    });
  });

  describe('replay', function () {
    it('answers the next two messages after a request that ran out of steps', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      apos.assistant.options.maxSteps = 1;
      try {
        script = () => readTurn('c-cut', 'one');
        const cut = await runToEnd(req, chat, 'Read everything');
        assert.equal(cut.finishReason, 'maxSteps');
      } finally {
        apos.assistant.options.maxSteps = 30;
      }
      script = null;
      for (const message of [ 'Next', 'And next' ]) {
        calls.length = 0;
        const request = await runToEnd(req, chat, message);
        assert.equal(request.status, 'completed');
        assert.equal(request.messages.at(-1).content[0].text, 'Done.');
        assertStandsOnItsOwn(calls[0].messages);
      }
    });

    it('replays a request that failed mid-way and leaves out one that never reached the model', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([ actTurn('c-break', 't_break') ]);
      const broken = await runToEnd(req, chat, 'Break mid-way');
      assert.equal(broken.status, 'failed');
      script = () => {
        throw apos.error('forbidden', 'no access');
      };
      const refused = await runToEnd(req, chat, 'Never reaches the model');
      assert.equal(refused.status, 'failed');
      script = null;
      calls.length = 0;
      const next = await runToEnd(req, chat, 'Go on');
      assert.equal(next.status, 'completed');
      const texts = userTexts(calls[0].messages);
      assert.deepEqual(texts, [ 'Break mid-way', 'Go on' ]);
      assertStandsOnItsOwn(calls[0].messages);
    });
  });

  describe('tier 1', function () {
    it('sends what it sent before while a chat is under its threshold', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      for (const [ index, page ] of [ 'a', 'b', 'c' ].entries()) {
        script = sequence([ readTurn(`c-small-${index}`, page), textTurn('Read.', 100) ]);
        await runToEnd(req, chat, `Read ${page}`);
      }
      calls.length = 0;
      script = null;
      await runToEnd(req, chat, 'Thanks');
      assert.equal((await apos.assistant.getChat(req, chat._id)).checkpoints, undefined);
      const results = toolResults(calls[0].messages);
      assert.equal(results.length, 3);
      assert(results.every(result => !result.output.cleared));
    });

    it('clears old read results past the threshold, keeping the last two requests, actions and every message', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([
        readTurn('c-1', 'first'),
        actTurn('c-2', 't_act'),
        textTurn('Read and changed.', 100)
      ]);
      await runToEnd(req, chat, 'Read first and change it');
      script = sequence([ readTurn('c-3', 'second'), textTurn('Read second.', 100) ]);
      await runToEnd(req, chat, 'Read second');
      // The provider counted past the 4000 threshold (8000 budget, 50%)
      script = sequence([ readTurn('c-4', 'third'), textTurn('Read third.', 4500) ]);
      await runToEnd(req, chat, 'Read third');

      calls.length = 0;
      script = null;
      const fourth = await runToEnd(req, chat, 'What did you read?');
      assert.equal(fourth.status, 'completed');
      const sent = calls[0].messages;
      const results = Object.fromEntries(toolResults(sent)
        .map(result => [ result.toolCallId, result.output ]));
      assert.deepEqual(results['c-1'], {
        cleared: true,
        tool: 't_read',
        input: { page: 'first' },
        note: results['c-1'].note
      });
      assert.match(results['c-1'].note, /still holds/);
      assert.deepEqual(results['c-2'], { done: 'changed' });
      assert.equal(results['c-3'].page, 'second');
      assert.equal(results['c-4'].page, 'third');
      assert.deepEqual(userTexts(sent), [
        'Read first and change it', 'Read second', 'Read third', 'What did you read?'
      ]);
      assert.deepEqual(replies(sent), [ 'Read and changed.', 'Read second.', 'Read third.' ]);
      assertStandsOnItsOwn(sent);

      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.equal(checkpoints.length, 1);
      const [ checkpoint ] = checkpoints;
      assert.equal(checkpoint.sequence, fourth.sequence);
      assert.deepEqual(checkpoint.calls, [ 'c-1' ]);
      assert.deepEqual(checkpoint.media, []);
      assert(checkpoint.before > 4000);
      assert(checkpoint.after < checkpoint.before);
      // The stored chat stays complete
      const [ first ] = await apos.assistant.getChatRequests(req, chat._id);
      assert.equal(toolResults(first.messages)[0].output.page, 'first');
      // The panel never reads the checkpoints
      const [ listed ] = (await apos.assistant.listChats(req))
        .filter(({ _id }) => _id === chat._id);
      assert.equal(listed.checkpoints, undefined);

      // Under the threshold again: the next send makes no checkpoint and
      // still replays the cleared read as cleared
      calls.length = 0;
      await runToEnd(req, chat, 'Thanks');
      const again = await apos.assistant.getChat(req, chat._id);
      assert.equal(again.checkpoints.length, 1);
      const cleared = toolResults(calls[0].messages).find(result => result.toolCallId === 'c-1');
      assert.equal(cleared.output.cleared, true);
    });

    it('replaces the images and documents of old requests with a line saying they were there', function () {
      const requests = [
        {
          _id: 'r0',
          sequence: 0,
          messages: [ {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Look at these'
              },
              {
                type: 'image',
                name: 'hero.png',
                image: {
                  data: 'a'.repeat(4000),
                  mediaType: 'image/png'
                }
              },
              {
                type: 'document',
                document: {
                  data: 'aGk=',
                  mediaType: 'application/pdf'
                }
              }
            ]
          } ]
        },
        {
          _id: 'r1',
          sequence: 1,
          messages: []
        },
        {
          _id: 'r2',
          sequence: 2,
          messages: []
        }
      ];
      const checkpoint = apos.assistant.clearOldReads({}, requests, {
        sequence: 3,
        keep: 2,
        before: 5000
      });
      assert.deepEqual(checkpoint.media, [ 'r0' ]);
      assert.deepEqual(checkpoint.calls, []);
      assert(checkpoint.after < 5000);
      const [ shortened ] = apos.assistant.applyCheckpoint(checkpoint, requests);
      assert.deepEqual(shortened.messages[0].content, [
        {
          type: 'text',
          text: 'Look at these'
        },
        {
          type: 'text',
          text: '[The image "hero.png" was shown here and later removed from the chat to save space.]'
        },
        {
          type: 'text',
          text: '[A document was shown here and later removed from the chat to save space.]'
        }
      ]);
      // Nothing new to clear: no checkpoint
      const again = { checkpoints: [ checkpoint ] };
      assert.equal(apos.assistant.clearOldReads(again, requests, {
        sequence: 4,
        keep: 2,
        before: 5000
      }), null);
    });
  });

  function userReq() {
    return apos.task.getReq({
      user: editor,
      mode: 'draft'
    });
  }

  async function runToEnd(req, chat, message) {
    await apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId: 'tab-1' }
    });
    let request;
    await waitFor(async () => {
      request = (await apos.assistant.getChatRequests(req, chat._id)).at(-1);
      const open = (await apos.assistant.getChat(req, chat._id)).openRequest;
      const job = request?.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: request.jobId });
      return request && (request.status !== 'running') && (open === null) &&
        (!job || job.ended);
    });
    return request;
  }

  function sequence(turns) {
    const queue = [ ...turns ];
    return (request) => {
      const next = queue.shift();
      return (typeof next === 'function') ? next(request) : (next || { text: 'Done.' });
    };
  }
});

function readTurn(id, page) {
  return {
    content: [ {
      type: 'toolCall',
      id,
      name: 't_read',
      input: { page }
    } ],
    finishReason: 'toolCalls',
    usage: {
      inputTokens: 100,
      outputTokens: 10
    }
  };
}

function actTurn(id, name) {
  return {
    content: [ {
      type: 'toolCall',
      id,
      name,
      input: {}
    } ],
    finishReason: 'toolCalls',
    usage: {
      inputTokens: 100,
      outputTokens: 10
    }
  };
}

function textTurn(text, inputTokens) {
  return {
    content: [ {
      type: 'text',
      text
    } ],
    finishReason: 'stop',
    usage: {
      inputTokens,
      outputTokens: 10
    }
  };
}

function toolResults(messages) {
  return messages
    .filter(message => message.role === 'tool')
    .flatMap(message => message.content);
}

// The editor's own words: a user message's last text part
function userTexts(messages) {
  return messages
    .filter(message => message.role === 'user')
    .map(message => message.content.at(-1).text);
}

function replies(messages) {
  return messages
    .filter(message => message.role === 'assistant')
    .flatMap(message => message.content)
    .filter(part => part.type === 'text')
    .map(part => part.text);
}

// Every tool call is answered by the message after it, as every provider
// requires
function assertStandsOnItsOwn(messages) {
  messages.forEach((message, index) => {
    const ids = (message.role === 'assistant')
      ? message.content.filter(part => part.type === 'toolCall').map(part => part.id)
      : [];
    if (!ids.length) {
      return;
    }
    const next = messages[index + 1];
    assert.equal(next?.role, 'tool');
    assert.deepEqual(
      next.content.map(part => part.toolCallId).sort(),
      [ ...ids ].sort()
    );
  });
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
    models: {
      'fake-large': { contextWindow: 8000 }
    },
    validate() {},
    async chat() {
      throw new Error('never called under APOS_AI_MOCK');
    }
  };
}
