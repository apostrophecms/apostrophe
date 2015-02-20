var assert = require('assert'),
    _ = require('lodash'),
    fs = require('fs');

if (!fs.existsSync(__dirname +'/node_modules')) { 
  fs.mkdirSync(__dirname + '/node_modules');
  fs.symlinkSync(__dirname + '/..', __dirname +'/node_modules/apostrophe', 'dir');
}


describe('Apostrophe', function() {
  it('should exist', function(done) {
    var apos = require('../index.js');
    assert(apos);
    return done();
  });

  // BOOTSTRAP FUNCTIONS ------------------------------------------- //

  it('should merge the options and local.js correctly', function(done){
    var apos = require('../index.js')({
      root: module,
      shortName: 'test',  // overriden by data/local.js
      hostName: 'test.com',
      __testDefaults: {
          modules: {}
      },
      afterInit: function(callback) {
        assert(apos.options.shortName === 'foo');
        return done();
      }
    });
  });

  it('should accept a `__localPath` option and invoke local.js as a function if it is provided as one', function(done){
    var apos = require('../index.js')({
      root: module,
      shortName: 'test',  // overriden by data/local_fn.js
      hostName: 'test.com',
      __localPath: '/data/local_fn.js',  
      __testDefaults: {
          modules: {}
      },
      afterInit: function(callback) {
        assert(apos.options.shortName === 'foo');
        return done();
      }
    });
  });

  it('should invoke local.js as a function with the apos and config object', function(done){
    var apos = require('../index.js')({
      root: module,
      shortName: 'test',   // concated in local_fn_b.js
      hostName: 'test.com',
      __localPath: '/data/local_fn_b.js',  
      __testDefaults: {
          modules: {}
      },
      afterInit: function(callback) {
        assert(apos.options.shortName === 'test-foo');
        return done();
      }
    });
  });

  it('should accept a `__testDeafults` option and load the test modules correctly', function(done){
    var apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      __testDefaults: {
          modules: {
              'apostrophe-test-module': {},
          }
      },
      afterInit: function(callback) {
        assert(apos.modules['apostrophe-test-module']);
        return done();
      }
    });
  });

  it('should create the modules and invoke the construct function correctly', function(done){
    var apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      __testDefaults: {
          modules: {
              'apostrophe-test-module': {},
          }
      },
      afterInit: function(callback) {
        assert(apos.test && apos.test.color === 'red');
        return done();
      }
    });
  });

  it('should load the default modules and implicitly subclass the base module correctly', function(done){
    var defaultModules = require('../defaults.js').modules;

    var apos = require('../index.js')({ 
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      afterInit: function(callback) {
        // color = blue is inherited from our implicit subclass of the base module
        assert(apos.assets && apos.assets.color === 'blue');
        // make sure that our modules match what is specifed in deafults.js
        assert(_.difference(_.keys(defaultModules), _.keys(apos.modules)).length === 0);            
        return done();
      }
    });
  });
});

// ------------------------------------------------------------------- //
// MODULES  ---------------------------------------------------------- //

