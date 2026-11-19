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
  const usageRecords = [];

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
        'assistant-long-chat-usage': {
          handlers() {
            return {
              '@apostrophecms/ai:usage': {
                record(req, usage) {
                  usageRecords.push(usage);
                }
              }
            };
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
      // Silent: no summary, so no divider
      const shortened = await apos.assistant.getChat(req, chat._id);
      const panel = apos.assistant.renderChat(shortened, { thread: true });
      assert.equal(panel.summary, null);
      assert.equal(panel.checkpoints, undefined);

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

  describe('inside a request', function () {
    const tooLong = () => {
      throw apos.error('aiContextOverflow', 'prompt is too long');
    };

    it('finishes a request whose reads outgrow the budget mid-way in one request over two runs', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      // The third step's count is past the 4000 threshold
      script = sequence([
        readTurn('m-1', 'one'),
        readTurn('m-2', 'two'),
        readTurn('m-3', 'three', 4500),
        textTurn('Read all three.', 2000)
      ]);
      const request = await runToEnd(req, chat, 'Read three pages');
      assert.equal(request.status, 'completed');
      assert.equal(request.finishReason, 'stop');
      assert.equal(calls.length, 4);
      // The run paused after the third step; the next run replays the
      // first read cleared, the last two rounds whole
      const resumed = Object.fromEntries(toolResults(calls[3].messages)
        .map(result => [ result.toolCallId, result.output ]));
      assert.equal(resumed['m-1'].cleared, true);
      assert.equal(resumed['m-1'].tool, 't_read');
      assert.equal(resumed['m-2'].page, 'two');
      assert.equal(resumed['m-3'].page, 'three');
      assertStandsOnItsOwn(calls[3].messages);
      assert.deepEqual(userTexts(calls[3].messages), [ 'Read three pages' ]);

      // One record holds the whole request, every result as it was read
      const requests = await apos.assistant.getChatRequests(req, chat._id);
      assert.equal(requests.length, 1);
      assert.deepEqual(toolResults(request.messages).map(result => result.output.page),
        [ 'one', 'two', 'three' ]);
      assert.deepEqual(replies(request.messages), [ 'Read all three.' ]);
      assert.deepEqual(request.usage, {
        inputTokens: 100 + 100 + 4500 + 2000,
        outputTokens: 40
      });
      assert.deepEqual(request.lastStepUsage, {
        inputTokens: 2000,
        outputTokens: 10
      });
      assert.equal(request.jobId && typeof request.jobId, 'string');

      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.equal(checkpoints.length, 1);
      assert.equal(checkpoints[0].sequence, request.sequence);
      assert.deepEqual(checkpoints[0].calls, [ 'm-1' ]);
      assert(checkpoints[0].before > 4000);

      // The next send replays the cleared read as cleared
      calls.length = 0;
      script = null;
      await runToEnd(req, chat, 'Thanks');
      const replayed = toolResults(calls[0].messages);
      assert.equal(replayed.find(result => result.toolCallId === 'm-1').output.cleared, true);
      assertStandsOnItsOwn(calls[0].messages);
    });

    it('keeps running past the threshold while there is nothing to clear', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([
        readTurn('n-1', 'one', 4500),
        readTurn('n-2', 'two', 4600),
        textTurn('Read both.', 4700)
      ]);
      const request = await runToEnd(req, chat, 'Read two pages');
      assert.equal(request.status, 'completed');
      assert.equal(calls.length, 3);
      assert.equal((await apos.assistant.getChat(req, chat._id)).checkpoints, undefined);
    });

    it('shortens further and tries once again when the provider refuses a request as too long', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([ readTurn('o-1', 'one'), textTurn('Read one.', 100) ]);
      await runToEnd(req, chat, 'Read one');
      script = sequence([ readTurn('o-2', 'two'), textTurn('Read two.', 100) ]);
      await runToEnd(req, chat, 'Read two');

      // Under the threshold by the count, yet refused
      calls.length = 0;
      script = sequence([ tooLong, textTurn('Fits now.', 100) ]);
      const request = await runToEnd(req, chat, 'Go on');
      assert.equal(request.status, 'completed');
      assert.equal(request.overflowRetried, true);
      assert.equal(request.error, undefined);
      assert.deepEqual(replies(request.messages), [ 'Fits now.' ]);
      assert.equal(calls.length, 2);
      // The first try sent both reads; the second, none of the earlier
      // requests kept
      assert(toolResults(calls[0].messages).every(result => !result.output.cleared));
      assert(toolResults(calls[1].messages).every(result => result.output.cleared));
      assert.deepEqual(userTexts(calls[1].messages), [ 'Read one', 'Read two', 'Go on' ]);
      assertStandsOnItsOwn(calls[1].messages);
      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.deepEqual(checkpoints.map(checkpoint => checkpoint.calls), [ [ 'o-1', 'o-2' ] ]);
    });

    it('fails a request that still can\'t fit, and the chat answers the next message', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([ readTurn('f-1', 'one'), textTurn('Read one.', 100) ]);
      await runToEnd(req, chat, 'Read one');

      calls.length = 0;
      script = sequence([
        readTurn('f-2', 'two'),
        readTurn('f-3', 'three'),
        tooLong,
        readTurn('f-4', 'four'),
        tooLong
      ]);
      const failed = await runToEnd(req, chat, 'Read everything');
      assert.equal(failed.status, 'failed');
      assert.equal(failed.error.name, 'aiContextOverflow');
      assert.equal(failed.overflowRetried, true);
      assert.equal(calls.length, 5);
      // The retry cleared the earlier request's read and the request's own
      // but its last round
      const retried = Object.fromEntries(toolResults(calls[3].messages)
        .map(result => [ result.toolCallId, result.output ]));
      assert.equal(retried['f-1'].cleared, true);
      assert.equal(retried['f-2'].cleared, true);
      assert.equal(retried['f-3'].page, 'three');
      // Stored as read
      assert.deepEqual(toolResults(failed.messages).map(result => result.output.page),
        [ 'two', 'three', 'four' ]);

      calls.length = 0;
      script = null;
      const next = await runToEnd(req, chat, 'Go on');
      assert.equal(next.status, 'completed');
      // The failed request is replayed as far as it got, without its reads
      const sent = calls[0].messages;
      assert.deepEqual(userTexts(sent), [ 'Read one', 'Read everything', 'Go on' ]);
      assert(toolResults(sent).every(result => result.output.cleared));
      assertStandsOnItsOwn(sent);
      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.deepEqual(checkpoints.at(-1).calls.sort(), [ 'f-1', 'f-2', 'f-3', 'f-4' ]);
    });

    it('fails at once when a refused request has nothing to clear', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([ tooLong ]);
      const failed = await runToEnd(req, chat, 'Hello');
      assert.equal(failed.status, 'failed');
      assert.equal(failed.error.name, 'aiContextOverflow');
      assert.equal(failed.overflowRetried, undefined);
      assert.equal(calls.length, 1);
      script = null;
      const next = await runToEnd(req, chat, 'Hello again');
      assert.equal(next.status, 'completed');
    });
  });

  describe('summaries', function () {
    // Threshold 6000 and target 4000 of the 8000 budget
    beforeEach(function () {
      apos.assistant.options.contextThreshold = 75;
    });
    afterEach(function () {
      apos.assistant.options.contextThreshold = 50;
      delete apos.assistant.options.summaryEffort;
    });

    it('parses the outline as the models write it', function () {
      const marked = apos.assistant.parseSummary([
        '- **STANDING INSTRUCTIONS:**',
        '  - "Always use British spelling from now on." (from the first request)',
        '  - “Reply in one line.”',
        '- **DECISIONS:**',
        '  - Read doc-1 and changed its title',
        '    in the same step.',
        '- **CHANGES:** none',
        '## OPEN THREADS',
        '- none',
        'LEARNED ABOUT THE SITE',
        '1. Pages are long.'
      ].join('\n'));
      assert.deepEqual(marked, {
        instructions: [ 'Always use British spelling from now on.', 'Reply in one line.' ],
        decisions: [ 'Read doc-1 and changed its title in the same step.' ],
        changes: [],
        threads: [],
        learned: [ 'Pages are long.' ]
      });
      // An item that starts like a heading is still an item
      assert.deepEqual(apos.assistant.parseSummary('DECISIONS\n- Decisions: none taken yet').decisions,
        [ 'Decisions: none taken yet' ]);
      assert.equal(apos.assistant.parseSummary('I could not summarize this chat.'), null);
    });

    it('replaces older requests by a summary written as one more step of the chat when tier 1 is not enough', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      const [ first ] = await buildLongChat(req, chat, 's');
      const lastSystem = calls.at(-1).system;
      const published = watchPublish();
      calls.length = 0;
      usageRecords.length = 0;
      script = summarizing(() => summaryTurn({
        instructions: [
          '"Always use British spelling   from now on." (from the first request)',
          '"first: words words words"'
        ],
        decisions: [ 'Read the pages in order.' ]
      }), [ textTurn('Next.', 100) ]);
      let next;
      try {
        next = await runToEnd(req, chat, 'What next?');
      } finally {
        published.restore();
      }
      assert.equal(next.status, 'completed');
      assert.equal(calls.length, 2);

      // The summary step: the chat as last sent, its tools, one more message
      const [ step, run ] = calls;
      assert.equal(step.system, lastSystem);
      assert.equal(step.model, 'fake-large');
      const names = call => call.tools.map(tool => tool.name);
      assert.deepEqual(names(step), names(run));
      const asked = userTexts(step.messages);
      assert.deepEqual(asked.slice(0, -1), [
        'Always use British spelling from now on. Read first', 'Read second', 'Read third'
      ]);
      assert.match(asked.at(-1), new RegExp(`up to the end of request ${first._id}`));
      assert(toolResults(step.messages).every(result => !result.output.cleared));
      assert(published.events.some(({ stage, data }) => (stage === 'summary') &&
        (data.requestId === next._id)));

      // The run: the summary in the instructions, the first request gone
      assert.match(run.system, /Earlier messages of this chat were replaced by this summary/);
      assert.match(run.system, /STANDING INSTRUCTIONS:\n- Always use British spelling {3}from now on\./);
      assert.match(run.system, /DECISIONS:\n- Read the pages in order\./);
      assert.doesNotMatch(run.system, /words words/);
      assert.deepEqual(userTexts(run.messages), [ 'Read second', 'Read third', 'What next?' ]);
      assert.deepEqual(toolResults(run.messages).map(result => result.toolCallId), [ 's-2', 's-3' ]);
      assertStandsOnItsOwn(run.messages);

      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.equal(checkpoints.length, 1);
      const [ checkpoint ] = checkpoints;
      assert.equal(checkpoint.sequence, next.sequence);
      assert.deepEqual(checkpoint.calls, [ 's-1' ]);
      assert.equal(checkpoint.summary.covers, first.sequence);
      assert.deepEqual(checkpoint.summary.instructions, [ 'Always use British spelling   from now on.' ]);
      assert(checkpoint.summaryUsage.inputTokens > 0);
      assert(checkpoint.after < checkpoint.before);
      assert.deepEqual(usageRecords.map(record => record.metadata.purpose), [ 'summary', 'request' ]);

      // Under the threshold again: the summary stays, nothing new is made
      calls.length = 0;
      script = null;
      await runToEnd(req, chat, 'Thanks');
      assert.equal(calls.length, 1);
      assert.match(calls[0].system, /Always use British spelling/);
      assert.deepEqual(userTexts(calls[0].messages),
        [ 'Read second', 'Read third', 'What next?', 'Thanks' ]);
      assert.equal((await apos.assistant.getChat(req, chat._id)).checkpoints.length, 1);
    });

    it('folds the current summary into the next one', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      const [ , second ] = await buildLongChat(req, chat, 'g');
      script = summarizing(() => summaryTurn({
        instructions: [ 'Always use British spelling from now on.' ],
        decisions: [ 'First decision.' ]
      }), [ textTurn('Next.', 7000) ]);
      await runToEnd(req, chat, 'What next?');

      calls.length = 0;
      script = summarizing(() => summaryTurn({
        instructions: [ 'Always use British spelling from now on.' ],
        decisions: [ 'First decision.', 'Second decision.' ]
      }), [ textTurn('Going on.', 100) ]);
      await runToEnd(req, chat, 'Go on');
      const [ step, run ] = calls;
      // The second step reads the first summary where the chat keeps it
      assert.match(step.system, /DECISIONS:\n- First decision\./);
      assert.match(userTexts(step.messages).at(-1), new RegExp(`request ${second._id}.*Fold in the summary`, 's'));
      assert.deepEqual(userTexts(step.messages).slice(0, -1),
        [ 'Read second', 'Read third', 'What next?' ]);
      assert.match(run.system, /DECISIONS:\n- First decision\.\n- Second decision\./);
      assert.deepEqual(userTexts(run.messages), [ 'Read third', 'What next?', 'Go on' ]);
      assertStandsOnItsOwn(run.messages);

      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.equal(checkpoints.length, 2);
      assert.equal(checkpoints[1].summary.covers, second.sequence);
      assert.deepEqual(checkpoints[1].calls, [ 'g-1', 'g-2' ]);
      // An instruction from a request the chat no longer replays still stands
      assert.deepEqual(checkpoints[1].summary.instructions,
        [ 'Always use British spelling from now on.' ]);
    });

    it('falls back to a call of its own when the summary step calls a tool', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      await buildLongChat(req, chat, 'b');
      calls.length = 0;
      script = (request) => {
        if (isSeparateSummary(request)) {
          return summaryTurn({ decisions: [ 'Written apart.' ] });
        }
        if (isSummaryStep(request)) {
          return readTurn('b-x', 'more');
        }
        return textTurn('Next.', 100);
      };
      const next = await runToEnd(req, chat, 'What next?');
      assert.equal(next.status, 'completed');
      assert.equal(calls.filter(isSummaryStep).length, 1);
      assert.equal(calls.filter(isSeparateSummary).length, 1);
      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.deepEqual(checkpoints[0].summary.decisions, [ 'Written apart.' ]);
      // The tool the step asked for never ran
      assert(!toolResults(next.messages).some(result => result.toolCallId === 'b-x'));
    });

    it('writes the summary on summaryEffort in calls of their own, oldest first in slices', async function () {
      apos.assistant.options.summaryEffort = 'low';
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      await buildLongChat(req, chat, 'e');
      calls.length = 0;
      let slice = 0;
      script = summarizing(() => summaryTurn({
        instructions: [ 'Always use British spelling from now on.' ],
        decisions: [ `Slice ${++slice}.` ]
      }), [ textTurn('Next.', 100) ]);
      await runToEnd(req, chat, 'What next?');
      const summaries = calls.filter(isSeparateSummary);
      // The 2000-token window of the low route leaves 1000 per slice
      assert(summaries.length >= 2);
      assert.equal(calls.filter(isSummaryStep).length, 0);
      for (const call of summaries) {
        assert.equal(call.model, 'fake-small');
        assert(!call.tools?.length);
        assert(apos.assistant.estimateTokens(JSON.stringify(call.messages)) < 2000);
      }
      const texts = call => call.messages[0].content.map(part => part.text);
      assert.match(texts(summaries[0])[0], /^The chat:\nEDITOR: Request id/);
      assert.match(texts(summaries[1])[0], /^The summary of the chat before this part:\n/);
      assert.match(texts(summaries[1])[0], /- Slice 1\./);
      const run = calls.at(-1);
      assert.equal(run.model, 'fake-large');
      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.deepEqual(checkpoints[0].summary.decisions, [ `Slice ${summaries.length}.` ]);
      assert.deepEqual(checkpoints[0].summary.instructions,
        [ 'Always use British spelling from now on.' ]);
      assert(usageRecords.filter(record => record.metadata.purpose === 'summary').length >=
        summaries.length);
    });

    it('summarizes the earlier requests when a request outgrows its budget mid-way', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([ readTurn('i-1', 'one'), textTurn('Read one.', 100) ]);
      const first = await runToEnd(req, chat, 'Never use emojis. Read one');
      script = sequence([ readTurn('i-2', 'two'), textTurn('Read two.', 100) ]);
      const second = await runToEnd(req, chat, 'Read two');

      calls.length = 0;
      script = summarizing(() => summaryTurn({
        instructions: [ 'Never use emojis.' ]
      }), [
        readTurn('i-3', 'three'),
        readTurn('i-4', 'four', 7000),
        textTurn('Read both.', 2000)
      ]);
      const request = await runToEnd(req, chat, 'Read three and four');
      assert.equal(request.status, 'completed');
      const step = calls.find(isSummaryStep);
      // The step continues the run as it was sent, its last round answered
      assert.equal(step.messages.at(-2).role, 'tool');
      assert.match(userTexts(step.messages).at(-1), new RegExp(`request ${second._id}`));
      const resumed = calls.at(-1);
      assert.match(resumed.system, /Never use emojis\./);
      assert.deepEqual(userTexts(resumed.messages), [ 'Read three and four' ]);
      assertStandsOnItsOwn(resumed.messages);
      assert.deepEqual(toolResults(request.messages).map(result => result.output.page),
        [ 'three', 'four' ]);
      const { checkpoints } = await apos.assistant.getChat(req, chat._id);
      assert.equal(checkpoints.length, 1);
      assert.equal(checkpoints[0].sequence, request.sequence);
      assert.equal(checkpoints[0].summary.covers, second.sequence);
      assert(first.sequence < second.sequence);
    });

    it('summarizes in a call of its own when the provider refuses a request as too long', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      script = sequence([ textTurn('Noted.', 100) ]);
      await runToEnd(req, chat, `Keep it short. ${'Some background. '.repeat(600)}`);
      script = sequence([ readTurn('v-1', 'one'), textTurn('Read one.', 100) ]);
      await runToEnd(req, chat, 'Read one');

      calls.length = 0;
      script = summarizing(() => summaryTurn({
        instructions: [ 'Keep it short.' ]
      }), [
        () => {
          throw apos.error('aiContextOverflow', 'prompt is too long');
        },
        textTurn('Fits now.', 100)
      ]);
      const request = await runToEnd(req, chat, 'Go on');
      assert.equal(request.status, 'completed');
      assert.equal(request.overflowRetried, true);
      // The refused transcript can't be sent again: the summary is a call
      // of its own
      assert.equal(calls.filter(isSummaryStep).length, 0);
      assert.equal(calls.filter(isSeparateSummary).length >= 1, true);
      const retried = calls.at(-1);
      assert.match(retried.system, /Keep it short\./);
      assert.deepEqual(userTexts(retried.messages), [ 'Go on' ]);
    });

    it('drops the checkpoints a revert reaches and keeps a standing instruction only when the editor wrote it outside reverted work', async function () {
      const req = userReq();
      const chat = await apos.assistant.createChat(req);
      const [ first ] = await buildLongChat(req, chat, 'r');
      script = summarizing(() => summaryTurn({
        instructions: [ 'Always use British spelling from now on.' ]
      }), [ textTurn('Next.', 7000) ]);
      const fourth = await runToEnd(req, chat, 'What next? Keep titles short.');
      script = summarizing(() => summaryTurn({
        instructions: [ 'Always use British spelling from now on.', 'Keep titles short.' ]
      }), [ textTurn('Going on.', 100) ]);
      const fifth = await runToEnd(req, chat, 'Go on');
      assert.equal((await apos.assistant.getChat(req, chat._id)).checkpoints.length, 2);

      // Reverting the request whose send made the second checkpoint falls
      // back to the first
      await revert(chat, fifth);
      let stored = await apos.assistant.getChat(req, chat._id);
      assert.deepEqual(stored.checkpoints.map(checkpoint => checkpoint.sequence),
        [ fourth.sequence ]);
      const later = { sequence: fifth.sequence + 1 };
      let transcript = await apos.assistant.getTranscript(stored, later);
      assert.deepEqual(userTexts(transcript), [ 'Read second', 'Read third', 'What next? Keep titles short.' ]);

      // Reverting the request that made the first falls back to the whole chat
      await revert(chat, fourth);
      stored = await apos.assistant.getChat(req, chat._id);
      assert.deepEqual(stored.checkpoints, []);
      transcript = await apos.assistant.getTranscript(stored, later);
      assert.deepEqual(userTexts(transcript),
        [ 'Always use British spelling from now on. Read first', 'Read second', 'Read third' ]);
      assert(toolResults(transcript).every(result => !result.output.cleared));

      // "Keep titles short." was written in reverted work only
      const checked = await apos.assistant.checkInstructions(stored, {
        instructions: [
          'Always use  British spelling from now on.',
          'Keep titles short.',
          'first: words words'
        ]
      });
      assert.deepEqual(checked.instructions, [ 'Always use  British spelling from now on.' ]);
      assert(first.sequence < fourth.sequence);
    });

    describe('continue in a new chat', function () {
      // A chat whose current summary covers its first request, the
      // requests made, and the request whose send summarized
      async function buildSummarizedChat(req, prefix) {
        const chat = await apos.assistant.createChat(req);
        const [ first, second, third ] = await buildLongChat(req, chat, prefix);
        script = summarizing(() => summaryTurn({
          instructions: [ 'Always use British spelling from now on.' ],
          decisions: [ 'Read the pages in order.' ],
          changes: [ 'Nothing changed yet.' ],
          threads: [ 'The fourth page is still to read.' ],
          learned: [ 'Pages are long.' ]
        }), [ textTurn('Next.', 100) ]);
        const fourth = await runToEnd(req, chat, 'What next?');
        return {
          chat: await apos.assistant.getChat(req, chat._id),
          requests: [ first, second, third, fourth ]
        };
      }

      async function continueFrom(req, chat, request, chatId = apos.util.generateId()) {
        await apos.assistant.continueInNewChat(req, chat._id, {
          requestId: request._id,
          chatId
        });
        let continued;
        await waitFor(async () => {
          continued = await apos.assistant.getChat(req, chatId);
          const job = continued.carry?.jobId &&
            await apos.modules['@apostrophecms/job'].db.findOne({ _id: continued.carry.jobId });
          return (continued.carry?.status !== 'running') && (!job || job.ended);
        });
        return continued;
      }

      it('reuses the current summary when it ends at the request, with no model call', async function () {
        const req = userReq();
        const { chat, requests: [ first ] } = await buildSummarizedChat(req, 'c1');
        calls.length = 0;
        const continued = await continueFrom(req, chat, first);
        assert.equal(calls.length, 0);
        assert.equal(continued.carry, null);
        assert.equal(continued.title, null);
        assert.deepEqual(continued.continuedFrom, {
          chatId: chat._id,
          requestId: first._id,
          title: chat.title
        });
        assert.deepEqual(continued.carried.summary.instructions,
          [ 'Always use British spelling from now on.' ]);
        assert.equal(continued.carried.summary.covers, undefined);
        // The source chat is as it was
        const after = await apos.assistant.getChat(req, chat._id);
        assert.deepEqual(after.checkpoints, chat.checkpoints);

        // The new chat's first request reads the carried summary, dated, and
        // nothing of the earlier chat's messages
        script = null;
        await runToEnd(req, continued, 'Now the contact page');
        const [ run ] = calls;
        assert.match(run.system, /carried over on \d{4}-\d{2}-\d{2}/);
        assert.match(run.system, /STANDING INSTRUCTIONS:\n- Always use British spelling from now on\./);
        assert.doesNotMatch(run.system, /Earlier messages of this chat were replaced/);
        assert.deepEqual(userTexts(run.messages), [ 'Now the contact page' ]);
      });

      it('folds the requests after the summary up to the request into it, nothing later', async function () {
        const req = userReq();
        const { chat, requests: [ , second ] } = await buildSummarizedChat(req, 'c2');
        calls.length = 0;
        usageRecords.length = 0;
        script = summarizing(() => summaryTurn({
          instructions: [ 'Always use British spelling from now on.', 'Read second' ],
          decisions: [ 'Read the pages in order.', 'Second read.' ]
        }), []);
        const continued = await continueFrom(req, chat, second);
        assert.equal(continued.carry, null);
        assert.equal(calls.length, 1);
        assert(isSeparateSummary(calls[0]));
        const text = calls[0].messages[0].content.map(part => part.text).join('\n');
        assert.match(text, /DECISIONS:\n- Read the pages in order\./);
        assert.match(text, /EDITOR: .*Read second/);
        assert.doesNotMatch(text, /Read third|What next\?|Read first/);
        assert.deepEqual(usageRecords.map(record => record.metadata.purpose), [ 'summary' ]);
        // Instructions are checked against the earlier chat
        assert.deepEqual(continued.carried.summary.instructions,
          [ 'Always use British spelling from now on.', 'Read second' ]);
        assert.deepEqual(continued.carried.summary.decisions,
          [ 'Read the pages in order.', 'Second read.' ]);
      });

      it('summarizes the stored chat up to the request when no summary ends before it', async function () {
        const req = userReq();
        const chat = await apos.assistant.createChat(req);
        script = null;
        const first = await runToEnd(req, chat, 'Always use British spelling from now on. Read first');
        await runToEnd(req, chat, 'Read second');
        calls.length = 0;
        script = summarizing(() => summaryTurn({
          instructions: [ 'Always use British spelling from now on.' ]
        }), []);
        const continued = await continueFrom(req, chat, first);
        assert.equal(calls.length, 1);
        const text = calls[0].messages[0].content.map(part => part.text).join('\n');
        assert.match(text, /^The chat:/);
        assert.doesNotMatch(text, /Read second/);
        assert.deepEqual(continued.carried.summary.instructions,
          [ 'Always use British spelling from now on.' ]);
      });

      it('is refused while the chat runs, and takes no message until its carry is done', async function () {
        const req = userReq();
        const chat = await apos.assistant.createChat(req);
        script = null;
        const first = await runToEnd(req, chat, 'Read first');
        await apos.assistant.chats.updateOne({ _id: chat._id }, {
          $set: {
            openRequest: {
              _id: 'elsewhere',
              tabId: 'tab-2',
              status: 'running'
            }
          }
        });
        try {
          await assert.rejects(continueFrom(req, chat, first),
            e => e.data?.reason === 'requestOpen');
        } finally {
          await apos.assistant.chats.updateOne({ _id: chat._id }, {
            $set: { openRequest: null }
          });
        }

        // A summary that can't be read fails the carry: no message is taken
        script = () => textTurn('I can not.', 50);
        const chatId = apos.util.generateId();
        const failed = await continueFrom(req, chat, first, chatId);
        assert.equal(failed.carry.status, 'failed');
        await assert.rejects(apos.assistant.send(req, chatId, {
          message: 'Hello',
          screen: { tabId: 'tab-1' }
        }), e => e.data?.reason === 'carrying');

        // The same id starts it again
        script = summarizing(() => summaryTurn({ decisions: [ 'Read first.' ] }), []);
        const continued = await continueFrom(req, chat, first, chatId);
        assert.equal(continued.carry, null);
        assert.deepEqual(continued.carried.summary.decisions, [ 'Read first.' ]);
        // Another request's id, or another chat's, is not found
        const other = apos.util.generateId();
        await assert.rejects(apos.assistant.continueInNewChat(req, other, {
          requestId: first._id,
          chatId
        }), e => e.name === 'notfound');
      });

      it('fails a carry whose process died', async function () {
        const req = userReq();
        const chat = await apos.assistant.createChat(req);
        script = null;
        const first = await runToEnd(req, chat, 'Read first');
        const chatId = apos.util.generateId();
        await apos.assistant.createChat(req, {
          _id: chatId,
          continuedFrom: {
            chatId: chat._id,
            requestId: first._id,
            title: chat.title
          }
        });
        const old = new Date(Date.now() - (2 * apos.modules['@apostrophecms/job'].options.abandonAfter));
        await apos.assistant.chats.updateOne({ _id: chatId }, {
          $set: { 'carry.updatedAt': old }
        });
        const reconciled = await apos.assistant.reconcileChat(req,
          await apos.assistant.getChat(req, chatId));
        assert.equal(reconciled.carry.status, 'failed');
      });

      it('keeps carried instructions in the new chat\'s own summaries', async function () {
        const req = userReq();
        const { chat, requests: [ first ] } = await buildSummarizedChat(req, 'c3');
        const continued = await continueFrom(req, chat, first);
        const checked = await apos.assistant.checkInstructions(continued, {
          instructions: [ 'Always use British spelling from now on.', 'Made up.' ]
        });
        assert.deepEqual(checked.instructions, [ 'Always use British spelling from now on.' ]);

        // Its first summary folds in the carried one, which stays for
        // "Continued from"
        await buildLongChat(req, continued, 'c3n');
        calls.length = 0;
        script = summarizing(() => summaryTurn({
          instructions: [ 'Always use British spelling from now on.' ],
          decisions: [ 'Kept going.' ]
        }), [ textTurn('Next.', 100) ]);
        await runToEnd(req, continued, 'What next?');
        const [ step, run ] = calls;
        assert.match(step.system, /carried over on/);
        assert.match(run.system, /Earlier messages of this chat were replaced/);
        assert.doesNotMatch(run.system, /carried over on/);
        const stored = await apos.assistant.getChat(req, continued._id);
        assert.deepEqual(stored.checkpoints.at(-1).summary.instructions,
          [ 'Always use British spelling from now on.' ]);
        assert(stored.carried.summary);
      });

      it('leaves either chat as it is when the other reverts', async function () {
        const req = userReq();
        const chat = await apos.assistant.createChat(req);
        script = null;
        const first = await runToEnd(req, chat, 'Always use British spelling. Read first');
        const second = await runToEnd(req, chat, 'Read second');
        script = summarizing(() => summaryTurn({ instructions: [ 'Always use British spelling.' ] }), []);
        const continued = await continueFrom(req, chat, first);
        script = null;
        const own = await runToEnd(req, continued, 'Go on');

        await revert(continued, own);
        let source = await apos.assistant.getChatRequests(req, chat._id);
        assert(source.every(request => !request.revertId));
        await revert(chat, second);
        source = await apos.assistant.getChatRequests(req, chat._id);
        assert.deepEqual(source.map(request => Boolean(request.revertId)),
          [ false, true ]);
        const stored = await apos.assistant.getChat(req, continued._id);
        assert.deepEqual(stored.carried.summary.instructions, [ 'Always use British spelling.' ]);
        const ownRequests = await apos.assistant.getChatRequests(req, continued._id);
        assert.equal(ownRequests.length, 1);
        assert(ownRequests[0].revertId);
      });

      it('shows the panel the summary\'s instructions, its length and the suggestion after every third summary', async function () {
        const req = userReq();
        const { chat } = await buildSummarizedChat(req, 'c4');
        const panel = apos.assistant.renderChat(chat, { thread: true });
        assert.equal(panel.checkpoints, undefined);
        // The editor's instructions only
        assert.deepEqual(panel.summary, {
          instructions: [ 'Always use British spelling from now on.' ],
          covers: chat.checkpoints[0].summary.covers
        });
        assert.equal(panel.carriedSummary, null);
        assert.equal(panel.suggestion, null);
        assert.equal(apos.assistant.renderChat(chat).summary, undefined);

        const length = await apos.assistant.getChatLength(chat);
        assert.equal(length.threshold, 6000);
        assert(length.measure > 0);

        // Three summaries: suggested under the request whose send made the
        // third, until dismissed
        const written = {
          ...chat.checkpoints[0],
          _id: 'third'
        };
        const three = {
          ...chat,
          checkpoints: [ chat.checkpoints[0], chat.checkpoints[0], written ]
        };
        assert.deepEqual(apos.assistant.renderChat(three, { thread: true }).suggestion, {
          _id: 'third',
          sequence: written.sequence
        });
        assert.equal(apos.assistant.renderChat({
          ...three,
          dismissedSuggestion: 'third'
        }, { thread: true }).suggestion, null);
        await apos.assistant.dismissSuggestion(req, chat._id, 'third');
        assert.equal((await apos.assistant.getChat(req, chat._id)).dismissedSuggestion, 'third');
      });
    });

    // Three requests, the last counted past the 6000 threshold: tier 1
    // clears the first one's read and leaves the chat over the target
    async function buildLongChat(req, chat, prefix) {
      script = sequence([ readTurn(`${prefix}-1`, 'first'), textTurn('Read first.', 100) ]);
      const first = await runToEnd(req, chat, 'Always use British spelling from now on. Read first');
      script = sequence([ readTurn(`${prefix}-2`, 'second'), textTurn('Read second.', 100) ]);
      const second = await runToEnd(req, chat, 'Read second');
      script = sequence([ readTurn(`${prefix}-3`, 'third'), textTurn('Read third.', 7000) ]);
      const third = await runToEnd(req, chat, 'Read third');
      return [ first, second, third ];
    }

    // Summary calls answered by `summary`, the rest by `turns` in order
    function summarizing(summary, turns) {
      const rest = sequence(turns);
      return (request) => ((isSummaryStep(request) || isSeparateSummary(request))
        ? summary(request)
        : rest(request));
    }

    function watchPublish() {
      const events = [];
      const original = apos.assistant.publish;
      apos.assistant.publish = async (req, chatId, stage, data) => {
        events.push({
          stage,
          data
        });
        return original(req, chatId, stage, data);
      };
      return {
        events,
        restore() {
          apos.assistant.publish = original;
        }
      };
    }

    async function revert(chat, request) {
      const started = await apos.assistant.revert(userReq(), chat._id, {
        requestId: request._id,
        tabId: 'tab-1'
      });
      await waitFor(async () => {
        const stored = await apos.assistant.getRevert(userReq(), started._id);
        return stored.status !== 'running';
      });
      const done = await apos.assistant.getRevert(userReq(), started._id);
      assert.equal(done.status, 'done');
    }
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

