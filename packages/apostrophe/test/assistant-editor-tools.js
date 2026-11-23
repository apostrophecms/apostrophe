const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The tools that turn to the editor, on the scripted mock: questions and
// confirmations suspend the run with an ask the owning browser tab answers,
// the plan is kept on the request, approval gates ask before a tool runs,
// writing nothing when declined, and a write to the document the page shows
// waits for the page to enter edit mode.

describe('Assistant: questions, confirmations, the plan and gates', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let notes;
  let script = null;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock(req, request) {
              return script ? script(req, request) : { text: 'Done.' };
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
          options: {
            label: 'Note',
            pluralLabel: 'Notes'
          },
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
        'assistant-memo': {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Memo'
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    notes = [];
    for (let i = 1; i <= 20; i++) {
      notes.push(await apos.modules['assistant-note'].insert(apos.task.getReq(), {
        title: `Note ${i}`
      }));
    }
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
  });

  describe('ask_editor', function () {
    const questions = [
      {
        question: 'Which layout?',
        options: [
          {
            label: 'One column',
            description: 'The image above the copy, full width.'
          },
          { label: 'Two columns' }
        ]
      },
      // One option is a choice beside Other
      {
        question: 'Which tone?',
        options: [ { label: 'Warm' } ],
        other: true
      },
      { question: 'What should the headline say?' },
      {
        question: 'Which image?',
        options: [ { label: 'The beach' }, { label: 'The city' } ],
        youDecide: true
      }
    ];

    it('asks up to four questions in one ask, and refuses a fifth, bare options or a lone one', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([
        toolTurn('ask_editor', { questions: [ ...questions, { question: 'And?' } ] }, 'five'),
        toolTurn('ask_editor', {
          questions: [ {
            question: 'Which tone?',
            options: [ 'Warm', 'Formal' ]
          } ]
        }, 'bare'),
        // One option with nothing beside it is no choice
        toolTurn('ask_editor', {
          questions: [ questions[0], {
            question: 'Which tone?',
            options: [ { label: 'Warm' } ]
          } ]
        }, 'lone'),
        toolTurn('ask_editor', { questions }, 'four')
      ]);
      const waiting = await runToEnd(req, chat, 'Redo the hero');
      assert.equal(waiting.status, 'waiting');
      assert.match(resultOf(waiting, 'call-five').error, /invalid arguments/);
      assert.match(resultOf(waiting, 'call-bare').error, /invalid arguments/);
      assert.match(resultOf(waiting, 'call-lone').error, /question 2 has one option/);
      assert.deepEqual(waiting.asks, [ {
        callId: 'call-four',
        name: 'ask_editor',
        kind: 'question',
        payload: {
          kind: 'question',
          questions: [
            {
              question: 'Which layout?',
              options: [
                {
                  label: 'One column',
                  description: 'The image above the copy, full width.'
                },
                { label: 'Two columns' }
              ],
              other: false,
              youDecide: false
            },
            {
              question: 'Which tone?',
              options: [ { label: 'Warm' } ],
              other: true,
              youDecide: false
            },
            {
              question: 'What should the headline say?',
              youDecide: false
            },
            {
              question: 'Which image?',
              options: [ { label: 'The beach' }, { label: 'The city' } ],
              other: false,
              youDecide: true
            }
          ]
        }
      } ]);
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    it('takes a choice, Other, free text and "You decide", all sent once', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ toolTurn('ask_editor', { questions }, 'ask'), { text: 'Thanks.' } ]);
      await runToEnd(req, chat, 'Redo the hero');
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-ask',
        answer: {
          answers: [
            { choice: 1 },
            { text: ' Playful ' },
            { text: 'Spring is here' },
            { youDecide: true }
          ]
        }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.deepEqual(resultOf(done, 'call-ask').output, {
        answered: true,
        answers: [
          {
            question: 'Which layout?',
            answer: 'Two columns'
          },
          {
            question: 'Which tone?',
            answer: 'Playful'
          },
          {
            question: 'What should the headline say?',
            answer: 'Spring is here'
          },
          {
            question: 'Which image?',
            youDecide: true
          }
        ]
      });
    });

    it('counts the steps of a request across its answers', async function () {
      apos.aposAssistant.options.maxSteps = 2;
      try {
        const req = userReq(editor);
        const chat = await apos.aposAssistant.createChat(req);
        script = sequence([
          toolTurn('ask_editor', { questions }, 'ask'),
          toolTurn('ask_editor', { questions }, 'again')
        ]);
        const waiting = await runToEnd(req, chat, 'Redo the hero');
        assert.equal(waiting.status, 'waiting');
        await apos.aposAssistant.answer(req, chat._id, {
          tabId: 'tab-1',
          callId: 'call-ask',
          answer: {
            answers: [ { choice: 0 }, { choice: 0 }, { text: 'Hi' }, { choice: 0 } ]
          }
        });
        // The run after the answer has the one step that was left: its
        // question is never asked
        const done = await waitForEnd(req, chat);
        assert.equal(done.status, 'completed');
        assert.equal(done.finishReason, 'maxSteps');
        assert.equal(done.asks, null);
      } finally {
        apos.aposAssistant.options.maxSteps = 30;
      }
    });

    it('refuses an incomplete or mistaken answer and keeps the question waiting', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ toolTurn('ask_editor', { questions }, 'ask') ]);
      await runToEnd(req, chat, 'Redo the hero');
      const good = [ { choice: 0 }, { choice: 0 }, { text: 'Hi' }, { choice: 0 } ];
      const refused = [
        good.slice(0, 3),
        // No such option
        [ { choice: 2 }, ...good.slice(1) ],
        [ { choice: '0' }, ...good.slice(1) ],
        // Words where only an option will do
        [ { text: 'Three columns' }, ...good.slice(1) ],
        // No words
        [ good[0], good[1], { text: '  ' }, good[3] ],
        [ good[0], good[1], {}, good[3] ],
        // Left to the assistant where it didn't offer that
        [ { youDecide: true }, ...good.slice(1) ]
      ];
      for (const answers of refused) {
        await assert.rejects(apos.aposAssistant.answer(req, chat._id, {
          tabId: 'tab-1',
          callId: 'call-ask',
          answer: { answers }
        }), { name: 'invalid' });
      }
      // Only the owning browser tab answers
      await assert.rejects(apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-2',
        callId: 'call-ask',
        answer: { answers: good }
      }), { name: 'conflict' });
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest.status, 'waiting');
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    it('ends the request when the questions are skipped', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ toolTurn('ask_editor', { questions }, 'ask') ]);
      await runToEnd(req, chat, 'Redo the hero');
      const skipped = await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
      assert.equal(skipped.status, 'skipped');
      assert.equal(skipped.asks, null);
      assert.deepEqual(resultOf(skipped, 'call-ask').output, { answered: false });
      assert.equal((await apos.aposAssistant.getChat(req, chat._id)).openRequest, null);
    });
  });

  describe('confirm', function () {
    it('goes on when approved and hears a no when declined', async function () {
      const req = userReq(editor);
      for (const approved of [ true, false ]) {
        const chat = await apos.aposAssistant.createChat(req);
        script = sequence([
          toolTurn('confirm', {
            action: 'Archive the 3 old landing pages?',
            details: 'They have had no visits this year.'
          }, 'confirm'),
          { text: 'OK.' }
        ]);
        const waiting = await runToEnd(req, chat, 'Tidy up');
        assert.deepEqual(waiting.asks[0].payload, {
          kind: 'confirm',
          action: 'Archive the 3 old landing pages?',
          details: 'They have had no visits this year.'
        });
        await assert.rejects(apos.aposAssistant.answer(req, chat._id, {
          tabId: 'tab-1',
          callId: 'call-confirm',
          answer: { approved: 'yes' }
        }), { name: 'invalid' });
        await apos.aposAssistant.answer(req, chat._id, {
          tabId: 'tab-1',
          callId: 'call-confirm',
          answer: { approved }
        });
        const done = await waitForEnd(req, chat);
        assert.deepEqual(resultOf(done, 'call-confirm').output, {
          answered: true,
          approved
        });
      }
    });
  });

  describe('write_plan', function () {
    it('keeps the plan on the request, and drops it on an empty list', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const steps = [
        {
          title: 'Read the home page',
          status: 'done'
        },
        {
          title: 'Draft a warmer headline',
          status: 'active'
        },
        { title: 'Update the hero' }
      ];
      script = sequence([ toolTurn('write_plan', { steps }, 'plan') ]);
      const done = await runToEnd(req, chat, 'Warm up the hero');
      assert.deepEqual(resultOf(done, 'call-plan').output, { steps: 3 });
      assert.deepEqual(done.plan, [
        steps[0],
        steps[1],
        {
          title: 'Update the hero',
          status: 'pending'
        }
      ]);
      // The panel reads it with the request
      const { requests } = await getChat(req, chat._id);
      assert.deepEqual(requests.at(-1).plan, done.plan);

      script = sequence([
        toolTurn('write_plan', { steps }, 'plan'),
        toolTurn('write_plan', { steps: [] }, 'drop')
      ]);
      const dropped = await runToEnd(req, chat, 'Never mind the plan');
      assert.equal(dropped.plan, null);
    });
  });

  // Before the gates' tests, which take every gate off after each
  describe('publishing', function () {
    it('asks before every publish, then publishes without switching the page to edit mode', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const note = await apos.modules['assistant-note'].insert(apos.task.getReq({ mode: 'draft' }), {
        title: 'To publish'
      });
      script = sequence([
        toolTurn('publish_document', { targets: [ { _id: note._id } ] }, 'publish'),
        { text: 'Published.' }
      ]);
      await apos.aposAssistant.send(req, chat._id, {
        message: 'Publish this note',
        screen: {
          tabId: 'tab-1',
          document: { _id: note._id }
        }
      });
      const waiting = await waitForEnd(req, chat);
      assert.deepEqual(waiting.asks, [ {
        callId: 'call-publish',
        name: 'publish_document',
        kind: 'confirm',
        payload: {
          kind: 'confirm',
          gate: {
            tool: 'publish_document',
            label: 'apostrophe:aiToolPublishDocument',
            count: 1,
            typeLabel: 'Notes',
            titles: [ 'To publish' ],
            more: 0,
            title: {
              key: 'apostrophe:assistantGatePublish',
              values: { count: 1 }
            },
            approve: 'apostrophe:publish'
          }
        }
      } ]);
      const publishedId = note._id.replace(':draft', ':published');
      assert.equal(await apos.doc.db.findOne({ _id: publishedId }), null);

      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-publish',
        answer: { approved: true }
      });
      // Done on the one answer: no edit mode step waits
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.equal(resultOf(done, 'call-publish').output.published[0].status, 'published');
      assert(await apos.doc.db.findOne({ _id: publishedId }));
    });
  });

  describe('gates', function () {
    afterEach(function () {
      apos.aposAssistant.options.maxDocsWithoutConfirm = 5;
      apos.aposAssistant.gates = {};
      apos.aposAssistant.removedGates = {};
      apos.aposAssistant.addGlobalStylesGate();
      apos.aposAssistant.addPublishGate();
    });

    it('asks before one call changes more documents than maxDocsWithoutConfirm, naming them', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes, 'Renamed') ]);
      const waiting = await runToEnd(req, chat, 'Rename every note');
      assert.equal(waiting.status, 'waiting');
      assert.deepEqual(waiting.asks, [ {
        callId: 'call-update',
        name: 'update_document',
        kind: 'confirm',
        payload: {
          kind: 'confirm',
          gate: {
            tool: 'update_document',
            label: 'apostrophe:aiToolUpdateDocument',
            count: 20,
            typeLabel: 'Notes',
            titles: Array.from({ length: 20 }, (each, i) => `Note ${i + 1}`),
            more: 0
          }
        }
      } ]);
      // Nothing is written while it waits
      assert.equal(await countTitled('Renamed'), 0);
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    it('runs the call once approved', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes, 'Approved'), { text: 'Renamed them.' } ]);
      await runToEnd(req, chat, 'Rename every note');
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { approved: true }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.equal(resultOf(done, 'call-update').output.written.length, 20);
      assert.equal(await countTitled('Approved'), 20);
    });

    it('writes nothing when declined, and the model hears so', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes, 'Declined'), { text: 'Left them as they are.' } ]);
      await runToEnd(req, chat, 'Rename every note');
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { approved: false }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.match(resultOf(done, 'call-update').error, /the user declined this step, so nothing was written/);
      assert.equal(await countTitled('Declined'), 0);
    });

    it('counts a document once, whatever the number of its widgets or the form of its id', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const [ note ] = notes;
      script = sequence([
        // Twelve widgets on one document
        toolTurn('add_widgets', {
          _id: note._id,
          area: 'body',
          widgets: Array.from({ length: 12 }, (value, i) => ({
            type: '@apostrophecms/rich-text',
            content: `<p>Widget ${i + 1}</p>`
          }))
        }, 'widgets'),
        // Six ids naming the same three documents
        toolTurn('update_document', {
          targets: notes.slice(0, 3).flatMap(doc => [
            {
              _id: doc._id,
              values: { title: `${doc.title}.` }
            },
            {
              _id: doc.aposDocId,
              values: { title: `${doc.title}.` }
            }
          ])
        }, 'same')
      ]);
      const done = await runToEnd(req, chat, 'Fill the first note');
      assert.equal(done.status, 'completed');
      assert.equal(resultOf(done, 'call-widgets').output.written.length, 1);
      assert.ok(resultOf(done, 'call-same').output);
    });

    it('never asks with maxDocsWithoutConfirm 0', async function () {
      apos.aposAssistant.options.maxDocsWithoutConfirm = 0;
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes, 'Unasked') ]);
      const done = await runToEnd(req, chat, 'Rename every note');
      assert.equal(done.status, 'completed');
      assert.equal(await countTitled('Unasked'), 20);
    });

    it('adds a project\'s gate beside the standard one, and removeGate takes them all off', async function () {
      const req = userReq(editor);
      const seen = [];
      apos.aposAssistant.addGate(
        'update_document',
        'gatedTitle',
        (args, { documentCount }) => {
          seen.push(documentCount);
          return args.targets.some(target => target.values.title === 'Gated');
        }
      );
      const one = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes.slice(0, 1), 'Gated') ]);
      const waiting = await runToEnd(req, one, 'Rename one note');
      assert.equal(waiting.status, 'waiting');
      assert.equal(waiting.asks[0].payload.gate.count, 1);
      assert.deepEqual(seen, [ 1 ]);
      await apos.aposAssistant.skip(req, one._id, { tabId: 'tab-1' });

      // The standard gate still fires on its own
      const many = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes, 'Many') ]);
      assert.equal((await runToEnd(req, many, 'Rename every note')).status, 'waiting');
      await apos.aposAssistant.skip(req, many._id, { tabId: 'tab-1' });

      apos.aposAssistant.removeGate('update_document');
      const free = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes, 'Gated') ]);
      assert.equal((await runToEnd(req, free, 'Rename every note')).status, 'completed');
      assert.equal(await countTitled('Gated'), 20);
    });

    it('takes one gate off by name, the standard one too, and replaces a gate added under its name', async function () {
      const req = userReq(editor);
      assert.throws(() => apos.aposAssistant.addGate('update_document', () => true), {
        message: 'A gate of the tool "update_document" needs a name.'
      });
      const drafts = [];
      for (let i = 1; i <= 6; i++) {
        drafts.push(await apos.modules['assistant-note']
          .insert(apos.task.getReq({ mode: 'draft' }), { title: `To publish ${i}` }));
      }
      const publishAll = async () => {
        const chat = await apos.aposAssistant.createChat(req);
        script = sequence([
          toolTurn('publish_document', {
            targets: drafts.map(doc => ({ _id: doc._id }))
          }, 'publish'),
          { text: 'Published.' }
        ]);
        return {
          chat,
          request: await runToEnd(req, chat, 'Publish them')
        };
      };
      const worded = {
        key: 'apostrophe:assistantGateStylesLocale',
        values: { locale: 'English' }
      };

      // Worded again under its own name: replaced, not added beside it
      apos.aposAssistant.addGate('publish_document', 'publish', () => ({ title: worded }));
      let { chat, request } = await publishAll();
      assert.deepEqual(request.asks[0].payload.gate.title, worded);
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });

      // Without it, the standard gate asks: six documents, over five
      apos.aposAssistant.removeGate('publish_document', 'publish');
      ({ chat, request } = await publishAll());
      assert.equal(request.status, 'waiting');
      assert.equal(request.asks[0].payload.gate.title, undefined);
      assert.equal(request.asks[0].payload.gate.count, 6);
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });

      // Without that one too, nothing asks
      apos.aposAssistant.removeGate('publish_document', 'documentCount');
      ({ request } = await publishAll());
      assert.equal(request.status, 'completed');
      assert.equal(await apos.doc.db.countDocuments({
        type: 'assistant-note',
        aposMode: 'published',
        title: /^To publish /
      }), 6);
    });

    it('words a gate\'s own confirmation, and answers an alternative as a decline with its message', async function () {
      const req = userReq(editor);
      apos.aposAssistant.addGate('update_document', 'worded', () => ({
        title: {
          key: 'apostrophe:assistantGateStylesLocale',
          values: { locale: 'English' }
        },
        text: {
          key: 'apostrophe:assistantGateLive'
        },
        approve: 'apostrophe:assistantApplyNow',
        alternatives: [ {
          name: 'elsewhere',
          label: 'apostrophe:assistantOpenStyles',
          message: 'the user wants it done elsewhere'
        } ]
      }));
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn(notes.slice(0, 1), 'Worded'), { text: 'Fine.' } ]);
      const waiting = await runToEnd(req, chat, 'Rename one note');
      const { gate } = waiting.asks[0].payload;
      assert.deepEqual(gate.title, {
        key: 'apostrophe:assistantGateStylesLocale',
        values: { locale: 'English' }
      });
      // One line becomes a list of lines
      assert.deepEqual(gate.text, [ { key: 'apostrophe:assistantGateLive' } ]);
      assert.equal(gate.approve, 'apostrophe:assistantApplyNow');
      assert.equal(gate.count, 1);
      for (const answer of [
        {
          approved: false,
          alternative: 'unknown'
        },
        {
          approved: true,
          alternative: 'elsewhere'
        }
      ]) {
        await assert.rejects(apos.aposAssistant.answer(req, chat._id, {
          tabId: 'tab-1',
          callId: 'call-update',
          answer
        }), { name: 'invalid' });
      }
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: {
          approved: false,
          alternative: 'elsewhere'
        }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.equal(resultOf(done, 'call-update').error, 'the user wants it done elsewhere');
      assert.equal(await countTitled('Worded'), 0);
    });

    it('gates any tool by name, never outside the assistant\'s door', async function () {
      const req = userReq(editor);
      apos.aposAssistant.addGate('write_plan', 'longPlan', args => args.steps.length > 2);
      const chat = await apos.aposAssistant.createChat(req);
      const steps = [ 'One', 'Two', 'Three' ].map(title => ({ title }));
      script = sequence([ toolTurn('write_plan', { steps }, 'plan') ]);
      const waiting = await runToEnd(req, chat, 'Plan it');
      assert.deepEqual(waiting.asks[0].payload.gate, {
        tool: 'write_plan',
        label: 'apostrophe:aiToolWritePlan',
        count: 1,
        typeLabel: null,
        titles: [],
        more: 0
      });
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });

      // The MCP door runs the same write without a question
      const mcpReq = apos.aposHarness.withDoor(userReq(editor), {
        door: 'mcp',
        lockId: 'mcp-test',
        requestId: 'mcp-request'
      });
      const result = await apos.ai.executeToolCalls(mcpReq,
        new Map([ [ 'update_document', apos.ai.getTool('update_document') ] ]),
        [ {
          type: 'toolCall',
          id: 'mcp-call',
          name: 'update_document',
          input: {
            targets: notes.map(doc => ({
              _id: doc._id,
              values: { title: 'Through MCP' }
            }))
          }
        } ]);
      await apos.aposHarness.endRequest(mcpReq);
      assert.equal(result[0].suspended, undefined);
      assert.equal(await countTitled('Through MCP'), 20);
    });
  });

  describe('edit mode before a write to the page', function () {
    afterEach(function () {
      apos.aposAssistant.options.maxDocsWithoutConfirm = 5;
    });

    // The screen of a browser tab showing `doc`
    function showing(doc, extra = {}) {
      return {
        tabId: 'tab-1',
        document: { _id: doc._id },
        ...extra
      };
    }

    it('switches the page to edit mode before writing the document it shows, then writes', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const note = notes[0];
      script = sequence([ updateTurn([ note ], 'In edit mode'), { text: 'Renamed.' } ]);
      await apos.aposAssistant.send(req, chat._id, {
        message: 'Rename this note',
        screen: showing(note)
      });
      const waiting = await waitForEnd(req, chat);
      assert.equal(waiting.status, 'waiting');
      assert.deepEqual(waiting.asks, [ {
        callId: 'call-update',
        name: 'update_document',
        kind: 'editMode',
        payload: {
          kind: 'editMode',
          screenEffect: 'changes',
          whenHidden: {
            executed: false,
            reason: 'the user is in another browser tab'
          }
        }
      } ]);
      assert.equal(await countTitled('In edit mode'), 0);
      // The answer carries the screen it left
      await assert.rejects(apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { executed: true }
      }), { name: 'invalid' });
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { executed: true },
        screen: showing(note, { editing: true })
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.equal(resultOf(done, 'call-update').output.written.length, 1);
      assert.equal(done.screen.editing, true);
      assert.equal(await countTitled('In edit mode'), 1);
    });

    it('writes at once when the page is in edit mode, hidden or showing another document', async function () {
      const req = userReq(editor);
      const [ note, other ] = notes;
      for (const [ title, screen ] of [
        [ 'Already editing', showing(note, { editing: true }) ],
        [ 'While hidden', showing(note, { visible: false }) ],
        [ 'Shown elsewhere', showing(other) ]
      ]) {
        const chat = await apos.aposAssistant.createChat(req);
        script = sequence([ updateTurn([ note ], title), { text: 'Renamed.' } ]);
        await apos.aposAssistant.send(req, chat._id, {
          message: 'Rename the note',
          screen
        });
        assert.equal((await waitForEnd(req, chat)).status, 'completed', title);
        assert.equal(await countTitled(title), 1, title);
      }
    });

    it('asks for edit mode only once an approved gate lets the write run', async function () {
      apos.aposAssistant.options.maxDocsWithoutConfirm = 1;
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const [ note, other ] = notes;
      script = sequence([ updateTurn([ note, other ], 'Gated'), { text: 'Renamed.' } ]);
      await apos.aposAssistant.send(req, chat._id, {
        message: 'Rename both',
        screen: showing(note)
      });
      assert.equal((await waitForEnd(req, chat)).asks[0].kind, 'confirm');
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { approved: true }
      });
      assert.equal((await waitForEnd(req, chat)).asks[0].kind, 'editMode');
      assert.equal(await countTitled('Gated'), 0);
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        // A page that could not switch still gets the write
        answer: {
          executed: false,
          reason: 'the page could not enter edit mode'
        },
        screen: showing(note)
      });
      assert.equal((await waitForEnd(req, chat)).status, 'completed');
      assert.equal(await countTitled('Gated'), 2);
    });
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  async function getChat(req, chatId) {
    const chat = await apos.aposAssistant.getChat(req, chatId);
    const requests = await apos.aposAssistant.getChatRequests(req, chatId);
    return {
      chat,
      requests: requests.map(apos.aposAssistant.renderRequest)
    };
  }

  async function countTitled(title) {
    return apos.doc.db.countDocuments({
      type: 'assistant-note',
      aposMode: 'draft',
      title
    });
  }

  async function runToEnd(req, chat, message, tabId = 'tab-1') {
    await apos.aposAssistant.send(req, chat._id, {
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
      const requests = await apos.aposAssistant.getChatRequests(req, chat._id);
      request = requests.at(-1);
      const open = (await apos.aposAssistant.getChat(req, chat._id)).openRequest;
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

function updateTurn(docs, title) {
  return toolTurn('update_document', {
    targets: docs.map(doc => ({
      _id: doc._id,
      values: { title }
    }))
  }, 'update');
}

function resultOf(request, callId) {
  return request.messages
    .flatMap(message => (message.role === 'tool') ? message.content : [])
    .find(part => part.toolCallId === callId);
}

function toolTurn(name, input = {}, id = name) {
  return {
    content: [ {
      type: 'toolCall',
      id: `call-${id}`,
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
