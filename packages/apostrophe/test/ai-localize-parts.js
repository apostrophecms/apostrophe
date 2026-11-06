const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const {
  PART_MAX_CHARS, splitParts, parsePartAddress, spliceParts
} = require('../modules/@apostrophecms/ai-localize/lib/parts.js');

// A long document, like a terms and conditions page, is read and written in
// parts, so no length is too much for AI localization
const clause = (i) => `<p>Clause ${i}. ${'The customer agrees to the terms. '.repeat(25)}</p>`;
const terms = '<h2>Terms</h2>\n' +
  Array.from({ length: 120 }, (_, i) => clause(i)).join('\n') +
  '\n<ul>' +
  Array.from({ length: 100 }, (_, i) => `<li>${'Item text. '.repeat(15)}${i}</li>`).join('') +
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
        assert(part.value.length <= PART_MAX_CHARS);
      }
      // The list is longer than a part, so it splits among its items
      assert(parts.some((part) => part.range.includes('/')));
      // Every clause and item is in exactly one part
      const joined = parts.map((part) => part.value).join('');
      for (let i = 0; i < 120; i++) {
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
      const text = Array.from({ length: 2000 }, (_, i) => `Line ${i}`).join('\n');
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
            ...Array.from({ length: 300 }, (_, i) => ({
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: `<p>Note ${i} ${'with a long enough preview '.repeat(4)}</p>`
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
      do {
        const page = await apos.aiLocalize.readText(req, {
          copy: 'target',
          offset
        });
        assert(JSON.stringify(page).length <= 62000);
        entries.push(...page.entries);
        offset = page.next;
      } while (offset !== undefined);
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
      for (let i = 0; i < 120; i++) {
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
        assert(JSON.stringify(page).length <= 22000);
        widgets.push(...page.areas.flatMap((area) => area.widgets));
        offset = page.next;
        pages++;
      } while (offset !== undefined);
      assert(pages > 1);
      assert.equal(widgets.length, 301);
      assert.deepEqual(widgets.map((widget) => widget.position), [ ...widgets.keys() ]);
    });

    it('makes room in the step budget for a long document', function() {
      assert(apos.aiLocalize.extraParts(apos.task.getReq(), source) > 5);
    });
  });
});