function readTurn(id, page, inputTokens = 100) {
  return {
    content: [ {
      type: 'toolCall',
      id,
      name: 't_read',
      input: { page }
    } ],
    finishReason: 'toolCalls',
    usage: {
      inputTokens,
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

function summaryTurn(sections) {
  const heading = (title, items) => [ title, ...(items?.length ? items : [ 'none' ]).map(item => `- ${item}`) ];
  return textTurn([
    ...heading('STANDING INSTRUCTIONS', sections.instructions),
    ...heading('DECISIONS', sections.decisions),
    ...heading('CHANGES', sections.changes),
    ...heading('OPEN THREADS', sections.threads),
    ...heading('LEARNED ABOUT THE SITE', sections.learned)
  ].join('\n'), 50);
}

// The summary as one more step of the chat
function isSummaryStep(request) {
  const last = request.messages.at(-1);
  return (last?.role === 'user') && Array.isArray(last.content) &&
    /^Summarize this chat up to/.test(last.content.at(-1)?.text || '');
}

// The summary as a call of its own
function isSeparateSummary(request) {
  return /^You summarize a chat/.test(request.system || '');
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
      'fake-large': { contextWindow: 8000 },
      // Small enough to slice a chat
      'fake-small': { contextWindow: 2000 }
    },
    validate() {},
    async chat() {
      throw new Error('never called under APOS_AI_MOCK');
    }
  };
}
