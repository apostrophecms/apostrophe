const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Chats and the run on the scripted mock: one request at a time per chat,
// chats in parallel, the stored transcript replayed, the browser tab that
// sends owning the request, and asks answered, skipped or moved to another
// browser tab.

describe('Assistant: chats and the run', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let other;
  let note;
  // The model's turns: a function of the adapter request, or the default
  let script = null;
  const calls = [];
  const doors = [];
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
              calls.push(request);
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
            titleEffort: 'none'
          }
        },
        'assistant-usage-watch': {
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
        'assistant-note': {
          extend: '@apostrophecms/piece-type'
        },
        // Hidden from every role below admin
        'assistant-secret': {
          extend: '@apostrophecms/piece-type',
          options: {
            viewRole: 'admin'
          }
        },
        'assistant-test-tools': {
          init(self) {
            self.apos.ai.addTool({
              name: 't_door',
              description: 'Records the door context.',
              tags: [ 'assistant' ],
              kind: 'query',
              input: {
                type: 'object',
                properties: {}
              },
              handler: async (req) => {
                doors.push(self.apos.aposHarness.getDoor(req));
                return { ok: true };
              }
            });
            self.apos.ai.addTool({
              name: 't_throw',
              description: 'Breaks.',
              tags: [ 'assistant' ],
              input: {
                type: 'object',
                properties: {}
              },
              handler: async () => {
                throw new Error('the tool broke');
              }
            });
            self.apos.ai.addTool({
              name: 't_write',
              description: 'Renames a note.',
              tags: [ 'assistant' ],
              input: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  title: { type: 'string' }
                },
                required: [ '_id', 'title' ]
              },
              handler: async (req, { _id, title }) => {
                await self.apos.aposHarness.writeDocuments(req, [ {
                  _id,
                  patch: { title }
                } ]);
                return { ok: true };
              }
            });
            for (const kind of [ 'browser', 'test-question' ]) {
              self.apos.ai.addTool({
                name: `t_${kind.replace('-', '_')}`,
                description: `Suspends with a ${kind} ask.`,
                tags: [ 'assistant' ],
                input: {
                  type: 'object',
                  properties: {}
                },
                handler: async (req, args) => {
                  doors.push(self.apos.aposHarness.getDoor(req));
                  const input = args._context?.input;
                  if (input === undefined) {
                    throw self.apos.error('aiInput', 'waiting', {
                      kind,
                      what: 'something'
                    });
                  }
                  return input;
                }
              });
              self.apos.aposAssistant.addAskKind(kind, {
                accept(req, ask, answer) {
                  if (typeof answer !== 'string') {
                    throw self.apos.error('invalid', 'an answer is a string');
                  }
                  return {
                    answered: true,
                    answer
                  };
                }
              });
            }
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    other = await t.createAdmin(apos, { username: 'other' });
    note = await apos.modules['assistant-note'].insert(apos.task.getReq(), {
      title: 'A note'
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    calls.length = 0;
    doors.length = 0;
  });

  describe('chats', function () {
    it('creates, lists newest first and renames a chat', async function () {
      const req = userReq(editor);
      const first = await apos.aposAssistant.createChat(req);
      // Created apart, as an editor creates them
      await new Promise(resolve => setTimeout(resolve, 5));
      const second = await apos.aposAssistant.createChat(req);
      await apos.aposAssistant.createChat(userReq(other));
      assert.equal(first.title, null);
      assert.equal(first.openRequest, null);

      const listed = (await apos.aposAssistant.listChats(req)).map(chat => chat._id);
      assert.deepEqual(listed.slice(0, 2), [ second._id, first._id ]);
      assert(!listed.includes(undefined));
      assert.equal(listed.length, (await apos.aposAssistant.chats.countDocuments({
        ownerId: editor._id
      })));

      const renamed = await apos.aposAssistant.renameChat(req, first._id, '  Spring   launch ');
      assert.equal(renamed.title, 'Spring launch');
      await assert.rejects(apos.aposAssistant.renameChat(req, first._id, '  '), { name: 'invalid' });
    });

    it('keeps a chat private to its owner', async function () {
      const chat = await apos.aposAssistant.createChat(userReq(editor));
      const req = userReq(other);
      await assert.rejects(apos.aposAssistant.getChat(req, chat._id), { name: 'notfound' });
      await assert.rejects(apos.aposAssistant.renameChat(req, chat._id, 'Mine'), { name: 'notfound' });
      await assert.rejects(apos.aposAssistant.deleteChat(req, chat._id), { name: 'notfound' });
      await assert.rejects(send(req, chat, 'tab-1', 'Hello'), { name: 'notfound' });
      await assert.rejects(apos.aposAssistant.createChat(apos.task.getReq()), { name: 'forbidden' });
    });

    it('deletes a chat: its requests, its change log entries, then the chat', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = writeScript('Renamed by the chat');
      const request = await runToEnd(req, chat, 'tab-1', 'Rename the note');
      assert.equal(request.status, 'completed');
      const entries = await apos.aposHarness.changes.find({ chat: chat._id }).toArray();
      assert.equal(entries.length, 1);
      // Someone else's entry naming the same chat is not the owner's to delete
      await apos.aposHarness.changes.insertOne({
        _id: 'foreign-entry',
        chat: chat._id,
        userId: other._id
      });

      await apos.aposAssistant.deleteChat(req, chat._id);
      assert.equal(await apos.aposAssistant.chats.countDocuments({ _id: chat._id }), 0);
      assert.equal(
        await apos.aposAssistant.requests.countDocuments({ chatId: chat._id }),
        0
      );
      const left = await apos.aposHarness.changes.find({ chat: chat._id }).toArray();
      assert.deepEqual(left.map(entry => entry._id), [ 'foreign-entry' ]);
      await apos.aposHarness.changes.deleteOne({ _id: 'foreign-entry' });
    });

    it('takes the ids the browser names: a first send creates its chat, a second send of a request answers with it', async function () {
      const req = userReq(editor);
      const chat = { _id: 'named-chat' };
      const gate = holdModel();
      const request = await apos.aposAssistant.send(req, chat._id, {
        message: 'Hello',
        screen: { tabId: 'tab-1' },
        requestId: 'named-request',
        create: true
      });
      assert.equal(request._id, 'named-request');
      const created = await apos.aposAssistant.getChat(req, chat._id);
      assert.equal(created.openRequest._id, 'named-request');

      // Sent again, as after an answer that never arrived: nothing new runs
      const again = await apos.aposAssistant.send(req, chat._id, {
        message: 'Hello',
        screen: { tabId: 'tab-1' },
        requestId: 'named-request',
        create: true
      });
      assert.equal(again._id, 'named-request');
      assert.equal(
        await apos.aposAssistant.requests.countDocuments({ chatId: chat._id }),
        1
      );
      assert.equal(await apos.aposAssistant.chats.countDocuments({ _id: chat._id }), 1);
      gate.release();
      await waitForEnd(req, chat);

      // Someone else's ids are not found, and change nothing of theirs
      const otherReq = userReq(other);
      await assert.rejects(apos.aposAssistant.send(otherReq, chat._id, {
        message: 'Mine now',
        screen: { tabId: 'tab-2' },
        create: true
      }), { name: 'notfound' });
      await apos.aposAssistant.createChat(otherReq, { _id: 'other-chat' });
      await assert.rejects(apos.aposAssistant.send(otherReq, 'other-chat', {
        message: 'Hello',
        screen: { tabId: 'tab-2' },
        requestId: 'named-request'
      }), { name: 'notfound' });
      // An id of another chat's request is not this chat's
      await apos.aposAssistant.createChat(req, { _id: 'second-chat' });
      await assert.rejects(apos.aposAssistant.send(req, 'second-chat', {
        message: 'Hello',
        screen: { tabId: 'tab-1' },
        requestId: 'named-request'
      }), { name: 'notfound' });
      assert.equal((await apos.aposAssistant.getChat(req, 'second-chat')).openRequest, null);
      await assert.rejects(apos.aposAssistant.send(req, chat._id, {
        message: 'Hello',
        screen: { tabId: 'tab-1' },
        requestId: 'not a valid id'
      }), { name: 'invalid' });
      assert.equal((await apos.aposAssistant.getRequest(req, 'named-request')).ownerId, editor._id);
    });

    it('frees the chat when a send stores nothing: a request id taken by someone else', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      // Stored by someone else since the check, as in a race
      await apos.aposAssistant.requests.insertOne({
        _id: 'raced-request',
        ownerId: other._id,
        chatId: 'elsewhere',
        sequence: 0
      });
      const findSentRequest = apos.aposAssistant.findSentRequest;
      apos.aposAssistant.findSentRequest = async () => null;
      try {
        await assert.rejects(apos.aposAssistant.send(req, chat._id, {
          message: 'Hello',
          screen: { tabId: 'tab-1' },
          requestId: 'raced-request'
        }), { name: 'notfound' });
      } finally {
        apos.aposAssistant.findSentRequest = findSentRequest;
        await apos.aposAssistant.requests.deleteOne({ _id: 'raced-request' });
      }
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest, null);
      const request = await runToEnd(req, chat, 'tab-1', 'Hello again');
      assert.equal(request.status, 'completed');
    });

    it('refuses to delete a chat whose request runs, not one waiting for an answer', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const gate = holdModel();
      await send(req, chat, 'tab-1', 'Hello');
      await assert.rejects(apos.aposAssistant.deleteChat(req, chat._id), conflict('requestOpen'));
      gate.release();
      await waitForEnd(req, chat);

      script = askScript('t_browser');
      await runToEnd(req, chat, 'tab-1', 'Ask me');
      await apos.aposAssistant.deleteChat(req, chat._id);
      assert.equal(await apos.aposAssistant.chats.countDocuments({ _id: chat._id }), 0);
    });
  });

  describe('titles', function () {
    it('titles a chat from its first message with no model call for titleEffort "none"', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      // Every model call, the ones the engine can't route included
      const generate = apos.ai.generate;
      const generated = [];
      apos.ai.generate = (...args) => {
        generated.push(args);
        return generate(...args);
      };
      try {
        await runToEnd(req, chat, 'tab-1', '  Rewrite   the intro\nof the about page ');
      } finally {
        apos.ai.generate = generate;
      }
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).title,
        'Rewrite the intro of the about page');
      assert.equal(generated.length, 1);
      assert.equal(generated[0][1].schema, undefined);
      // Only the first message names it
      await runToEnd(req, chat, 'tab-1', 'Now the outro');
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).title,
        'Rewrite the intro of the about page');
    });

    it('cuts a long first message at a word boundary, or gives #N with no text', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const long = 'Write a short welcome paragraph for the new members of the board and the staff';
      const title = await apos.aposAssistant.getMessageTitle(chat, long);
      assert.equal(title, 'Write a short welcome paragraph for the new members of the…');
      assert(title.length <= 60);
      assert.equal(
        await apos.aposAssistant.getMessageTitle(chat, 'x'.repeat(80)),
        `${'x'.repeat(59)}…`
      );
      const number = await apos.aposAssistant.chats
        .countDocuments({ ownerId: editor._id });
      assert.equal(await apos.aposAssistant.getMessageTitle(chat, ' \n '), `#${number}`);
    });

    it('names a chat with a model call on titleEffort, unless the editor renamed it', async function () {
      const req = userReq(editor);
      apos.aposAssistant.options.titleEffort = 'low';
      try {
        script = (request) => (request.schema
          ? titleTurn('Spring launch')
          : { text: 'Done.' });
        const chat = await apos.aposAssistant.createChat(req);
        await runToEnd(req, chat, 'tab-1', 'Plan the spring launch page');
        assert.equal((await apos.aposAssistant.getChat(req, chat._id)).title, 'Spring launch');
        const titleCall = calls.find(call => call.schema);
        assert.equal(titleCall.model, 'fake-small');

        const gate = holdModel((request) => (request.schema
          ? titleTurn('Model title')
          : { text: 'Done.' }));
        const renamed = await apos.aposAssistant.createChat(req);
        await send(req, renamed, 'tab-1', 'Plan the summer page');
        await apos.aposAssistant.renameChat(req, renamed._id, 'My summer');
        gate.release();
        await waitForEnd(req, renamed);
        assert.equal(calls.filter(call => call.schema).length, 2);
        assert.equal((await apos.aposAssistant.getChat(req, renamed._id)).title, 'My summer');
      } finally {
        apos.aposAssistant.options.titleEffort = 'none';
      }
    });

    it('marks the usage of the request\'s run and of the title call by purpose', async function () {
      const req = userReq(editor);
      apos.aposAssistant.options.titleEffort = 'low';
      try {
        script = (request) => (request.schema
          ? titleTurn('Autumn sale')
          : { text: 'Done.' });
        usageRecords.length = 0;
        const chat = await apos.aposAssistant.createChat(req);
        await runToEnd(req, chat, 'tab-1', 'Plan the autumn sale page');
        await waitFor(() => usageRecords.length === 2);
        assert.deepEqual(
          usageRecords.map(record => record.metadata.purpose).sort(),
          [ 'request', 'title' ]
        );
      } finally {
        apos.aposAssistant.options.titleEffort = 'none';
      }
    });
  });

  describe('the run', function () {
    it('runs a request on the harness through the assistant door and stores its end', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([
        toolTurn('t_door', {}),
        { text: 'All done.' }
      ]);
      const sent = await send(req, chat, 'tab-1', 'Look around');
      assert.equal(sent.status, 'running');
      assert.equal(sent.tabId, 'tab-1');
      assert.equal(sent.sequence, 1);
      const request = await waitForEnd(req, chat);

      assert.equal(request.status, 'completed');
      assert.equal(request.finishReason, 'stop');
      assert.equal(request.provider, 'fake');
      assert.equal(request.model, 'fake-large');
      assert(request.jobId);
      assert(request.usage.inputTokens > 0);
      assert.deepEqual(request.messages[0], {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Request id: ${request._id}`
          },
          {
            type: 'text',
            text: 'Current screen: {"locale":"en","editing":false}'
          },
          {
            type: 'text',
            text: 'Look around'
          }
        ]
      });
      assert.equal(request.messages.at(-1).role, 'assistant');
      assert.equal(request.messages.length, 4);
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest, null);

      assert.deepEqual(doors, [ {
        door: 'assistant',
        lockId: chat._id,
        family: 'tab-1',
        chat: chat._id,
        requestId: request._id,
        seen: new Map(),
        pendingSeen: new Map(),
        model: {
          provider: 'fake',
          model: 'fake-large'
        }
      } ]);
      const names = calls[0].tools.map(tool => tool.name);
      for (const name of [ 'get_document', 'update_document', 't_door' ]) {
        assert(names.includes(name), name);
      }
      assert.match(calls[0].system, /^You work on the content of this ApostropheCMS site/);
      // One locale: nothing about copies in other locales
      assert.equal(apos.aposAssistant.getLocalizationSection(), null);
      assert(!calls[0].system.includes('localize_document'));
      assert.deepEqual(apos.area.widgetOperations, []);
    });

    it('keeps what the chat saw of each document on the chat, for its next request', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const draftId = note._id.replace(':published', ':draft');
      script = writeScript('Seen by the chat');
      await runToEnd(req, chat, 'tab-1', 'Rename the note');

      const { updatedAt } = await apos.doc.db.findOne({ _id: draftId });
      const stored = await apos.aposAssistant.chats.findOne({ _id: chat._id });
      assert.deepEqual(stored.seen, [ {
        _id: draftId,
        updatedAt: updatedAt.toISOString()
      } ]);
      // Never sent to the browser with the chat list
      const listed = await apos.aposAssistant.listChats(req);
      assert.equal(listed.find(each => each._id === chat._id).seen, undefined);

      script = sequence([
        toolTurn('t_door', {}),
        { text: 'Looked.' }
      ]);
      await runToEnd(req, chat, 'tab-1', 'Look again');
      const { seen } = doors.at(-1);
      assert.deepEqual([ ...seen ], [ [ draftId, updatedAt.toISOString() ] ]);
    });

    it('records the request\'s writes in the change log and ends them there', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = writeScript('Renamed again');
      const request = await runToEnd(req, chat, 'tab-1', 'Rename the note');

      const [ entry ] = await apos.aposHarness.changes
        .find({ requestId: request._id })
        .toArray();
      assert.equal(entry.door, 'assistant');
      assert.equal(entry.chat, chat._id);
      assert.equal(entry.userId, editor._id);
      assert.deepEqual(entry.model, {
        provider: 'fake',
        model: 'fake-large'
      });
      // Ended: the entry keeps its rows only
      assert.equal(entry.head, undefined);
      assert.equal(entry.base, undefined);
    });

    it('refuses a send while the chat\'s request is open, with the reason', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const gate = holdModel();
      const running = await send(req, chat, 'tab-1', 'First');

      await assert.rejects(send(req, chat, 'tab-1', 'Second'), conflict('requestOpen', running._id));
      await assert.rejects(send(req, chat, 'tab-2', 'Second'), conflict('otherBrowserTab', running._id));
      const read = await apos.aposAssistant.getChat(req, chat._id);
      assert.deepEqual(read.openRequest, {
        _id: running._id,
        tabId: 'tab-1',
        status: 'running'
      });
      gate.release();
      await waitForEnd(req, chat);

      // Idle again, the chat belongs to no browser tab
      const next = await runToEnd(req, chat, 'tab-2', 'Second');
      assert.equal(next.status, 'completed');
      assert.equal(next.tabId, 'tab-2');
      assert.equal(next.sequence, 2);
    });

    it('runs two chats at once', async function () {
      const req = userReq(editor);
      const one = await apos.aposAssistant.createChat(req);
      const two = await apos.aposAssistant.createChat(req);
      const gate = holdModel();
      await send(req, one, 'tab-1', 'One');
      await send(req, two, 'tab-1', 'Two');
      await waitFor(() => gate.waiting === 2);
      for (const chat of [ one, two ]) {
        assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest.status, 'running');
      }
      gate.release();
      assert.equal((await waitForEnd(req, one)).status, 'completed');
      assert.equal((await waitForEnd(req, two)).status, 'completed');
    });

    it('replays the chat\'s earlier requests, a failed one only as far as the model got', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      await runToEnd(req, chat, 'tab-1', 'Remember the word apple');
      script = () => {
        throw apos.error('aiRefusal', 'refused');
      };
      const failed = await runToEnd(req, chat, 'tab-1', 'Something refused');
      assert.equal(failed.status, 'failed');
      assert.deepEqual(failed.error, {
        name: 'aiRefusal',
        message: 'refused'
      });
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest, null);

      // A continuation that fails keeps the slice its first run stored
      script = sequence([
        toolTurn('t_browser', {}),
        () => {
          throw apos.error('aiRefusal', 'refused');
        }
      ]);
      await runToEnd(req, chat, 'tab-1', 'Ask, then fail');
      await answer(req, chat, 'tab-1', 'shown');
      const failedLater = await waitForEnd(req, chat);
      assert.equal(failedLater.status, 'failed');
      assert.equal(failedLater.messages[0].content.at(-1).text, 'Ask, then fail');

      script = null;
      calls.length = 0;
      await runToEnd(req, chat, 'tab-1', 'What was the word?');
      const texts = calls[0].messages
        .filter(message => message.role === 'user')
        .map(message => message.content.at(-1).text);
      // The refused one never reached the model; the other kept its ask
      assert.deepEqual(texts, [
        'Remember the word apple',
        'Ask, then fail',
        'What was the word?'
      ]);
      assert.deepEqual(calls[0].messages.find(message => message.role === 'tool').content, [ {
        type: 'toolResult',
        toolCallId: 'call-t_browser',
        output: {
          answered: true,
          answer: 'shown'
        }
      } ]);
    });

    it('keeps the calls of a run a tool stopped, and a retry reads them', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const logged = [];
      const logError = apos.aposAssistant.logError;
      apos.aposAssistant.logError = (req, name, message, data) => {
        logged.push({
          name,
          message,
          data
        });
      };
      try {
        script = sequence([ {
          content: [
            toolCall('t_write', {
              _id: note._id.replace(':published', ':draft'),
              title: 'Written before the stop'
            }),
            toolCall('t_throw')
          ],
          finishReason: 'toolCalls',
          usage: usage()
        } ]);
        const failed = await runToEnd(req, chat, 'tab-1', 'Rename, then break');
        assert.equal(failed.status, 'failed');
        assert.equal(failed.error.message, 'the tool broke');
        assert.deepEqual(failed.messages.map(message => message.role), [
          'user',
          'assistant',
          'tool'
        ]);
        assert.deepEqual(failed.messages[2].content, [ {
          type: 'toolResult',
          toolCallId: 'call-t_write',
          output: { ok: true }
        } ]);
        assert.deepEqual(failed.usage, {
          inputTokens: 10,
          outputTokens: 2
        });
        const failures = logged.filter(entry => entry.name === 'run-failed');
        assert.equal(failures.length, 1);
        assert.equal(failures[0].message, 'the tool broke');
        assert.equal(failures[0].data.chatId, chat._id);
        assert.equal(failures[0].data.requestId, failed._id);
        assert.equal(failures[0].data.tool, 't_throw');

        script = null;
        calls.length = 0;
        await apos.aposAssistant.retry(req, chat._id, {
          retryOf: failed._id,
          screen: { tabId: 'tab-1' }
        });
        assert.equal((await waitForEnd(req, chat)).status, 'completed');
        const tool = calls[0].messages.find(message => message.role === 'tool');
        assert.deepEqual(tool.content, [
          {
            type: 'toolResult',
            toolCallId: 'call-t_write',
            output: { ok: true }
          },
          {
            type: 'toolResult',
            toolCallId: 'call-t_throw',
            output: {
              executed: false,
              reason: 'failed'
            }
          }
        ]);
        const texts = calls[0].messages
          .filter(message => message.role === 'user')
          .map(message => message.content.at(-1).text);
        assert.deepEqual(texts, [ 'Rename, then break', 'Rename, then break' ]);
      } finally {
        apos.aposAssistant.logError = logError;
      }
    });

    it('replays a request that ran out of steps with its last calls answered as not run', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      apos.aposAssistant.options.maxSteps = 1;
      try {
        script = () => toolTurn('t_door', {});
        const cut = await runToEnd(req, chat, 'tab-1', 'Keep going');
        assert.equal(cut.status, 'completed');
        assert.equal(cut.finishReason, 'maxSteps');
      } finally {
        apos.aposAssistant.options.maxSteps = 30;
      }
      script = null;
      calls.length = 0;
      await runToEnd(req, chat, 'tab-1', 'Next');
      const tool = calls[0].messages.find(message => message.role === 'tool');
      assert.deepEqual(tool.content, [ {
        type: 'toolResult',
        toolCallId: 'call-t_door',
        output: {
          executed: false,
          reason: 'maxSteps'
        }
      } ]);
    });

    it('runs every request on the effort option, or the engine default when unset', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      await runToEnd(req, chat, 'tab-1', 'One');
      assert.deepEqual(calls.map(call => call.model), [ 'fake-large' ]);

      delete apos.aposAssistant.options.effort;
      try {
        calls.length = 0;
        const request = await runToEnd(req, chat, 'tab-1', 'Two');
        assert.deepEqual(calls.map(call => call.model), [ 'fake-medium' ]);
        assert.equal(request.model, 'fake-medium');
      } finally {
        apos.aposAssistant.options.effort = 'high';
      }
    });
  });

  describe('mentions', function () {
    let pricing;
    let chart;
    let guest;
    let editorRole;
    let secret;

    before(async function () {
      const req = apos.task.getReq({ mode: 'draft' });
      pricing = await apos.modules['assistant-note'].insert(req, {
        title: 'Pricing notes'
      });
      chart = await apos.image.insert(req, {
        title: 'Pricing chart'
      });
      guest = await t.createUser(apos, 'guest', { username: 'mention-guest' });
      editorRole = await t.createUser(apos, 'editor', { username: 'mention-editor' });
      secret = await apos.modules['assistant-secret'].insert(req, {
        title: 'Pricing secrets'
      });
    });

    it('finds pages, pieces and images by the start of their words, only those the user may read', async function () {
      const req = userReq(editor);
      const found = await apos.aposAssistant.findMentions(req, 'pric');
      assert.deepEqual(
        found.map(doc => [ doc._id, doc.kind ]).sort(),
        [ [ chart._id, 'image' ], [ pricing._id, 'piece' ], [ secret._id, 'piece' ] ].sort()
      );
      assert.equal(
        found.find(doc => doc._id === chart._id).label,
        apos.image.options.label
      );
      // A phrase matches as a whole, its last word by its start
      assert.deepEqual(
        (await apos.aposAssistant.findMentions(req, 'pricing no')).map(doc => doc._id),
        [ pricing._id ]
      );
      assert.deepEqual(
        (await apos.aposAssistant.findMentions(req, 'pricing notes ')).map(doc => doc._id),
        [ pricing._id ]
      );
      assert.deepEqual(await apos.aposAssistant.findMentions(req, 'pricing zzqx'), []);
      const home = await apos.aposAssistant.findMentions(req, 'hom');
      assert.deepEqual(home.map(doc => [ doc.kind, doc.label ]), [ [ 'page', 'apostrophe:page' ] ]);
      // Nothing typed yet: the latest updated
      const latest = await apos.aposAssistant.findMentions(req, '');
      assert(latest.some(doc => doc._id === chart._id));
      // Never a one-of-a-kind document
      assert.deepEqual(await apos.aposAssistant.findMentions(req, 'glob'), []);
      assert.deepEqual(await apos.aposAssistant.findMentions(req, 'zzqx'), []);
      assert.deepEqual(await apos.aposAssistant.findMentions(userReq(guest), 'pric'), []);
      // An editor never sees a type its role may not view
      assert.deepEqual(
        (await apos.aposAssistant.findMentions(userReq(editorRole), 'pric'))
          .map(doc => doc._id).sort(),
        [ chart._id, pricing._id ].sort()
      );

      const jar = await t.loginAs(apos, 'editor');
      const { results } = await apos.http.get('/api/v1/@apostrophecms/assistant/mention', {
        jar,
        qs: { q: 'char' }
      });
      assert.deepEqual(results.map(doc => doc._id), [ chart._id ]);
    });

    it('keeps the mentions the user may read, with their own titles, and the model reads them', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const message = `Compare @[Old \\] name](image:${pricing._id}) with ` +
        `@[Ghost](page:nope:en:draft), then @[Pricing notes](piece:${pricing._id})`;
      const request = await runToEnd(req, chat, 'tab-1', message);
      const token = `@[Pricing notes](piece:${pricing._id})`;
      assert.equal(request.message, `Compare ${token} with Ghost, then ${token}`);
      assert.deepEqual(request.mentions, [ {
        _id: pricing._id,
        type: 'assistant-note',
        kind: 'piece',
        title: 'Pricing notes',
        locale: 'en'
      } ]);
      const [ user ] = calls[0].messages.filter(each => each.role === 'user');
      const texts = user.content.map(part => part.text);
      assert.equal(texts.at(-2), request.message);
      // Postgres reorders the stored keys
      const [ intro, listed ] = texts.at(-1).split('read it with the tools: ');
      assert.match(intro, /^The message mentions these documents/);
      assert.deepEqual(JSON.parse(listed), request.mentions);
      // The chat's title reads the mention, not its token
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).title,
        'Compare @Pricing notes with Ghost, then @Pricing notes');

      const { message: guestMessage, mentions } = await apos.aposAssistant
        .verifyMentions(userReq(guest), token);
      assert.equal(guestMessage, 'Pricing notes');
      assert.deepEqual(mentions, []);
    });

    it('renders Markdown with its mentions as chips that no text can make', async function () {
      const req = userReq(editor);
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      const typed = `**Bold** @[x](page:${home._id}), @[y](piece:${pricing._id}) and ` +
        '@[Ghost](page:nope)\n<a class="apos-assistant-chip" href="https://x.test">fake</a> ' +
        '\uE0000\uE001';
      const { message, mentions } = await apos.aposAssistant.verifyMentions(req, typed);
      assert.equal(mentions.find(each => each._id === home._id).url, home._url);
      const html = apos.aposAssistant.renderMarkdown(message, { mentions });
      assert(html.includes('<strong>Bold</strong>'));
      // A page is a link to it, a piece without a page a button for its editor
      assert(html.includes('<a class="apos-assistant-chip apos-assistant-chip--action" ' +
        'data-apos-test="assistant-chip" data-kind="page" ' +
        `title="Home" href="${home._url}">`));
      assert(html.includes(`data-id="${pricing._id}" data-type="assistant-note">`));
      assert(html.includes('and Ghost'));
      assert.equal(html.match(/apos-assistant-chip--action/g).length, 2);
      assert(!/[\uE000\uE001]/.test(html));
      // The editor's message stays as typed: the panel shows it
      const rendered = apos.aposAssistant.renderRequest({
        message,
        mentions,
        messages: []
      });
      assert.equal(rendered.message, message);
      assert.equal(rendered.messageHtml, undefined);
    });

    it('renders a reply\'s documents as chips, any other token as its title, and tells the model how', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      // A wrong title and kind are the document's own, any form of an id
      // names its document, and an id nobody may read is its title
      script = () => ({
        text: `I updated @[Notes](page:${pricing._id}) for @[Start](piece:${home.aposDocId}). ` +
          '@[Ghost](page:nope:en:draft) was not found.'
      });
      const request = await runToEnd(req, chat, 'tab-1', 'Update the pricing notes');
      assert.deepEqual(
        request.replyMentions.map(each => [ each._id, each.kind, each.title ]),
        [ [ pricing._id, 'piece', 'Pricing notes' ], [ home._id, 'page', 'Home' ] ]
      );
      const { reply: html } = apos.aposAssistant.renderRequest(request);
      assert(html.includes(`data-kind="piece" title="Pricing notes" data-id="${pricing._id}"`));
      assert(html.includes(`data-kind="page" title="Home" href="${home._url}"`));
      assert.equal(html.match(/apos-assistant-chip--action/g).length, 2);
      assert(html.includes('. Ghost was not found.'));
      assert(calls[0].system.includes(apos.aposAssistant.getReplySection()));
      assert(apos.aposAssistant.getReplySection().includes('@[title](kind:_id)'));
      // The transcript keeps the model's words
      assert(request.messages.at(-1).content[0].text.includes(`@[Notes](page:${pricing._id})`));
    });
  });

  describe('asks', function () {
    it('waits on a browser ask that only the owning browser tab answers', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = askScript('t_browser');
      const waiting = await runToEnd(req, chat, 'tab-1', 'Show me');
      assert.equal(waiting.status, 'waiting');
      assert.deepEqual(waiting.asks, [ {
        callId: 'call-t_browser',
        name: 't_browser',
        kind: 'browser',
        payload: {
          kind: 'browser',
          what: 'something'
        }
      } ]);
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest.status, 'waiting');

      await assert.rejects(send(req, chat, 'tab-1', 'Something else'), conflict('requestOpen'));
      await assert.rejects(answer(req, chat, 'tab-2', 'shown'), conflict('otherBrowserTab'));
      await assert.rejects(answer(req, chat, 'tab-1', 42), { name: 'invalid' });
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest.status, 'waiting');
      assert(Number.isFinite(waiting.workedMs));

      // The editor takes a while to answer
      await new Promise(resolve => setTimeout(resolve, 300));
      await answer(req, chat, 'tab-1', 'shown');
      const done = await waitForEnd(req, chat);
      // The time the assistant worked leaves the wait out
      assert(done.workedMs >= waiting.workedMs);
      assert(done.workedMs - waiting.workedMs < 300);
      assert.equal(done._id, waiting._id);
      assert.equal(done.status, 'completed');
      assert.equal(done.asks, null);
      const result = done.messages.find(message => message.role === 'tool');
      assert.deepEqual(result.content[0].output, {
        answered: true,
        answer: 'shown'
      });
      assert.equal(done.messages[0].content.at(-1).text, 'Show me');
      assert.equal(done.usage.inputTokens > waiting.usage.inputTokens, true);
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest, null);
    });

    for (const [ tool, kind ] of [ [ 't_browser', 'browser' ], [ 't_test_question', 'test-question' ] ]) {
      it(`moves a request waiting on a ${kind} ask to the browser tab that continues here`, async function () {
        const req = userReq(editor);
        const chat = await apos.aposAssistant.createChat(req);
        script = askScript(tool);
        await runToEnd(req, chat, 'tab-1', 'Ask');

        await assert.rejects(apos.aposAssistant.continueHere(req, chat._id, {
          tabId: 'tab-2',
          screen: { tabId: 'tab-1' }
        }), { name: 'invalid' });
        const moved = await apos.aposAssistant.continueHere(req, chat._id, {
          tabId: 'tab-2',
          screen: {
            tabId: 'tab-2',
            url: '/elsewhere'
          }
        });
        assert.equal(moved.tabId, 'tab-2');
        assert.equal(moved.status, 'waiting');
        // The new browser tab's screen is the request's
        assert.equal(moved.screen.tabId, 'tab-2');
        assert.equal(moved.screen.url, '/elsewhere');
        assert.equal(moved.screen.visible, true);
        assert.deepEqual((await apos.aposAssistant.getChat(req, chat._id)).openRequest, {
          _id: moved._id,
          tabId: 'tab-2',
          status: 'waiting'
        });
        await assert.rejects(
          answer(req, chat, 'tab-1', 'from the old one', `call-${tool}`),
          conflict('otherBrowserTab')
        );
        await assert.rejects(apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' }), conflict('otherBrowserTab'));

        doors.length = 0;
        await answer(req, chat, 'tab-2', 'here', `call-${tool}`);
        const done = await waitForEnd(req, chat);
        assert.equal(done.status, 'completed');
        // The continuation's writes lock in the new browser tab's family
        assert.equal(doors[0].family, 'tab-2');
      });
    }

    it('skips the asks: the request ends with its transcript completed', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      // An ask, and an action after it, which never starts
      script = sequence([
        {
          content: [
            toolCall('t_browser'),
            toolCall('t_test_question')
          ],
          finishReason: 'toolCalls',
          usage: usage()
        }
      ]);
      const waiting = await runToEnd(req, chat, 'tab-1', 'Ask then look');
      assert.equal(waiting.status, 'waiting');

      await assert.rejects(apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-2' }), conflict('otherBrowserTab'));
      const skipped = await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
      assert.equal(skipped.status, 'skipped');
      assert.equal(skipped.asks, null);
      assert(skipped.endedAt);
      assert.deepEqual(skipped.messages.at(-1), {
        role: 'tool',
        content: [
          {
            type: 'toolResult',
            toolCallId: 'call-t_browser',
            output: { answered: false }
          },
          {
            type: 'toolResult',
            toolCallId: 'call-t_test_question',
            output: {
              executed: false,
              reason: 'skipped'
            }
          }
        ]
      });
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest, null);
      await assert.rejects(apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' }), conflict('notWaiting'));

      script = null;
      calls.length = 0;
      const next = await runToEnd(req, chat, 'tab-1', 'Something else');
      assert.equal(next.status, 'completed');
      assert.deepEqual(calls[0].messages.slice(0, 3), skipped.messages);
    });

    it('refuses an answer when no ask waits, with the reason', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      await assert.rejects(answer(req, chat, 'tab-1', 'x'), conflict('notWaiting'));
      await assert.rejects(
        apos.aposAssistant.continueHere(req, chat._id, { tabId: 'tab-1' }),
        conflict('notWaiting')
      );
      const gate = holdModel();
      await send(req, chat, 'tab-1', 'Hello');
      await assert.rejects(answer(req, chat, 'tab-1', 'x'), conflict('notWaiting'));
      gate.release();
      await waitForEnd(req, chat);
    });
  });

  // A write to a document saved since the chat last read it is refused; a
  // read counts from the next step's calls on, or once the request ends
  describe('what the chat has seen', function () {
    let read;

    before(async function () {
      read = await apos.modules['assistant-note'].insert(apos.task.getReq(), {
        title: 'A note to read'
      });
    });

    function draftId() {
      return read._id.replace(':published', ':draft');
    }

    async function stampOf(chat) {
      const { seen } = await apos.aposAssistant.chats.findOne({ _id: chat._id });
      return (seen || []).find(each => each._id === draftId())?.updatedAt;
    }

    async function updatedAt() {
      return (await apos.doc.db.findOne({ _id: draftId() })).updatedAt.toISOString();
    }

    // The chat read the note, then someone else saved it
    async function seenThenSaved(req, chat) {
      script = sequence([ toolTurn('get_document', { _id: draftId() }), { text: 'Read.' } ]);
      await runToEnd(req, chat, 'tab-1', 'Read the note');
      const taskReq = apos.task.getReq({ mode: 'draft' });
      const draft = await apos.modules['assistant-note'].find(taskReq, { _id: draftId() })
        .toObject();
      await apos.modules['assistant-note'].update(taskReq, {
        ...draft,
        title: `Saved by someone else ${apos.util.generateId()}`
      });
      return updatedAt();
    }

    function turn(...content) {
      return {
        content,
        finishReason: 'toolCalls',
        usage: usage()
      };
    }

    function readNote() {
      return toolCall('get_document', { _id: draftId() });
    }

    function rename(id, title) {
      return toolCall('update_document', {
        targets: [ {
          _id: draftId(),
          values: { title }
        } ]
      }, id);
    }

    function resultOf(request, callId) {
      return request.messages
        .flatMap(message => (message.role === 'tool') ? message.content : [])
        .find(part => part.toolCallId === callId).output;
    }

    it('keeps the reads of the last step once the request ends', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      await seenThenSaved(req, chat);
      assert.notEqual(await stampOf(chat), await updatedAt());
      script = sequence([ turn(readNote()), { text: 'Read again.' } ]);
      await runToEnd(req, chat, 'tab-1', 'Read the note again');
      assert.equal(await stampOf(chat), await updatedAt());
    });

    it('counts a read for the next step, not for a write of its own step', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      await seenThenSaved(req, chat);
      script = sequence([
        // The step's write came from what the model knew before the read
        turn(readNote(), rename('call-same-step', 'From the same step')),
        turn(rename('call-next-step', 'From the next step')),
        { text: 'Renamed.' }
      ]);
      const done = await runToEnd(req, chat, 'tab-1', 'Rename the note');
      assert.equal(done.status, 'completed');
      assert.equal(resultOf(done, 'call-same-step').refused[0].reason, 'changed');
      assert.equal(resultOf(done, 'call-next-step').written.length, 1);
    });

    it('keeps a read beside a browser ask for the steps after the answer, not for its own step', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const saved = await seenThenSaved(req, chat);
      script = sequence([
        turn(readNote(), toolCall('t_browser'), rename('call-same-step', 'From the same step')),
        turn(rename('call-next-step', 'From the next step')),
        { text: 'Renamed.' }
      ]);
      const waiting = await runToEnd(req, chat, 'tab-1', 'Show and rename the note');
      assert.equal(waiting.status, 'waiting');
      assert.deepEqual(waiting.pendingSeen, [ {
        _id: draftId(),
        updatedAt: saved
      } ]);
      await answer(req, chat, 'tab-1', 'shown');
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.equal(done.pendingSeen, null);
      assert.equal(resultOf(done, 'call-same-step').refused[0].reason, 'changed');
      assert.equal(resultOf(done, 'call-next-step').written.length, 1);
      assert.equal(
        (await apos.doc.db.findOne({ _id: draftId() })).title,
        'From the next step'
      );
    });

    for (const end of [ 'stopped', 'skipped' ]) {
      it(`keeps a read beside a browser ask when the request is ${end} while it waits`, async function () {
        const req = userReq(editor);
        const chat = await apos.aposAssistant.createChat(req);
        const saved = await seenThenSaved(req, chat);
        script = sequence([ turn(readNote(), toolCall('t_browser')) ]);
        await runToEnd(req, chat, 'tab-1', 'Show the note');
        const ended = (end === 'stopped')
          ? await apos.aposAssistant.stop(req, chat._id)
          : await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
        assert.equal(ended.status, end);
        assert.equal(ended.pendingSeen, null);
        assert.equal(await stampOf(chat), saved);
      });
    }
  });

  describe('routes', function () {
    it('serves the owner\'s chats and refuses with the reason in the response', async function () {
      const jar = await t.loginAs(apos, 'editor');
      // The CSRF cookie a write needs
      await apos.http.get('/', { jar });
      const base = '/api/v1/@apostrophecms/assistant/chat';
      // A new chat is created by its first send, named by the browser
      const chat = { _id: 'route-chat' };
      const gate = holdModel();
      const { request } = await apos.http.post(`${base}/${chat._id}/send`, {
        jar,
        body: {
          message: 'Hello',
          screen: { tabId: 'tab-1' },
          requestId: 'route-request',
          create: true
        }
      });
      assert.equal(request._id, 'route-request');
      assert.equal(request.status, 'running');

      const read = await apos.http.get(`${base}/${chat._id}`, { jar });
      assert.equal(read.chat.openRequest.tabId, 'tab-1');
      assert.equal(read.chat.seen, undefined);
      assert.equal(read.requests[0].tabId, 'tab-1');
      // One request, with its chat: what a request event changed
      const one = await apos.http.get(`${base}/${chat._id}/request/${request._id}`, { jar });
      assert.equal(one.request._id, request._id);
      assert.equal(one.chat.openRequest._id, request._id);
      assert.equal(one.chat.seen, undefined);
      await assert.rejects(apos.http.get(`${base}/${chat._id}/request/nope`, { jar }),
        { status: 404 });
      await assert.rejects(apos.http.get(`${base}/nope/request/${request._id}`, { jar }),
        { status: 404 });
      await assert.rejects(apos.http.post(`${base}/${chat._id}/send`, {
        jar,
        body: {
          message: 'Again',
          screen: { tabId: 'tab-2' }
        }
      }), (e) => {
        assert.equal(e.status, 409);
        assert.equal(e.body.data.reason, 'otherBrowserTab');
        assert.equal(e.body.data.requestId, request._id);
        return true;
      });
      await assert.rejects(apos.http.post(`${base}/${chat._id}/send`, {
        jar,
        body: { message: 'No browser tab' }
      }), { status: 400 });
      gate.release();
      await waitForEnd(userReq(editor), chat);

      const { chats } = await apos.http.get(base, { jar });
      assert(chats.some(listed => listed._id === chat._id));
      const renamed = await apos.http.patch(`${base}/${chat._id}`, {
        jar,
        body: { title: 'Renamed' }
      });
      assert.equal(renamed.chat.title, 'Renamed');
      await apos.http.delete(`${base}/${chat._id}`, { jar });
      await assert.rejects(apos.http.get(`${base}/${chat._id}`, { jar }), { status: 404 });

      await assert.rejects(apos.http.get(base), { status: 403 });
    });

    it('answers not found to every route given someone else\'s ids, and changes nothing of theirs', async function () {
      const base = '/api/v1/@apostrophecms/assistant/chat';
      const req = userReq(editor);
      const chat = { _id: 'forged-chat' };
      // Waiting on a question: every action below would be taken from its
      // owner
      script = askScript('t_test_question');
      await apos.aposAssistant.send(req, chat._id, {
        message: 'Ask me',
        screen: { tabId: 'tab-1' },
        requestId: 'forged-request',
        create: true
      });
      const waiting = await waitForEnd(req, chat);
      assert.equal(waiting.status, 'waiting');
      const before = await apos.aposAssistant.getChat(req, chat._id);
      await apos.aposAssistant.reverts.insertOne({
        _id: 'forged-revert',
        ownerId: editor._id,
        chatId: chat._id,
        requestIds: [ waiting._id ],
        status: 'failed',
        documents: []
      });

      const jar = await t.loginAs(apos, 'other');
      await apos.http.get('/', { jar });
      const own = { _id: 'forger-chat' };
      await apos.http.post(`${base}/${own._id}/send`, {
        jar,
        body: {
          message: 'Mine',
          screen: { tabId: 'tab-2' },
          create: true
        }
      });
      await waitForEnd(userReq(other), own);
      const screen = { tabId: 'tab-2' };
      const forged = (id = chat._id) => ({
        'GET chat': [ 'get', `${base}/${id}` ],
        'GET request': [ 'get', `${base}/${id}/request/${waiting._id}` ],
        'GET step': [ 'get', `${base}/${id}/request/${waiting._id}/step/call-t_test_question` ],
        send: [ 'post', `${base}/${id}/send`, {
          message: 'Taken',
          screen,
          requestId: 'forger-request'
        } ],
        'send, creating': [ 'post', `${base}/${id}/send`, {
          message: 'Taken',
          screen,
          create: true
        } ],
        answer: [ 'post', `${base}/${id}/answer`, {
          tabId: 'tab-1',
          callId: 'call-t_test_question',
          answer: 'Forged',
          screen: { tabId: 'tab-1' }
        } ],
        skip: [ 'post', `${base}/${id}/skip`, { tabId: 'tab-1' } ],
        'continue-here': [ 'post', `${base}/${id}/continue-here`, {
          tabId: 'tab-2',
          screen
        } ],
        'open-editor': [ 'post', `${base}/${id}/open-editor`, {
          tabId: 'tab-1',
          callId: 'call-t_test_question',
          root: {}
        } ],
        stop: [ 'post', `${base}/${id}/stop`, {} ],
        retry: [ 'post', `${base}/${id}/retry`, {
          retryOf: waiting._id,
          screen
        } ],
        'revert-check': [ 'post', `${base}/${id}/revert-check`, {
          requestId: waiting._id,
          tabId: 'tab-2',
          screen
        } ],
        revert: [ 'post', `${base}/${id}/revert`, {
          requestId: waiting._id,
          tabId: 'tab-2',
          screen
        } ],
        'revert-retry': [ 'post', `${base}/${id}/revert-retry`, {
          revertId: 'forged-revert',
          tabId: 'tab-2',
          screen
        } ],
        'revert-dismiss': [ 'post', `${base}/${id}/revert-dismiss`, {
          revertId: 'forged-revert'
        } ],
        rename: [ 'patch', `${base}/${id}`, { title: 'Taken' } ],
        delete: [ 'delete', `${base}/${id}` ]
      });
      // Their chat by its id, then their request and revert by their ids
      // through a chat of the forger's own
      for (const id of [ chat._id, own._id ]) {
        for (const [ name, [ method, url, body ] ] of Object.entries(forged(id))) {
          if ((id === own._id) && [ 'send', 'send, creating', 'skip', 'continue-here',
            'stop', 'rename', 'delete', 'GET chat', 'answer', 'open-editor' ].includes(name)) {
            // Actions on the forger's own chat that name none of their ids
            continue;
          }
          await assert.rejects(apos.http[method](url, {
            jar,
            ...(body && { body })
          }), (e) => {
            assert.equal(e.status, 404, `${name} on ${id}: ${e.status}`);
            return true;
          });
        }
      }
      const { chats } = await apos.http.get(base, { jar });
      assert(chats.some(each => each._id === own._id));
      assert(!chats.some(each => each._id === chat._id));

      // Theirs as they left it
      const after = await apos.aposAssistant.getChat(req, chat._id);
      assert.equal(after.openRequest._id, waiting._id);
      assert.equal(after.openRequest.status, 'waiting');
      assert.equal(after.openRequest.tabId, 'tab-1');
      assert.equal(after.title, before.title);
      const requests = await apos.aposAssistant.getChatRequests(req, chat._id);
      assert.deepEqual(requests.map(each => [ each._id, each.status, each.tabId ]),
        [ [ waiting._id, 'waiting', 'tab-1' ] ]);
      assert.equal(requests[0].messages.length, waiting.messages.length);
      const reverts = await apos.aposAssistant.getChatReverts(req, chat._id);
      assert.deepEqual(reverts.map(each => [ each._id, each.status, each.dismissed ]),
        [ [ 'forged-revert', 'failed', undefined ] ]);
      assert.equal(await apos.aposAssistant.requests.countDocuments({
        ownerId: other._id,
        chatId: chat._id
      }), 0);
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
      await apos.aposAssistant.reverts.deleteOne({ _id: 'forged-revert' });
    });
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  function send(req, chat, tabId, message) {
    return apos.aposAssistant.send(req, chat._id, {
      message,
      screen: { tabId }
    });
  }

  function answer(req, chat, tabId, value, callId = 'call-t_browser') {
    return apos.aposAssistant.answer(req, chat._id, {
      tabId,
      callId,
      answer: value
    });
  }

  async function runToEnd(req, chat, tabId, message) {
    await send(req, chat, tabId, message);
    return waitForEnd(req, chat);
  }

  // The chat's latest request once its run has ended (or waits), and the
  // run's end handler with it
  async function waitForEnd(req, chat) {
    let request;
    await waitFor(async () => {
      const requests = await apos.aposAssistant.getChatRequests(req, chat._id);
      request = requests.at(-1);
      const open = (await apos.aposAssistant.getChat(req, chat._id)).openRequest;
      return request && (request.status !== 'running') &&
        ((open === null) || (open.status === 'waiting')) &&
        await jobEnded(request.jobId);
    });
    return request;

    // A job ends only after its run's end handler
    async function jobEnded(jobId) {
      const job = jobId && await apos.modules['@apostrophecms/job'].db.findOne({ _id: jobId });
      return !job || job.ended;
    }
  }

  // Holds every model call until released; `waiting` counts the held ones
  function holdModel(then = () => ({ text: 'Done.' })) {
    let release;
    const released = new Promise((resolve) => {
      release = resolve;
    });
    const gate = {
      waiting: 0,
      release
    };
    script = async (request) => {
      gate.waiting++;
      await released;
      return then(request);
    };
    return gate;
  }

  function writeScript(title) {
    return sequence([
      toolTurn('t_write', {
        _id: note._id.replace(':published', ':draft'),
        title
      }),
      { text: 'Renamed.' }
    ]);
  }

  function askScript(tool) {
    return sequence([
      toolTurn(tool, {}),
      { text: 'Thanks.' }
    ]);
  }

  // The turns in order, then the default; a function is called for its turn
  function sequence(turns) {
    const queue = [ ...turns ];
    return (request) => {
      const next = queue.shift();
      return (typeof next === 'function') ? next(request) : (next || { text: 'Done.' });
    };
  }
});

function toolCall(name, input = {}, id = `call-${name}`) {
  return {
    type: 'toolCall',
    id,
    name,
    input
  };
}

function toolTurn(name, input) {
  return {
    content: [ toolCall(name, input) ],
    finishReason: 'toolCalls',
    usage: usage()
  };
}

function titleTurn(title) {
  return {
    content: [ {
      type: 'text',
      text: JSON.stringify({ title })
    } ],
    object: { title },
    finishReason: 'stop',
    usage: usage()
  };
}

function usage() {
  return {
    inputTokens: 10,
    outputTokens: 2
  };
}

function conflict(reason, requestId) {
  return (e) => {
    assert.equal(e.name, 'conflict');
    assert.equal(e.data.reason, reason);
    if (requestId) {
      assert.equal(e.data.requestId, requestId);
    }
    return true;
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