describe('Modules', function(){

  //                   //
  //    BASE MODULE    //
  //                   //

  describe('Base Module', function(){
    var apos;

    it('should be subclassable', function(done){
      apos = require('../index.js')({ 
        root: module,
        shortName: 'test',
        hostName: 'test.com',
        modules: {
          // will push an asset for us to look for later
          'apostrophe-test-module-push': {}
        },
        afterInit: function(callback) {
          assert(apos.test && apos.test.color === 'red');
          return done();
        }
      });
    });

    it('should provide apos.assets with the right context for pushing assets', function(done){
      var found = false;
      for (var i = apos.assets.pushed.stylesheets.length - 1; i >= 0; i--) {
        if (apos.assets.pushed.stylesheets[i].file == __dirname + '/lib/modules/apostrophe-test-module-push/public/css/test.css') {
          found = true;
          break;
        }
      };
      assert(found);
      return done();
    });
  });

  //            //
  //    UTIL    //
  //            //

  describe('Utils', function(){
    var apos;

    it('should exist on the apos object', function(done){
      apos = require('../index.js')({ 
        root: module,
        shortName: 'test',
        hostName: 'test.com',
        afterInit: function(callback) {
          assert(apos.utils);
          return done();
        }
      });
    });

    // UTIL METHODS ------------------------------------------------------- //

    describe('methods', function(){

      it('generateId: should return a string of an number', function(done){
        var id = apos.utils.generateId();

        assert(typeof(id) === 'string');
        assert(typeof(parseInt(id)) === 'number');
        return done();
      });
      
      it('globalReplace: should replace multiple instances of a string', function(done){
        var s = apos.utils.globalReplace('apostrophe is for cool kids. therefore apostrophe is cool.', 'apostrophe', 'comma');

        assert(s.indexOf('apostrophe') < 0);
        assert(s.split('comma').length == 3);
        return done();
      });
      
      it('truncatePlaintext: should tuncate a message without cutting off a word', function(done){
        var s = apos.utils.truncatePlaintext('I want to be cut off here. This is an extra sentance.', 25);

        assert(s.indexOf('here') > 0);
        return done();
      });

      it('escapeHtml: should replace html tags with html string entites', function(done){
        var s = apos.utils.escapeHtml('<div>hello</div>');
        
        assert(s.indexOf('<') < 0 && s.indexOf('&lt;') >= 0);
        return done();
      });

      it('htmlToPlaintext: should strip all html notation', function(done){
        var s = apos.utils.htmlToPlaintext('<div>hello</div>');

        assert(s.indexOf('<') < 0 && s.indexOf('hello') >= 0);
        return done();
      });

      it('capitalizeFirst: should capitalize the first letter', function(done){
        var s = apos.utils.capitalizeFirst('hello');
        
        assert(s.indexOf('hello') < 0 && s.indexOf('H' == 0));
        return done();
      });

      it('cssName: should covert camelCase or underscore name formats to hyphenated css-style', function(done){
        var s = apos.utils.cssName('camelCase and under_score');

        assert(s.indexOf('C') < 0 && s.indexOf('_') < 0);
        assert(s.indexOf('camel-case') >= 0);
        return done();
      });

      it('camelName: should convert non digits or ASII characters to a capitalized version of the next character', function(done){
        var s = apos.utils.camelName('hello apostrophe');

        assert(s.indexOf(' ') < 0 && s.indexOf('A') == 5);
        return done();
      });

      it('addSlashIfNeeded: should add a slash "/" to the end of a path if necessary', function(done){
        var s = apos.utils.addSlashIfNeeded('/my/path');
        
        assert(s === '/my/path/');
        return done();
      }); 
    });
  });

  //            //
  //     DB     //
  //            //

  describe('Db', function(){
    it('should exist on the apos object with a connection at port 27017', function(done){
      var apos = require('../index.js')({ 
        root: module,
        shortName: 'test',
        hostName: 'test.com',
        afterInit: function(callback) {
          assert(apos.db);
          assert(apos.db.serverConfig.port === 27017)
          return done();
        }
      });
    });
  });

  //             //
  //   CACHES    //
  //             //

  describe('Caches', function() {
    var apos;
    var cache;
    it('should exist on the apos object', function(done) {
      apos = require('../index.js')({
        root: module,
        shortName: 'test',
        hostName: 'test.com',
        afterInit: function(callback) {
            assert(apos.caches);
            return done();
        }
      });
    });
    it('should give us a cache object', function() {
      cache = apos.caches.get('testMonkeys');
    });
    it('should not crash on clear', function(done) {
      return cache.clear(done);
    });
    it('should not contain capuchin yet', function(done) {
      return cache.get('capuchin', function(err, monkey) {
        assert(!err);
        assert(!monkey);
        return done();
      });
    });
    it('should allow us to store capuchin', function(done) {
      return cache.set('capuchin', { message: 'eek eek' }, function(err) {
        assert(!err);
        return done();
      });
    });
    it('should now contain capuchin', function(done) {
      return cache.get('capuchin', function(err, monkey) {
        assert(!err);
        assert(monkey);
        assert(monkey.message === 'eek eek');
        return done();
      });
    });
    it('should not crash on clear #2', function(done) {
      return cache.clear(done);
    });
    it('should not contain capuchin anymore', function(done) {
      return cache.get('capuchin', function(err, monkey) {
        assert(!err);
        assert(!monkey);
        return done();
      });
    });
  });

  //               //
  //    EXPRESS    //
  //               //

  var apos;

  describe('Express', function(){

    it('express should exist on the apos object', function(done){
      apos = require('../index.js')({
        root: module,
        shortName: 'test',
        hostName: 'test.com',
        modules: {
          'apostrophe-express': {
            port: 7934
          },
          'express-test': {},
          'templates-test': {},
          'templates-subclass-test': {}
        },
        afterInit: function(callback) {
          assert(apos.express);
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

    it('app should exist on the apos object', function() {
      assert(apos.app);
    });

    it('baseApp should exist on the apos object', function() {
      assert(apos.baseApp);
    });

    it('app and baseApp should be the same in the absence of a prefix', function() {
      assert(apos.baseApp === apos.app);
    });

    it('should allow us to implement a route that requires the JSON bodyParser', function(done) {
      var request = require('request');
      request({
        method: 'POST',
        url: 'http://localhost:7934/tests/body',
        json: {
          person: {
            age: '30'
          }
        }
      }, function(err, response, body) {
        assert(body.toString() === '30');
        done();
      });
    });
    it('should be able to implement a route with apostrophe-module.route', function(done) {
      var request = require('request');
      request({
        method: 'POST',
        url: 'http://localhost:7934/modules/express-test/test2',
        json: {
          person: {
            age: '30'
          }
        }
      }, function(err, response, body) {
        assert(body.toString() === '30');
        done();
      });
    });
  });

  //             //
  //             //
  //  TEMPLATES  //
  //             //
  //             //

  describe('Templates', function(){

    it('should have a templates property', function() {
      assert(apos.templates);
    });

    // mock up a request
    function newReq() {
      return {
        res: {
          __: function(x) { return x; }
        },
        pushCall: apos.app.request.pushCall,
        getCalls: apos.app.request.getCalls,
        pushData: apos.app.request.pushData,
        getData: apos.app.request.getData,
        query: {}
      };
    }

    it('should be able to render a template relative to a module', function() {
      var req = newReq();
      var result = apos.modules['templates-test'].render(req, 'test', { age: 50 });
      assert(result === '<h1>50</h1>\n');
    });

    it('should respect templateData at module level', function() {
      var req = newReq();
      var result = apos.modules['templates-test'].render(req, 'test');
      assert(result === '<h1>30</h1>\n');
    });

    it('should respect template overrides', function() {
      var req = newReq();
      var result = apos.modules['templates-subclass-test'].render(req, 'override-test');
      assert(result === '<h1>I am overridden</h1>\n');
    });

    it('should inherit in the absence of overrides', function() {
      var req = newReq();
      var result = apos.modules['templates-subclass-test'].render(req, 'inherit-test');
      assert(result === '<h1>I am inherited</h1>\n');
    });

    it('should render pages successfully with outerLayout', function() {
      var req = newReq();
      var result = apos.modules['templates-test'].renderPage(req, 'page');
      assert(result.indexOf('<title>I am the title</title>') !== -1);
      assert(result.indexOf('<h1>I am the title</h1>') !== -1);
      assert(result.indexOf('<h2>I am the main content</h2>') !== -1);
    });

    it('cross-module-included files should be able to include/extend other files relative to their own module', function() {
      var req = newReq();
      var result = apos.modules['templates-test'].renderPage(req, 'pageWithLayout');
      assert(result.indexOf('<title>I am the title</title>') !== -1);
      assert(result.indexOf('<h1>I am the title</h1>') !== -1);
      assert(result.indexOf('<h2>I am the inner content</h2>') !== -1);
      assert(result.indexOf('<h3>I am in the layout</h3>') !== -1);
      assert(result.indexOf('<p>I am included</p>') !== -1);
    });
  });
});
