var t = require('../test-lib/test.js');
var assert = require('assert');

var apos;

describe('Templates', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('should have a templates property', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        },
        'express-test': {
          ignoreNoCodeWarning: true
        },
        'templates-test': {
          ignoreNoCodeWarning: true
        },
        'templates-subclass-test': {
          ignoreNoCodeWarning: true
        },
        'templates-options-test': {
          ignoreNoCodeWarning: true
        },
        'apostrophe-pages': {
          park: [
            {
              title: 'With Layout',
              slug: '/with-layout',
              type: 'withLayout'
            }
          ]
        }
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
        assert(!err);
        done();
      }
    });
  });

  it('should be able to render a template relative to a module', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-test'].render(req, 'test', { age: 50 });
    assert(result === '<h1>50</h1>\n');
  });

  it('should respect templateData at module level', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-test'].render(req, 'test');
    assert(result === '<h1>30</h1>\n');
  });

  it('should respect template overrides', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-subclass-test'].render(req, 'override-test');
    assert(result === '<h1>I am overridden</h1>\n');
  });

  it('should inherit in the absence of overrides', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-subclass-test'].render(req, 'inherit-test');
    assert(result === '<h1>I am inherited</h1>\n');
  });

  it('should be able to see the options of the module via module.options', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-options-test'].render(req, 'options-test');
    assert(result.match(/nifty/));
  });

  it('should be able to call helpers on the modules object', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-options-test'].render(req, 'options-test');
    assert(result.match(/4/));
  });

  it('should render pages successfully with outerLayout', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-test'].renderPage(req, 'page');
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h2>I am the main content</h2>') !== -1);
  });

  it('cross-module-included files should be able to include/extend other files relative to their own module', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-test'].renderPage(req, 'pageWithLayout');
    assert(result.indexOf('<title>I am the title</title>') !== -1);
    assert(result.indexOf('<h2>I am the inner content</h2>') !== -1);
    assert(result.indexOf('<h3>I am in the layout</h3>') !== -1);
    assert(result.indexOf('<p>I am included</p>') !== -1);
  });

  it('should render pages successfully with prepend and append to locations', function() {
    var req = apos.tasks.getReq();
    // Otherwise there is no context menu (we need a page or a piece)
    req.data.page = {
      _id: 'imadethisup',
      _edit: true
    };
    apos.templates.prepend('head', function(req) {
      assert(req.res);
      return '<meta name="before-test" />';
    });
    apos.templates.append('head', function(req) {
      assert(req.res);
      return '<meta name="after-test" />';
    });
    apos.pages.addAfterContextMenu(function(req) {
      assert(req.res);
      return '<h4>After the Context Menu</h4>';
    });
    var result = apos.pages.renderPage(req, 'pages/withLayout');
    var titleIndex = result.indexOf('<title>');
    var beforeTestIndex = result.indexOf('<meta name="before-test" />');
    var afterTestIndex = result.indexOf('<meta name="after-test" />');
    var bodyIndex = result.indexOf('<body');
    var afterContextMenu = result.indexOf('<h4>After the Context Menu</h4>');
    assert(titleIndex !== -1);
    assert(beforeTestIndex !== -1);
    assert(afterTestIndex !== -1);
    assert(bodyIndex !== -1);
    assert(afterContextMenu !== -1);
    assert(beforeTestIndex < titleIndex);
    assert(afterTestIndex > titleIndex);
    assert(afterTestIndex < bodyIndex);
  });

  it('should not escape <br />', function() {
    var req = apos.tasks.getAnonReq();
    var result = apos.modules['templates-test'].render(req, 'testWithNlbrFilter');
    assert.equal(result, '<p>first line<br />\nsecond line</p>\n');
  });

  it('should format dates', function() {
    var req = apos.tasks.getAnonReq();
    // default locale
    var result = apos.modules['templates-test'].renderString(req, '{{ data.now | date(\'LLLL\') }}', {
      now: new Date(2018, 11, 1)
    });
    assert.equal(result, 'Saturday, December 1, 2018 12:00 AM');
    // locale parameter is respected
    result = apos.modules['templates-test'].renderString(req, '{{ data.now | date(\'LLLL\', \'en-gb\') }}', {
      now: new Date(2018, 11, 1)
    });
    assert.equal(result, 'Saturday, 1 December 2018 00:00');
    // Use of a locale does not persistently alter behavior for next call with no locale
    result = apos.modules['templates-test'].renderString(req, '{{ data.now | date(\'LLLL\') }}', {
      now: new Date(2018, 11, 1)
    });
    assert.equal(result, 'Saturday, December 1, 2018 12:00 AM');
  });

});
