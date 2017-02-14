var assert = require('assert');
var t = require('./testUtils');

var apos;

describe('Templates', function(){

  this.timeout(5000);

  it('should have a templates property', function(done) {
  	apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7934
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {},
        'templates-options-test': {}
      },
      afterInit: function(callback) {
        assert(apos.templates);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        // assert(!err);
        done();
      }
    });
  });

  it('should be able to render a template relative to a module', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-test'].render(req, 'test', { age: 50 });
    assert(result === '<h1>50</h1>\n');
  });

  it('should respect templateData at module level', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-test'].render(req, 'test');
    assert(result === '<h1>30</h1>\n');
  });

  it('should respect template overrides', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-subclass-test'].render(req, 'override-test');
    assert(result === '<h1>I am overridden</h1>\n');
  });

  it('should inherit in the absence of overrides', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-subclass-test'].render(req, 'inherit-test');
    assert(result === '<h1>I am inherited</h1>\n');
  });

  it('should be able to see the options of the module via module.options', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-options-test'].render(req, 'options-test');
    assert(result.match(/nifty/));
  });

  it('should be able to call helpers on the modules object', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-options-test'].render(req, 'options-test');
    assert(result.match(/4/));
  });

  it('should render pages successfully with outerLayout', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-test'].renderPage(req, 'page');
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h1>I am the title</h1>') !== -1);
    assert(result.indexOf('<h2>I am the main content</h2>') !== -1);
  });

  it('cross-module-included files should be able to include/extend other files relative to their own module', function() {
    var req = t.req.anon(apos);
    var result = apos.modules['templates-test'].renderPage(req, 'pageWithLayout');
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h1>I am the title</h1>') !== -1);
    assert(result.indexOf('<h2>I am the inner content</h2>') !== -1);
    assert(result.indexOf('<h3>I am in the layout</h3>') !== -1);
    assert(result.indexOf('<p>I am included</p>') !== -1);
  });
});
