var assert = require('assert'),
    _ = require('lodash');



describe('Apostrophe', function() {
  it('should exist', function(done) {
    var apos = require('../index.js');
    assert(apos);
    return done();
  });

  // BOOTSTRAP FUNCTIONS ------------------------------------------- //

  it('should merge the options and local.js correctly', function(done){
    var apos = require('../index.js')({
        rootDir: __dirname,
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
        rootDir: __dirname,
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
        rootDir: __dirname,
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
        rootDir: __dirname,
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
        rootDir: __dirname,
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

        rootDir: '../',  // set for the normal lib/modules folder
        shortName: 'test',
        hostName: 'test.com',
        afterInit: function(callback) {

            assert(_.difference(_.keys(defaultModules), _.keys(apos.modules)).length === 0);            
            return done();
        }
    });
  });
});

// ------------------------------------------------------------------- //
// MODULES  ---------------------------------------------------------- //

describe('Modules', function(){

    //            //
    //    UTIL    //
    //            //

    describe('Utils', function(){
        var apos;

        it('should exist on the apos object', function(done){
            apos = require('../index.js')({ 
                rootDir: '../',
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
                done();
            });
            
            it('globalReplace: should replace multiple instances of a string', function(done){
                var s = apos.utils.globalReplace('apostrophe is for cool kids. therefore apostrophe is cool.', 'apostrophe', 'comma');

                assert(s.indexOf('apostrophe') < 0);
                assert(s.split('comma').length == 3);
                done();
            });
            
            it('truncatePlaintext: should tuncate a message without cutting off a word', function(done){
                var s = apos.utils.truncatePlaintext('I want to be cut off here. This is an extra sentance.', 25);

                assert(s.indexOf('here') > 0);
                done();
            });

            it('escapeHtml: should replace html tags with html string entites', function(done){
                var s = apos.utils.escapeHtml('<div>hello</div>');
                
                assert(s.indexOf('<') < 0 && s.indexOf('&lt;') >= 0);
                done();
            });

            it('htmlToPlaintext: should strip all html notation', function(done){
                var s = apos.utils.htmlToPlaintext('<div>hello</div>');

                assert(s.indexOf('<') < 0 && s.indexOf('hello') >= 0);
                done();
            });

            it('capitalizeFirst: should capitalize the first letter', function(done){
                var s = apos.utils.capitalizeFirst('hello');
                
                assert(s.indexOf('hello') < 0 && s.indexOf('H' == 0));
                done();
            });

            it('cssName: should covert camelCase or underscore name formats to hyphenated css-style', function(done){
                var s = apos.utils.cssName('camelCase and under_score');

                assert(s.indexOf('C') < 0 && s.indexOf('_') < 0);
                assert(s.indexOf('camel-case') >= 0);
                done();
            });

            it('camelName: should convert non digits or ASII characters to a capitalized version of the next character', function(done){
                var s = apos.utils.camelName('hello apostrophe');

                assert(s.indexOf(' ') < 0 && s.indexOf('A') == 5);
                done();
            });

            it('addSlashIfNeeded: should add a slash "/" to the end of a path if necessary', function(done){
                var s = apos.utils.addSlashIfNeeded('/my/path');
                
                assert(s === '/my/path/');
                done();
            }); 
        });
    });

    //            //
    //     DB     //
    //            //

    describe('Db', function(){
        it('should exist on the apos object with a connection at port 27017', function(done){
            var apos = require('../index.js')({ 
                rootDir: '../',
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
});