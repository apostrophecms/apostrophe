const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const { findForeignTools } = require('../test-lib/ai-guidance.js');

// What each door's model reads names only tools that door has, on a site
// with every core module that adds guidance or tools: several locales, the
// assistant, Global Styles with fields, AI Localize.

describe('Harness: what each door reads', function () {
  this.timeout(t.timeout);

  let apos;

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
              }
            }
          }
        },
        '@apostrophecms/ai': {
          options: {
            providers: { fake: {} }
          },
          init(self) {
            self.apos.ai.addAdapter({
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
            });
          }
        },
        '@apostrophecms/assistant': {
          options: {
            enabled: true
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
              }
            }
          }
        }
      }
    });
  });

  after(async function () {
    delete process.env.APOS_AI_MOCK;
    await t.destroy(apos);
  });

  it('should have every kind of tool registered, so the check means something', function () {
    const names = apos.ai.getTools().map(({ name }) => name);

    for (const name of [
      'update_document',
      'copy_widgets',
      'get_localization',
      'open_editor',
      'confirm',
      'localize_finish'
    ]) {
      assert(names.includes(name), name);
    }
  });

  for (const door of [ 'assistant', 'mcp' ]) {
    it(`should name no tool the ${door} door lacks in anything its model reads`, async function () {
      assert.deepEqual(await findForeignTools(apos, door), []);
    });
  }
});
