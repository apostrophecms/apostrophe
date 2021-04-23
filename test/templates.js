const t = require('../test-lib/test.js');
const assert = require('assert');
const cheerio = require('cheerio');
const Promise = require('bluebird');

let apos;

describe('Templates', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  it('should have a templates property', async () => {
    apos = await t.create({
      root: module,
      modules: {
        'express-test': {},
        'template-test': {},
        'template-subclass-test': {},
        'template-options-test': {},
        'inject-test': {},
        'with-layout-page': {
          extend: '@apostrophecms/page-type'
        },
        'fragment-page': {
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

  it('should render fragments containing async components correctly', async () => {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-page'].renderPage(req, 'page');
    if (result.match(/error/)) {
      throw result;
    }

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

  it('should render fragment without passing any keyword arguments', async () => {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');
    if (result.match(/error/)) {
      throw result;
    }

    const m = result.match(/--test1--([\S\s]*?)--endtest1--/g);
    const arr = m[0].split('\n');
    const data = arr
      .slice(1, arr.length - 1)
      .filter(s => !!s.trim())
      .map(s => s.trim());

    assert.deepStrictEqual(data, [
      'pos1',
      'pos2',
      'kw1_default',
      'kw2_default',
      'kw3_default'
    ]);
  });

  it('should support keyword arguments and render macros and fragments from other fragments', async () => {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');
    if (result.match(/error/)) {
      throw result;
    }

    const m = result.match(/--test2--([\S\s]*?)--endtest2--/g);
    const arr = m[0].split('\n');
    const data = arr
      .slice(1, arr.length - 1)
      .filter(s => !!s.trim())
      .map(s => s.trim());

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

  it('should render rendercall blocks', async () => {
    const req = apos.task.getReq();
    const result = await apos.modules['fragment-all'].renderPage(req, 'page');
    if (result.match(/error/)) {
      throw result;
    }

    const m = result.match(/--test3--([\S\s]*?)--endtest3--/g);
    const arr = m[0].split('\n');
    const data = arr
      .slice(1, arr.length - 1)
      .filter(s => !!s.trim())
      .map(s => s.trim());

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

});
