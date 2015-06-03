var assert = require('assert');
var _ = require('lodash');
var async = require('async');

var apos;

function anonReq() {
  return {
    res: {
      __: function(x) { return x; }
    },
    browserCall: apos.app.request.browserCall,
    getBrowserCalls: apos.app.request.getBrowserCalls,
    query: {}
  };
}

function adminReq() {
  return _.merge(anonReq(), {
    user: {
      permissions: {
        admin: true
      }
    }
  });
}


describe('Pieces', function() {
  //////
  // EXISTENCE
  //////

  it('should initialize', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7942
        },
        'things': {
          extend: 'apostrophe-pieces',
          addFields: {
            name: 'foo',
            label: 'Foo',
            type: 'string'
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.modules['things']);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        done();
      },
    });
  });

  var testThing = {
    title: 'hello',
    foo: 'bar'
  };

  it('should create a new piece', function(done) {
    assert(apos.modules['things'].newInstance);
    var thing = apos.modules['things'].newInstance();
    assert(thing);
    done();
  });

  it('should insert a piece into the database', function(done) {
    assert(apos.modules['things'].insert);
    apos.modules['things'].insert(adminReq(), testThing, function(err) {
      assert(!err);
      done();
    });
  });

  it('should update a piece in the database', function(done) {
    assert(apos.modules['things'].update);
    testThing.foo = 'moo';
    apos.modules['things'].update(adminReq(), testThing, function(err) {
      assert(!err);
      done();
    });
  });


});