const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// A pass of the Localize dialog's AI run: one document into one locale, the
// model replaced by a scripted agent that calls the pass's own tools. Long
// documents are covered by ai-localize-parts.js.

describe('AI Localize: a pass of the Localize run', function () {
  this.timeout(t.timeout);

  let apos;
  const users = {};
  // The agent's turns for the test at hand, one tool call each: `(outputs)
  // => ({ name, input })`, `outputs` being the results of the calls so far,
  // or a text, which ends the pass
  let steps = [];
  // Every request the model got
  let requests = [];
  let canceling = false;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/ai': {
          options: {
            mock: agent
          }
        },
        '@apostrophecms/ai-localize': {
          options: {
            cancelPollInterval: 10
          }
        },
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: { prefix: '/fr' },
              de: { prefix: '/de' }
            }
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
                name: 'run-page',
                label: 'Page'
              }
            ]
          }
        },
        'run-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              summary: { type: 'string' },
              // Kept away from AI
              internal: { type: 'string' },
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {},
                    'run-card': {}
                  }
                }
              },
              aside: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          },
          extendMethods(self) {
            return {
              getAiSchema(_super, req) {
                return _super(req).filter(field => field.name !== 'internal');
              }
            };
          }
        },
        'run-card-widget': {
          extend: '@apostrophecms/widget-type',
          fields: {
            add: {
              heading: { type: 'string' },
              // Kept away from AI
              tracking: { type: 'string' },
              _authors: {
                type: 'relationship',
                withType: 'run-author'
              }
            }
          },
          extendMethods(self) {
            return {
              getAiSchema(_super, req) {
                return _super(req).filter(field => field.name !== 'tracking');
              }
            };
          }
        },
        'run-author': {
          extend: '@apostrophecms/piece-type'
        }
      }
    });
    for (const name of [ 'ann', 'bob' ]) {
      users[name] = await apos.user.insert(apos.task.getReq(), {
        username: name,
        title: name[0].toUpperCase() + name.slice(1),
        password: 'test-password',
        role: 'admin'
      });
    }
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  beforeEach(function () {
    steps = [];
    requests = [];
    canceling = false;
  });

  async function agent(req, request) {
    requests.push(request);
    const outputs = request.messages
      .flatMap(message => message.content)
      .filter(part => part.type === 'toolResult')
      .map(part => ((part.error !== undefined) ? { error: part.error } : part.output));
    const step = steps[outputs.length];
    const made = step ? await step(outputs) : 'Nothing left to do.';
    return {
      content: [
        (typeof made === 'string')
          ? {
            type: 'text',
            text: made
          }
          : {
            type: 'toolCall',
            id: `call-${outputs.length}`,
            ...made
          }
      ],
      finishReason: (typeof made === 'string') ? 'stop' : 'toolCalls',
      usage: {
        inputTokens: 1,
        outputTokens: 1
      }
    };
  }

  const french = value => value.replaceAll('Hello', 'Bonjour');
  const readTarget = () => ({
    name: 'localize_read_text',
    input: { copy: 'target' }
  });
  // Every entry of the read at `index`, translated
  const translate = (index = 0) => outputs => ({
    name: 'localize_update',
    input: {
      values: Object.fromEntries(outputs[index].entries
        .map(entry => [ entry.address, french(entry.value) ]))
    }
  });
  const finish = () => ({
    name: 'localize_finish',
    input: { summary: 'Translated.' }
  });

  function userReq(username = 'ann', extra = {}) {
    return apos.task.getReq({
      user: users[username],
      mode: 'draft',
      ...extra
    });
  }

  // Runs the pairs of `docs` into `locale` as the job does
  async function run(docs, locale = 'fr', options = {}) {
    const outcomes = [];
    await apos.aiLocalize.work(userReq(), {
      isCanceling: async () => canceling,
      setTotal: async () => {},
      success: async () => {},
      failure: async () => {},
      setResults: results => outcomes.push(...results.outcomes)
    }, {
      jobId: 'test',
      pairs: docs.map(doc => ({
        docId: doc._id,
        title: doc.title,
        type: doc.type,
        related: false,
        locale
      })),
      overwriteMain: false,
      overwriteRelated: false,
      translateLocales: [ 'fr', 'de' ],
      ...options
    });
    return outcomes;
  }

  // The request of a tool call of a pass from `source` into its French copy
  function passReq(source, pass = {}) {
    return userReq('ann', {
      aposAi: true,
      aposAiLocalize: {
        sourceId: source._id,
        targetId: inLocale(source, 'fr'),
        sourceLocale: 'en',
        targetLocale: 'fr',
        writes: 0,
        texts: 0,
        ...pass
      }
    });
  }

  const inLocale = (doc, locale) => doc._id.replace(/:[^:]+:draft$/, `:${locale}:draft`);
  const stored = _id => apos.doc.db.findOne({ _id });
  const vias = async doc => (await apos.aiLocalize.recordsDb
    .find({ aposDocId: doc.aposDocId })
    .sort({ at: 1 })
    .toArray()).map(record => record.via);
  const richText = content => ({
    metaType: 'widget',
    type: '@apostrophecms/rich-text',
    content
  });
  const card = fields => ({
    metaType: 'widget',
    type: 'run-card',
    ...fields
  });

  function insertPage(fields = {}) {
    return apos.page.insert(userReq(), '_home', 'lastChild', {
      type: 'run-page',
      title: 'Hello page',
      summary: 'Hello in short',
      ...fields,
      main: {
        metaType: 'area',
        items: fields.main || [
          richText('<p>Hello <strong>world</strong></p>'),
          card({ heading: 'Hello card' })
        ]
      }
    });
  }

  // Core's own copy, as the classic Localize makes it: both copies in line
  async function localize(page, locale = 'fr') {
    const draft = await apos.page.findOneForEditing(userReq(), { _id: page._id });
    await apos.page.localize(userReq(), draft, locale);
    return stored(inLocale(page, locale));
  }

  async function edit(_id, change) {
    const req = userReq('ann', { locale: _id.split(':')[1] });
    const draft = await apos.page.findOneForEditing(req, { _id });
    change(draft);
    return apos.page.update(req, draft);
  }

  describe('a pass', function () {
    it('should copy a document new to a locale and translate all of it', async function () {
      const page = await insertPage();
      steps = [ readTarget, translate(), finish ];

      const [ outcome ] = await run([ page ]);

      assert.equal(outcome.status, 'done', JSON.stringify(outcome));
      assert.equal(outcome.mode, 'new');
      assert.equal(outcome.translated, true);
      assert.equal(outcome.writes, 1);
      assert.equal(outcome.texts, 4);
      assert.equal(outcome.summary, 'Translated.');
      assert.equal(outcome.targetId, inLocale(page, 'fr'));
      assert.equal(outcome.url, '/fr/hello-page');
      const task = requests[0].messages[0].content[0].text;
      assert.match(task, /fresh copy of the source/);
      const copy = await stored(inLocale(page, 'fr'));
      assert.equal(copy.title, 'Bonjour page');
      assert.equal(copy.summary, 'Bonjour in short');
      assert.equal(copy.main.items[0].content, '<p>Bonjour <strong>world</strong></p>');
      assert.equal(copy.main.items[1].heading, 'Bonjour card');
      assert.equal(copy.path, page.path);
      assert.deepEqual(await vias(page), [ 'copy', 'ai' ]);
      assert.equal((await stored(page._id)).title, 'Hello page');
    });

    it('should bring over what changed in the source and keep the target\'s own work', async function () {
      const page = await insertPage();
      await localize(page);
      await edit(inLocale(page, 'fr'), draft => {
        draft.summary = 'Le nôtre';
      });
      await edit(page._id, draft => {
        draft.title = 'Hello again';
      });
      steps = [
        readTarget,
        () => ({
          name: 'localize_update',
          input: { values: { title: 'Bonjour encore' } }
        }),
        finish
      ];

      const [ outcome ] = await run([ page ]);

      assert.equal(outcome.status, 'done', JSON.stringify(outcome));
      assert.equal(outcome.mode, 'update');
      assert.equal(outcome.changes.basis, 'record');
      assert.equal(outcome.changes.count, 1);
      assert.equal(outcome.texts, 1);
      const task = requests[0].messages[0].content[0].text;
      const lists = task.split('targetChanges');
      assert.match(lists[0], /"address": "title"/);
      assert.match(lists[0], /Hello again/);
      assert.match(lists[1], /"address": "summary"/);
      const copy = await stored(inLocale(page, 'fr'));
      assert.equal(copy.title, 'Bonjour encore');
      assert.equal(copy.summary, 'Le nôtre');
      assert.deepEqual(await vias(page), [ 'localize', 'ai' ]);
    });

    it('should find a pair with no change in the source up to date without a model call', async function () {
      const page = await insertPage();
      await localize(page);
      await edit(inLocale(page, 'fr'), draft => {
        draft.summary = 'Le nôtre';
      });

      const [ outcome ] = await run([ page ]);

      assert.equal(outcome.status, 'upToDate');
      assert.equal(outcome.changes.count, 0);
      assert.equal(requests.length, 0);
      assert.equal((await stored(inLocale(page, 'fr'))).summary, 'Le nôtre');
      assert.deepEqual(await vias(page), [ 'localize' ]);
    });

    it('should stop when the run is canceled, and translate a stopped copy afresh the next time', async function () {
      const page = await insertPage();
      const other = await insertPage({ title: 'Hello other' });
      steps = [
        async () => {
          canceling = true;
          // Long enough for the run to notice
          await new Promise(resolve => setTimeout(resolve, 100));
          return readTarget();
        }
      ];

      const outcomes = await run([ page, other ]);

      assert.equal(outcomes[0].status, 'stopped');
      assert.equal(outcomes[0].writes, 0);
      assert.deepEqual(outcomes[1], {
        index: 1,
        status: 'stopped'
      });
      assert.equal(requests.length, 1);
      assert.deepEqual(await vias(page), [ 'copy' ]);
      assert.equal(await stored(inLocale(other, 'fr')), null);

      canceling = false;
      steps = [ readTarget, translate(), finish ];
      const [ again ] = await run([ page ]);

      assert.equal(again.status, 'done', JSON.stringify(again));
      assert.equal(again.mode, 'new');
      assert.equal((await stored(inLocale(page, 'fr'))).title, 'Bonjour page');
      assert.deepEqual(await vias(page), [ 'copy', 'copy', 'ai' ]);
    });

    it('should report a pass the model never declared finished as incomplete', async function () {
      const page = await insertPage();
      steps = [ readTarget, translate(), () => 'I could not check the result.' ];

      const [ outcome ] = await run([ page ]);

      assert.equal(outcome.status, 'incomplete');
      assert.equal(outcome.message, 'I could not check the result.');
      assert.equal(outcome.writes, 1);
      // What it wrote stays, and the copy still counts as untranslated
      assert.equal((await stored(inLocale(page, 'fr'))).title, 'Bonjour page');
      assert.deepEqual(await vias(page), [ 'copy' ]);
    });

    it('should tell the model when an area refuses a widget', async function () {
      const page = await insertPage();
      let refusal;
      steps = [
        () => ({
          name: 'localize_add_widget',
          input: {
            area: 'aside',
            widget: {
              type: 'run-card',
              heading: 'Bonjour'
            }
          }
        }),
        ([ output ]) => {
          refusal = output;
          return 'The card does not fit there.';
        }
      ];

      const [ outcome ] = await run([ page ]);

      assert.equal(outcome.status, 'incomplete');
      assert.equal(outcome.writes, 0);
      assert.equal(typeof refusal.error, 'string');
      // The area was never edited: it exists only in the schema
      assert.equal((await stored(inLocale(page, 'fr'))).aside, undefined);
    });

    it('should replace a copy whole when asked to, and translate it', async function () {
      const page = await insertPage();
      await localize(page);
      await edit(inLocale(page, 'fr'), draft => {
        draft.summary = 'Le nôtre';
      });
      steps = [ readTarget, translate(), finish ];

      const [ outcome ] = await run([ page ], 'fr', { overwriteMain: true });

      assert.equal(outcome.status, 'done', JSON.stringify(outcome));
      assert.equal(outcome.mode, 'replace');
      const copy = await stored(inLocale(page, 'fr'));
      assert.equal(copy.summary, 'Bonjour in short');
      assert.deepEqual(await vias(page), [ 'localize', 'copy', 'ai' ]);
    });

    it('should copy without a model when the locale is not translated', async function () {
      const page = await insertPage();

      const [ outcome ] = await run([ page ], 'de', { translateLocales: [ 'fr' ] });

      assert.equal(outcome.status, 'done');
      assert.equal(outcome.mode, 'new');
      assert.equal(outcome.translated, false);
      assert.equal(requests.length, 0);
      assert.equal((await stored(inLocale(page, 'de'))).title, 'Hello page');
      assert.deepEqual(await vias(page), [ 'localize' ]);
    });
  });

  describe('the tools of a pass', function () {
    it('should write fields, widgets\' fields and rich text by address', async function () {
      const page = await insertPage();
      const copy = await localize(page);
      const [ text, heading ] = copy.main.items;
      const req = passReq(page);

      const result = await apos.aiLocalize.update(req, {
        values: {
          title: 'Bonjour page',
          [`@${heading._id}.heading`]: 'Bonjour carte',
          [`@${text._id}.content`]: '<p>Bonjour <strong>monde</strong></p>'
        }
      });

      assert.deepEqual(result, { written: 3 });
      assert.equal(req.aposAiLocalize.writes, 1);
      const saved = await stored(copy._id);
      assert.equal(saved.title, 'Bonjour page');
      assert.equal(saved.main.items[1].heading, 'Bonjour carte');
      assert.equal(saved.main.items[0].content, '<p>Bonjour <strong>monde</strong></p>');
      assert.equal(saved.summary, 'Hello in short');
      assert.equal((await stored(page._id)).title, 'Hello page');
    });

    it('should refuse to write what places or names the document', async function () {
      const page = await insertPage();
      await localize(page);

      await assert.rejects(
        apos.aiLocalize.update(passReq(page), { values: { slug: '/elsewhere' } }),
        {
          name: 'aiToolError',
          message: /slug cannot be written/
        }
      );
    });

    it('should copy a widget of the source whole, its relationships in the target\'s locale', async function () {
      const author = await apos.modules['run-author'].insert(userReq(), { title: 'Ann Author' });
      await apos.modules['run-author'].localize(userReq(), author, 'fr');
      const page = await insertPage();
      const copy = await localize(page);
      const { main } = await edit(page._id, draft => {
        draft.main.items.push(card({
          heading: 'Hello new card',
          tracking: 'utm-1',
          _authors: [ author ]
        }));
      });
      const req = passReq(page);

      const result = await apos.aiLocalize.addWidget(req, {
        area: 'main',
        copyOf: main.items[2]._id,
        position: 1
      });

      assert.equal(result.position, 1);
      assert.equal(req.aposAiLocalize.writes, 1);
      const saved = await stored(copy._id);
      assert.deepEqual(saved.main.items.map(item => item._id), [
        copy.main.items[0]._id,
        result.widgetId,
        copy.main.items[1]._id
      ]);
      const added = saved.main.items[1];
      assert.equal(added.heading, 'Hello new card');
      assert.equal(added.tracking, 'utm-1');
      assert.deepEqual(added.authorsIds, [ author.aposDocId ]);
      const loaded = await apos.page.find(userReq('ann', { locale: 'fr' }), { _id: copy._id })
        .toObject();
      assert.equal(loaded.main.items[1]._authors[0]._id, inLocale(author, 'fr'));
    });

    it('should add a widget the model wrote, at the end unless told where', async function () {
      const page = await insertPage();
      const copy = await localize(page);

      const result = await apos.aiLocalize.addWidget(passReq(page), {
        area: copy.main._id,
        widget: {
          type: 'run-card',
          heading: 'Bonjour'
        }
      });

      assert.equal(result.position, 2);
      const saved = await stored(copy._id);
      assert.equal(saved.main.items.length, 3);
      assert.equal(saved.main.items[2]._id, result.widgetId);
      assert.equal(saved.main.items[2].heading, 'Bonjour');
      assert.equal(saved.main.items[2].metaType, 'widget');
    });

    it('should refuse a widget given both ways, of an unknown type or for no area', async function () {
      const page = await insertPage();
      const copy = await localize(page);
      const add = input => apos.aiLocalize.addWidget(passReq(page), input);

      await assert.rejects(add({ area: 'main' }), { name: 'aiToolError' });
      await assert.rejects(add({
        area: 'main',
        widget: { type: 'nope' }
      }), { name: 'aiToolError' });
      await assert.rejects(add({
        area: 'nowhere',
        widget: {
          type: 'run-card',
          heading: 'Bonjour'
        }
      }), { name: 'aiToolError' });
      await assert.rejects(add({
        area: 'main',
        copyOf: 'nope'
      }), { name: 'aiToolError' });
      assert.equal((await stored(copy._id)).main.items.length, 2);
    });

    it('should remove a widget of the target', async function () {
      const page = await insertPage();
      const copy = await localize(page);
      const req = passReq(page);

      const result = await apos.aiLocalize.removeWidget(req, {
        widgetId: copy.main.items[0]._id
      });

      assert.deepEqual(result, { removed: copy.main.items[0]._id });
      assert.equal(req.aposAiLocalize.writes, 1);
      assert.deepEqual(
        (await stored(copy._id)).main.items.map(item => item._id),
        [ copy.main.items[1]._id ]
      );
      await assert.rejects(
        apos.aiLocalize.removeWidget(req, { widgetId: 'nope' }),
        { name: 'aiToolError' }
      );
    });

    it('should read either copy: its text, its structure, values by path, a widget type', async function () {
      const page = await insertPage();
      const copy = await localize(page);
      const [ text, heading ] = copy.main.items;
      const req = passReq(page);

      const read = await apos.aiLocalize.readText(req, { copy: 'source' });
      const outline = await apos.aiLocalize.readOutline(req, { copy: 'target' });
      const { values } = await apos.aiLocalize.readPaths(req, {
        copy: 'target',
        paths: [ 'title', `@${heading._id}.heading`, `@${text._id}`, 'nope' ]
      });
      const cardSchema = await apos.aiLocalize.widgetSchema(req, { type: 'run-card' });
      const textSchema = await apos.aiLocalize.widgetSchema(req, {
        type: '@apostrophecms/rich-text'
      });

      assert.equal(read.copy, 'source');
      assert.equal(read.locale, 'en');
      assert.equal(read.title, 'Hello page');
      assert.deepEqual(
        read.entries.map(({
          address, format, value
        }) => [ address, format, value ]),
        [
          [ 'title', 'text', 'Hello page' ],
          [ 'summary', 'text', 'Hello in short' ],
          [ `@${page.main.items[0]._id}.content`, 'html', '<p>Hello <strong>world</strong></p>' ],
          [ `@${page.main.items[1]._id}.heading`, 'text', 'Hello card' ]
        ]
      );
      assert.equal(outline.locale, 'fr');
      assert.equal(outline.type, 'run-page');
      const main = outline.areas.find(area => area.path === 'main');
      assert.equal(main._id, copy.main._id);
      assert.deepEqual(
        main.widgets.map(({
          _id, type, position
        }) => [ _id, type, position ]),
        [
          [ text._id, '@apostrophecms/rich-text', 0 ],
          [ heading._id, 'run-card', 1 ]
        ]
      );
      assert.equal(main.widgets[0].preview, 'Hello world');
      assert.deepEqual(values.map(({ path, found }) => [ path, found ]), [
        [ 'title', true ],
        [ `@${heading._id}.heading`, true ],
        [ `@${text._id}`, true ],
        [ 'nope', false ]
      ]);
      assert.equal(values[0].value, 'Hello page');
      assert.equal(values[1].value, 'Hello card');
      assert.equal(values[2].value.type, '@apostrophecms/rich-text');
      assert.equal(values[2].value.content, '<p>Hello <strong>world</strong></p>');
      assert.equal(values[3].value, null);
      assert.match(cardSchema.schema, /^heading: string$/m);
      assert.match(cardSchema.schema, /^_authors: relationship \(-> run-author\)$/m);
      assert.match(textSchema.schema, /^content: string \(HTML\)$/m);
    });

    it('should refuse a call made outside a pass', async function () {
      await assert.rejects(
        apos.aiLocalize.readText(userReq(), { copy: 'source' }),
        {
          name: 'aiToolError',
          message: /only available during a localization/
        }
      );
    });
  });

  // What the run gained when it moved onto the write path and the schema
  // every other AI write goes through
  describe('on the shared write path', function () {
    async function lockAs(username, doc, lockId = `${username}-tab`) {
      const req = userReq(username, { locale: doc.aposLocale.split(':')[0] });
      await apos.doc.lock(req, doc, lockId);
      return () => apos.doc.unlock(req, doc, lockId);
    }

    it('should fail a pair whose target another editor has open, before any model call', async function () {
      const page = await insertPage();
      const copy = await localize(page);
      await edit(page._id, draft => {
        draft.title = 'Hello again';
      });
      const unlock = await lockAs('bob', copy);
      steps = [ readTarget, translate(), finish ];

      const [ outcome ] = await run([ page ]);
      const [ replaced ] = await run([ page ], 'fr', { overwriteMain: true });
      await unlock();

      assert.equal(outcome.status, 'failed');
      assert.match(outcome.message, /Bob/);
      assert.equal(replaced.status, 'failed');
      assert.match(replaced.message, /Bob/);
      assert.equal(requests.length, 0);
      assert.equal((await stored(copy._id)).title, 'Hello page');
      assert.deepEqual(await vias(page), [ 'localize' ]);
    });

    it('should fail a pair whose target an editor opens while the pass works', async function () {
      const page = await insertPage();
      const copy = await localize(page);
      await edit(page._id, draft => {
        draft.title = 'Hello again';
      });
      let unlock;
      steps = [
        async () => {
          unlock = await lockAs('bob', copy);
          return {
            name: 'localize_update',
            input: { values: { title: 'Bonjour encore' } }
          };
        },
        finish
      ];

      const [ outcome ] = await run([ page ]);
      await unlock();

      assert.equal(outcome.status, 'failed');
      assert.match(outcome.message, /Bob/);
      assert.equal(requests.length, 1);
      assert.equal((await stored(copy._id)).title, 'Hello page');
      assert.deepEqual(await vias(page), [ 'localize' ]);
    });

    it('should neither show the model a field kept away from AI nor let it write one', async function () {
      const page = await insertPage({
        internal: 'Hello internal',
        main: [
          richText('<p>Hello <strong>world</strong></p>'),
          card({
            heading: 'Hello card',
            tracking: 'Hello tracking'
          })
        ]
      });
      let read;
      let refusal;
      steps = [
        readTarget,
        ([ output ]) => {
          read = output;
          return {
            name: 'localize_update',
            input: { values: { internal: 'Bonjour internal' } }
          };
        },
        outputs => {
          refusal = outputs[1];
          return translate()(outputs);
        },
        finish
      ];

      const [ outcome ] = await run([ page ]);

      assert.equal(outcome.status, 'done', JSON.stringify(outcome));
      assert.deepEqual(read.entries.map(entry => entry.address), [
        'title',
        'summary',
        `@${page.main.items[0]._id}.content`,
        `@${page.main.items[1]._id}.heading`
      ]);
      assert.match(refusal.error, /internal/);
      // Core's copy carries them, untranslated
      const copy = await stored(inLocale(page, 'fr'));
      assert.equal(copy.internal, 'Hello internal');
      assert.equal(copy.main.items[1].tracking, 'Hello tracking');
      assert.equal(copy.main.items[1].heading, 'Bonjour card');

      const req = passReq(page);
      const { values } = await apos.aiLocalize.readPaths(req, {
        copy: 'target',
        paths: [ `@${page.main.items[1]._id}`, 'internal' ]
      });
      const { schema } = await apos.aiLocalize.widgetSchema(req, { type: 'run-card' });
      const outline = await apos.aiLocalize.readOutline(req, { copy: 'target' });
      assert.equal(values[0].value.heading, 'Bonjour card');
      assert.equal(values[0].value.tracking, undefined);
      assert.equal(values[1].found, false);
      assert.doesNotMatch(schema, /tracking/);
      assert.doesNotMatch(JSON.stringify(outline), /Hello tracking/);
    });

    it('should keep the id of a copied widget when the target has none like it', async function () {
      const page = await insertPage();
      const copy = await localize(page);
      const { main } = await edit(page._id, draft => {
        draft.main.items.push(card({ heading: 'Hello new card' }));
      });
      const add = () => apos.aiLocalize.addWidget(passReq(page), {
        area: 'main',
        copyOf: main.items[2]._id
      });

      const first = await add();
      const second = await add();

      assert.equal(first.widgetId, main.items[2]._id);
      assert.notEqual(second.widgetId, main.items[2]._id);
      assert.deepEqual((await stored(copy._id)).main.items.map(item => item._id), [
        ...copy.main.items.map(item => item._id),
        first.widgetId,
        second.widgetId
      ]);
    });

    it('should refuse a value the save would drop', async function () {
      const page = await insertPage();
      const copy = await localize(page);

      await assert.rejects(
        apos.aiLocalize.update(passReq(page), {
          values: {
            [`@${copy.main.items[1]._id}._authors`]: [ { _id: 'nope:fr:draft' } ]
          }
        }),
        { name: 'aiToolError' }
      );
    });
  });
});
