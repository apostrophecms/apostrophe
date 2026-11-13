const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Revert in a chat on the scripted mock: a request and every later one
// taken back as a job, the chat closed to anything else meanwhile, and the
// requests marked reverted.

describe('Assistant: revert', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let other;
  let script = null;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            mock() {
              return script ? script() : { text: 'Done.' };
            }
          }
        },
        '@apostrophecms/assistant': {
          options: {
            enabled: true,
            titleEffort: 'none'
          }
        },
        'revert-note': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              body: { type: 'string' }
            }
          }
        },
        '@apostrophecms/page': {
          options: {
            types: [ {
              name: 'revert-page',
              label: 'Revert page'
            } ]
          }
        },
        'revert-page': {
          extend: '@apostrophecms/page-type'
        },
        'revert-test-tools': {
          init(self) {
            self.apos.ai.addTool({
              name: 't_rename',
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
                const { written } = await self.apos.harness.writeDocuments(req, [ {
                  _id,
                  patch: { title }
                } ]);
                return { written: written.length };
              }
            });
            self.apos.ai.addTool({
              name: 't_write',
              description: 'Writes a document.',
              tags: [ 'assistant' ],
              input: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  patch: { type: 'object' }
                },
                required: [ '_id', 'patch' ]
              },
              handler: async (req, { _id, patch }) => {
                const { written } = await self.apos.harness.writeDocuments(req, [ {
                  _id,
                  patch
                } ]);
                return { written: written.length };
              }
            });
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    other = await t.createAdmin(apos, { username: 'other' });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
  });

  function userReq(user = editor) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  async function insertNote(title) {
    const note = await apos.modules['revert-note'].insert(userReq(), { title });
    return note._id;
  }

  function find(_id) {
    return apos.doc.db.findOne({ _id });
  }

  // A request renaming the note, run to its end
  async function rename(chat, _id, title) {
    const turns = [ {
      content: [ {
        type: 'toolCall',
        id: 'call-rename',
        name: 't_rename',
        input: {
          _id,
          title
        }
      } ],
      finishReason: 'toolCalls',
      usage: {
        inputTokens: 1,
        outputTokens: 1
      }
    }, { text: 'Renamed.' } ];
    script = () => turns.shift() || { text: 'Done.' };
    const request = await apos.assistant.send(userReq(), chat._id, {
      message: `Rename it ${title}`,
      screen: { tabId: 'tab-1' }
    });
    await waitFor(async () => {
      const stored = await apos.assistant.getRequest(userReq(), request._id);
      return (stored.status !== 'running') &&
        !(await apos.assistant.getChat(userReq(), chat._id)).openRequest &&
        await jobEnded(stored.jobId);
    });
    return apos.assistant.getRequest(userReq(), request._id);
  }

  // A request writing `patch` to the document, run to its end
  async function write(chat, _id, patch) {
    const turns = [ {
      content: [ {
        type: 'toolCall',
        id: 'call-write',
        name: 't_write',
        input: {
          _id,
          patch
        }
      } ],
      finishReason: 'toolCalls',
      usage: {
        inputTokens: 1,
        outputTokens: 1
      }
    }, { text: 'Written.' } ];
    script = () => turns.shift() || { text: 'Done.' };
    const request = await apos.assistant.send(userReq(), chat._id, {
      message: 'Write it',
      screen: { tabId: 'tab-1' }
    });
    await waitFor(async () => {
      const stored = await apos.assistant.getRequest(userReq(), request._id);
      return (stored.status !== 'running') &&
        !(await apos.assistant.getChat(userReq(), chat._id)).openRequest &&
        await jobEnded(stored.jobId);
    });
    return apos.assistant.getRequest(userReq(), request._id);
  }

  async function revert(chat, request, options = {}) {
    const started = await apos.assistant.revert(userReq(), chat._id, {
      requestId: request._id,
      tabId: 'tab-1',
      ...options
    });
    return waitForRevert(started);
  }

  function retry(chat, revertId) {
    return apos.assistant.retryRevert(userReq(), chat._id, {
      revertId,
      tabId: 'tab-1'
    });
  }

  async function waitForRevert(started) {
    await waitFor(async () => {
      const stored = await apos.assistant.getRevert(userReq(), started._id);
      return (stored.status !== 'running') && await jobEnded(stored.jobId);
    });
    return apos.assistant.getRevert(userReq(), started._id);
  }

  // A job ends only after its work's own end
  async function jobEnded(jobId) {
    const job = jobId && await apos.modules['@apostrophecms/job'].db.findOne({ _id: jobId });
    return !job || job.ended;
  }

  it('should revert a request and every later one, mark them and free the chat', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const _id = await insertNote('Original');
    const first = await rename(chat, _id, 'One');
    const second = await rename(chat, _id, 'Two');
    const third = await rename(chat, _id, 'Three');

    const checked = await apos.assistant.checkRevert(userReq(), chat._id, {
      requestId: second._id,
      tabId: 'tab-1'
    });
    assert.deepEqual(checked.requestIds, [ second._id, third._id ]);
    assert.deepEqual(checked.documents.map(document => document.outcome), [ 'putBack' ]);
    assert.equal((await find(_id)).title, 'Three');

    const done = await revert(chat, second);

    assert.equal(done.status, 'done');
    assert.deepEqual(done.requestIds, [ second._id, third._id ]);
    // The job the panel follows, one document done of one
    const job = await apos.modules['@apostrophecms/job'].db.findOne({ _id: done.jobId });
    assert.equal(job.total, 1);
    assert.equal(job.processed, 1);
    assert.deepEqual(
      done.documents.map(document => document.outcome),
      checked.documents.map(document => document.outcome)
    );
    assert.equal((await find(_id)).title, 'One');
    const requests = await apos.assistant.getChatRequests(userReq(), chat._id);
    assert.deepEqual(requests.map(request => request.revertId || null), [
      null, done._id, done._id
    ]);
    assert.equal(first.revertId, undefined);
    assert.equal((await apos.assistant.getChat(userReq(), chat._id)).openRevert, null);
    const [ entry ] = await apos.harness.changes.find({ requestId: done._id }).toArray();
    assert.equal(entry.ai, false);
    assert.equal(entry.revert, true);
    assert.deepEqual(
      (await apos.assistant.getChatReverts(userReq(), chat._id)).map(item => item._id),
      [ done._id ]
    );

    // Reverted already, and not retried as a failed request either
    await assert.rejects(revert(chat, third), { name: 'invalid' });
    const fourth = await rename(chat, _id, 'Four');
    const later = await revert(chat, first);
    assert.deepEqual(later.requestIds, [ first._id, fourth._id ]);
    assert.equal((await find(_id)).title, 'Original');
  });

  it('should refuse a revert while a request is open, and a send or a delete while a revert runs', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const _id = await insertNote('Original');
    const request = await rename(chat, _id, 'Renamed');
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    script = async () => {
      await held;
      return { text: 'Done.' };
    };
    await apos.assistant.send(userReq(), chat._id, {
      message: 'Wait',
      screen: { tabId: 'tab-1' }
    });

    const open = { reason: 'requestOpen' };
    await assert.rejects(revert(chat, request), refusal(open));
    await assert.rejects(apos.assistant.checkRevert(userReq(), chat._id, {
      requestId: request._id,
      tabId: 'tab-1'
    }), refusal(open));
    release();
    await waitFor(async () => {
      return !(await apos.assistant.getChat(userReq(), chat._id)).openRequest;
    });

    // A revert running, as its slot holds the chat
    await apos.assistant.chats.updateOne({ _id: chat._id }, {
      $set: {
        openRevert: {
          _id: 'running-revert',
          tabId: 'tab-1'
        }
      }
    });
    await apos.assistant.reverts.insertOne({
      _id: 'running-revert',
      chatId: chat._id,
      ownerId: editor._id,
      requestIds: [],
      status: 'running',
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const running = { reason: 'revertRunning' };
    await assert.rejects(apos.assistant.send(userReq(), chat._id, {
      message: 'Next',
      screen: { tabId: 'tab-1' }
    }), refusal(running));
    await assert.rejects(revert(chat, request), refusal(running));
    await assert.rejects(
      apos.assistant.deleteChat(userReq(), chat._id),
      refusal(running)
    );
  });

  it('should hold back a locked document, and put it back on retry', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const ids = [ await insertNote('Free'), await insertNote('Locked') ];
    const request = await rename(chat, ids[0], 'Free, renamed');
    await rename(chat, ids[1], 'Locked, renamed');
    const locked = await find(ids[1]);
    await apos.doc.lock(userReq(other), locked, 'other-tab');

    const done = await revert(chat, request);

    assert.equal(done.status, 'done');
    const outcome = _id => done.documents.find(document => document.docId === _id);
    assert.equal(outcome(ids[0]).outcome, 'putBack');
    assert.equal(outcome(ids[1]).outcome, 'locked');
    assert.equal(outcome(ids[1]).lockedBy, other.title);
    assert.equal((await find(ids[1])).title, 'Locked, renamed');

    await apos.doc.unlock(userReq(other), locked, 'other-tab');
    const retried = await waitForRevert(await retry(chat, done._id));

    assert.equal(retried.status, 'done');
    assert.deepEqual(
      retried.documents.map(document => [ document.docId, document.outcome ]),
      [ [ ids[1], 'putBack' ], [ ids[0], 'putBack' ] ]
    );
    assert.equal((await find(ids[1])).title, 'Locked');
    await assert.rejects(retry(chat, done._id), { name: 'invalid' });
  });

  it('should fail a revert left behind by a process that died, and run it whole on retry', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const _id = await insertNote('Original');
    const request = await rename(chat, _id, 'Renamed');
    const long = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await apos.assistant.reverts.insertOne({
      _id: 'left-revert',
      chatId: chat._id,
      ownerId: editor._id,
      tabId: 'tab-1',
      requestIds: [ request._id ],
      status: 'running',
      documents: [],
      createdAt: long,
      updatedAt: long
    });
    await apos.assistant.chats.updateOne({ _id: chat._id }, {
      $set: {
        openRevert: {
          _id: 'left-revert',
          tabId: 'tab-1'
        },
        updatedAt: long
      }
    });

    const reconciled = await apos.assistant.reconcileChat(
      userReq(),
      await apos.assistant.getChat(userReq(), chat._id)
    );

    assert.equal(reconciled.openRevert, null);
    const failed = await apos.assistant.getRevert(userReq(), 'left-revert');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error.name, 'interrupted');
    const kept = await apos.assistant.getRequest(userReq(), request._id);
    assert.equal(kept.revertId, undefined);

    const retried = await waitForRevert(await retry(chat, 'left-revert'));

    assert.equal(retried.status, 'done');
    assert.equal((await find(_id)).title, 'Original');
    const reverted = await apos.assistant.getRequest(userReq(), request._id);
    assert.equal(reverted.revertId, 'left-revert');
  });

  it('should leave reverted requests out of the transcript', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const _id = await insertNote('Original');
    await rename(chat, _id, 'One');
    const second = await rename(chat, _id, 'Two');
    await revert(chat, second);

    const transcript = await apos.assistant.getTranscript(
      await apos.assistant.getChat(userReq(), chat._id),
      { sequence: 99 }
    );

    const said = transcript
      .filter(message => message.role === 'user')
      .flatMap(message => message.content.map(part => part.text));
    assert(said.includes('Rename it One'));
    assert(!said.includes('Rename it Two'));
  });

  it('should keep a revert\'s progress, cause and the view of each document it kept, and its dismissal', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const page = await apos.page.insert(userReq(), '_home', 'lastChild', {
      type: 'revert-page',
      title: 'Spring sale'
    });
    const noteId = await insertNote('Note');
    const lockedId = await insertNote('Locked');
    const first = await write(chat, page._id, { title: 'Spring sale, shorter' });
    await write(chat, noteId, {
      title: 'Note, shorter',
      body: 'Shorter body'
    });
    await rename(chat, lockedId, 'Locked, shorter');
    // Edited by hand since: the page whole, the note's body only
    await apos.page.update(userReq(), {
      ...(await apos.page.findOneForEditing(userReq(), { _id: page._id })),
      title: 'Spring sale, by hand'
    });
    await apos.modules['revert-note'].update(userReq(), {
      ...(await apos.modules['revert-note'].findOneForEditing(userReq(), { _id: noteId })),
      body: 'By hand'
    });
    const locked = await find(lockedId);
    await apos.doc.lock(userReq(other), locked, 'other-tab');

    const checked = await apos.assistant.checkRevert(userReq(), chat._id, {
      requestId: first._id,
      tabId: 'tab-1'
    });
    const done = await revert(chat, first, { cause: 'planCancel' });

    assert.equal(done.status, 'done');
    assert.equal(done.cause, 'planCancel');
    assert.deepEqual(done.progress, {
      done: 3,
      total: 3
    });
    const byId = new Map(done.documents.map(document => [ document.docId, document ]));
    assert.equal(byId.get(page._id).outcome, 'kept');
    assert.equal(byId.get(page._id).view, 'seeChanges');
    assert.equal(byId.get(noteId).outcome, 'kept');
    assert.equal(byId.get(noteId).view, 'versions');
    assert.equal(byId.get(lockedId).outcome, 'locked');
    assert.equal(byId.get(lockedId).view, 'versions');
    assert.equal((await find(noteId)).title, 'Note');

    // As the panel reads it: no rows, partly when some were put back
    const rendered = apos.assistant.renderRevert(done);
    assert.equal(rendered.ownerId, undefined);
    assert.equal(rendered.jobId, undefined);
    const shown = new Map(rendered.documents
      .map(document => [ document.docId, document ]));
    assert.equal(shown.get(noteId).rows, undefined);
    assert.equal(shown.get(noteId).partly, true);
    assert.equal(shown.get(page._id).partly, false);
    assert.equal(shown.get(page._id).label, 'apostrophe:page');
    assert.equal(shown.get(noteId).label, apos.modules['revert-note'].options.label);
    const dry = apos.assistant.renderRevert({ documents: checked.documents });
    const summary = document => [ document.docId, document.outcome, document.partly ];
    assert.deepEqual(dry.documents.map(summary), rendered.documents.map(summary));

    // A cause the revert doesn't know is not kept
    await apos.doc.unlock(userReq(other), locked, 'other-tab');
    const unknown = await revert(chat, await rename(chat, lockedId, 'Again'), { cause: 'other' });
    assert.equal(unknown.cause, undefined);

    await apos.assistant.dismissRevert(userReq(), chat._id, { revertId: done._id });
    assert.equal((await apos.assistant.getRevert(userReq(), done._id)).dismissed, true);
    const elsewhere = await apos.assistant.createChat(userReq());
    await assert.rejects(
      apos.assistant.dismissRevert(userReq(), elsewhere._id, { revertId: done._id }),
      { name: 'notfound' }
    );
  });

  it('should not retry a failed revert once a request was sent after it', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const _id = await insertNote('Original');
    const request = await rename(chat, _id, 'Renamed');
    await apos.assistant.reverts.insertOne({
      _id: 'failed-revert',
      chatId: chat._id,
      ownerId: editor._id,
      tabId: 'tab-1',
      requestIds: [ request._id ],
      status: 'failed',
      error: {
        name: 'error',
        message: 'failed'
      },
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await rename(chat, _id, 'Renamed again');

    await assert.rejects(retry(chat, 'failed-revert'), { name: 'invalid' });

    assert.equal((await apos.assistant.getRevert(userReq(), 'failed-revert')).status, 'failed');
    assert.equal((await apos.assistant.getChat(userReq(), chat._id)).openRevert, null);
  });

  it('should delete a chat\'s reverts with it', async function () {
    const chat = await apos.assistant.createChat(userReq());
    const request = await rename(chat, await insertNote('Original'), 'Renamed');
    await revert(chat, request);

    await apos.assistant.deleteChat(userReq(), chat._id);

    assert.equal(await apos.assistant.reverts.countDocuments({ chatId: chat._id }), 0);
  });
});

function refusal({ reason }) {
  return (e) => {
    assert.equal(e.name, 'conflict');
    assert.equal(e.data.reason, reason);
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
