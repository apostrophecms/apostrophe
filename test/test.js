var assert = require('assert'),
	_ = require('lodash');


describe('Apostrophe', function() {
  it('should exist', function(done) {
    var apos = require('../index.js');
    assert(apos);
    return done();
  });

  it('should merge the options and local.js correctly', function(done){
  	var apos = require('../index.js')({
		rootDir: __dirname,
	  	shortName: 'test',  // overriden by data/local.js
	  	hostName: 'test.com',
		__testDefaults: {
			modules: {
			    'apostrophe-test-module': {},
		    }
		},
		afterInit: function(callback) {
			assert(apos.options.shortName === 'foo');
			return done();
		}
	});
  });

  // it('invoke local.js as a function if it is provided as one', function(done){
  // 	return done();
  // });

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
			assert(apos.modules['apostrophe-test-module'].color === 'red');
			return done();
		}
	});
  });

  it('should load the default modules correctly', function(done){
  	var defeaultModules = require('../defaults.js').modules;

	var apos = require('../index.js')({ 

		rootDir: '../',  // set for the normal lib/modules folder
		shortName: 'test',
		hostName: 'test.com',

		afterInit: function(callback) {

    		assert(apos.modules);
    		assert(_.difference(_.keys(defeaultModules), _.keys(apos.modules)).length === 0);    		
    		return done();
		}
	});
  });


});