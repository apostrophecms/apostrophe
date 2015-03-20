var assert = require('assert');

var apos;

describe('Express', function(){

  it('express should exist on the apos object', function(done){
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7936
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

  var request = require('request');

  it('should use the extended bodyParser for submitted forms', function(done){
  	request({
  		method: 'POST',
  		url: 'http://localhost:7936/tests/body',
  		form: {
  			person: {
  				age: '30'
  			}
  		}
  	}, function(err, response, body) {
  		assert(body.toString() === '30');
  		done();
  	});
  });
  it('should allow us to implement a route that requires the JSON bodyParser', function(done) {
    
    request({
      method: 'POST',
      url: 'http://localhost:7936/tests/body',
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
    request({
      method: 'POST',
      url: 'http://localhost:7936/modules/express-test/test2',
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

  // PREFIX STUFF

 	it('should set prefix on the apos object if passed in', function(done){
 		apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      prefix: '/prefix',
      modules: {
        'apostrophe-express': {
          port: 7937
        },
        'express-test': {},
        'templates-test': {},
        'templates-subclass-test': {}
      },
      afterInit: function(callback) {
        assert(apos.prefix);
        assert(apos.prefix === '/prefix');
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

 	it('should have different baseApp and app properties with a prefix', function(){
 		assert(apos.app !== apos.baseApp);
 	});

 	it('should take same requests at the prefix', function(done){
    request({
  		method: 'POST',
  		url: 'http://localhost:7937/prefix/tests/body',
  		form: {
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