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
                doors.push(self.apos.harness.getDoor(req));
                return { ok: true };
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
                await self.apos.harness.writeDocuments(req, [ {
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
                  doors.push(self.apos.harness.getDoor(req));
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
              self.apos.assistant.addAskKind(kind, {
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
      const first = await apos.assistant.createChat(req);
      // Created apart, as an editor creates them
      await new Promise(resolve => setTimeout(resolve, 5));
      const second = await apos.assistant.createChat(req);
      await apos.assistant.createChat(userReq(other));
      assert.equal(first.title, null);
      assert.equal(first.openRequest, null);

      const listed = (await apos.assistant.listChats(req)).map(chat => chat._id);
      assert.deepEqual(listed.slice(0, 2), [ second._id, first._id ]);
      assert(!listed.includes(undefined));
      assert.equal(listed.length, (await apos.assistant.chats.countDocuments({
        ownerId: editor._id
      })));

      const renamed = await apos.assistant.renameChat(req, first._id, '  Spring   launch ');
      assert.equal(renamed.title, 'Spring launch');
      await assert.rejects(apos.assistant.renameChat(req, first._id, '  '), { name: 'invalid' });
    });

    it('keeps a chat private to its owner', async function () {
      const chat = await apos.assistant.createChat(userReq(editor));
      const req = userReq(other);
      await assert.rejects(apos.assistant.getChat(req, chat._id), { name: 'notfound' });
      await assert.rejects(apos.assistant.renameChat(req, chat._id, 'Mine'), { name: 'notfound' });
      await assert.rejects(apos.assistant.deleteChat(req, chat._id), { name: 'notfound' });
      await assert.rejects(send(req, chat, 'tab-1', 'Hello'), { name: 'notfound' });
      await assert.rejects(apos.assistant.createChat(apos.task.getReq()), { name: 'forbidden' });
    });

    it('deletes a chat: its requests, its change log entries, then the chat', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = writeScript('Renamed by the chat');
      const request = await runToEnd(req, chat, 'tab-1', 'Rename the note');
      assert.equal(request.status, 'completed');
      const entries = await apos.harness.changes.find({ chat: chat._id }).toArray();
      assert.equal(entries.length, 1);
      // Someone else's entry naming the same chat is not the owner's to delete
      await apos.harness.changes.insertOne({
        _id: 'foreign-entry',
        chat: chat._id,
        userId: other._id
      });

      await apos.assistant.deleteChat(req, chat._id);
      assert.equal(await apos.assistant.chats.countDocuments({ _id: chat._id }), 0);
      assert.equal(await apos.assistant.requests.countDocuments({ chatId: chat._id }), 0);
      const left = await apos.harness.changes.find({ chat: chat._id }).toArray();
      assert.deepEqual(left.map(entry => entry._id), [ 'foreign-entry' ]);
      await apos.harness.changes.deleteOne({ _id: 'foreign-entry' });
    });

    it('refuses to delete a chat whose request runs, not one waiting for an answer', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const gate = holdModel();
      await send(req, chat, 'tab-1', 'Hello');
      await assert.rejects(apos.assistant.deleteChat(req, chat._id), conflict('requestOpen'));
      gate.release();
      await waitForEnd(req, chat);

      script = askScript('t_browser');
      await runToEnd(req, chat, 'tab-1', 'Ask me');
      await apos.assistant.deleteChat(req, chat._id);
      assert.equal(await apos.assistant.chats.countDocuments({ _id: chat._id }), 0);
    });
  });

  describe('titles', function () {
    it('titles a chat from its first message with no model call for titleEffort "none"', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
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
      assert.equal((await apos.assistant.getChat(req, chat._id)).title,
        'Rewrite the intro of the about page');
      assert.equal(generated.length, 1);
      assert.equal(generated[0][1].schema, undefined);
      // Only the first message names it
      await runToEnd(req, chat, 'tab-1', 'Now the outro');
      assert.equal((await apos.assistant.getChat(req, chat._id)).title,
        'Rewrite the intro of the about page');
    });

    it('cuts a long first message at a word boundary, or gives #N with no text', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      const long = 'Write a short welcome paragraph for the new members of the board and the staff';
      const title = await apos.assistant.getMessageTitle(chat, long);
      assert.equal(title, 'Write a short welcome paragraph for the new members of the…');
      assert(title.length <= 60);
      assert.equal(
        await apos.assistant.getMessageTitle(chat, 'x'.repeat(80)),
        `${'x'.repeat(59)}…`
      );
      const number = await apos.assistant.chats.countDocuments({ ownerId: editor._id });
      assert.equal(await apos.assistant.getMessageTitle(chat, ' \n '), `#${number}`);
    });

    it('names a chat with a model call on titleEffort, unless the editor renamed it', async function () {
      const req = userReq(editor);
      apos.assistant.options.titleEffort = 'low';
      try {
        script = (request) => (request.schema
          ? titleTurn('Spring launch')
          : { text: 'Done.' });
        const chat = await apos.assistant.createChat(req);
        await runToEnd(req, chat, 'tab-1', 'Plan the spring launch page');
        assert.equal((await apos.assistant.getChat(req, chat._id)).title, 'Spring launch');
        const titleCall = calls.find(call => call.schema);
        assert.equal(titleCall.model, 'fake-small');

        const gate = holdModel((request) => (request.schema
          ? titleTurn('Model title')
          : { text: 'Done.' }));
        const renamed = await apos.assistant.createChat(req);
        await send(req, renamed, 'tab-1', 'Plan the summer page');
        await apos.assistant.renameChat(req, renamed._id, 'My summer');
        gate.release();
        await waitForEnd(req, renamed);
        assert.equal(calls.filter(call => call.schema).length, 2);
        assert.equal((await apos.assistant.getChat(req, renamed._id)).title, 'My summer');
      } finally {
        apos.assistant.options.titleEffort = 'none';
      }
    });
  });

  describe('the run', function () {
    it('runs a request on the harness through the assistant door and stores its end', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
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
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest, null);

      assert.deepEqual(doors, [ {
        door: 'assistant',
        lockId: chat._id,
        family: 'tab-1',
        chat: chat._id,
        requestId: request._id,
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
    });

    it('records the request\'s writes in the change log and ends them there', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = writeScript('Renamed again');
      const request = await runToEnd(req, chat, 'tab-1', 'Rename the note');

      const [ entry ] = await apos.harness.changes
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
      const chat = await apos.assistant.createChat(req);
      const gate = holdModel();
      const running = await send(req, chat, 'tab-1', 'First');

      await assert.rejects(send(req, chat, 'tab-1', 'Second'), conflict('requestOpen', running._id));
      await assert.rejects(send(req, chat, 'tab-2', 'Second'), conflict('otherBrowserTab', running._id));
      const read = await apos.assistant.getChat(req, chat._id);
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
      const one = await apos.assistant.createChat(req);
      const two = await apos.assistant.createChat(req);
      const gate = holdModel();
      await send(req, one, 'tab-1', 'One');
      await send(req, two, 'tab-1', 'Two');
      await waitFor(() => gate.waiting === 2);
      for (const chat of [ one, two ]) {
        assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest.status, 'running');
      }
      gate.release();
      assert.equal((await waitForEnd(req, one)).status, 'completed');
      assert.equal((await waitForEnd(req, two)).status, 'completed');
    });

    it('replays the chat\'s earlier requests, never a failed one', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
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
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest, null);

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
      assert.deepEqual(texts, [ 'Remember the word apple', 'What was the word?' ]);
    });

    it('replays a request that ran out of steps with its last calls answered as not run', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      apos.assistant.options.maxSteps = 1;
      try {
        script = () => toolTurn('t_door', {});
        const cut = await runToEnd(req, chat, 'tab-1', 'Keep going');
        assert.equal(cut.status, 'completed');
        assert.equal(cut.finishReason, 'maxSteps');
      } finally {
        apos.assistant.options.maxSteps = 30;
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
      const chat = await apos.assistant.createChat(req);
      await runToEnd(req, chat, 'tab-1', 'One');
      assert.deepEqual(calls.map(call => call.model), [ 'fake-large' ]);

      delete apos.assistant.options.effort;
      try {
        calls.length = 0;
        const request = await runToEnd(req, chat, 'tab-1', 'Two');
        assert.deepEqual(calls.map(call => call.model), [ 'fake-medium' ]);
        assert.equal(request.model, 'fake-medium');
      } finally {
        apos.assistant.options.effort = 'high';
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
      const found = await apos.assistant.findMentions(req, 'pric');
      assert.deepEqual(
        found.map(doc => [ doc._id, doc.kind ]).sort(),
        [ [ chart._id, 'image' ], [ pricing._id, 'piece' ], [ secret._id, 'piece' ] ].sort()
      );
      assert.equal(
        found.find(doc => doc._id === chart._id).label,
        apos.image.options.label
      );
      const home = await apos.assistant.findMentions(req, 'hom');
      assert.deepEqual(home.map(doc => [ doc.kind, doc.label ]), [ [ 'page', 'apostrophe:page' ] ]);
      // Nothing typed yet: the latest updated
      const latest = await apos.assistant.findMentions(req, '');
      assert(latest.some(doc => doc._id === chart._id));
      // Never a one-of-a-kind document
      assert.deepEqual(await apos.assistant.findMentions(req, 'glob'), []);
      assert.deepEqual(await apos.assistant.findMentions(req, 'zzqx'), []);
      assert.deepEqual(await apos.assistant.findMentions(userReq(guest), 'pric'), []);
      // An editor never sees a type its role may not view
      assert.deepEqual(
        (await apos.assistant.findMentions(userReq(editorRole), 'pric'))
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
      const chat = await apos.assistant.createChat(req);
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
      assert.match(texts.at(-1), /^The message mentions these documents/);
      assert(texts.at(-1).endsWith(JSON.stringify(request.mentions)));
      // The chat's title reads the mention, not its token
      assert.equal((await apos.assistant.getChat(req, chat._id)).title,
        'Compare @Pricing notes with Ghost, then @Pricing notes');

      const { message: guestMessage, mentions } = await apos.assistant
        .verifyMentions(userReq(guest), token);
      assert.equal(guestMessage, 'Pricing notes');
      assert.deepEqual(mentions, []);
    });

    it('renders a message as Markdown, its mentions as chips that no text can make', async function () {
      const req = userReq(editor);
      const home = await apos.page.find(req, { slug: '/' }).toObject();
      const typed = `**Bold** @[x](page:${home._id}), @[y](piece:${pricing._id}) and ` +
        '@[Ghost](page:nope)\n<a class="apos-assistant-chip" href="https://x.test">fake</a> ' +
        '\uE0000\uE001';
      const { message, mentions } = await apos.assistant.verifyMentions(req, typed);
      assert.equal(mentions.find(each => each._id === home._id).url, home._url);
      const html = apos.assistant.renderMarkdown(message, { mentions });
      assert(html.includes('<strong>Bold</strong>'));
      // A page is a link to it, a piece without a page a button for its editor
      assert(html.includes('<a class="apos-assistant-chip apos-assistant-chip--action" ' +
        'data-apos-test="assistant-chip" data-kind="page" ' +
        `title="Home" href="${home._url}">`));
      assert(html.includes(`data-id="${pricing._id}" data-type="assistant-note">`));
      assert(html.includes('and Ghost'));
      assert.equal(html.match(/apos-assistant-chip--action/g).length, 2);
      assert(!/[\uE000\uE001]/.test(html));
      assert.equal(
        apos.assistant.renderRequest({
          message,
          mentions,
          messages: []
        }).messageHtml,
        html
      );
    });

    it('renders a reply\'s documents as chips, any other token as its title, and tells the model how', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
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
      const { html } = apos.assistant.renderRequest(request).messages.at(-1);
      assert(html.includes(`data-kind="piece" title="Pricing notes" data-id="${pricing._id}"`));
      assert(html.includes(`data-kind="page" title="Home" href="${home._url}"`));
      assert.equal(html.match(/apos-assistant-chip--action/g).length, 2);
      assert(html.includes('. Ghost was not found.'));
      assert(calls[0].system.includes(apos.assistant.getReplySection()));
      assert(apos.assistant.getReplySection().includes('@[title](kind:_id)'));
      // The transcript keeps the model's words
      assert(request.messages.at(-1).content[0].text.includes(`@[Notes](page:${pricing._id})`));
    });
  });

  describe('asks', function () {
    it('waits on a browser ask that only the owning browser tab answers', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
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
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest.status, 'waiting');

      await assert.rejects(send(req, chat, 'tab-1', 'Something else'), conflict('requestOpen'));
      await assert.rejects(answer(req, chat, 'tab-2', 'shown'), conflict('otherBrowserTab'));
      await assert.rejects(answer(req, chat, 'tab-1', 42), { name: 'invalid' });
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest.status, 'waiting');

      await answer(req, chat, 'tab-1', 'shown');
      const done = await waitForEnd(req, chat);
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
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest, null);
    });

    for (const [ tool, kind ] of [ [ 't_browser', 'browser' ], [ 't_test_question', 'test-question' ] ]) {
      it(`moves a request waiting on a ${kind} ask to the browser tab that continues here`, async function () {
        const req = userReq(editor);
        const chat = await apos.assistant.createChat(req);
        script = askScript(tool);
        await runToEnd(req, chat, 'tab-1', 'Ask');

        await assert.rejects(apos.assistant.continueHere(req, chat._id, {
          tabId: 'tab-2',
          screen: { tabId: 'tab-1' }
        }), { name: 'invalid' });
        const moved = await apos.assistant.continueHere(req, chat._id, {
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
        assert.deepEqual((await apos.assistant.getChat(req, chat._id)).openRequest, {
          _id: moved._id,
          tabId: 'tab-2',
          status: 'waiting'
        });
        await assert.rejects(
          answer(req, chat, 'tab-1', 'from the old one', `call-${tool}`),
          conflict('otherBrowserTab')
        );
        await assert.rejects(apos.assistant.skip(req, chat._id, { tabId: 'tab-1' }), conflict('otherBrowserTab'));

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
      const chat = await apos.assistant.createChat(req);
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

      await assert.rejects(apos.assistant.skip(req, chat._id, { tabId: 'tab-2' }), conflict('otherBrowserTab'));
      const skipped = await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
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
      assert.equal((await apos.assistant.getChat(req, chat._id)).openRequest, null);
      await assert.rejects(apos.assistant.skip(req, chat._id, { tabId: 'tab-1' }), conflict('notWaiting'));

      script = null;
      calls.length = 0;
      const next = await runToEnd(req, chat, 'tab-1', 'Something else');
      assert.equal(next.status, 'completed');
      assert.deepEqual(calls[0].messages.slice(0, 3), skipped.messages);
    });

    it('refuses an answer when no ask waits, with the reason', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      await assert.rejects(answer(req, chat, 'tab-1', 'x'), conflict('notWaiting'));
      await assert.rejects(
        apos.assistant.continueHere(req, chat._id, { tabId: 'tab-1' }),
        conflict('notWaiting')
      );
      const gate = holdModel();
      await send(req, chat, 'tab-1', 'Hello');
      await assert.rejects(answer(req, chat, 'tab-1', 'x'), conflict('notWaiting'));
      gate.release();
      await waitForEnd(req, chat);
    });
  });

  describe('routes', function () {
    it('serves the owner\'s chats and refuses with the reason in the response', async function () {
      const jar = await t.loginAs(apos, 'editor');
      // The CSRF cookie a write needs
      await apos.http.get('/', { jar });
      const base = '/api/v1/@apostrophecms/assistant/chat';
      const { chat } = await apos.http.post(base, {
        jar,
        body: {}
      });
      const gate = holdModel();
      const { request } = await apos.http.post(`${base}/${chat._id}/send`, {
        jar,
        body: {
          message: 'Hello',
          screen: { tabId: 'tab-1' }
        }
      });
      assert.equal(request.status, 'running');

      const read = await apos.http.get(`${base}/${chat._id}`, { jar });
      assert.equal(read.chat.openRequest.tabId, 'tab-1');
      assert.equal(read.requests[0].tabId, 'tab-1');
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
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  function send(req, chat, tabId, message) {
    return apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId }
    });
  }

  function answer(req, chat, tabId, value, callId = 'call-t_browser') {
    return apos.assistant.answer(req, chat._id, {
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
      const requests = await apos.assistant.getChatRequests(req, chat._id);
      request = requests.at(-1);
      const open = (await apos.assistant.getChat(req, chat._id)).openRequest;
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

function toolCall(name, input = {}) {
  return {
    type: 'toolCall',
    id: `call-${name}`,
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
