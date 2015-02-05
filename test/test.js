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