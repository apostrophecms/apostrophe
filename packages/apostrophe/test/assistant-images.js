const assert = require('assert').strict;
const fs = require('fs/promises');
const path = require('path');
const t = require('../test-lib/test.js');

// `generate_image` on the scripted mock: candidates held as chat files until
// the ask resolves, Use saving the picked one through the one save into
// Media (a new image, or the file of the image it replaces), Try again and
// Refine generating the next round, Cancel and Skip leaving nothing, a save
// Media refuses keeping the picked image, and no generation for a user who
// may not upload.

const FIXTURES = path.join(__dirname, 'data/upload_tests');
const UPLOADS = path.join(__dirname, 'public/uploads');
const INPUT = {
  prompt: 'A rocket launch at night',
  title: 'Night launch',
  alt: 'A rocket lifting off at night'
};

describe('Assistant: images', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let other;
  let guest;
  let script = null;
  let imageCalls = [];
  let png;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    png = (await fs.readFile(path.join(FIXTURES, 'upload_image.png'))).toString('base64');
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock(req, request) {
              return script?.(req, request) || { text: 'Done.' };
            },
            mockImage(req, request) {
              imageCalls.push(request);
              return Array.from({ length: request.count }, () => ({
                type: 'png',
                data: png
              }));
            }
          },
          init(self) {
            self.apos.ai.addAdapter(fakeAdapter());
          }
        },
        '@apostrophecms/assistant': {
          options: {
            enabled: true,
            titleEffort: 'none',
            effort: 'high'
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    other = await t.createAdmin(apos, { username: 'other' });
    guest = await t.createUser(apos, 'guest', { username: 'guest' });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await fs.rm(path.join(UPLOADS, 'apos-ai'), {
      recursive: true,
      force: true
    });
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    imageCalls = [];
  });

  it('holds the options until Use, which saves the picked one to Media through the change log', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    const before = await countImages();
    script = sequence([ toolTurn('generate_image', INPUT, 'gen'), { text: 'Done.' } ]);
    const waiting = await runToEnd(req, chat, 'Make a launch image');
    assert.equal(waiting.status, 'waiting');
    const [ ask ] = waiting.asks;
    assert.equal(ask.kind, 'images');
    assert.equal(ask.payload.title, 'Night launch');
    assert.equal(ask.payload.round, 1);
    assert.equal(ask.payload.candidates.length, apos.assistant.options.genImageCount);
    assert.equal(imageCalls[0].count, apos.assistant.options.genImageCount);
    assert.equal(imageCalls[0].images, undefined);
    // Nothing in Media yet; the options are the owner's to look at
    assert.equal(await countImages(), before);
    const held = await apos.assistant.attachments
      .find({ requestId: waiting._id })
      .toArray();
    assert.equal(held.length, 4);
    assert(held.every(record => record.kind === 'candidate' && record.callId === 'call-gen'));
    const { data } = await apos.assistant.readAttachment(req, chat._id,
      ask.payload.candidates[1]._id, { size: 'thumbnail' });
    assert(data.length > 0);
    await assert.rejects(apos.assistant.readAttachment(userReq(other), chat._id,
      ask.payload.candidates[1]._id), { name: 'notfound' });

    const done = await answer(req, chat, 'call-gen', {
      action: 'use',
      candidate: ask.payload.candidates[1]._id
    });
    assert.equal(done.status, 'completed');
    const result = resultOf(done, 'call-gen').output;
    assert.equal(result.used, true);
    assert.equal(result.option, 2);
    assert.equal(result.written[0].title, 'Night launch');
    assert.equal(result.written[0].published, true);
    assert.match(result.media, /"Night launch" is in the Media library/);
    assert.equal(await countImages(), before + 1);
    const image = await apos.image.find(apos.task.getReq({ mode: 'draft' }), {
      _id: result.written[0]._id
    }).toObject();
    assert.equal(image.alt, 'A rocket lifting off at night');
    const logged = await apos.harness.changes.find({ requestId: done._id }).toArray();
    assert(logged.some(row => row.aposDocId === image.aposDocId));
    // Every option is gone, the used one too: Media holds it now
    assert.equal(await countRequestFiles(done), 0);
    for (const { storage } of held) {
      await assertGone(storage);
    }
    assert.deepEqual(done.imageAsks, [ {
      callId: 'call-gen',
      title: 'Night launch',
      replaces: null,
      rounds: [],
      outcome: {
        action: 'use',
        option: 2,
        imageId: image._id,
        attachmentId: null
      }
    } ]);
    assert.equal(done.notices.length, 1);
    const { _id: noticeId, ...notice } = done.notices[0];
    assert(noticeId);
    assert.deepEqual(notice, {
      callId: 'call-gen',
      tone: 'success',
      title: 'apostrophe:assistantSavedToMedia',
      text: 'apostrophe:assistantSavedToMediaText',
      interpolate: { title: 'Night launch' },
      link: {
        _id: image._id,
        type: '@apostrophecms/image',
        label: 'apostrophe:assistantOpenInMedia'
      },
      action: null
    });

    await revert(req, chat, done);
    const reverted = await apos.image.find(apos.task.getReq({ mode: 'draft' }), {
      aposDocId: image.aposDocId
    }).archived(null).toObject();
    assert.equal(reverted.archived, true);
  });

  it('leaves nothing on Cancel or Skip', async function () {
    const req = userReq(editor);
    const before = await countImages();
    for (const end of [ 'cancel', 'skip' ]) {
      const chat = await apos.assistant.createChat(req);
      script = sequence([ toolTurn('generate_image', INPUT, 'gen'), { text: 'Done.' } ]);
      const waiting = await runToEnd(req, chat, 'Make a launch image');
      const held = await apos.assistant.attachments
        .find({ requestId: waiting._id })
        .toArray();
      assert.equal(held.length, 4);
      let done;
      if (end === 'cancel') {
        done = await answer(req, chat, 'call-gen', { action: 'cancel' });
        assert.equal(done.status, 'completed');
        assert.equal(resultOf(done, 'call-gen').output.used, false);
      } else {
        await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
        done = await apos.assistant.getRequest(req, waiting._id);
        assert.equal(done.status, 'skipped');
      }
      assert.equal(done.imageAsks[0].outcome.action, (end === 'cancel') ? 'cancel' : 'skipped');
      assert.equal(await countRequestFiles(done), 0);
      for (const { storage } of held) {
        await assertGone(storage);
      }
    }
    assert.equal(await countImages(), before);
  });

  it('makes new options on Try again and Refine, from the picked image or from the original', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    script = sequence([ toolTurn('generate_image', INPUT, 'gen'), { text: 'Done.' } ]);
    const first = (await runToEnd(req, chat, 'Make a launch image')).asks[0].payload;

    const again = (await answerAndWait(req, chat, { action: 'again' })).asks[0].payload;
    assert.equal(again.round, 2);
    assert.equal(imageCalls[1].prompt, INPUT.prompt);
    assert.equal(await countHeld(first.candidates), 0);

    const picked = again.candidates[2]._id;
    const fromPick = (await answerAndWait(req, chat, {
      action: 'refine',
      candidate: picked,
      notes: 'Add a full moon'
    })).asks[0].payload;
    assert.equal(fromPick.round, 3);
    assert.equal(fromPick.source, picked);
    assert.equal(imageCalls[2].images.length, 1);
    assert.match(imageCalls[2].prompt, /Add a full moon/);
    const kept = await apos.assistant.attachments.findOne({ _id: picked });
    assert.equal(kept.kept, true);
    assert.equal(await countHeld(again.candidates), 1);

    const fromOriginal = (await answerAndWait(req, chat, {
      action: 'refine',
      notes: 'Make it dawn'
    })).asks[0].payload;
    assert.equal(fromOriginal.source, null);
    assert.equal(imageCalls[3].images, undefined);
    assert.match(imageCalls[3].prompt, /^A rocket launch at night\n\n.*Add a full moon Make it dawn$/);
    assert.equal(await countHeld(fromPick.candidates), 0);

    const done = await answer(req, chat, 'call-gen', { action: 'cancel' });
    assert.deepEqual(done.imageAsks[0].rounds, [
      { action: 'again' },
      {
        action: 'refine',
        notes: 'Add a full moon',
        kept: picked
      },
      {
        action: 'refine',
        notes: 'Make it dawn',
        kept: null
      }
    ]);
    // The image picked on Refine stays with the chat, as the thread shows it
    const left = await apos.assistant.attachments.find({ requestId: done._id }).toArray();
    assert.deepEqual(left.map(record => record._id), [ picked ]);
    await apos.assistant.deleteChat(req, chat._id);
    await assertGone(kept.storage);
  });

  it('refuses answers that name no image of the round or no notes', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    script = sequence([ toolTurn('generate_image', INPUT, 'gen'), { text: 'Done.' } ]);
    await runToEnd(req, chat, 'Make a launch image');
    for (const bad of [
      { action: 'use' },
      {
        action: 'use',
        candidate: 'nope'
      },
      { action: 'refine' },
      { action: 'pick' }
    ]) {
      await assert.rejects(apos.assistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-gen',
        answer: bad
      }), { name: 'invalid' });
    }
    await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
  });

  it('edits a Media image in place on Use, and revert brings its file back', async function () {
    const req = userReq(editor);
    const hero = await insertImage('Hero product shot');
    const chat = await apos.assistant.createChat(req);
    script = sequence([
      toolTurn('generate_image', {
        ...INPUT,
        prompt: 'Warmer light',
        fromImage: hero._id,
        replaces: hero._id
      }, 'gen'),
      { text: 'Done.' }
    ]);
    const waiting = await runToEnd(req, chat, 'Fix the lighting on the hero image');
    const { payload } = waiting.asks[0];
    assert.deepEqual(payload.replaces, {
      _id: (await findImage(hero))._id,
      title: 'Hero product shot'
    });
    // The Media image is copied into the chat as the source
    assert(payload.original);
    assert.equal(payload.source, payload.original);
    assert.equal(imageCalls[0].images.length, 1);
    assert.equal(imageCalls[0].images[0].mediaType, 'image/png');
    const done = await answer(req, chat, 'call-gen', {
      action: 'use',
      candidate: payload.candidates[0]._id
    });
    const result = resultOf(done, 'call-gen').output;
    assert.match(result.media, /"Hero product shot" was updated in the Media library/);
    const updated = await findImage(hero);
    assert.notEqual(updated.attachment._id, hero.attachment._id);
    // The image keeps its own title and alt
    assert.equal(updated.title, 'Hero product shot');
    assert.equal(updated.alt, 'The hero');
    assert.equal(done.notices[0].title, 'apostrophe:assistantUpdatedInMedia');
    // The copy went with the ask
    assert.equal(await countRequestFiles(done), 0);

    await revert(req, chat, done);
    assert.equal((await findImage(hero)).attachment._id, hero.attachment._id);
  });

  it('keeps the picked image when the save is refused, and Retry saves it into the same image', async function () {
    const req = userReq(editor);
    const hero = await insertImage('Locked hero');
    const draft = await findImage(hero);
    await apos.doc.lock(userReq(other), draft, 'other-tab');
    const chat = await apos.assistant.createChat(req);
    script = sequence([
      toolTurn('generate_image', {
        ...INPUT,
        fromImage: hero._id,
        replaces: hero._id
      }, 'gen'),
      { text: 'Done.' }
    ]);
    const waiting = await runToEnd(req, chat, 'Fix the hero');
    const done = await answer(req, chat, 'call-gen', {
      action: 'use',
      candidate: waiting.asks[0].payload.candidates[0]._id
    });
    const result = resultOf(done, 'call-gen').output;
    assert.equal(result.saved, false);
    assert.match(result.error, /being edited by other/);
    const kept = await apos.assistant.attachments.findOne({ _id: result.attachment });
    assert.equal(kept.kind, 'attachment');
    assert.equal(kept.replaces, draft._id);
    assert.equal(kept.name, 'night-launch.png');
    assert.deepEqual(done.imageAsks[0].outcome, {
      action: 'use',
      option: 1,
      imageId: null,
      attachmentId: kept._id
    });
    const [ failed ] = done.notices;
    assert.equal(failed.tone, 'error');
    assert.equal(failed.title, 'apostrophe:assistantNotSavedToMedia');
    assert.equal(failed.text, 'apostrophe:assistantSaveLocked');
    assert.deepEqual(failed.interpolate, {
      title: 'Locked hero',
      name: 'other'
    });
    assert.equal(failed.action.name, 'saveToMedia');
    // The action's data is the server's
    assert.deepEqual(apos.assistant.renderRequest(done).notices[0].action, {
      name: 'saveToMedia',
      label: 'apostrophe:assistantRetry'
    });
    assert.equal((await findImage(hero)).attachment._id, hero.attachment._id);

    // Retry while still locked: refused again, with Retry again
    const again = await retry(req, chat, done, failed);
    assert.equal(again.status, 'completed');
    assert.deepEqual(again.action, {
      name: 'saveToMedia',
      requestId: done._id,
      noticeId: failed._id
    });
    assert.equal(again.notices[0].text, 'apostrophe:assistantSaveLocked');
    assert.equal(again.notices[0].action.name, 'saveToMedia');
    // Run once: a second click finds it gone
    await assert.rejects(retry(req, chat, done, failed), { name: 'invalid' });
    const first = await apos.assistant.getRequest(req, done._id);
    assert.equal(apos.assistant.renderRequest(first).notices[0].action, null);

    await apos.doc.unlock(userReq(other), draft, 'other-tab');
    const saved = await retry(req, chat, again, again.notices[0]);
    assert.equal(saved.status, 'completed');
    assert.equal(saved.notices[0].title, 'apostrophe:assistantUpdatedInMedia');
    const updated = await findImage(hero);
    assert.notEqual(updated.attachment._id, hero.attachment._id);
    // Named after the image it replaced
    assert.match(updated.attachment.name, /^locked-hero/);
    assert.equal(await apos.assistant.attachments.countDocuments({ _id: kept._id }), 0);
    // The round it was picked in shows the Media image now
    const picked = await apos.assistant.getRequest(req, done._id);
    assert.equal(picked.imageAsks[0].outcome.imageId, updated._id);
    assert.equal(picked.imageAsks[0].outcome.attachmentId, null);
    // What the model replays: the user's line, the save's call and its result
    const [ user, call, tool ] = saved.messages;
    assert.equal(user.role, 'user');
    assert.equal(call.content[0].name, 'save_attachment_to_media');
    assert.deepEqual(call.content[0].input, { attachment: kept._id });
    assert.equal(tool.content[0].output.written[0].title, 'Locked hero');
    let replayed;
    script = (scriptReq, request) => {
      replayed = request.messages;
      return { text: 'Good.' };
    };
    await runToEnd(req, chat, 'Thanks');
    assert(replayed.some(message => (message.role === 'assistant') &&
      message.content.some?.(part => part.id === call.content[0].id)));

    // The retry is a request like any other: its revert puts the file back
    await revert(req, chat, saved);
    assert.equal((await findImage(hero)).attachment._id, hero.attachment._id);
  });

  it('saves an attached image into a Media image it replaces', async function () {
    const req = userReq(editor);
    const hero = await insertImage('Team photo');
    const chat = await apos.assistant.createChat(req);
    const file = path.join(UPLOADS, `${apos.util.generateId()}.png`);
    await fs.copyFile(path.join(FIXTURES, 'upload_image.png'), file);
    const attached = await apos.assistant.attach(req, chat._id, {
      originalname: 'new-team.png',
      path: file
    });
    await fs.rm(file);
    script = sequence([
      toolTurn('save_attachment_to_media', {
        attachment: attached._id,
        title: 'Ignored',
        replaces: hero._id
      }, 'save'),
      { text: 'Done.' }
    ]);
    const done = await runToEnd(req, chat, 'Replace the team photo with this', [ attached._id ]);
    const output = resultOf(done, 'call-save').output;
    assert.match(output.media, /"Team photo" was updated/);
    const updated = await findImage(hero);
    assert.notEqual(updated.attachment._id, hero.attachment._id);
    assert.equal(updated.title, 'Team photo');
  });

  it('generates nothing for a user who may not upload, and refuses a bad source', async function () {
    const guestReq = userReq(guest);
    let chat = await apos.assistant.createChat(guestReq);
    script = sequence([ toolTurn('generate_image', INPUT, 'gen'), { text: 'Done.' } ]);
    let done = await runToEnd(guestReq, chat, 'Make an image');
    assert.match(resultOf(done, 'call-gen').error, /may not upload images, so no image was generated/);
    assert.equal(imageCalls.length, 0);

    const req = userReq(editor);
    chat = await apos.assistant.createChat(req);
    const hero = await insertImage('Source');
    script = sequence([
      toolTurn('generate_image', {
        ...INPUT,
        fromImage: hero._id,
        fromAttachment: 'x'
      }, 'two'),
      toolTurn('generate_image', {
        ...INPUT,
        fromAttachment: 'missing'
      }, 'missing'),
      toolTurn('generate_image', {
        ...INPUT,
        fromImage: 'missing'
      }, 'notimage'),
      { text: 'Done.' }
    ]);
    done = await runToEnd(req, chat, 'Edit');
    assert.match(resultOf(done, 'call-two').error, /Name one source/);
    assert.match(resultOf(done, 'call-missing').error, /No file attached/);
    assert.match(resultOf(done, 'call-notimage').error, /No Media image/);
    assert.equal(imageCalls.length, 0);
  });

  it('is the assistant\'s alone', function () {
    const mcp = apos.harness.getDoorTools('mcp').map(tool => tool.name);
    const assistant = apos.harness.getDoorTools('assistant').map(tool => tool.name);
    assert(assistant.includes('generate_image'));
    assert(!mcp.includes('generate_image'));
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  async function countImages() {
    return apos.image.find(apos.task.getReq({ mode: 'draft' })).toCount();
  }

  function countRequestFiles(request) {
    return apos.assistant.attachments.countDocuments({ requestId: request._id });
  }

  async function countHeld(candidates) {
    return apos.assistant.attachments.countDocuments({
      _id: { $in: candidates.map(each => each._id) }
    });
  }

  async function insertImage(title) {
    const req = apos.task.getReq();
    const attachment = await apos.attachment.insert(req, {
      name: 'upload_image.png',
      path: path.join(FIXTURES, 'upload_image.png')
    });
    return apos.image.insert(req, {
      title,
      alt: 'The hero',
      attachment
    });
  }

  function findImage(image) {
    return apos.image.find(apos.task.getReq({ mode: 'draft' }), {
      aposDocId: image.aposDocId
    }).toObject();
  }

  async function runToEnd(req, chat, message, attachments = []) {
    await apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId: 'tab-1' },
      attachments
    });
    return waitForEnd(req, chat);
  }

  async function answer(req, chat, callId, value) {
    await apos.assistant.answer(req, chat._id, {
      tabId: 'tab-1',
      callId,
      answer: value
    });
    return waitForEnd(req, chat);
  }

  function answerAndWait(req, chat, value) {
    return answer(req, chat, 'call-gen', value);
  }

  async function retry(req, chat, request, notice) {
    const started = await apos.assistant.runNoticeAction(req, chat._id, {
      requestId: request._id,
      noticeId: notice._id,
      screen: { tabId: 'tab-1' }
    });
    return waitForEnd(req, chat).then(() => apos.assistant.getRequest(req, started._id));
  }

  async function waitForEnd(req, chat) {
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

  async function revert(req, chat, request) {
    const started = await apos.assistant.revert(req, chat._id, {
      requestId: request._id,
      tabId: 'tab-1'
    });
    await waitFor(async () => {
      const stored = await apos.assistant.getRevert(req, started._id);
      const job = stored.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: stored.jobId });
      return (stored.status !== 'running') && (!job || job.ended);
    });
    const ended = await apos.assistant.getRevert(req, started._id);
    assert.equal(ended.status, 'done');
    return ended;
  }

  async function assertGone(storage) {
    for (const stored of [ storage.path, ...Object.values(storage.sizes || {}) ]) {
      await assert.rejects(fs.access(path.join(UPLOADS, stored)), { code: 'ENOENT' });
    }
  }
});

function sequence(turns) {
  const queue = [ ...turns ];
  return () => queue.shift() || { text: 'Done.' };
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
      imageInput: true,
      documentInput: true
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
