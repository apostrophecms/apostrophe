const assert = require('assert').strict;
const path = require('path');
const t = require('../test-lib/test.js');

// The tools that spend model tokens on the server, on the scripted mock:
// `describe_images` makes one vision call per Media image on the delegation
// route, from a size variant, and keeps the bytes out of the transcript;
// with a question, it asks that instead of describing. `delegate` runs a
// read-only subagent on its own short instructions, on the delegation route or
// the effort the model names, capped in steps. Neither reaches the MCP door.

const UPLOADS = path.join(__dirname, 'data/upload_tests');

describe('Assistant: describe_images and delegate', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let images;
  let note;
  // The model's turns, by who is asking: the request's run, a subagent, a
  // vision call
  let script = null;
  let calls = [];
  let copied = [];

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock(req, request) {
              const caller = getCaller(request);
              calls.push({
                caller,
                request
              });
              return script?.[caller]?.(req, request) || { text: 'Done.' };
            }
          },
          init(self) {
            self.apos.ai.addAdapter(fakeAdapter());
          }
        },
        '@apostrophecms/harness': {
          options: {
            guidance: 'Sections start at a widget with an h2.'
          }
        },
        '@apostrophecms/assistant': {
          options: {
            enabled: true,
            titleEffort: 'none',
            effort: 'high',
            delegationMaxSteps: 3
          }
        },
        'assistant-note': {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Note',
            aiWhen: 'Short internal notes.',
            aiHow: 'One paragraph at most.'
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    const req = apos.task.getReq();
    images = [];
    for (const [ title, file ] of [
      [ 'Beach', 'upload_image.png' ],
      [ 'Crop', 'crop_image.jpeg' ],
      [ 'Logo', 'crop_image.png' ]
    ]) {
      const attachment = await apos.attachment.insert(req, {
        name: file,
        path: path.join(UPLOADS, file)
      });
      images.push(await apos.image.insert(req, {
        title,
        attachment
      }));
    }
    // A vector file has no size variants and no vision model reads it
    await apos.doc.db.updateMany({ aposDocId: images[2].aposDocId }, {
      $set: { 'attachment.extension': 'svg' }
    });
    note = await apos.modules['assistant-note'].insert(req, { title: 'Note' });
    const { uploadfs } = apos.attachment;
    const copyOut = uploadfs.copyOut;
    uploadfs.copyOut = function (from, to, callback) {
      copied.push(from);
      return copyOut.call(this, from, to, callback);
    };
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    calls = [];
    copied = [];
  });

  it('neither tool reaches the MCP door', function () {
    const mcp = apos.harness.getDoorTools('mcp').map(tool => tool.name);
    const assistant = apos.harness.getDoorTools('assistant').map(tool => tool.name);
    for (const name of [ 'describe_images', 'delegate' ]) {
      assert(!mcp.includes(name), name);
      assert(assistant.includes(name), name);
      assert.equal(apos.ai.getTool(name).kind, 'agent');
    }
  });

  describe('describe_images', function () {
    it('makes one vision call per image on delegationEffort, from the one-half size, and stores text only', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = {
        run: sequence([
          toolTurn('describe_images', { ids: images.slice(0, 2).map(image => image._id) }),
          { text: 'Both described.' }
        ]),
        vision: (req, request) => ({
          text: `A picture, ${request.messages[0].content[0].image.data.length} bytes of base64.`
        })
      };
      const request = await runToEnd(req, chat, 'Describe the two images');

      assert.equal(request.status, 'completed');
      const vision = calls.filter(call => call.caller === 'vision');
      assert.equal(vision.length, 2);
      for (const { request: call } of vision) {
        assert.equal(call.model, 'fake-small');
        const [ image, text ] = call.messages[0].content;
        assert.equal(image.type, 'image');
        assert(image.image.data.length > 0);
        assert.equal(text.text, 'Describe this image.');
      }
      const mediaTypes = vision
        .map(call => call.request.messages[0].content[0].image.mediaType);
      assert.deepEqual(mediaTypes.sort(), [ 'image/jpeg', 'image/png' ]);
      assert.deepEqual(copied.sort(), [
        `/attachments/${images[0].attachment._id}-${images[0].attachment.name}.one-half.png`,
        `/attachments/${images[1].attachment._id}-${images[1].attachment.name}.one-half.jpg`
      ].sort());

      const { output } = resultOf(request, 'call-describe_images');
      assert.deepEqual(output.images.map(({ _id, title }) => ({
        _id,
        title
      })), [
        {
          _id: images[0]._id,
          title: 'Beach'
        },
        {
          _id: images[1]._id,
          title: 'Crop'
        }
      ]);
      for (const image of output.images) {
        assert.match(image.description, /^A picture, \d+ bytes of base64\.$/);
      }
      // The transcript holds text only, no image part and no bytes
      const stored = JSON.stringify(request.messages);
      assert(!stored.includes('"image"'));
      for (const { request: call } of vision) {
        assert(!stored.includes(call.messages[0].content[0].image.data.slice(0, 64)));
      }
    });

    it('describes what it can and names why it skipped the rest', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = {
        run: sequence([
          toolTurn('describe_images', {
            ids: [ images[2]._id, 'nothing-here', note._id, images[0]._id ]
          }),
          { text: 'Done.' }
        ]),
        vision: () => ({ text: 'A beach.' })
      };
      const request = await runToEnd(req, chat, 'Describe these');

      const { images: described } = resultOf(request, 'call-describe_images').output;
      assert.equal(described.length, 4);
      assert.equal(described[0].title, 'Logo');
      assert.match(described[0].error, /svg image can't be described/);
      assert.match(described[1].error, /No Media image/);
      assert.match(described[2].error, /not a Media image/);
      assert.equal(described[3].description, 'A beach.');
      assert.equal(calls.filter(call => call.caller === 'vision').length, 1);
    });

    it('asks the model\'s question of each image in place of a description', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = {
        run: sequence([
          toolTurn('describe_images', {
            ids: images.slice(0, 2).map(image => image._id),
            question: 'Is there a person in it?'
          }),
          { text: 'Done.' }
        ]),
        vision: (req, request) => ({ text: `No. (${request.messages[0].content[1].text})` })
      };
      const request = await runToEnd(req, chat, 'Which image shows a person?');

      const vision = calls.filter(call => call.caller === 'vision');
      assert.equal(vision.length, 2);
      for (const { request: call } of vision) {
        assert.match(call.system, /answer its question about the image/);
        assert.doesNotMatch(call.system, /Say what the image shows/);
      }
      const { images: looked } = resultOf(request, 'call-describe_images').output;
      assert.deepEqual(looked.map(image => image.answer), [
        'No. (Is there a person in it?)',
        'No. (Is there a person in it?)'
      ]);
      assert(looked.every(image => image.description === undefined));
    });

    it('counts the vision calls\' tokens with the request\'s own', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = {
        run: sequence([
          toolTurn('describe_images', { ids: [ images[0]._id ] }),
          {
            text: 'Done.',
            usage: {
              inputTokens: 10,
              outputTokens: 2
            }
          }
        ]),
        vision: () => ({
          content: [ {
            type: 'text',
            text: 'A beach.'
          } ],
          finishReason: 'stop',
          usage: {
            inputTokens: 300,
            outputTokens: 40
          }
        })
      };
      const request = await runToEnd(req, chat, 'Describe it');
      assert.deepEqual(request.agentUsage, {
        inputTokens: 300,
        outputTokens: 40
      });
      const rendered = apos.assistant.renderRequest(request);
      assert.equal(rendered.agentUsage, undefined);
      assert.equal(rendered.usage.inputTokens, request.usage.inputTokens + 300);
      assert.equal(rendered.usage.outputTokens, request.usage.outputTokens + 40);
    });
  });

  describe('delegate', function () {
    it('lists only the configured effort levels, each with its description', function () {
      const { effort } = apos.ai.getTool('delegate').input.properties;
      assert.deepEqual(effort.enum, [ 'low', 'medium', 'high' ]);
      assert.match(effort.description, /\n- low: Quick reads\n- medium: Most work\n- high: Hard problems$/);
    });

    it('runs on delegationEffort with its own instructions, the site\'s and the read tools only, and stops at delegationMaxSteps', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = {
        run: sequence([
          toolTurn('delegate', { instructions: 'Find the notes about launches' }),
          { text: 'Found nothing.' }
        ]),
        // Never answers: the cap ends it
        subagent: () => toolTurn('search_content', { query: 'launch' }, `search-${calls.length}`)
      };
      const request = await runToEnd(req, chat, 'Which notes are about launches?');

      assert.equal(request.status, 'completed');
      const subagent = calls.filter(call => call.caller === 'subagent');
      assert.equal(subagent.length, 3);
      for (const { request: call } of subagent) {
        assert.equal(call.model, 'fake-small');
      }
      const { request: first } = subagent[0];
      assert.equal(first.messages[0].content[0].text, 'Find the notes about launches');
      // Its own paragraph in place of the door's base instructions, then what
      // the site provides
      assert.doesNotMatch(first.system, /Every write result/);
      assert.match(first.system, /in the language the task is written in/);
      assert(first.system.endsWith(`\n\n${apos.harness.getSiteInstructions(req)}`));
      assert.match(first.system, /\n\nSections start at a widget with an h2\.\n\n/);
      assert.match(first.system, /\nassistant-note: Short internal notes\. \(aiHow\)/);
      const tools = first.tools.map(tool => tool.name);
      assert.deepEqual(tools, [
        'find_references', 'get_changes', 'get_document', 'get_guidance', 'get_page_tree',
        'get_schema', 'list_types', 'search_content'
      ]);
      assert.deepEqual(resultOf(request, 'call-delegate').output, {
        answer: '',
        finishReason: 'maxSteps'
      });
    });

    it('runs on the effort the model names', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      script = {
        run: sequence([
          toolTurn('delegate', {
            instructions: 'Compare the note types',
            effort: 'medium'
          }),
          { text: 'Compared.' }
        ]),
        subagent: () => ({ text: 'They are the same.' })
      };
      const request = await runToEnd(req, chat, 'Compare');

      const subagent = calls.filter(call => call.caller === 'subagent');
      assert.equal(subagent.length, 1);
      assert.equal(subagent[0].request.model, 'fake-medium');
      assert.deepEqual(resultOf(request, 'call-delegate').output, {
        answer: 'They are the same.',
        finishReason: 'stop'
      });
      const main = calls.filter(call => call.caller === 'run');
      assert(main.every(call => call.request.model === 'fake-large'));
    });

    it('counts its reads as the chat\'s, and keeps a changed screen for the request\'s run', async function () {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      let read;
      script = {
        run: sequence([
          toolTurn('delegate', { instructions: 'Read the note' }),
          async () => {
            // Someone saves the note after the subagent read it
            const draft = await apos.modules['assistant-note'].findOneForEditing(
              apos.task.getReq({ mode: 'draft' }),
              { aposDocId: note.aposDocId }
            );
            draft.title = 'Retitled';
            await apos.modules['assistant-note'].update(apos.task.getReq({ mode: 'draft' }), draft);
            return updateTurn(note, 'From the model');
          },
          { text: 'Done.' }
        ]),
        subagent: sequence([
          async (req) => {
            // The browser tab's screen changes while the subagent works
            await apos.assistant.requests.updateOne({
              _id: apos.harness.getDoor(req).requestId
            }, { $set: { screenChanged: true } });
            return toolTurn('get_document', { _id: note._id }, 'read');
          },
          (req, request) => {
            read = request.messages.at(-1).content[0].output;
            return { text: 'The note is called Note.' };
          }
        ])
      };
      const request = await runToEnd(req, chat, 'Rename the note');

      assert.equal(read.title, 'Note');
      assert.equal(read.screen, undefined);
      assert(resultOf(request, 'call-delegate').output.screen);
      const { refused } = resultOf(request, 'call-update').output;
      assert.equal(refused[0].reason, 'changed');
    });
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  async function runToEnd(req, chat, message, tabId = 'tab-1') {
    await apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId }
    });
    let request;
    await waitFor(async () => {
      const requests = await apos.assistant.getChatRequests(req, chat._id);
      request = requests.at(-1);
      const job = request?.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: request.jobId });
      return request && (request.status !== 'running') && (!job || job.ended);
    });
    return request;
  }
});

function getCaller(request) {
  if (request.messages[0]?.content.some?.(part => part.type === 'image')) {
    return 'vision';
  }
  return request.system?.includes('You are a research assistant') ? 'subagent' : 'run';
}

function sequence(turns) {
  const queue = [ ...turns ];
  return (req, request) => {
    const turn = queue.shift();
    return (typeof turn === 'function') ? turn(req, request) : (turn || { text: 'Done.' });
  };
}

function updateTurn(doc, title) {
  return toolTurn('update_document', {
    targets: [ {
      _id: doc._id,
      values: { title }
    } ]
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
      structured: true,
      imageInput: true
    },
    effort: {
      low: {
        model: 'fake-small',
        description: 'Quick reads'
      },
      medium: {
        model: 'fake-medium',
        description: 'Most work'
      },
      high: {
        model: 'fake-large',
        description: 'Hard problems'
      }
    },
    models: {},
    validate() {},
    async chat() {
      throw new Error('never called under APOS_AI_MOCK');
    }
  };
}
