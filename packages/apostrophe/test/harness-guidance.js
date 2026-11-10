const assert = require('assert').strict;
const t = require('../test-lib/test.js');

// Guidance: the instructions both doors send, in their fixed order, and the
// `aiWhen` and `aiHow` of types, field types and fields.

describe('Harness: guidance and language', function () {
  this.timeout(t.timeout);

  let apos;

  before(async function () {
    process.env.APOS_AI_MOCK = '1';
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/harness': {
          options: {
            guidance: 'Write in a warm, plain tone.'
          }
        },
        '@apostrophecms/ai': {
          extendMethods() {
            return {
              getDeniedTypes(_super) {
                return [ ..._super(), 'guide-secret' ];
              }
            };
          }
        },
        'guide-rating-field': {
          init(self) {
            self.apos.schema.addFieldType({
              name: 'guideRating',
              extend: 'integer',
              aiHow: 'A whole number from 1 to 5.'
            });
          }
        },
        'guide-article': {
          extend: '@apostrophecms/piece-type',
          options: {
            aiWhen: 'Guides and how-tos.',
            aiHow: 'Open with what the reader will be able to do.'
          },
          fields: {
            add: {
              summary: {
                type: 'string',
                help: 'Shown in lists',
                aiHow: 'One sentence, no jargon.'
              },
              rating: {
                type: 'guideRating',
                aiHow: 'Ask the user when unsure.'
              },
              score: {
                type: 'guideRating',
                help: 'Out of five'
              }
            }
          }
        },
        'guide-event': {
          extend: '@apostrophecms/piece-type',
          options: {
            aiHow: 'Give every event a start date.'
          }
        },
        'guide-secret': {
          extend: '@apostrophecms/piece-type',
          options: {
            aiWhen: 'Never shown to AI.',
            aiHow: 'Never shown to AI either.'
          }
        },
        'guide-banner-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            aiWhen: 'A banner at the top of a landing page.'
          }
        },
        'guide-page': {
          extend: '@apostrophecms/page-type',
          options: {
            aiWhen: 'A landing page for a campaign.'
          }
        }
      }
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  function userReq(extra = {}) {
    return apos.task.getReq({
      user: {
        _id: 'user-ann',
        username: 'ann',
        title: 'Ann',
        role: 'admin'
      },
      mode: 'draft',
      ...extra
    });
  }

  function doorReq(door) {
    return apos.harness.withDoor(userReq(), {
      door,
      lockId: `lock-${door}`,
      requestId: `request-${door}`
    });
  }

  async function captureLog(fn) {
    /* eslint-disable no-console */
    const lines = [];
    const log = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      await fn();
    } finally {
      console.log = log;
    }
    /* eslint-enable no-console */
    return lines.join('\n');
  }

  function run(name, input, req = userReq()) {
    return apos.ai.executeToolCall(req, apos.ai.getTool(name), {
      id: 'call-1',
      name,
      input
    });
  }

  describe('the instructions', function () {
    it('should assemble the slots in their fixed order', function () {
      const instructions = apos.harness.getInstructions(doorReq('assistant'), [
        'The editor is on /about.',
        '  ',
        'The plan: one step left.'
      ]);
      const [ base, site, types, ...door ] = instructions.split('\n\n');
      const baseLines = base.split('\n');

      assert.match(baseLines[0], /^You work on the content of this ApostropheCMS site/);
      assert(base.includes('never by id'));
      assert(base.includes('"notice"'));
      assert.match(baseLines.at(-1), /^Reply in the language the user writes in.+ English\.$/);
      assert.equal(site, 'Write in a warm, plain tone.');
      assert.deepEqual(types.split('\n'), [
        'When to use each type. A type marked "(aiHow)" has rules for working with it: ' +
          'read them with get_guidance first.',
        'guide-article: Guides and how-tos. (aiHow)',
        'guide-banner: A banner at the top of a landing page.',
        'guide-event (aiHow)',
        'guide-page: A landing page for a campaign.'
      ]);
      // An empty section is left out
      assert.deepEqual(door, [ 'The editor is on /about.', 'The plan: one step left.' ]);
    });

    it('should send every type\'s aiWhen through either door', function () {
      for (const req of [ doorReq('assistant'), doorReq('mcp'), userReq() ]) {
        const instructions = apos.harness.getInstructions(req);

        assert(instructions.includes('\nguide-banner: A banner at the top of a landing page.\n'));
        assert(instructions.endsWith('\nguide-page: A landing page for a campaign.'));
      }
    });

    it('should only mark a type\'s aiHow, which get_guidance gives', async function () {
      const instructions = apos.harness.getInstructions(userReq());
      const { input } = apos.ai.getTool('get_guidance');

      assert.equal(instructions.includes('Give every event a start date.'), false);
      assert.equal(instructions.includes('Open with what the reader'), false);
      assert.equal(instructions.includes('guide-secret'), false);
      assert.deepEqual(input.properties.types.items.enum, [ 'guide-article', 'guide-event' ]);
      assert.deepEqual(await run('get_guidance', { types: [ 'guide-event' ] }), {
        guidance: [ {
          type: 'guide-event',
          aiHow: 'Give every event a start date.'
        } ]
      });
    });

    it('should print with their size for developers', async function () {
      const printed = await captureLog(() => apos.task.invoke(
        '@apostrophecms/harness:print-instructions'
      ));
      const instructions = apos.harness.getInstructions(apos.task.getReq());

      assert.equal(
        printed,
        `# Instructions: ${instructions.length} characters, before each door's own sections\n\n` +
          instructions
      );
      assert(printed.includes('\nguide-page: A landing page for a campaign.'));
    });

    it('should name the admin UI language for a message with none of its own', function () {
      const req = userReq({ locale: 'en' });
      req.user.adminLocale = 'fr';

      const instructions = apos.harness.getInstructions(req);

      assert.match(
        instructions,
        /\nReply in the language the user writes in, even when the content or what they paste is in another\. A message with no language of its own \(only "ok", only pasted text\) gets a reply in French\.\n/
      );
    });
  });

  describe('the schema read', function () {
    it('should give a field\'s aiHow on its line and a field type\'s in the legend', async function () {
      const { schema, legend } = await run('get_schema', { types: [ 'guide-article' ] });
      const lines = schema.split('\n');

      // A field's own aiHow replaces its help; a field type's doesn't
      assert(lines.includes('summary: string, aiHow "One sentence, no jargon."'));
      assert(lines.includes('rating: guideRating, aiHow "Ask the user when unsure."'));
      assert(lines.includes('score: guideRating, help "Out of five"'));
      assert(legend.includes('\naiHow: '));
      assert(legend.includes('\naiHow for guideRating fields: A whole number from 1 to 5.'));
    });

    it('should explain only the aiHow a read shows', async function () {
      const fieldOnly = await run('get_schema', {
        types: [ 'guide-article' ],
        fields: [ 'summary' ]
      });
      const none = await run('get_schema', { types: [ 'guide-event' ] });

      assert(fieldOnly.legend.includes('\naiHow: '));
      assert.equal(fieldOnly.legend.includes('\naiHow for '), false);
      assert.equal(none.legend.includes('aiHow'), false);
    });
  });

  describe('the browser', function () {
    // The field aiHow texts of the fixture
    const texts = [ 'One sentence, no jargon.', 'Ask the user when unsure.' ];

    it('should never receive guidance in a rendered page', async function () {
      const req = apos.task.getReq();

      await apos.template.renderPageForModule(
        req,
        'page',
        {},
        apos.modules['@apostrophecms/home-page']
      );

      // The schema is in the body data, its guidance isn't
      const attributes = req.data.aposBodyDataAttributes;
      assert.match(attributes, /guide-article.+summary/);
      for (const text of texts) {
        assert.equal(attributes.includes(text), false, text);
      }
      const field = apos.modules['guide-article'].schema
        .find(field => field.name === 'summary');
      assert.equal(field.aiHow, 'One sentence, no jargon.');
    });

    it('should never receive guidance through an external front', async function () {
      const data = {};

      await apos.template.annotateDataForExternalFront(
        apos.task.getReq(),
        'guide-article:show',
        data,
        'guide-article'
      );

      const field = data.aposBodyData.modules['guide-article'].schema
        .find(field => field.name === 'summary');
      assert.equal(field.type, 'string');
      assert.equal(Object.hasOwn(field, 'aiHow'), false);
      for (const text of texts) {
        assert.equal(JSON.stringify(data).includes(text), false, text);
      }
    });
  });

  describe('refusals at startup', function () {
    // The instance fails after the first module's init, which captures it
    // for cleanup
    async function failsToBoot(modules, pattern) {
      let captured;
      try {
        await assert.rejects(t.create({
          root: module,
          exit: 'throw',
          modules: {
            capture: {
              init(self) {
                captured = self.apos;
              }
            },
            ...modules
          }
        }), pattern);
      } finally {
        await t.destroy(captured);
      }
    }

    it('should refuse guidance or a type\'s aiWhen or aiHow that is not a string', async function () {
      await failsToBoot({
        '@apostrophecms/harness': {
          options: {
            guidance: [ 'Be brief.' ]
          }
        }
      }, /"@apostrophecms\/harness" module's guidance option must be a string/);
      await failsToBoot({
        'bad-guide-widget': {
          extend: '@apostrophecms/widget-type',
          options: {
            aiWhen: { en: 'A banner.' }
          }
        }
      }, /"bad-guide-widget" module's aiWhen option must be a string/);
      await failsToBoot({
        'bad-guide': {
          extend: '@apostrophecms/piece-type',
          options: {
            aiHow: [ 'Lead with the news.' ]
          }
        }
      }, /"bad-guide" module's aiHow option must be a string/);
    });

    it('should refuse a field\'s or field type\'s aiHow that is not a string', async function () {
      await failsToBoot({
        'bad-guide': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              summary: {
                type: 'string',
                aiHow: () => 'One sentence.'
              }
            }
          }
        }
      }, /field "summary":\s+aiHow must be a string/);
      await failsToBoot({
        'bad-field-type': {
          init(self) {
            self.apos.schema.addFieldType({
              name: 'badRating',
              extend: 'integer',
              aiHow: 5
            });
          }
        }
      }, /"badRating" field type's aiHow must be a string/);
    });
  });
});
