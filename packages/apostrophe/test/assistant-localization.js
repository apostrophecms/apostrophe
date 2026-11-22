const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const { findForeignTools } = require('../test-lib/ai-guidance.js');

// Selected widgets localized by the assistant, on the scripted mock: written
// in each locale's copy and nowhere else, a locale the editor may not edit
// refused and named, all of it taken back by Revert. The localization lines
// of the instructions, the site's translation service among them.

describe('Assistant: localizing selected widgets', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;
  let script = null;
  let calls = [];
  // The page in each locale, as seeded
  const pages = {};

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
              calls.push(request);
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
        '@apostrophecms/page': {
          options: {
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'loc-page',
                label: 'Page'
              }
            ]
          }
        },
        'loc-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
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
        // The site's translation service, as a module offers it to the
        // localization agent and to the assistant
        'loc-translator': {
          init(self) {
            self.apos.ai.addTool({
              name: 'site_translate',
              label: 'Translate',
              description: 'Translate texts with the site\'s translation service.',
              input: {
                type: 'object',
                properties: {
                  texts: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: [ 'texts' ],
                additionalProperties: false
              },
              tags: [ 'ai-localize-translate', 'assistant' ],
              kind: 'query',
              async handler(req, { texts }) {
                return { translations: texts };
              }
            });
          }
        }
      }
    });
    editor = await t.createAdmin(apos, { username: 'editor' });
    const req = userReq();
    const manager = apos.modules['loc-page'];
    const page = await apos.page.insert(req, '_home', 'lastChild', {
      type: 'loc-page',
      title: 'Story',
      main: {
        metaType: 'area',
        items: [ text('w-a', 'Alpha'), text('w-b', 'Bravo'), text('w-c', 'Charlie') ]
      }
    });
    for (const locale of [ 'fr', 'de' ]) {
      await manager.localize(req, page, locale);
    }
    // The source changed since: what the requests carry over
    const draft = await manager.findOneForEditing(req, { _id: page._id });
    draft.main.items[0].content = '<p>Alpha, edited</p>';
    draft.main.items[1].content = '<p>Bravo, edited</p>';
    await manager.update(req, draft);
    for (const locale of [ 'en', 'fr', 'de' ]) {
      pages[locale] = await stored(locale);
    }
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    script = null;
    calls = [];
  });

  it('should tell the model how copies work and when to ask, with the site\'s translation service', async function () {
    const chat = await apos.assistant.createChat(userReq());
    await runToEnd(chat, 'Hello');
    const { system } = calls[0];

    assert(system.includes('Make its copy in another locale with localize_document, never ' +
      'with a create tool; get_localization says what changed'));
    assert(system.includes(`\n\n${apos.assistant.getLocalizationSection()}`));
    assert.match(system, /^Localizing for the user:\n- Before replacing a change the target copy made itself/m);
    assert.match(system, /- site_translate is the site's translation service and has the last word on wording/);
    assert.match(apos.ai.getTool('create_page').description, /Never for a copy in another locale: that is localize_document\.$/);
    assert.match(apos.ai.getTool('create_piece').description, /Never for a copy in another locale: that is localize_document\.$/);
    // The service runs on the server, so the MCP door never has it
    assert(apos.harness.getDoorTools('assistant').some(({ name }) => name === 'site_translate'));
    assert(!apos.harness.getDoorTools('mcp').some(({ name }) => name === 'site_translate'));
    for (const door of [ 'assistant', 'mcp' ]) {
      assert.deepEqual(await findForeignTools(apos, door), []);
    }
  });

  it('should offer Localize in every widget type\'s menu, its prompt for the panel to open with', function () {
    const req = userReq();
    const operation = apos.modules['@apostrophecms/rich-text-widget'].getBrowserData(req)
      .widgetOperations.find(({ name }) => name === 'assistantLocalize');

    assert.deepEqual(operation, {
      name: 'assistantLocalize',
      label: 'apostrophe:localize',
      icon: 'translate-icon',
      action: 'assistant-widget-operation',
      secondaryLevel: true,
      multiple: true
    });
    assert.deepEqual(apos.assistant.getBrowserData(req).widgetOperations, {
      assistantLocalize: 'apostrophe:assistantLocalizePrompt'
    });
    assert.throws(() => apos.assistant.addWidgetOperation('bad', { label: 'Bad' }),
      /needs a label and a prompt/);
  });

  it('should localize a selected widget into one locale and change nothing else', async function () {
    const chat = await apos.assistant.createChat(userReq());
    script = sequence([
      toolTurn('get_localization', {
        _id: pages.en._id,
        locale: 'fr',
        widgets: [ 'w-a' ]
      }, 'read'),
      toolTurn('update_document', {
        targets: [ {
          _id: pages.fr._id,
          values: { '@w-a.content': '<p>Alpha, modifié</p>' }
        } ]
      }, 'write'),
      { text: 'Localized it into French.' }
    ]);
    const request = await runToEnd(chat, 'Localize this widget into French', [ 'w-a' ]);
    const fr = await stored('fr');

    assert.equal(request.status, 'completed');
    // The model is told which widget is selected
    assert(JSON.stringify(calls[0].messages.find(({ role }) => role === 'user'))
      .includes('\\"widgetIds\\":[\\"w-a\\"]'));
    // What the model matches on: the widget is in the French copy, and its
    // source change is a path that works there as it is
    const { output: read } = resultOf(request, 'call-read');
    assert.equal(read.state, 'behind');
    assert.deepEqual(read.widgets.map(w => [ w._id, w.counterpart, w.changed ]),
      [ [ 'w-a', true, true ] ]);
    assert.deepEqual(read.sourceChanges.map(row => [ row.path, row.counterpart ]),
      [ [ '@w-a.content', true ] ]);
    assert.equal(fr.main.items[0].content, '<p>Alpha, modifié</p>');
    assert.deepEqual(contents(fr).slice(1), contents(pages.fr).slice(1));
    assert.equal(fr.title, pages.fr.title);
    assert.deepEqual(contents(await stored('en')), contents(pages.en));
    assert.deepEqual(contents(await stored('de')), contents(pages.de));
    const entries = await apos.harness.changes.find({ requestId: request._id }).toArray();
    assert.deepEqual(entries.map(entry => [ entry.docId, entry.ai ]),
      [ [ pages.fr._id, true ] ]);
    await restore();
  });

  it('should localize several widgets into two locales, and take every locale back on revert', async function () {
    const chat = await apos.assistant.createChat(userReq());
    script = sequence([
      toolTurn('get_localization', {
        _id: pages.en._id,
        locale: 'fr',
        widgets: [ 'w-a', 'w-b' ]
      }, 'read-fr'),
      toolTurn('get_localization', {
        _id: pages.en._id,
        locale: 'de',
        widgets: [ 'w-a', 'w-b' ]
      }, 'read-de'),
      toolTurn('update_document', {
        targets: [ {
          _id: pages.fr._id,
          values: {
            '@w-a.content': '<p>Alpha, modifié</p>',
            '@w-b.content': '<p>Bravo, modifié</p>'
          }
        }, {
          _id: pages.de._id,
          values: {
            '@w-a.content': '<p>Alpha, bearbeitet</p>',
            '@w-b.content': '<p>Bravo, bearbeitet</p>'
          }
        } ]
      }, 'write'),
      { text: 'Localized both into French and German.' }
    ]);
    const request = await runToEnd(chat, 'Localize these 2 widgets into French and German',
      [ 'w-a', 'w-b' ]);

    assert.equal(request.status, 'completed');
    assert.deepEqual(contents(await stored('fr')),
      [ '<p>Alpha, modifié</p>', '<p>Bravo, modifié</p>', contents(pages.fr)[2] ]);
    assert.deepEqual(contents(await stored('de')),
      [ '<p>Alpha, bearbeitet</p>', '<p>Bravo, bearbeitet</p>', contents(pages.de)[2] ]);

    assert.equal(await revertRequest(request), 'done');
    for (const locale of [ 'en', 'fr', 'de' ]) {
      assert.deepEqual(contents(await stored(locale)), contents(pages[locale]), locale);
    }
  });

  it('should refuse and name a locale the editor may not edit, and write the others', async function () {
    const chat = await apos.assistant.createChat(userReq());
    script = sequence([
      toolTurn('update_document', {
        targets: [ {
          _id: pages.fr._id,
          values: { '@w-a.content': '<p>Alpha, modifié</p>' }
        }, {
          _id: pages.de._id,
          values: { '@w-a.content': '<p>Alpha, bearbeitet</p>' }
        } ]
      }, 'write'),
      { text: 'French is done; you may not edit the German page.' }
    ]);
    const can = apos.permission.can;
    apos.permission.can = (req, action, doc, ...rest) => {
      const locale = doc?.aposLocale?.split(':')[0] || req.locale;
      return ((action === 'edit') && (locale === 'de'))
        ? false
        : can(req, action, doc, ...rest);
    };
    let request;
    try {
      request = await runToEnd(chat, 'Localize this widget into French and German', [ 'w-a' ]);
    } finally {
      apos.permission.can = can;
    }
    const { output } = resultOf(request, 'call-write');

    assert.deepEqual(output.written.map(({ _id }) => _id), [ pages.fr._id ]);
    assert.deepEqual(output.refused.map(item => [ item._id, item.title, item.reason ]), [
      [ pages.de._id, 'Story', 'forbidden' ]
    ]);
    assert.equal((await stored('fr')).main.items[0].content, '<p>Alpha, modifié</p>');
    assert.deepEqual(contents(await stored('de')), contents(pages.de));
    await restore();
  });

  it('should not switch the page shown to edit mode for a record of its copies', async function () {
    const req = userReq();
    const chat = await apos.assistant.createChat(req);
    script = sequence([
      toolTurn('get_localization', {
        _id: pages.en._id,
        locale: 'fr'
      }, 'read'),
      toolTurn('record_localization', {
        _id: pages.en._id,
        locales: [ 'fr' ]
      }, 'record'),
      { text: 'Recorded.' }
    ]);
    await apos.assistant.send(req, chat._id, {
      message: 'Record French as up to date',
      screen: {
        tabId: 'tab-1',
        url: '/',
        visible: true,
        editing: false,
        document: {
          _id: pages.en._id,
          type: pages.en.type,
          title: pages.en.title
        }
      }
    });
    const request = await waitForEnd(req, chat);

    assert.equal(request.status, 'completed');
    assert.deepEqual(
      resultOf(request, 'call-record').output.written.map(item => item.locale),
      [ 'fr' ]
    );
    await apos.aiLocalize.recordsDb.deleteMany({ aposDocId: pages.en.aposDocId });
  });

  it('should record no localization while an editor holds the copy unsaved', async function () {
    const req = userReq();
    const held = await apos.assistant.createChat(req);
    const record = toolTurn('record_localization', {
      _id: pages.en._id,
      locales: [ 'fr' ]
    }, 'record');
    script = sequence([
      toolTurn('get_localization', {
        _id: pages.en._id,
        locale: 'fr'
      }, 'read'),
      record,
      { text: 'Save the French page first.' }
    ]);
    await apos.assistant.send(req, held._id, {
      message: 'Bring French up to date',
      screen: {
        tabId: 'tab-1',
        modals: [ {
          kind: 'editor',
          docId: pages.fr._id
        } ]
      }
    });
    const refused = await waitForEnd(req, held);
    const free = await apos.assistant.createChat(req);
    script = sequence([
      toolTurn('get_localization', {
        _id: pages.en._id,
        locale: 'fr'
      }, 'read'),
      record,
      { text: 'Recorded.' }
    ]);
    const recorded = await runToEnd(free, 'Bring French up to date');

    assert.match(
      resultOf(refused, 'call-record').error,
      /is open in an editor on the user's screen/
    );
    assert.deepEqual(
      resultOf(recorded, 'call-record').output.written.map(item => item.locale),
      [ 'fr' ]
    );
    const records = await apos.aiLocalize.recordsDb
      .find({
        aposDocId: pages.en.aposDocId,
        via: 'ai'
      })
      .toArray();
    assert.equal(records.length, 1);
    await apos.aiLocalize.recordsDb.deleteMany({ aposDocId: pages.en.aposDocId });
  });

  function userReq() {
    return apos.task.getReq({
      user: editor,
      mode: 'draft'
    });
  }

  function stored(locale) {
    return apos.doc.db.findOne({
      type: 'loc-page',
      aposLocale: `${locale}:draft`
    });
  }

  // The French and German copies back to as seeded, outside any request
  async function restore() {
    for (const locale of [ 'fr', 'de' ]) {
      await apos.doc.db.replaceOne({ _id: pages[locale]._id }, pages[locale]);
    }
  }

  async function runToEnd(chat, message, widgetIds) {
    const req = userReq();
    await apos.assistant.send(req, chat._id, {
      message,
      screen: {
        tabId: 'tab-1',
        ...(widgetIds && {
          selection: {
            docId: pages.en._id,
            widgetIds
          }
        })
      }
    });
    return waitForEnd(req, chat);
  }

  async function waitForEnd(req, chat) {
    let request;
    await waitFor(async () => {
      const requests = await apos.assistant.getChatRequests(req, chat._id);
      request = requests.at(-1);
      const open = (await apos.assistant.getChat(req, chat._id)).openRequest;
      const job = request?.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: request.jobId });
      return request && (request.status !== 'running') &&
        ((open === null) || (open.status === 'waiting')) && (!job || job.ended);
    });
    return request;
  }

  async function revertRequest(request) {
    const req = userReq();
    const started = await apos.assistant.revert(req, request.chatId, {
      requestId: request._id,
      tabId: 'tab-1'
    });
    await waitFor(async () => {
      const revert = await apos.assistant.getRevert(req, started._id);
      const job = revert.jobId &&
        await apos.modules['@apostrophecms/job'].db.findOne({ _id: revert.jobId });
      return (revert.status !== 'running') && (!job || job.ended);
    });
    return (await apos.assistant.getRevert(req, started._id)).status;
  }

  function sequence(turns) {
    const queue = [ ...turns ];
    return () => queue.shift() || { text: 'Done.' };
  }
});

function text(_id, words) {
  return {
    _id,
    metaType: 'widget',
    type: '@apostrophecms/rich-text',
    content: `<p>${words}</p>`
  };
}

function contents(page) {
  return page.main.items.map(item => item.content);
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
