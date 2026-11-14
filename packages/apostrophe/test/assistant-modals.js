const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The assistant in open editors, on the scripted mock: an editor's save of
// fields the assistant wrote into it records those fields, and only those,
// as the request's rows in the change log.

describe('Assistant: working in open editors', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock() {
              return { text: 'Done.' };
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
              subtitle: {
                type: 'string',
                label: 'Subtitle'
              },
              body: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    'assistant-card': {}
                  }
                }
              },
              items: {
                type: 'array',
                fields: {
                  add: {
                    label: {
                      type: 'string',
                      label: 'Label'
                    }
                  }
                }
              }
            }
          }
        },
        'assistant-card-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              heading: {
                type: 'string',
                label: 'Heading'
              }
            }
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    await t.createAdmin(apos, { username: 'other' });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  describe('an editor\'s save of fields written from outside', function () {
    let jar;
    let otherJar;

    before(async function () {
      jar = await t.loginAs(apos, 'editor');
      otherJar = await t.loginAs(apos, 'other');
    });

    it('records the fields the request wrote as its rows, the editor\'s own as the editor\'s', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Before');
      const draft = await getDraft(note, jar);
      draft.title = 'Written by the assistant';
      draft.subtitle = 'Typed by the editor';
      const saved = await put(draft, jar, outside(request, [ 'title' ]));
      assert.equal(saved._outside, undefined);
      assert.equal((await apos.doc.db.findOne({ _id: draft._id }))._outside, undefined);

      const entries = await entriesOf(request, note);
      assert.equal(entries.length, 1);
      const [ entry ] = entries;
      assert.deepEqual(entry.rows.map(pathOf), [ 'title' ]);
      assert.deepEqual(entry.fields, [ 'title' ]);
      assert.equal(entry.door, 'assistant');
      assert.equal(entry.chat, request.chatId);
      assert.equal(entry.ai, true);
      assert.equal(entry.userId, editor._id);
      // The request had ended: a closed entry
      assert.equal(entry.base, undefined);
      assert.equal(entry.head, undefined);
    });

    it('records a widget\'s and an array item\'s fields by their paths, nothing else of theirs', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Paths', {
        body: area([ card('c1', 'One'), card('c2', 'Two') ]),
        items: [ item('i1', 'First'), item('i2', 'Second') ]
      });
      const draft = await getDraft(note, jar);
      draft.body.items[0].heading = 'One, rewritten';
      draft.body.items[1].heading = 'Two, typed';
      draft.items[0].label = 'First, rewritten';
      draft.items[1].label = 'Second, typed';
      await put(draft, jar, outside(request, [ '@c1.heading', '@i1.label' ]));

      const [ entry ] = await entriesOf(request, note);
      assert.deepEqual(
        entry.rows.map(pathOf).sort(),
        [ 'body.c1.heading', 'items.i1.label' ]
      );
    });

    it('records a whole area written from a document editor, its rich text included', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Area', {
        body: area([ richText('w1', '<p>One</p>') ])
      });
      const draft = await getDraft(note, jar);
      draft.body.items[0].content = '<p>One, rewritten</p>';
      draft.body.items.push(card('c3', 'Added'));
      draft.subtitle = 'Typed by the editor';
      await put(draft, jar, outside(request, [ 'body' ]));

      const [ entry ] = await entriesOf(request, note);
      assert.deepEqual(entry.rows.map(pathOf).sort(), [ 'body.c3', 'body.w1' ]);
    });

    it('records a PATCH of the page\'s patches the same way', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Patched', {
        body: area([ card('c1', 'One'), card('c2', 'Two') ])
      });
      await apos.http.patch(`/api/v1/assistant-note/${note._id}`, {
        jar,
        body: {
          _patches: [
            { '@c1.heading': 'One, rewritten' },
            { '@c2.heading': 'Two, typed' }
          ],
          _outside: outside(request, [ '@c1.heading' ])
        }
      });
      const [ entry ] = await entriesOf(request, note);
      assert.deepEqual(entry.rows.map(pathOf), [ 'body.c1.heading' ]);
    });

    it('records each request\'s own fields in its own entry', async function () {
      const first = await endedRequest(editor);
      const second = await endedRequest(editor);
      const note = await insertNote('Two requests');
      const draft = await getDraft(note, jar);
      draft.title = 'From the first';
      draft.subtitle = 'From the second';
      await put(draft, jar, {
        tabId: 'tab-1',
        parts: [
          {
            marker: { requestId: first._id },
            fields: [ 'title' ]
          },
          {
            marker: { requestId: second._id },
            fields: [ 'subtitle' ]
          }
        ]
      });
      assert.deepEqual((await entriesOf(first, note))[0].rows.map(pathOf), [ 'title' ]);
      assert.deepEqual((await entriesOf(second, note))[0].rows.map(pathOf), [ 'subtitle' ]);
    });

    it('records nothing for fields the save left as they were', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Unchanged');
      const draft = await getDraft(note, jar);
      draft.subtitle = 'Typed by the editor';
      await put(draft, jar, outside(request, [ 'title' ]));
      assert.deepEqual(await entriesOf(request, note), []);
    });

    it('ignores a marker of another user\'s request, of another browser tab or unknown', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Forged');

      const fromOther = await getDraft(note, otherJar);
      fromOther.title = 'By the other user';
      await put(fromOther, otherJar, outside(request, [ 'title' ]));

      const fromTab = await getDraft(note, jar);
      fromTab.title = 'From another browser tab';
      await put(fromTab, jar, outside(request, [ 'title' ], 'tab-2'));

      const unknown = await getDraft(note, jar);
      unknown.title = 'Unknown request';
      await put(unknown, jar, outside({ _id: 'nope' }, [ 'title' ]));

      assert.deepEqual(await entriesOf(request, note), []);
      const logged = await apos.harness.changes.countDocuments({ docId: fromOther._id });
      assert.equal(logged, 0);
    });

    it('lets the chat revert what the request wrote through the editor, nothing of the editor\'s', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Before');
      const draft = await getDraft(note, jar);
      draft.title = 'Written by the assistant';
      draft.subtitle = 'Typed by the editor';
      await put(draft, jar, outside(request, [ 'title' ]));

      const req = userReq(editor);
      const started = await apos.assistant.revert(req, request.chatId, {
        requestId: request._id,
        tabId: 'tab-1'
      });
      await waitFor(async () => {
        const stored = await apos.assistant.getRevert(req, started._id);
        const job = stored.jobId &&
          await apos.modules['@apostrophecms/job'].db.findOne({ _id: stored.jobId });
        return (stored.status !== 'running') && (!job || job.ended);
      });
      assert.equal((await apos.assistant.getRevert(req, started._id)).status, 'done');
      const reverted = await apos.doc.db.findOne({ _id: draft._id });
      assert.equal(reverted.title, 'Before');
      assert.equal(reverted.subtitle, 'Typed by the editor');
    });

    it('leaves the entry open while the request runs, as its own writes do', async function () {
      const request = await endedRequest(editor);
      await apos.assistant.requests.updateOne({ _id: request._id }, {
        $set: { status: 'waiting' }
      });
      const note = await insertNote('Open');
      const draft = await getDraft(note, jar);
      draft.title = 'While it waits';
      await put(draft, jar, outside(request, [ 'title' ]));
      const [ entry ] = await entriesOf(request, note);
      assert(entry.head instanceof Date);
      assert(entry.base);
    });
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  // A request of the user's that ran and ended, sent from `tab-1`
  async function endedRequest(user) {
    const req = userReq(user);
    const chat = await apos.assistant.createChat(req);
    await apos.assistant.send(req, chat._id, {
      message: 'Hello',
      screen: { tabId: 'tab-1' }
    });
    let request;
    await waitFor(async () => {
      [ request ] = await apos.assistant.getChatRequests(req, chat._id);
      const job = request?.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: request.jobId });
      return request && (request.status !== 'running') && (!job || job.ended);
    });
    return request;
  }

  function insertNote(title, values = {}) {
    return apos.modules['assistant-note'].insert(userReq(editor), {
      title,
      ...values
    });
  }

  function getDraft(note, jar) {
    return apos.http.get(`/api/v1/assistant-note/${note._id}`, {
      jar,
      qs: { aposMode: 'draft' }
    });
  }

  function put(draft, jar, outsideBody) {
    return apos.http.put(`/api/v1/assistant-note/${draft._id}`, {
      jar,
      body: {
        ...draft,
        _outside: outsideBody
      }
    });
  }

  function entriesOf(request, note) {
    return apos.harness.changes
      .find({
        requestId: request._id,
        docId: note._id
      })
      .sort({ sequence: 1 })
      .toArray();
  }
});

function outside(request, fields, tabId = 'tab-1') {
  return {
    tabId,
    parts: [ {
      marker: { requestId: request._id },
      fields
    } ]
  };
}

function pathOf(row) {
  return row.path.map(segment => segment.name).join('.');
}

function area(items) {
  return {
    metaType: 'area',
    items
  };
}

function richText(_id, content) {
  return {
    _id,
    metaType: 'widget',
    type: '@apostrophecms/rich-text',
    content
  };
}

function card(_id, heading) {
  return {
    _id,
    metaType: 'widget',
    type: 'assistant-card',
    heading
  };
}

function item(_id, label) {
  return {
    _id,
    metaType: 'arrayItem',
    label
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
