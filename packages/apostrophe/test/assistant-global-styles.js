const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Global Styles in the assistant, on the scripted mock: changed in their own
// window by default, the window being the screen's editor while no modal is
// open; a direct write is asked first, naming the locales it writes, and
// refused outside the assistant's door.

describe('Assistant: Global Styles', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let script = null;
  // The Global Styles document in each locale
  const styles = {};

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: { label: 'English' },
              fr: {
                label: 'French',
                prefix: '/fr'
              },
              de: {
                label: 'German',
                prefix: '/de'
              }
            }
          }
        },
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
        '@apostrophecms/styles': {
          styles: {
            add: {
              accentColor: {
                type: 'color',
                label: 'Accent',
                selector: ':root',
                property: '--accent'
              },
              brandColor: {
                type: 'color',
                label: 'Brand',
                selector: ':root',
                property: '--brand',
                options: {
                  presetColors: [ '#112233', '#445566' ],
                  disableSpectrum: true,
                  disableFields: true
                }
              },
              headingFont: {
                type: 'select',
                label: 'Heading font',
                selector: 'h1',
                property: 'font-family',
                choices: [
                  {
                    label: 'Inter',
                    value: 'Inter'
                  },
                  {
                    label: 'Georgia',
                    value: 'Georgia'
                  }
                ]
              },
              radius: {
                type: 'range',
                label: 'Radius',
                selector: '.button',
                property: 'border-radius',
                unit: 'px',
                min: 0,
                max: 24
              }
            }
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    for (const locale of [ 'en', 'fr', 'de' ]) {
      styles[locale] = await apos.modules['@apostrophecms/styles']
        .find(userReq(editor).clone({ locale }), {})
        .toObject();
    }
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
  });

  it('marks Global Styles as having rules, the window for the assistant only', function () {
    const [ assistant, mcp ] = [ 'assistant', 'mcp' ].map(door => apos.aposHarness.withDoor(
      userReq(editor),
      {
        door,
        lockId: `${door}-test`,
        requestId: `${door}-request`
      }
    ));
    const shared = 'Say what the fields can\'t express (a gradient where a field takes one ' +
      'color, say) rather than settling quietly for something close. The look of one ' +
      'widget is that widget\'s own style fields, changed with update_document, not ' +
      'Global Styles.';

    for (const req of [ assistant, mcp ]) {
      assert.match(apos.aposHarness.getSiteInstructions(req),
        /^@apostrophecms\/styles: The site-wide design: .* \(aiHow\)$/m);
    }
    assert.equal(apos.aposHarness.getTypeGuidance('@apostrophecms/styles', 'mcp'), shared);
    assert.equal(
      apos.aposHarness.getTypeGuidance('@apostrophecms/styles', 'assistant'),
      `${shared}\n\nChange Global Styles in their own window: open it with open_editor on ` +
        'the Global Styles document, then set every value the request needs with ' +
        'edit_open_document, in as few calls as you can; the page restyles as each value ' +
        'lands. Nothing is live until the user presses "Update Global Styles", which makes ' +
        'it live at once, and Cancel throws it away: say so in the reply. The window edits ' +
        'the locale of the page shown. Write Global Styles with update_document only when ' +
        'the user asks for the change to go live at once or in other locales; that call ' +
        'asks the user itself before it writes, so don\'t ask beforehand.'
    );
  });

  describe('a direct write', function () {
    it('is written at once through the MCP door, which has no gate', async function () {
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
          input: { targets: [ accentTarget(styles.en, '#111111') ] }
        } ]);
      await apos.aposHarness.endRequest(mcpReq);
      assert.equal(result[0].suspended, undefined);
      assert.equal(result[0].error, undefined);
      assert.equal(result[0].result.written[0]._id, styles.en._id);
      assert.equal(result[0].result.written[0].published, true);
      assert.equal(await getAccent('en'), '#111111');
    });

    it('asks first for this page\'s locale, offering the window instead', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn([ styles.en ], '#222222'), { text: 'Opening it.' } ]);
      const waiting = await runToEnd(req, chat, 'Make the accent darker');
      assert.equal(waiting.status, 'waiting');
      const { gate } = waiting.asks[0].payload;
      assert.deepEqual(gate.title, {
        key: 'apostrophe:assistantGateStylesLocale',
        values: { locale: 'English' }
      });
      assert.deepEqual(gate.text, [ { key: 'apostrophe:assistantGateLive' } ]);
      assert.equal(gate.approve, 'apostrophe:assistantApplyNow');
      assert.deepEqual(gate.alternatives.map(({ name, label }) => ({
        name,
        label
      })), [ {
        name: 'window',
        label: 'apostrophe:assistantOpenStyles'
      } ]);

      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: {
          approved: false,
          alternative: 'window'
        }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.match(resultOf(done, 'call-update').error,
        /open the window with open_editor .* edit_open_document/);
      assert.notEqual(await getAccent('en'), '#222222');
    });

    it('names several locales without the window, and writes them all in one request once applied', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([
        updateTurn([ styles.en, styles.fr, styles.de ], '#333333'),
        { text: 'Changed in every locale.' }
      ]);
      const waiting = await runToEnd(req, chat, 'Darker accent in all locales');
      const { gate } = waiting.asks[0].payload;
      assert.deepEqual(gate.title, {
        key: 'apostrophe:assistantGateStylesLocales',
        values: { count: 3 }
      });
      assert.deepEqual(gate.text, [
        { list: [ 'English', 'French', 'German' ] },
        { key: 'apostrophe:assistantGateLive' }
      ]);
      assert.equal(gate.alternatives, undefined);
      // The window is no answer to it
      await assert.rejects(apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: {
          approved: false,
          alternative: 'window'
        }
      }), { name: 'invalid' });

      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { approved: true }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      const { output } = resultOf(done, 'call-update');
      assert.deepEqual(output.written.map(item => item.locale).sort(), [ 'de', 'en', 'fr' ]);
      assert.equal(output.pageLocale, 'en');
      assert.equal(output.pageLocaleWritten, true);
      for (const locale of [ 'en', 'fr', 'de' ]) {
        assert.equal(await getAccent(locale), '#333333', locale);
      }
    });

    it('is taken back in every locale by one Revert', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      const before = {};
      for (const locale of [ 'en', 'fr', 'de' ]) {
        before[locale] = await getAccent(locale);
      }
      script = sequence([
        updateTurn([ styles.en, styles.fr, styles.de ], '#3a3a3a'),
        { text: 'Changed in every locale.' }
      ]);
      await runToEnd(req, chat, 'Darker accent in all locales');
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { approved: true }
      });
      const done = await waitForEnd(req, chat);
      assert.equal(await revertRequest(done), 'done');
      for (const locale of [ 'en', 'fr', 'de' ]) {
        assert.equal(await getAccent(locale), before[locale], locale);
      }
    });

    it('offers no window for another locale, and says this page\'s was not written', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([ updateTurn([ styles.fr ], '#444444'), { text: 'Changed.' } ]);
      const waiting = await runToEnd(req, chat, 'Darker accent in French');
      const { gate } = waiting.asks[0].payload;
      assert.deepEqual(gate.title.values, { locale: 'French' });
      assert.equal(gate.alternatives, undefined);
      await apos.aposAssistant.answer(req, chat._id, {
        tabId: 'tab-1',
        callId: 'call-update',
        answer: { approved: true }
      });
      const { output } = resultOf(await waitForEnd(req, chat), 'call-update');
      assert.equal(output.pageLocale, 'en');
      assert.equal(output.pageLocaleWritten, false);
      assert.equal(await getAccent('fr'), '#444444');
    });
  });

  describe('the window', function () {
    it('holds its document: a direct write points at edit_open_document, which reaches it', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([
        toolTurn('get_document', { _id: styles.en._id }, 'read'),
        updateTurn([ styles.en ], '#555555'),
        toolTurn('edit_open_document', {
          action: 'update_document',
          values: { accentColor: '#555555' }
        }, 'edit')
      ]);
      await apos.aposAssistant.send(req, chat._id, {
        message: 'Darker accent',
        screen: withWindow()
      });
      const waiting = await waitForEnd(req, chat);
      assert.match(resultOf(waiting, 'call-read').output.openEditor,
        /open in an editor on the user's screen/);
      assert.match(resultOf(waiting, 'call-update').error,
        /open in an editor on the user's screen: change it with edit_open_document/);
      // The window is the editor on top: the browser is asked
      assert.equal(waiting.status, 'waiting');
      assert.equal(waiting.asks[0].name, 'edit_open_document');
      assert.notEqual(await getAccent('en'), '#555555');
      await apos.aposAssistant.skip(req, chat._id, { tabId: 'tab-1' });
    });

    it('is not reached under a modal', async function () {
      const req = userReq(editor);
      const chat = await apos.aposAssistant.createChat(req);
      script = sequence([
        toolTurn('edit_open_document', {
          action: 'update_document',
          values: { accentColor: '#666666' }
        }, 'edit')
      ]);
      await apos.aposAssistant.send(req, chat._id, {
        message: 'Darker accent',
        screen: withWindow({ modals: [ { kind: 'other' } ] })
      });
      const done = await waitForEnd(req, chat);
      assert.equal(done.status, 'completed');
      assert.match(resultOf(done, 'call-edit').error, /a dialog is open over the editor/);
    });
  });

  describe('values the fields take', function () {
    const refusals = [
      [ { accentColor: 'notacolor' }, 'accentColor', 'Not a color or a CSS variable ("--name").' ],
      [ { brandColor: '#ff0000' }, 'brandColor', 'Only these colors: #112233, #445566.' ],
      [ { headingFont: 'Comic Sans' }, 'headingFont', 'Not one of the choices: "Inter", "Georgia".' ],
      [ { radius: 99 }, 'radius', 'Outside the range 0 to 24.' ],
      [ { nope: 1 }, 'nope', 'No field of that name here; the schema read lists them.' ]
    ];

    it('refuses in the window, field by field with the reason, what its field would drop', async function () {
      const req = userReq(editor);
      const root = {
        kind: 'document',
        data: styles.en
      };
      for (const [ values, path, message ] of refusals) {
        const { result } = await apos.aposHarness.editContent(req, root, {
          action: 'update_document',
          values
        });
        assert.deepEqual(result.refused[0].fields, [ {
          path,
          reason: (path === 'nope') ? 'unknown' : 'invalid',
          message
        } ], path);
      }
      // A CSS variable, a preset in another case and a choice pass
      const { values } = await apos.aposHarness.editContent(req, root, {
        action: 'update_document',
        values: {
          accentColor: '--brand-accent',
          brandColor: '#445566',
          headingFont: 'Georgia',
          radius: 8
        }
      });
      assert.deepEqual(values, {
        accentColor: '--brand-accent',
        brandColor: '#445566',
        headingFont: 'Georgia',
        radius: 8
      });
    });

    it('refuses the same in a direct write, writing nothing', async function () {
      const req = apos.aposHarness.withDoor(userReq(editor), {
        door: 'assistant',
        lockId: 'styles-test',
        requestId: 'styles-request'
      });
      const result = await apos.aposHarness.updateDocument(req, {
        targets: [ {
          _id: styles.en._id,
          values: {
            accentColor: '#123456',
            radius: 99
          }
        } ]
      });
      await apos.aposHarness.endRequest(req);
      assert.deepEqual(result.refused[0].fields, [ {
        path: 'radius',
        reason: 'invalid',
        message: 'Outside the range 0 to 24.'
      } ]);
      assert.notEqual(await getAccent('en'), '#123456');
    });
  });

  describe('a save from the window', function () {
    let jar;

    before(async function () {
      jar = await t.loginAs(apos, 'editor');
    });

    it('is recorded as the request\'s rows with the AI mark, and Revert puts the values and the stylesheet back', async function () {
      const request = await endedRequest();
      const draft = await getWindowDraft();
      const before = draft.accentColor;
      await saveFromWindow(draft, {
        accentColor: '#0a7d32',
        radius: 12
      }, request);

      const entries = await apos.aposHarness.changes
        .find({
          requestId: request._id,
          docId: draft._id
        })
        .toArray();
      assert.equal(entries.length, 1);
      assert.deepEqual(entries[0].rows.map(pathOf), [ 'accentColor' ]);
      const req = userReq(editor);
      const published = await apos.doc.db.findOne({
        _id: draft._id.replace(':draft', ':published')
      });
      assert.equal(published.accentColor, '#0a7d32');
      const { results } = await apos.docVersions.getTimelinePage(
        req,
        apos.docVersions.getTimelineCriteria(published)
      );
      assert.equal(results[0].ai, true);
      const { rows } = await apos.docVersions.getVersionChanges(req, results[0]._id);
      assert.deepEqual(
        rows.filter(row => [ 'accentColor', 'radius' ].includes(pathOf(row))).map(aiOf),
        [ [ 'accentColor', 'changed' ], [ 'radius', false ] ]
      );
      assert.match(await getStylesheet('draft'), /#0a7d32/);
      assert.match(await getStylesheet('published'), /#0a7d32/);

      assert.equal(await revertRequest(request), 'done');
      for (const mode of [ 'draft', 'published' ]) {
        const doc = await apos.doc.db.findOne({
          _id: draft._id.replace(':draft', `:${mode}`)
        });
        assert.equal(doc.accentColor, before, mode);
        // The editor's own value stays
        assert.equal(doc.radius, 12, mode);
        assert.doesNotMatch(await getStylesheet(mode), /#0a7d32/, mode);
      }
    });

    it('leaves Global Styles to a revert while the window is open', async function () {
      const request = await endedRequest();
      const draft = await getWindowDraft();
      await saveFromWindow(draft, { accentColor: '#7d0a32' }, request);
      const checked = await apos.aposAssistant.checkRevert(
        userReq(editor),
        request.chatId,
        {
          requestId: request._id,
          tabId: 'tab-1',
          screen: withWindow()
        }
      );
      const planned = checked.documents.find(document => document.docId === draft._id);
      assert.equal(planned.outcome, 'locked');
      assert.equal(planned.reason, 'editor');
    });

    it('is restored from Document Versions, with the stylesheet', async function () {
      const draft = await getWindowDraft();
      await saveFromWindow(draft, { accentColor: '#101010' });
      const marked = await getWindowDraft();
      await saveFromWindow(marked, { accentColor: '#202020' });
      const published = await apos.doc.db.findOne({
        _id: draft._id.replace(':draft', ':published')
      });
      const versions = await apos.docVersions.find(
        userReq(editor),
        apos.docVersions.getTimelineCriteria(published)
      );
      const version = versions.find(item => item.doc.accentColor === '#101010');
      await apos.http.put(`/api/v1/@apostrophecms/styles/${draft._id}`, {
        jar,
        body: {
          ...version.doc,
          _restoreVersion: version._id
        }
      });
      assert.equal((await getWindowDraft()).accentColor, '#101010');
      assert.match(await getStylesheet('published'), /#101010/);
      const [ latest ] = await apos.docVersions.find(
        userReq(editor),
        apos.docVersions.getTimelineCriteria(published)
      );
      assert.equal(latest.restoredFrom?._id, version._id);
    });

    // What the window holds, as it reads it
    async function getWindowDraft() {
      const { results } = await apos.http.get('/api/v1/@apostrophecms/styles', {
        jar,
        qs: { aposMode: 'draft' }
      });
      return results[0];
    }

    // Update in the window: its values, with what the request wrote in it
    function saveFromWindow(draft, values, request = null) {
      return apos.http.put(`/api/v1/@apostrophecms/styles/${draft._id}`, {
        jar,
        body: {
          ...draft,
          ...values,
          ...(request && {
            _outside: {
              tabId: 'tab-1',
              parts: [ {
                marker: { requestId: request._id },
                fields: [ 'accentColor' ]
              } ]
            }
          })
        }
      });
    }

    async function getStylesheet(mode) {
      const global = await apos.doc.db.findOne({
        type: '@apostrophecms/global',
        aposLocale: `en:${mode}`
      });
      return global.stylesStylesheet || '';
    }

  });

  // A screen with the Global Styles window open on an English page
  function withWindow(extra = {}) {
    return {
      tabId: 'tab-1',
      window: {
        kind: 'editor',
        docId: styles.en._id,
        docType: '@apostrophecms/styles'
      },
      ...extra
    };
  }

  function accentTarget(doc, color) {
    return {
      _id: doc._id,
      values: { accentColor: color }
    };
  }

  function updateTurn(docs, color) {
    return toolTurn('update_document', {
      targets: docs.map(doc => accentTarget(doc, color))
    }, 'update');
  }

  async function getAccent(locale) {
    const doc = await apos.doc.db.findOne({
      type: '@apostrophecms/styles',
      aposLocale: `${locale}:draft`
    });
    return doc.accentColor;
  }

  async function revertRequest(request) {
    const req = userReq(editor);
    const started = await apos.aposAssistant.revert(req, request.chatId, {
      requestId: request._id,
      tabId: 'tab-1'
    });
    await waitFor(async () => {
      const stored = await apos.aposAssistant.getRevert(req, started._id);
      const job = stored.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: stored.jobId });
      return (stored.status !== 'running') && (!job || job.ended);
    });
    return (await apos.aposAssistant.getRevert(req, started._id)).status;
  }

  // A request of a new chat, ended
  async function endedRequest() {
    const req = userReq(editor);
    const chat = await apos.aposAssistant.createChat(req);
    await apos.aposAssistant.send(req, chat._id, {
      message: 'Hello',
      screen: { tabId: 'tab-1' }
    });
    return waitForEnd(req, chat);
  }

  function userReq(user) {
    return apos.task.getReq({
      user,
      mode: 'draft'
    });
  }

  async function runToEnd(req, chat, message) {
    await apos.aposAssistant.send(req, chat._id, {
      message,
      screen: { tabId: 'tab-1' }
    });
    return waitForEnd(req, chat);
  }

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

  function sequence(turns) {
    const queue = [ ...turns ];
    return () => queue.shift() || { text: 'Done.' };
  }
});

function pathOf(row) {
  return row.path.map(segment => segment.name).join('.');
}

function aiOf(row) {
  return [ pathOf(row), row.ai ];
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
