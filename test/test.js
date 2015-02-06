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

  it('should load the default modules correctly', function(done){
    var defaultModules = require('../defaults.js').modules;

    var apos = require('../index.js')({ 

        root: module,  // set for the normal lib/modules folder
        shortName: 'test',
        hostName: 'test.com',
        afterInit: function(callback) {
        	assert(apos.assets.color === 'blue');
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

    // describe('Base Module', function(){
    //     var apos;

    //     it('should be subclassable', function(done){
    //         apos = require('../index.js')({ 
    //             root: module,
    //             shortName: 'test',
    //             hostName: 'test.com',
    //             __testDefaults: {
    //                 modules: { 
    //                     'apostrophe-test-module': {}
    //                 }
    //             },
    //             afterInit: function(callback) {

    //                 assert(apos.test && apos.test.color === 'red');
    //                 return done();
    //             }
    //         });
    //     });

    //     it('should have methods: pushAsset, render, renderString, renderer, rendererString, and renderPage', function(done){
    //         assert(typeof(apos.test.pushAsset) === 'function');
    //         assert(typeof(apos.test.render) === 'function');
    //         assert(typeof(apos.test.renderString) === 'function');
    //         assert(typeof(apos.test.renderer) === 'function');
    //         assert(typeof(apos.test.rendererString) === 'function');
    //         assert(typeof(apos.test.renderPage) === 'function');
    //         return done();
    //     });
    // });

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
    //     CACHES  //
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
});
