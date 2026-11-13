const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const {
  splitParts: split, parsePartAddress, spliceParts
} = require('../modules/@apostrophecms/ai-localize/lib/parts.js');

// A long document, like a terms and conditions page, is read and written in
// parts, so no length is too much for AI localization. The limits are
// lowered here so that a few thousand characters stand in for a long
// document: parts of up to PART chars, pages of TEXT_PAGE and OUTLINE_PAGE
const PART = 300;
const TEXT_PAGE = 2000;
const OUTLINE_PAGE = 1500;
const CLAUSES = 30;
const splitParts = (value, format) => split(value, format, PART);
const clause = (i) => `<p>Clause ${i}. ${'The customer agrees to the terms. '.repeat(3)}</p>`;
const terms = '<h2>Terms</h2>\n' +
  Array.from({ length: CLAUSES }, (_, i) => clause(i)).join('\n') +
  '\n<ul>' +
  Array.from({ length: 20 }, (_, i) => `<li>${'Item text. '.repeat(5)}${i}</li>`).join('') +
  '</ul>\n<table><tr><td>Last</td></tr></table>';

describe('AI localization of long text', function() {
  this.timeout(t.timeout);

  describe('parts', function() {
    it('leaves short text whole', function() {
      assert.deepEqual(splitParts('<p>Short</p>', 'html'), [ {
        range: null,
        value: '<p>Short</p>'
      } ]);
    });

    it('splits long rich text into parts that cover all of it, nested blocks included', function() {
      const parts = splitParts(terms, 'html');
      assert(parts.length > 5);
      for (const part of parts) {
        assert(part.value.length <= PART);
      }
      // The list is longer than a part, so it splits among its items
      assert(parts.some((part) => part.range.includes('/')));
      // Every clause and item is in exactly one part
      const joined = parts.map((part) => part.value).join('');
      for (let i = 0; i < CLAUSES; i++) {
        assert.equal(joined.split(`Clause ${i}.`).length, 2);
      }
      assert(joined.includes('<td>Last</td>'));
    });

    it('writes every part back to its own range, leaving the rest exactly as it was', function() {
      const parts = splitParts(terms, 'html');
      const { value, notes } = spliceParts(terms, 'html', parts.map((part) => ({
        ...parsePartAddress(`@x.content#${part.range}`),
        text: part.value.replaceAll('customer', 'client')
      })));
      assert.equal(value, terms.replaceAll('customer', 'client'));
      assert.deepEqual(notes, []);
    });

    it('notes a write that changes the number of blocks', function() {
      const { value, notes } = spliceParts(terms, 'html', [ {
        ...parsePartAddress('@x.content#1-1'),
        text: '<p>One</p><p>Two</p>'
      } ]);
      assert(value.startsWith('<h2>Terms</h2>\n<p>One</p><p>Two</p>\n<p>Clause 1.'));
      assert.equal(notes.length, 1);
    });

    it('refuses a range that is not there, and overlapping writes', function() {
      assert.throws(() => spliceParts(terms, 'html', [ {
        ...parsePartAddress('@x.content#500-501'),
        text: 'x'
      } ]), /not in the target/);
      assert.throws(() => spliceParts(terms, 'html', [
        {
          ...parsePartAddress('@x.content#1-5'),
          text: 'x'
        },
        {
          ...parsePartAddress('@x.content#5-6'),
          text: 'y'
        }
      ]), /overlap/);
      assert.equal(parsePartAddress('@x.content#5-2'), null);
    });

    it('splits long plain text by lines', function() {
      const text = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join('\n');
      const parts = splitParts(text, 'text');
      assert(parts.length > 1);
      const { value } = spliceParts(text, 'text', parts.map((part) => ({
        ...parsePartAddress(`notes#${part.range}`),
        text: part.value.replaceAll('Line', 'Ligne')
      })));
      assert.equal(value, text.replaceAll('Line', 'Ligne'));
    });
  });

  describe('tools', function() {
    let apos;
    let source;
    let target;

    after(function() {
      return t.destroy(apos);
    });

    before(async function() {
      apos = await t.create({
        root: module,
        modules: {
          '@apostrophecms/ai-localize': {
            options: {
              partMaxChars: PART,
              textPageChars: TEXT_PAGE,
              outlinePageChars: OUTLINE_PAGE
            }
          },
          '@apostrophecms/i18n': {
            options: {
              locales: {
                en: {},
                fr: { prefix: '/fr' }
              }
            }
          },
          'terms-page': {
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
          }
        }
      });
      const req = apos.task.getReq({ mode: 'draft' });
      source = await apos.page.insert(req, '_home', 'lastChild', {
        title: 'Terms',
        type: 'terms-page',
        main: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: terms
            },
            // Enough widgets to page the outline
            ...Array.from({ length: 30 }, (_, i) => ({
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: `<p>Note ${i} with a preview</p>`
            }))
          ]
        }
      });
      target = await apos.page.localize(req, source, 'fr');
    });

    function passReq() {
      return apos.task.getReq({
        mode: 'draft',
        aposAiLocalize: {
          sourceId: source._id,
          targetId: target._id,
          sourceLocale: 'en',
          targetLocale: 'fr',
          writes: 0
        }
      });
    }

    it('reads a long field in parts and writes each part to its own address', async function() {
      const req = passReq();
      const entries = [];
      let offset = 0;
      let pages = 0;
      do {
        const page = await apos.aiLocalize.readText(req, {
          copy: 'target',
          offset
        });
        assert(JSON.stringify(page).length <= TEXT_PAGE + PART + 500);
        entries.push(...page.entries);
        offset = page.next;
        pages++;
      } while (offset !== undefined);
      assert(pages > 1);
      const parts = entries.filter((entry) => entry.parts);
      assert(parts.length > 5);
      assert(parts.every((entry) => /^@\w+\.content#[\d/]+-\d+$/.test(entry.address)));
      // Written a few parts per call, as a model would
      for (let i = 0; i < parts.length; i += 3) {
        const values = Object.fromEntries(parts.slice(i, i + 3)
          .map((entry) => [ entry.address, entry.value.replaceAll('customer', 'client') ]));
        const result = await apos.aiLocalize.update(req, { values });
        assert.equal(result.notes, undefined);
      }
      const saved = await apos.doc.db.findOne({ _id: target._id });
      const content = saved.main.items[0].content;
      assert(!content.includes('customer'));
      for (let i = 0; i < CLAUSES; i++) {
        assert(content.includes(`Clause ${i}. The client agrees`));
      }
      assert(content.includes('<td>Last</td>'));
    });

    it('pages a long outline', async function() {
      const req = passReq();
      const widgets = [];
      let offset = 0;
      let pages = 0;
      do {
        const page = await apos.aiLocalize.readOutline(req, {
          copy: 'source',
          offset
        });
        assert(JSON.stringify(page).length <= OUTLINE_PAGE + 500);
        widgets.push(...page.areas.flatMap((area) => area.widgets));
        offset = page.next;
        pages++;
      } while (offset !== undefined);
      assert(pages > 1);
      assert.equal(widgets.length, 31);
      assert.deepEqual(widgets.map((widget) => widget.position), [ ...widgets.keys() ]);
    });

    it('makes room in the step budget for a long document', function() {
      assert(apos.aiLocalize.extraParts(apos.task.getReq(), source) > 5);
    });
  });
  // A whole AI pass over a long document, the model replaced by a scripted
  // agent that works the way the prompt asks: read the target page by page,
  // write it back a couple of entries per call, finish. The base step budget
  // is far too small for that on purpose: only the steps a long document
  // adds to it let the pass finish
  describe('a full pass', function() {
    let apos;
    let source;
    const calls = [];

    after(async function() {
      delete process.env.APOS_AI_MOCK;
      return t.destroy(apos);
    });

    before(async function() {
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
              maxSteps: 3,
              partMaxChars: PART,
              textPageChars: TEXT_PAGE
            }
          },
          '@apostrophecms/i18n': {
            options: {
              locales: {
                en: {},
                fr: { prefix: '/fr' }
              }
            }
          },
          'terms-page': {
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
          }
        }
      });
      source = await apos.page.insert(apos.task.getReq({ mode: 'draft' }), '_home', 'lastChild', {
        title: 'Terms',
        type: 'terms-page',
        main: {
          metaType: 'area',
          items: [ {
            metaType: 'widget',
            type: '@apostrophecms/rich-text',
            content: terms
          } ]
        }
      });
    });

    async function agent(req, request) {
      const results = new Map();
      const made = [];
      for (const message of request.messages) {
        for (const part of message.content) {
          if (part.type === 'toolCall') {
            made.push(part);
          } else if (part.type === 'toolResult') {
            results.set(part.toolCallId, part);
          }
        }
      }
      const last = made.at(-1);
      const reads = made.filter((call) => call.name === 'localize_read_text');
      const lastRead = reads.at(-1) && results.get(reads.at(-1).id);
      if (!lastRead || lastRead.output?.next !== undefined) {
        return call('localize_read_text', {
          copy: 'target',
          offset: lastRead?.output?.next || 0
        });
      }
      if (last?.name === 'localize_finish') {
        return turn([ {
          type: 'text',
          text: 'Done'
        } ], 'stop');
      }
      const entries = reads.flatMap((read) => results.get(read.id).output.entries);
      const written = new Set(made
        .filter((call) => call.name === 'localize_update')
        .flatMap((call) => Object.keys(call.input.values)));
      const next = entries.filter((entry) => !written.has(entry.address)).slice(0, 2);
      if (next.length) {
        return call('localize_update', {
          values: Object.fromEntries(next.map((entry) => [
            entry.address,
            entry.value.replaceAll('customer', 'client').replace('Terms', 'Conditions')
          ]))
        });
      }
      return call('localize_finish', { summary: 'Translated the terms.' });

      function call(name, input) {
        calls.push(name);
        return turn([ {
          type: 'toolCall',
          id: `c${calls.length}`,
          name,
          input
        } ], 'toolCalls');
      }
      function turn(content, finishReason) {
        return {
          content,
          finishReason,
          usage: {
            inputTokens: 1,
            outputTokens: 1
          }
        };
      }
    }

    it('localizes a long document in full', async function() {
      const outcomes = [];
      await apos.aiLocalize.work(apos.task.getReq(), {
        isCanceling: async () => false,
        setTotal: async () => {},
        success: async () => {},
        failure: async () => {},
        setResults: (results) => outcomes.push(...results.outcomes)
      }, {
        jobId: 'test',
        pairs: [ {
          docId: source._id,
          title: source.title,
          type: source.type,
          related: false,
          locale: 'fr'
        } ],
        overwriteMain: false,
        overwriteRelated: false,
        translateLocales: [ 'fr' ]
      });
      assert.equal(outcomes[0].status, 'done', JSON.stringify(outcomes[0]));
      assert(calls.filter((name) => name === 'localize_read_text').length > 1);
      assert(calls.filter((name) => name === 'localize_update').length > 5);
      const copy = await apos.doc.db.findOne({ _id: `${source.aposDocId}:fr:draft` });
      assert.equal(copy.title, 'Conditions');
      const content = copy.main.items[0].content;
      assert(!content.includes('customer'));
      for (let i = 0; i < CLAUSES; i++) {
        assert(content.includes(`Clause ${i}. The client agrees`));
      }
      assert(content.includes('<td>Last</td>'));
    });
  });
});
