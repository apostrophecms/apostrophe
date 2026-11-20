const assert = require('assert').strict;
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const t = require('../test-lib/test.js');

// Chat retention on the scripted mock: a chat's delete order, with Document
// Versions keeping the AI saves; the sweep deleting chats past
// `chatExpireAfter`, finishing an interrupted delete with no file left
// unnamed, removing files never sent, one sweep at a time; and the tasks
// exporting or deleting exactly one user's chats.

const FIXTURES = path.join(__dirname, 'data/upload_tests');
const UPLOADS = path.join(__dirname, 'public/uploads');
const STORE = path.join(UPLOADS, 'apos-ai');
const LOCK = '@apostrophecms/assistant:expireChats';
const DAY = 24 * 60 * 60 * 1000;

describe('Assistant: retention', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let other;
  let scratch;
  let script = null;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'assistant-retention-'));
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock() {
              return script?.() || { text: 'Done.' };
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
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await fs.rm(STORE, {
      recursive: true,
      force: true
    });
    await fs.rm(scratch, {
      recursive: true,
      force: true
    });
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    apos.assistant.options.chatExpireAfter = 0;
  });

  it('sweeps on an interval, stopped when the app is destroyed', function () {
    assert(apos.assistant.sweepInterval);
  });

  it('deletes a chat\'s requests, reverts, files and change rows, and Document Versions keeps the AI saves', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    const image = await attach(req, chat, 'photo.png');
    script = sequence([
      toolTurn('save_attachment_to_media', { attachment: image._id }, 'save'),
      { text: 'Done.' }
    ]);
    const request = await runToEnd(req, chat, 'Save it', [ image._id ]);
    const saved = resultOf(request, 'call-save').output.written[0];
    const { aposDocId } = await apos.image.find(apos.task.getReq({ mode: 'draft' }), {
      _id: saved._id
    }).toObject();
    await revertRequest(req, chat, request);
    await attach(req, chat, 'unsent.png');
    const records = await apos.assistant.attachments.find({ chatId: chat._id }).toArray();
    assert.equal(records.length, 2);
    assert.equal(await apos.assistant.reverts.countDocuments({ chatId: chat._id }), 1);
    assert(await apos.harness.changes.countDocuments({ chat: chat._id }) > 0);

    await apos.assistant.deleteChat(req, chat._id);
    assert.equal(await apos.assistant.chats.countDocuments({ _id: chat._id }), 0);
    assert.equal(await apos.assistant.requests.countDocuments({ chatId: chat._id }), 0);
    assert.equal(await apos.assistant.reverts.countDocuments({ chatId: chat._id }), 0);
    assert.equal(await countFiles({ chatId: chat._id }), 0);
    assert.equal(await apos.harness.changes.countDocuments({ chat: chat._id }), 0);
    for (const { storage } of records) {
      await assertGone(storage);
    }
    const versions = apos.modules['@apostrophecms/document-versions'].db;
    assert(await versions.countDocuments({
      docId: aposDocId,
      ai: true
    }) > 0);
  });

  it('deletes chats past chatExpireAfter on a sweep, and none with 0', async function () {
    const req = userReq(editor);
    const old = await apos.assistant.createChat(req);
    const image = await attach(req, old, 'photo.png');
    await runToEnd(req, old, 'Look', [ image._id ]);
    const fresh = await apos.assistant.createChat(req);
    await runToEnd(req, fresh, 'Hello');
    await apos.assistant.chats.updateOne({ _id: old._id }, {
      $set: { lastRequestAt: new Date(Date.now() - 2 * DAY) }
    });

    assert.deepEqual(await apos.assistant.expireChats(), {
      chats: 0,
      files: 0
    });
    assert(await apos.assistant.chats.findOne({ _id: old._id }));

    apos.assistant.options.chatExpireAfter = DAY / 1000;
    const swept = await apos.assistant.expireChats();
    assert.equal(swept.chats, 1);
    assert.equal(await apos.assistant.chats.countDocuments({ _id: old._id }), 0);
    assert.equal(await apos.assistant.requests.countDocuments({ chatId: old._id }), 0);
    assert.equal(await apos.assistant.attachments.countDocuments({ chatId: old._id }), 0);
    assert(await apos.assistant.chats.findOne({ _id: fresh._id }));
    await apos.assistant.deleteChat(req, fresh._id);
  });

  it('finishes a delete interrupted after the bytes, and retries orphans, leaving no file unnamed', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    const image = await attach(req, chat, 'photo.png');
    await runToEnd(req, chat, 'Look', [ image._id ]);
    // Interrupted: the requests and the bytes are gone, the records not
    await apos.assistant.chats.updateOne({ _id: chat._id }, { $set: { deleting: true } });
    await apos.assistant.requests.deleteMany({ chatId: chat._id });
    const record = await apos.assistant.attachments.findOne({ _id: image._id });
    await apos.assistant.removeChatFile(record.storage);
    // A file another delete could not remove
    const left = await apos.assistant.createChat(req);
    const orphan = await attach(req, left, 'orphan.png');
    await apos.assistant.attachments.updateOne({ _id: orphan._id }, {
      $set: {
        status: 'orphan',
        removeFailedAt: new Date()
      },
      $unset: { chatId: 1 }
    });
    const orphanStorage = await storageOf(orphan);

    const swept = await apos.assistant.expireChats();
    assert.deepEqual(swept, {
      chats: 1,
      files: 1
    });
    assert.equal(await apos.assistant.chats.countDocuments({ _id: chat._id }), 0);
    assert.equal(await apos.assistant.attachments.countDocuments({
      _id: { $in: [ image._id, orphan._id ] }
    }), 0);
    await assertGone(orphanStorage);
    await assertEveryFileNamed();
    await apos.assistant.deleteChat(req, left._id);
  });

  it('removes a file never sent once it is a day old', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    const stale = await attach(req, chat, 'stale.png');
    const recent = await attach(req, chat, 'recent.png');
    await apos.assistant.attachments.updateOne({ _id: stale._id }, {
      $set: { createdAt: new Date(Date.now() - 2 * DAY) }
    });
    const storage = await storageOf(stale);
    assert.equal((await apos.assistant.expireChats()).files, 1);
    assert.equal(await apos.assistant.attachments.countDocuments({ _id: stale._id }), 0);
    await assertGone(storage);
    assert(await apos.assistant.attachments.findOne({ _id: recent._id }));
    await apos.assistant.deleteChat(req, chat._id);
  });

  it('skips a sweep while another process holds its lock', async function () {
    const req = userReq(editor);
    const chat = await apos.assistant.createChat(req);
    await runToEnd(req, chat, 'Hello');
    await apos.assistant.chats.updateOne({ _id: chat._id }, {
      $set: { lastRequestAt: new Date(Date.now() - 2 * DAY) }
    });
    apos.assistant.options.chatExpireAfter = DAY / 1000;
    // Another process's sweep, as this process sees its lock
    await apos.lock.db.insertOne({
      _id: LOCK,
      when: Date.now(),
      idleTimeout: 30000,
      unique: 'other-process'
    });
    try {
      assert.equal(await apos.assistant.expireChats(), null);
      assert(await apos.assistant.chats.findOne({ _id: chat._id }));
    } finally {
      await apos.lock.db.deleteOne({ _id: LOCK });
    }
    assert.equal((await apos.assistant.expireChats()).chats, 1);
    assert.equal(await apos.lock.db.countDocuments({ _id: LOCK }), 0);
  });

  it('exports, then deletes, exactly one user\'s chats', async function () {
    const mine = await apos.assistant.createChat(userReq(editor));
    const image = await attach(userReq(editor), mine, 'photo.png');
    await runToEnd(userReq(editor), mine, 'Look', [ image._id ]);
    const theirs = await apos.assistant.createChat(userReq(other));
    const theirImage = await attach(userReq(other), theirs, 'theirs.png');
    await runToEnd(userReq(other), theirs, 'Look', [ theirImage._id ]);

    const dir = path.join(scratch, 'export');
    await apos.task.invoke('@apostrophecms/assistant:export-chats', {
      user: 'editor',
      dir
    });
    const text = await fs.readFile(path.join(dir, 'chats.json'), 'utf8');
    const exported = JSON.parse(text);
    assert.equal(exported.ownerId, editor._id);
    assert.deepEqual(exported.chats.map(chat => chat._id), [ mine._id ]);
    const [ chat ] = exported.chats;
    assert.equal(chat.requests.length, 1);
    assert.equal(chat.attachments.length, 1);
    assert.equal(chat.attachments[0].storage, undefined);
    // No chat file's path is ever given out
    assert.doesNotMatch(text, /apos-ai/);
    const copied = await fs.readFile(path.join(dir, chat.attachments[0].file));
    assert.deepEqual(copied, await fs.readFile(path.join(FIXTURES, 'upload_image.png')));
    // An export goes only into an empty directory
    await assert.rejects(apos.assistant.exportUserChats(editor._id, dir), { name: 'invalid' });

    await apos.task.invoke('@apostrophecms/assistant:delete-chats', { user: editor._id });
    assert.equal(await apos.assistant.chats.countDocuments({ ownerId: editor._id }), 0);
    assert.equal(await countFiles({ ownerId: editor._id }), 0);
    assert(await apos.assistant.chats.findOne({ _id: theirs._id }));
    assert(await apos.assistant.attachments.findOne({ _id: theirImage._id }));
    await apos.assistant.deleteChat(userReq(other), theirs._id);
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  function countFiles(criteria) {
    return apos.assistant.attachments.countDocuments(criteria);
  }

  async function storageOf(attachment) {
    return (await apos.assistant.attachments.findOne({ _id: attachment._id })).storage;
  }

  async function attach(req, chat, name) {
    const file = path.join(scratch, `${apos.util.generateId()}-${name}`);
    await fs.copyFile(path.join(FIXTURES, 'upload_image.png'), file);
    return apos.assistant.attach(req, chat._id, {
      originalname: name,
      path: file
    });
  }

  async function runToEnd(req, chat, message, attachments = []) {
    await apos.assistant.send(req, chat._id, {
      message,
      screen: { tabId: 'tab-1' },
      attachments
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

  async function revertRequest(req, chat, request) {
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
  }

  async function assertGone(storage) {
    for (const stored of [ storage.path, ...Object.values(storage.sizes || {}) ]) {
      await assert.rejects(fs.access(path.join(UPLOADS, stored)), { code: 'ENOENT' });
    }
  }

  // Every file in the store is named by a record
  async function assertEveryFileNamed() {
    const named = new Set();
    for (const { storage } of await apos.assistant.attachments.find({}).toArray()) {
      for (const stored of [ storage.path, ...Object.values(storage.sizes || {}) ]) {
        named.add(stored);
      }
    }
    let files = [];
    try {
      files = await fs.readdir(STORE);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
    for (const file of files) {
      assert(named.has(`/apos-ai/${file}`), `${file} is named by no record`);
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
