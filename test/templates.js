let t = require('../test-lib/test.js');
let assert = require('assert');

let apos;

describe('Templates', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  it('should have a templates property', async () => {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        '@apostrophecms/express': {
          options: {
            secret: 'xxx',
            port: 7900
          }
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {},
        'templates-options-test': {},
        'inject-test': {},
        '@apostrophecms/pages': {
          options: {
            park: [
              {
                title: 'With Layout',
                slug: '/with-layout',
                type: 'withLayout',
                parkedId: 'withLayout'
              }
            ]
          }
        }
      }
    });
  });

  it('should be able to render a template relative to a module', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-test'].render(req, 'test', { age: 50 });
    assert(result === '<h1>50</h1>\n');
  });

  it('should respect templateData at module level', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-test'].render(req, 'test');
    assert(result === '<h1>30</h1>\n');
  });

  it('should respect template overrides', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-subclass-test'].render(req, 'override-test');
    assert(result === '<h1>I am overridden</h1>\n');
  });

  it('should inherit in the absence of overrides', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-subclass-test'].render(req, 'inherit-test');
    assert(result === '<h1>I am inherited</h1>\n');
  });

  it('should be able to see the options of the module via module.options', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-options-test'].render(req, 'options-test');
    assert(result.match(/nifty/));
  });

  it('should be able to call helpers on the modules object', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-options-test'].render(req, 'options-test');
    assert(result.match(/4/));
  });

  it('should render pages successfully with outerLayout', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-test'].renderPage(req, 'page');
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h2>I am the main content</h2>') !== -1);
  });

  it('cross-module-included files should be able to include/extend other files relative to their own module', async function() {
    let req = apos.tasks.getAnonReq();
    let result = await apos.modules['templates-test'].renderPage(req, 'pageWithLayout');
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h2>I am the inner content</h2>') !== -1);
    assert(result.indexOf('<h3>I am in the layout</h3>') !== -1);
    assert(result.indexOf('<p>I am included</p>') !== -1);
  });

  it('should render pages successfully with prepend and append to locations', async function() {
    let req = apos.tasks.getReq();
    let result = await apos.pages.renderPage(req, 'pages/withLayout');
    let titleIndex = result.indexOf('<title>');
    let beforeTestIndex = result.indexOf('<meta name="prepend-head-test" />');
    let afterTestIndex = result.indexOf('<meta name="append-head-test" />');
    let bodyIndex = result.indexOf('<body');
    let appendBody = result.indexOf('<h4>append-body-test</h4>');
    assert(titleIndex !== -1);
    assert(beforeTestIndex !== -1);
    assert(afterTestIndex !== -1);
    assert(bodyIndex !== -1);
    assert(appendBody !== -1);
    assert(beforeTestIndex < titleIndex);
    assert(afterTestIndex > titleIndex);
    assert(afterTestIndex < bodyIndex);
  });

});
