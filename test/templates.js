const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const cheerio = require('cheerio');
const Promise = require('bluebird');

describe('Templates', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function() {
    return t.destroy(apos);
  });

  /**
   * Helper ofr grabbing output between --label-- ... --endlabel--, split it to
   * lines and remove all whitespace
   *
   * @param {String} result page output
   * @param {String} label a test case marker
   * @returns {Array<String>} array of non-empty lines
   */
  const parseOutput = (result, label) => {
    const regx = new RegExp(`--${label}--([\\S\\s]*?)--end${label}--`, 'g');
    const m = result.match(regx);
    const arr = m[0].split('\n');
    return arr
      .slice(1, arr.length - 1)
      .filter(s => !!s.trim())
      .map(s => s.trim());
  };

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        'express-test': {},
        'template-test': {
          options: {
            ignoreNoCodeWarning: true
          }
        },
        'template-subclass-test': {
          options: {
            ignoreNoCodeWarning: true
          }
        },
        'template-options-test': {},
        'inject-test': {},
        'with-layout-page': {
          extend: '@apostrophecms/page-type'
        },
        'fragment-page': {
          extend: '@apostrophecms/page-type',
          components(self) {
            return {
              async test(req, input) {
                // Be very async
                await Promise.delay(100);
                input.afterDelay = true;
                return input;
              }
            };
          }
        },
        'fragment-all': {
          components(self) {
            return {
              async test(req, input) {
                // Be very async
                await Promise.delay(100);
                input.afterDelay = true;
                return input;
              }
            };
          }
        },
        'inject-nodes': {
          init(self) {
            self.prependNodes('head', 'prependHeadTest');
            self.appendNodes('head', 'appendHeadTest');
            self.prependNodes('main', 'prependMainTest');
            self.appendNodes('main', 'appendMainTest');
            self.appendNodes('body', 'appendBodyTest');
          },
          methods(self) {
            return {
              prependHeadTest(req) {
                return [
                  {
                    name: 'meta',
                    attrs: {
                      name: 'prepend-node-head-test>'
                    }
                  }
                ];
              },
              appendHeadTest(req) {
                return [
                  {
                    name: 'meta',
                    attrs: {
                      name: 'append-node-head-test>'
                    }
                  }
                ];
              },
              prependMainTest(req) {
                return [
                  {
                    name: 'h4',
                    body: [
                      {
                        text: 'prepend-node-main-test<test>'
                      }
                    ]
                  }
                ];
              },
              appendMainTest(req) {
                return [
                  {
                    name: 'h4',
                    body: [
                      {
                        text: 'append-node-main-test<test>'
                      }
                    ]
                  }
                ];
              },
              appendBodyTest(req) {
                return [
                  {
                    comment: 'append-node-body-comment-test'
                  },
                  {
                    raw: '<h4>append-node-body-raw-test</h4>'
                  },
                  {
                    name: 'h3',
                    attrs: {
                      boolean: true,
                      ignored1: false,
                      ignored2: null,
                      ignored3: undefined,
                      truthy: 'true',
                      falsy: 'false'
                    },
                    body: [
                      {
                        text: 'append-node-body-misc-test'
                      }
                    ]
                  }
                ];
              }
            };
          }
        }
      }
    });
  });

  it('should be able to render a template relative to a module', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-test'].render(req, 'test', { age: 50 });
    assert(result === '<h1>50</h1>\n');
  });

  it('should respect templateData at module level', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-test'].render(req, 'test');
    assert(result === '<h1>30</h1>\n');
  });

  it('should respect template overrides', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-subclass-test'].render(req, 'override-test');
    assert(result === '<h1>I am overridden</h1>\n');
  });

  it('should inherit in the absence of overrides', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-subclass-test'].render(req, 'inherit-test');
    assert(result === '<h1>I am inherited</h1>\n');
  });

  it('should be able to see the options of the module via module.options', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-options-test'].render(req, 'options-test');
    assert(result.match(/nifty/));
  });

  it('should be able to call helpers on the modules object', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-options-test'].render(req, 'options-test');
    assert(result.match(/4/));
  });

  it('should render pages successfully with outerLayout, with core data-apos attribute', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-test'].renderPage(req, 'page');
    const $ = cheerio.load(result);
    const $body = $('body');
    assert($body.length);
    const aposData = JSON.parse($body.attr('data-apos'));
    assert(aposData);
    assert(aposData.shortName);
    assert(aposData.csrfCookieName);
    assert(!aposData.modules['@apostrophecms/admin-bar']);
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h2>I am the main content</h2>') !== -1);
  });

  it('should render pages successfully with outerLayout for admin user, with expanded data-apos attribute', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['template-test'].renderPage(req, 'page');
    const $ = cheerio.load(result);
    const $body = $('body');
    assert($body.length);
    const aposData = JSON.parse($body.attr('data-apos'));
    assert(aposData);
    assert(aposData.shortName);
    assert(aposData.modules['@apostrophecms/admin-bar'].items.length);
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h2>I am the main content</h2>') !== -1);
  });

  it('cross-module-included files should be able to include/extend other files relative to their own module', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-test'].renderPage(req, 'pageWithLayout');
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h2>I am the inner content</h2>') !== -1);
    assert(result.indexOf('<h3>I am in the layout</h3>') !== -1);
    assert(result.indexOf('<p>I am included</p>') !== -1);
  });

  it('should render pages successfully with prepend and append to locations', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['with-layout-page'].renderPage(req, 'page');
    const titleIndex = result.indexOf('<title>');
    const beforeTestIndex = result.indexOf('<meta name="prepend-head-test" />');
    const afterTestIndex = result.indexOf('<meta name="append-head-test" />');
    const bodyIndex = result.indexOf('<body');
    const appendBody = result.indexOf('<h4>append-body-test</h4>');
    assert(titleIndex !== -1);
    assert(beforeTestIndex !== -1);
    assert(afterTestIndex !== -1);
    assert(bodyIndex !== -1);
    assert(appendBody !== -1);
    assert(beforeTestIndex < titleIndex);
    assert(afterTestIndex > titleIndex);
    assert(afterTestIndex < bodyIndex);
  });

  it('should render pages successfully with prepend, append and conditions', async function() {
    const req = apos.task.getReq();
    const result = (await apos.modules['with-layout-page'].renderPage(req, 'page'))
      .split('<body')[0];

    const separatorIndex = result.indexOf('<meta name="condition-separator-test" />');

    const prependViteIndex = result.indexOf('<meta name="prepend-vite-test" />');
    const appendDevViteIndex = result.indexOf('<meta name="append-dev-vite-test" />');
    const appendProdWebpackIndex = result.indexOf('<meta name="append-prod-webpack-test" />');
    const prependProdIndex = result.indexOf('<meta name="prepend-prod-test" />');
    const prependDevViteIndex = result.indexOf('<meta name="prepend-dev-vite-test" />');

    const prependWebpackIndex = result.indexOf('<meta name="prepend-webpack-test" />');
    const prependDevIndex = result.indexOf('<meta name="prepend-dev-test" />');
    const prependDevWebpackIndex = result.indexOf('<meta name="prepend-dev-webpack-test" />');
    const appendDevWebpackIndex = result.indexOf('<meta name="append-dev-webpack-test" />');
    const appendDevIndex = result.indexOf('<meta name="append-dev-test" />');

    assert.ok(separatorIndex !== -1);
    assert.equal(prependViteIndex, -1);
    assert.equal(appendDevViteIndex, -1);
    assert.equal(appendProdWebpackIndex, -1);
    assert.equal(prependProdIndex, -1);
    assert.equal(prependDevViteIndex, -1);

    assert.ok(prependWebpackIndex !== -1);
    assert.ok(appendDevWebpackIndex !== -1);
    assert.ok(appendDevIndex !== -1);
    assert.ok(prependDevIndex !== -1);
    assert.ok(prependDevWebpackIndex !== -1);

    assert.ok(prependWebpackIndex < separatorIndex);
    // because the inject `when` dev is in our test,
    // while this one goes into the original outerLayoutBase.html
    assert.ok(prependWebpackIndex < appendDevWebpackIndex);
    assert.ok(prependDevIndex < separatorIndex);
    assert.ok(prependDevWebpackIndex < separatorIndex);
    assert.ok(prependDevIndex < prependDevWebpackIndex);
    assert.ok(appendDevWebpackIndex > separatorIndex);
    assert.ok(appendDevIndex > separatorIndex);
    assert.ok(appendDevWebpackIndex < appendDevIndex);
  });

  it('should render pages successfully with nodes prepend and append', async function() {
    const req = apos.task.getReq();
    const html = (await apos.modules['with-layout-page'].renderPage(req, 'page'))
      .split('<body');
    const head = html[0];
    const body = html[1];

    const prependNodeHeadTestIndex = head.indexOf('<meta name="prepend-node-head-test&gt;" />');
    const appendNodeHeadTestIndex = head.indexOf('<meta name="append-node-head-test&gt;" />');
    const prependNodeMainTestIndex = body.indexOf('<h4>prepend-node-main-test&lt;test&gt;</h4>');
    const appendNodeMainTestIndex = body.indexOf('<h4>append-node-main-test&lt;test&gt;</h4>');

    // Duplicate checks
    const prependNodeHeadLastIndex = head.lastIndexOf('<meta name="prepend-node-head-test&gt;" />');
    const appendNodeHeadLastIndex = head.lastIndexOf('<meta name="append-node-head-test&gt;" />');
    const prependNodeMainLastIndex = body.lastIndexOf('<h4>prepend-node-main-test&lt;test&gt;</h4>');
    const appendNodeMainLastIndex = body.lastIndexOf('<h4>append-node-main-test&lt;test&gt;</h4>');

    // Comment/raw checks
    const appendNodeBodyCommentTestIndex = body.indexOf('<!-- append-node-body-comment-test -->');
    const appendNodeBodyRawTestIndex = body.indexOf('<h4>append-node-body-raw-test</h4>');

    // Attribute handling checks
    const appendNodeBodyMiscTestIndex = body.indexOf(
      '<h3 boolean truthy="true" falsy="false">append-node-body-misc-test</h3>'
    );

    const actual = {
      prependHeadExist: prependNodeHeadTestIndex !== -1,
      appendHeadExist: appendNodeHeadTestIndex !== -1,
      prependHeadNoDuplicate: prependNodeHeadTestIndex === prependNodeHeadLastIndex,
      appendHeadNoDuplicate: appendNodeHeadTestIndex === appendNodeHeadLastIndex,
      headOrder: prependNodeHeadTestIndex < appendNodeHeadTestIndex,
      prependMainExist: prependNodeMainTestIndex !== -1,
      appendMainExist: appendNodeMainTestIndex !== -1,
      prependMainNoDuplicate: prependNodeMainTestIndex === prependNodeMainLastIndex,
      appendMainNoDuplicate: appendNodeMainTestIndex === appendNodeMainLastIndex,
      mainOrder: prependNodeMainTestIndex < appendNodeMainTestIndex,
      appendBodyCommentExist: appendNodeBodyCommentTestIndex !== -1,
      appendBodyRawExist: appendNodeBodyRawTestIndex !== -1,
      appendNodeBodyAttrsCheck: appendNodeBodyMiscTestIndex !== -1
    };

    const expected = {
      prependHeadExist: true,
      appendHeadExist: true,
      prependHeadNoDuplicate: true,
      appendHeadNoDuplicate: true,
      headOrder: true,
      prependMainExist: true,
      appendMainExist: true,
      prependMainNoDuplicate: true,
      appendMainNoDuplicate: true,
      mainOrder: true,
      appendBodyCommentExist: true,
      appendBodyRawExist: true,
      appendNodeBodyAttrsCheck: true
    };

    assert.deepEqual(
      actual,
      expected,
      'There was an issue with the prepend/append node rendering.'
    );
  });

  it('should not escape <br /> generated by the nlbr filter, but should escape tags in its input', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-test'].render(req, 'testWithNlbrFilter');
    assert.strictEqual(result, '<p>first line<br />\nsecond line<br />\n&lt;a href=&#34;javascript:alert(\'oh no\')&#34;&gt;CSRF attempt&lt;/a&gt;</p>\n');
  });

  it('should not escape <br /> generated by the nlp filter, but should escape tags in its input', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-test'].render(req, 'testWithNlpFilter');
    assert.strictEqual(result, '<p>first line</p>\n<p>second line</p>\n<p>&lt;a href=&#34;javascript:alert(\'oh no\')&#34;&gt;CSRF attempt&lt;/a&gt;</p>\n');
  });

  it('should not escape <br /> generated by the nlbr filter or markup in the test input', async function() {
    const req = apos.task.getAnonReq();
    const result = await apos.modules['template-test'].render(req, 'testWithNlbrFilterSafe');
    assert.strictEqual(result, '<p>first line<br />\nsecond line<br />\n<a href="http://niceurl.com">This is okay</a></p>\n');
  });

  it('should render fragments containing async components correctly', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-page'].renderPage(req, 'page');
    const aboveFragment = result.indexOf('Above Fragment');
    const beforeComponent = result.indexOf('Before Component');
    const componentText = result.indexOf('Component Text');
    const afterDelay = result.indexOf('After Delay');
    const afterComponent = result.indexOf('After Component');
    const belowFragment = result.indexOf('Below Fragment');

    assert(aboveFragment !== -1);
    assert(beforeComponent !== -1);
    assert(componentText !== -1);
    assert(afterDelay !== -1);
    assert(afterComponent !== -1);
    assert(belowFragment !== -1);

    assert(aboveFragment < beforeComponent);
    assert(beforeComponent < componentText);
    assert(componentText < afterDelay);
    assert(afterDelay < afterComponent);
    assert(afterComponent < belowFragment);
  });

  it('should render fragment without passing any keyword arguments', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');

    const data = parseOutput(result, 'test1');
    assert.deepStrictEqual(data, [
      'pos1',
      'pos2',
      'kw1_default',
      'kw2_default',
      'kw3_default'
    ]);
  });

  it('should support keyword arguments and render macros and fragments from other fragments', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');

    const data = parseOutput(result, 'test2');
    assert.deepStrictEqual(data, [
      'Above Fragment',
      'pos1',
      'pos2',
      'pos3',
      'kw1_default',
      'kw2',
      'kw3_default',
      'Below Fragment'
    ]);
  });

  it('should render rendercall blocks', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');

    const data = parseOutput(result, 'test3');
    assert.deepStrictEqual(data, [
      'Above Call Fragment',
      'pos1',
      'pos2',
      'pos3',
      'Start Call Body',
      'Text is called',
      'After Delay',
      'End Call Body',
      'kw1_default',
      'kw2',
      'kw3_default',
      'Below Call Fragment'
    ]);
  });

  it('should skip positional arguments when there is keyword arguments (1)', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');

    const data = parseOutput(result, 'issue_3056_1');
    assert.deepStrictEqual(data, [
      'val_1',
      'val_',
      'val_9',
      'val_4'
    ]);
  });

  it('should skip positional arguments when there is keyword arguments (2)', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');

    const data = parseOutput(result, 'issue_3056_2');
    assert.deepStrictEqual(data, [
      'val_1',
      'val_',
      'val_9',
      'val_4'
    ]);
  });

  it('should filter out unknown keyword arguments', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');

    const data = parseOutput(result, 'issue_3102');
    assert.deepStrictEqual(data, [
      'val_',
      'val_1',
      'val_2',
      'val_'
    ]);
  });

  it('should support apos helpers and localization in fragments', async function() {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'aux-test');
    assert(result.includes('gee-whiz'));
    assert(result.includes('Modify / Delete'));
  });

});
