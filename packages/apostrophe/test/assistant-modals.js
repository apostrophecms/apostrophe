const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// The assistant in open editors, on the scripted mock: an editor's save of
// fields the assistant wrote into it records those fields, and only those,
// as the request's rows in the change log; `edit_open_document` reads and
// changes what the editor on top holds, and the document tools leave a
// document open in an editor alone.

describe('Assistant: working in open editors', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let script = null;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} },
            mock(req) {
              return script ? script(req) : { text: 'Done.' };
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
        // Published on save, with versions, as images are
        'assistant-notice': {
          extend: '@apostrophecms/piece-type',
          options: {
            autopublish: true,
            versions: true
          },
          fields: {
            add: {
              subtitle: {
                type: 'string',
                label: 'Subtitle'
              }
            }
          }
        },
        'assistant-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    'assistant-card': {}
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

  beforeEach(function () {
    script = null;
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

    it('leaves the save the user\'s: its version is not AI-made', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Before');
      const draft = await getDraft(note, jar);
      draft.title = 'Written by the assistant';
      await put(draft, jar, outside(request, [ 'title' ]));

      assert.equal((await entriesOf(request, note)).length, 1);
      const [ version ] = await apos.docVersions.db
        .find({ docId: note.aposDocId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      assert.equal((await apos.docVersions.unpack(version.doc)).title, draft.title);
      assert.equal(version.ai, false);
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

    it('records a rich text widget\'s markup written by its key', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Rich text', {
        body: area([ richText('w1', '<p>One</p>'), richText('w2', '<p>Two</p>') ])
      });
      const draft = await getDraft(note, jar);
      draft.body.items[0].content = '<p>One, rewritten</p>';
      draft.body.items[1].content = '<p>Two, typed</p>';
      await put(draft, jar, outside(request, [ '@w1.content' ]));

      const [ entry ] = await entriesOf(request, note);
      assert.deepEqual(entry.rows.map(pathOf), [ 'body.w1' ]);
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

      assert.equal(await revertRequest(request), 'done');
      const reverted = await apos.doc.db.findOne({ _id: draft._id });
      assert.equal(reverted.title, 'Before');
      assert.equal(reverted.subtitle, 'Typed by the editor');
    });

    it('records a widget moved inside its area as the request\'s, and the chat reverts the move', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Moved', {
        body: area([ card('c1', 'One'), card('c2', 'Two'), card('c3', 'Three') ])
      });
      const draft = await getDraft(note, jar);
      draft.body.items.unshift(draft.body.items.pop());
      await put(draft, jar, outside(request, [ '@c3' ]));

      const [ entry ] = await entriesOf(request, note);
      assert.deepEqual(entry.rows.map(pathOf), [ 'body' ]);
      assert.equal(entry.rows[0].kind, 'area');

      assert.equal(await revertRequest(request), 'done');
      const reverted = await apos.doc.db.findOne({ _id: draft._id });
      assert.deepEqual(reverted.body.items.map(widget => widget._id), [ 'c1', 'c2', 'c3' ]);
    });

    it('leaves a reorder the moved widget does not explain the editor\'s', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Both moved', {
        body: area([ card('c1', 'One'), card('c2', 'Two'), card('c3', 'Three') ])
      });
      const draft = await getDraft(note, jar);
      // The assistant moved the last card to the top, the editor then
      // swapped the other two
      const [ c1, c2, c3 ] = draft.body.items;
      draft.body.items = [ c3, c2, c1 ];
      await put(draft, jar, outside(request, [ '@c3' ]));
      assert.deepEqual(await entriesOf(request, note), []);
    });

    it('shows the fields the request wrote as AI-made in the version and See Changes', async function () {
      const request = await endedRequest(editor);
      const note = await insertNote('Before');
      const draft = await getDraft(note, jar);
      draft.title = 'Written by the assistant';
      draft.subtitle = 'Typed by the editor';
      await put({
        ...draft,
        _explicitSave: true
      }, jar, outside(request, [ 'title' ]));

      const req = userReq(editor);
      const { results } = await apos.docVersions.getTimelinePage(
        req,
        apos.docVersions.getTimelineCriteria(draft)
      );
      assert.equal(results[0].ai, true);
      const { rows } = await apos.docVersions.getVersionChanges(req, results[0]._id);
      assert.deepEqual(rows.map(aiOf), [ [ 'title', 'changed' ], [ 'subtitle', false ] ]);
      const changes = await apos.docVersions.getDraftChanges(req, draft._id);
      assert.deepEqual(
        changes.rows.filter(row => [ 'title', 'subtitle' ].includes(pathOf(row))).map(aiOf),
        [ [ 'title', 'changed' ], [ 'subtitle', false ] ]
      );
    });

    it('records them for a type published on save, as the media manager\'s image editor saves it', async function () {
      const request = await endedRequest(editor);
      const notice = await apos.modules['assistant-notice'].insert(userReq(editor), {
        title: 'Before'
      });
      const draft = await apos.http.get(`/api/v1/assistant-notice/${notice._id}`, {
        jar,
        qs: { aposMode: 'draft' }
      });
      await apos.http.put(`/api/v1/assistant-notice/${draft._id}`, {
        jar,
        body: {
          ...draft,
          title: 'Written by the assistant',
          subtitle: 'Typed by the editor',
          _outside: outside(request, [ 'title' ])
        }
      });

      const published = await apos.doc.db.findOne({
        _id: draft._id.replace(':draft', ':published')
      });
      assert.equal(published.title, 'Written by the assistant');
      const entries = await entriesOf(request, notice);
      assert.equal(entries.length, 1);
      assert.deepEqual(entries[0].rows.map(pathOf), [ 'title' ]);
      const req = userReq(editor);
      const { results } = await apos.docVersions.getTimelinePage(
        req,
        apos.docVersions.getTimelineCriteria(published)
      );
      assert.equal(results[0].ai, true);
      const { rows } = await apos.docVersions.getVersionChanges(req, results[0]._id);
      assert.deepEqual(
        rows.filter(row => [ 'title', 'subtitle' ].includes(pathOf(row))).map(aiOf),
        [ [ 'title', 'changed' ], [ 'subtitle', false ] ]
      );
    });

    it('keeps them AI-made through the page\'s autosaves of a widget editor', async function () {
      const request = await endedRequest(editor);
      const req = userReq(editor);
      const inserted = await apos.page.insert(req, '_home', 'lastChild', {
        title: 'Cards',
        type: 'assistant-page',
        main: area([ card('p1', 'One'), card('p2', 'Two') ])
      });
      await apos.page.publish(req, await apos.page.findOneForEditing(req, {
        _id: inserted._id
      }));
      // As the page loads it in edit mode
      await apos.http.get(`/api/v1/@apostrophecms/page/${inserted._id}`, {
        jar,
        qs: { aposMode: 'draft' }
      });
      const patch = (patches, outsideBody) => apos.http.patch(
        `/api/v1/@apostrophecms/page/${inserted._id}`,
        {
          jar,
          body: {
            _patches: patches,
            ...(outsideBody && { _outside: outsideBody })
          }
        }
      );
      await patch([
        { '@p1.heading': 'One, rewritten' },
        { '@p2.heading': 'Two, typed' }
      ], outside(request, [ '@p1.heading' ]));
      await patch([ { '@p2.heading': 'Two, typed again' } ]);

      const versions = await apos.docVersions.find(
        req,
        apos.docVersions.getTimelineCriteria(inserted)
      );
      assert.deepEqual(
        versions.map(version => [ version.mode, version.aiFields ?? null ]),
        [ [ 'draft', [ '@p1.heading' ] ], [ 'published', null ] ]
      );
      const { rows } = await apos.docVersions.getDraftChanges(req, inserted._id);
      assert.deepEqual(rows.map(aiOf), [
        [ 'main.p1.heading', 'changed' ],
        [ 'main.p2.heading', false ]
      ]);
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

  describe('edit_open_document and the modal rule', function () {
    let note;

    before(async function () {
      note = await insertNote('Open note', {
        subtitle: 'Saved subtitle',
        body: area([ card('card-1', 'Saved heading') ]),
        items: [ item('item-1', 'Saved label') ]
      });
    });

    it('is a browser tool of the assistant, named in the screen section', async function () {
      const tool = apos.ai.getTool('edit_open_document');
      assert.deepEqual(tool.tags, [ 'assistant', 'browser' ]);
      assert.equal(tool.maxResultChars, apos.harness.getReadBudget('document'));
      assert(apos.assistant.getScreenSection().includes('edit_open_document'));
    });

    it('refuses a call no editor on top can serve, from the stored screen', async function () {
      assert.match(
        await refusalOf([], { action: 'get_document' }),
        /No editor is open/
      );
      assert.match(
        await refusalOf([ { kind: 'manager' } ], { action: 'get_document' }),
        /No editor is open/
      );
      assert.match(
        await refusalOf([
          editorModal(),
          {
            kind: 'chooser',
            field: 'related'
          }
        ], { action: 'get_document' }),
        /a chooser for "related" is open over the editor; ask the user to close it first/
      );
      // A type AI may not read is dropped from the screen
      assert.match(
        await refusalOf([ {
          kind: 'editor',
          docType: '@apostrophecms/user'
        } ], {
          action: 'update_document',
          values: { title: 'x' }
        }),
        /may not change the document in this editor/
      );
    });

    it('checks the arguments against the named document tool\'s', async function () {
      const screen = [ editorModal() ];
      assert.match(
        await refusalOf(screen, { action: 'update_document' }),
        /invalid arguments for "update_document": arguments must have required property 'values'/
      );
      assert.match(
        await refusalOf(screen, {
          action: 'get_document',
          widgets: [ 'card-1' ]
        }),
        /invalid arguments for "get_document"/
      );
      assert.match(
        await refusalOf(screen, {
          action: 'remove_widgets',
          widgets: []
        }),
        /invalid arguments for "remove_widgets"/
      );
    });

    it('asks the browser with the arguments prepared, defaults filled in', async function () {
      const {
        req, chat, request
      } = await callOnScreen([ editorModal() ], {
        action: 'get_document'
      });
      assert.equal(request.status, 'waiting');
      assert.deepEqual(request.asks[0].payload, {
        kind: 'browser',
        screenEffect: 'keeps',
        args: {
          action: 'get_document',
          view: 'outline'
        },
        whenHidden: {
          executed: false,
          reason: 'the user is in another browser tab'
        }
      });
      await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    it('reads what the editor holds, unsaved changes included', async function () {
      const { req, chat } = await callOnScreen([ editorModal() ], {
        action: 'get_document',
        view: 'properties',
        paths: [ 'subtitle', '@card-1.heading' ]
      });
      const served = await serve(req, chat, documentRoot({
        subtitle: 'Typed subtitle',
        body: area([ card('card-1', 'Typed heading') ])
      }));
      assert.deepEqual(served, {
        executed: true,
        values: {},
        touched: [],
        removed: []
      });
      const done = await answer(req, chat, { executed: true });
      const output = resultOf(done, 'call-edit_open_document').output;
      assert.equal(output.executed, true);
      assert.equal(output.type, 'assistant-note');
      assert.deepEqual(output.properties, [
        {
          path: 'subtitle',
          value: 'Typed subtitle'
        },
        {
          path: '@card-1.heading',
          value: 'Typed heading'
        }
      ]);
    });

    it('changes what the editor holds, unsaved, the model reading the change kept on the ask', async function () {
      const { req, chat } = await callOnScreen([ editorModal() ], {
        action: 'update_document',
        values: {
          subtitle: 'New subtitle',
          '@card-1.heading': 'New heading'
        }
      });
      const served = await serve(req, chat, documentRoot());
      assert.equal(served.executed, true);
      assert.deepEqual(Object.keys(served.values).sort(), [ 'body', 'subtitle' ]);
      assert.equal(served.values.subtitle, 'New subtitle');
      assert.equal(served.values.body.items[0].heading, 'New heading');
      assert.deepEqual(served.touched.sort(), [ '@card-1.heading', 'subtitle' ]);
      // The panel never reads the kept result
      const [ waiting ] = (await apos.assistant.getChatRequests(req, chat._id)).slice(-1);
      assert.equal(apos.assistant.renderRequest(waiting).asks[0].result, undefined);
      const done = await answer(req, chat, {
        executed: true,
        // The browser's word on the result is not taken
        written: 'forged'
      });
      const output = resultOf(done, 'call-edit_open_document').output;
      assert.equal(output.saved, false);
      assert.equal(output.written[0]._id, note._id);
      assert.match(output.notice, /in the open editor, not saved/);
      const draft = await apos.doc.db.findOne({ _id: note._id });
      assert.equal(draft.subtitle, 'Saved subtitle');
    });

    it('reaches only the widget a widget editor holds', async function () {
      const screen = [
        editorModal(),
        {
          kind: 'widgetEditor',
          docId: note._id,
          widgetId: 'card-1',
          field: 'body'
        }
      ];
      const { req, chat } = await callOnScreen(screen, {
        action: 'update_document',
        values: { subtitle: 'Not here' }
      });
      const widget = widgetRoot(card('card-1', 'Saved heading'));
      const served = await serve(req, chat, widget);
      assert.deepEqual(served.values, {});
      const done = await answer(req, chat, { executed: true });
      const output = resultOf(done, 'call-edit_open_document').output;
      assert.equal(output.saved, false);
      assert(output.refused[0].fields
        .every(field => /only it can change until its editor closes/.test(field.message)));

      const changed = await callOnScreen(screen, {
        action: 'update_document',
        values: { heading: 'Widget heading' }
      });
      const result = await serve(changed.req, changed.chat, widget);
      assert.deepEqual(result.values, { heading: 'Widget heading' });
      assert.deepEqual(result.touched, [ 'heading' ]);
      await apos.assistant.skip(changed.req, changed.chat._id, { tabId: 'tab-1' });
    });

    it('refuses a root that is not the editor on top, and takes the browser\'s reason', async function () {
      const { req, chat } = await callOnScreen([ editorModal() ], {
        action: 'update_document',
        values: { subtitle: 'x' }
      });
      const served = await serve(req, chat, widgetRoot(card('card-1', 'Saved heading')));
      assert.equal(served.executed, false);
      assert.match(served.reason, /no longer the one the call was made for/);
      const done = await answer(req, chat, { executed: true });
      assert.deepEqual(stripScreen(resultOf(done, 'call-edit_open_document').output), {
        executed: false,
        reason: served.reason,
        answered: true
      });

      const second = await callOnScreen([ editorModal() ], {
        action: 'update_document',
        values: { subtitle: 'y' }
      });
      await serve(second.req, second.chat, documentRoot());
      const refused = await answer(second.req, second.chat, {
        executed: false,
        reason: 'the editor can\'t take subtitle now'
      });
      assert.equal(
        resultOf(refused, 'call-edit_open_document').output.reason,
        'the editor can\'t take subtitle now'
      );
    });

    it('serves only the browser tab that owns the waiting request', async function () {
      const { req, chat } = await callOnScreen([ editorModal() ], { action: 'get_document' });
      await assert.rejects(
        apos.assistant.serveOpenEditor(req, chat._id, {
          tabId: 'tab-2',
          callId: 'call-edit_open_document',
          root: documentRoot()
        })
      );
      await assert.rejects(
        apos.assistant.serveOpenEditor(req, chat._id, {
          tabId: 'tab-1',
          callId: 'call-other',
          root: documentRoot()
        }),
        { name: 'notfound' }
      );
      await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    it('refuses a document tool\'s write to a document an editor holds', async function () {
      const update = {
        targets: [ {
          _id: note._id,
          values: { subtitle: 'Written' }
        } ]
      };
      assert.match(
        await writeRefusal([ editorModal() ], 'update_document', update),
        /"Open note" is open in an editor on the user's screen: change it with edit_open_document/
      );
      assert.match(
        await writeRefusal([ editorModal(), {
          kind: 'arrayEditor',
          docId: note._id,
          itemId: 'item-1',
          field: 'items'
        } ],
        'remove_widgets', {
          _id: note._id,
          widgets: [ 'card-1' ]
        }),
        /has its array editor open on the user's screen: change that array with/
      );
      assert.match(
        await writeRefusal([ editorModal(), {
          kind: 'chooser',
          field: 'related'
        } ],
        'update_document', update),
        /under a chooser for "related"; ask the user to close what is over the editor first/
      );
      const draft = await apos.doc.db.findOne({ _id: note._id });
      assert.equal(draft.subtitle, 'Saved subtitle');
    });

    it('holds the document open beside a media manager\'s list, and nothing without one', async function () {
      const update = {
        targets: [ {
          _id: note._id,
          values: { subtitle: 'Written' }
        } ]
      };
      const side = {
        kind: 'mediaManager',
        docId: note._id,
        selection: [ note._id ]
      };
      assert.match(
        await writeRefusal([ side ], 'update_document', update),
        /"Open note" is open in an editor on the user's screen: change it with edit_open_document/
      );
      assert.match(
        await writeRefusal([ side, { kind: 'other' } ], 'update_document', update),
        /under a dialog; ask the user to close what is over the editor first/
      );
      const { req, chat } = await callOnScreen([ side ], {
        action: 'update_document',
        values: { subtitle: 'Typed by the assistant' }
      });
      const served = await serve(req, chat, documentRoot());
      assert.equal(served.executed, true);
      assert.deepEqual(served.values, { subtitle: 'Typed by the assistant' });
      await answer(req, chat, { executed: true });
      assert.equal((await apos.doc.db.findOne({ _id: note._id })).subtitle, 'Saved subtitle');

      // The list alone holds nothing: its checked rows are written
      script = sequence([ toolTurn('update_document', update), { text: 'Done.' } ]);
      const { request } = await sendOnScreen([ {
        kind: 'mediaManager',
        selection: [ note._id ]
      } ], 'Write the checked one');
      assert.equal(resultOf(request, 'call-update_document').error, undefined);
      assert.equal((await apos.doc.db.findOne({ _id: note._id })).subtitle, 'Written');
      await apos.doc.db.updateOne({ _id: note._id }, { $set: { subtitle: 'Saved subtitle' } });
    });

    it('writes a document no editor holds, and reads a held one', async function () {
      const other = await insertNote('Other note');
      script = sequence([
        toolTurn('update_document', {
          targets: [ {
            _id: other._id,
            values: { subtitle: 'Written' }
          } ]
        }),
        toolTurn('get_document', { _id: note._id }, 'call-read'),
        { text: 'Done.' }
      ]);
      const { request } = await sendOnScreen([ editorModal() ], 'Write the other note');
      assert.equal(request.status, 'completed');
      assert.equal(resultOf(request, 'call-update_document').error, undefined);
      const read = resultOf(request, 'call-read');
      assert.equal(read.error, undefined);
      assert.match(
        read.output.openEditor,
        /"Open note" is open in an editor on the user's screen, which may hold changes not saved yet: this is the saved draft\. edit_open_document reads/
      );
      const draft = await apos.doc.db.findOne({ _id: other._id });
      assert.equal(draft.subtitle, 'Written');
    });

    it('reads a document no editor holds without the note', async function () {
      const other = await insertNote('Unheld note');
      script = sequence([
        toolTurn('get_document', { _id: other._id }, 'call-read'),
        { text: 'Done.' }
      ]);
      const { request } = await sendOnScreen([ editorModal() ], 'Read the other note');
      assert.equal(resultOf(request, 'call-read').output.openEditor, undefined);
    });

    it('hands the model a read refused for its arguments while an editor is open', async function () {
      script = sequence([
        toolTurn('get_document', {
          _id: note._id,
          view: 'properties',
          paths: Array.from({ length: 21 }, (value, i) => `path${i}`)
        }, 'call-read'),
        { text: 'Done.' }
      ]);
      const { request } = await sendOnScreen([ editorModal() ], 'Read the open note');
      assert.equal(request.status, 'completed');
      assert.match(resultOf(request, 'call-read').error, /must NOT have more than 20 items/);
    });

    it('carries the keys the turn\'s later writes in the editor name, for busy ahead', async function () {
      script = sequence([ {
        content: [
          toolCall('call-1', 'edit_open_document', {
            action: 'update_document',
            values: { subtitle: 'One' }
          }),
          toolCall('call-2', 'edit_open_document', { action: 'get_document' }),
          toolCall('call-3', 'edit_open_document', {
            action: 'remove_widgets',
            widgets: [ 'card-1' ]
          }),
          toolCall('call-4', 'edit_open_document', {
            action: 'update_document',
            values: {
              '@item-1.label': 'Four',
              subtitle: 'Four'
            }
          })
        ],
        finishReason: 'toolCalls',
        usage: {
          inputTokens: 10,
          outputTokens: 2
        }
      } ]);
      const {
        req, chat, request
      } = await sendOnScreen([ editorModal() ], 'Work in the editor');
      assert.equal(request.status, 'waiting');
      assert.deepEqual(request.asks.map(ask => ask.callId), [ 'call-1' ]);
      assert.deepEqual(request.asks[0].payload.ahead, [ '@card-1', '@item-1.label', 'subtitle' ]);
      await apos.assistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    it('takes the screen the browser tab posts when its modals change, before the next write', async function () {
      const update = {
        targets: [ {
          _id: note._id,
          values: { subtitle: 'Written' }
        } ]
      };
      script = sequence([
        toolTurn('confirm', { action: 'Go on?' }),
        toolTurn('update_document', update),
        { text: 'Refused.' }
      ]);
      const {
        req, chat, request
      } = await sendOnScreen([], 'Write the note');
      assert.equal(request.status, 'waiting');
      const otherTab = await sendFromTab(userReq(editor), 'tab-2');
      // The editor opens over the page while the request waits
      await apos.assistant.postScreen(req, {
        tabId: 'tab-1',
        screen: {
          tabId: 'tab-1',
          modals: [ editorModal() ]
        }
      });
      const stored = await apos.assistant.getRequest(req, request._id);
      assert.deepEqual(stored.screen.modals.map(modal => modal.docId), [ note._id ]);
      assert.equal(stored.screen.locale, request.screen.locale);
      const untouched = await apos.assistant.getRequest(req, otherTab._id);
      assert.deepEqual(untouched.screen.modals, []);
      await apos.assistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-confirm',
        answer: { approved: true }
      });
      const done = await waitForEnd(req, chat);
      assert.match(
        resultOf(done, 'call-update_document').error,
        /"Open note" is open in an editor on the user's screen: change it with edit_open_document/
      );
      const draft = await apos.doc.db.findOne({ _id: note._id });
      assert.equal(draft.subtitle, 'Saved subtitle');
      await apos.assistant.skip(req, otherTab.chatId, { tabId: 'tab-2' });
    });

    // A request of another browser tab, left waiting on a confirmation
    async function sendFromTab(req, tabId) {
      const chat = await apos.assistant.createChat(req);
      const turns = [ toolTurn('confirm', { action: 'Wait?' }) ];
      const before = script;
      script = () => turns.shift() || before();
      await apos.assistant.send(req, chat._id, {
        message: 'Wait',
        screen: {
          tabId,
          modals: []
        }
      });
      const waiting = await waitForEnd(req, chat);
      script = before;
      return waiting;
    }

    function editorModal() {
      return {
        kind: 'editor',
        docId: note._id
      };
    }

    function documentRoot(values = {}) {
      return {
        kind: 'document',
        data: {
          ...note,
          ...values
        }
      };
    }

    function widgetRoot(data) {
      return {
        kind: 'widget',
        data,
        areaFieldId: apos.modules['assistant-note'].schema
          .find(field => field.name === 'body')._id
      };
    }

    async function sendOnScreen(modals, message) {
      const req = userReq(editor);
      const chat = await apos.assistant.createChat(req);
      await apos.assistant.send(req, chat._id, {
        message,
        screen: {
          tabId: 'tab-1',
          modals
        }
      });
      return {
        req,
        chat,
        request: await waitForEnd(req, chat)
      };
    }

    // One `edit_open_document` call on a screen with these modals
    function callOnScreen(modals, input) {
      script = sequence([ toolTurn('edit_open_document', input) ]);
      return sendOnScreen(modals, 'Work in the editor');
    }

    async function refusalOf(modals, input) {
      script = sequence([ toolTurn('edit_open_document', input), { text: 'Refused.' } ]);
      const { request } = await sendOnScreen(modals, 'Work in the editor');
      assert.equal(request.status, 'completed');
      return resultOf(request, 'call-edit_open_document').error;
    }

    async function writeRefusal(modals, name, input) {
      script = sequence([ toolTurn(name, input), { text: 'Refused.' } ]);
      const { request } = await sendOnScreen(modals, 'Write it');
      assert.equal(request.status, 'completed');
      return resultOf(request, `call-${name}`).error;
    }

    function serve(req, chat, root) {
      return apos.assistant.serveOpenEditor(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-edit_open_document',
        root
      });
    }

    async function answer(req, chat, given) {
      await apos.assistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-edit_open_document',
        answer: given,
        screen: { tabId: 'tab-1' }
      });
      return waitForEnd(req, chat);
    }
  });

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  // The chat's latest request once its run has ended or waits
  async function waitForEnd(req, chat) {
    let request;
    await waitFor(async () => {
      request = (await apos.assistant.getChatRequests(req, chat._id)).at(-1);
      const open = (await apos.assistant.getChat(req, chat._id)).openRequest;
      const job = request?.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: request.jobId });
      return request && (request.status !== 'running') &&
        ((open === null) || (open.status === 'waiting')) && (!job || job.ended);
    });
    return request;
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

  // The status a revert of the request by its chat ends in
  async function revertRequest(request) {
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
    return (await apos.assistant.getRevert(req, started._id)).status;
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

// The turns in order, then the default
function sequence(turns) {
  const queue = [ ...turns ];
  return () => queue.shift() || { text: 'Done.' };
}

function toolCall(id, name, input) {
  return {
    type: 'toolCall',
    id,
    name,
    input
  };
}

function toolTurn(name, input = {}, id = `call-${name}`) {
  return {
    content: [ {
      type: 'toolCall',
      id,
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

function resultOf(request, callId) {
  return request.messages
    .flatMap(message => (message.role === 'tool') ? message.content : [])
    .find(part => part.toolCallId === callId);
}

function stripScreen({ screen, ...rest }) {
  return rest;
}

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

function aiOf(row) {
  return [ pathOf(row), row.ai ];
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
