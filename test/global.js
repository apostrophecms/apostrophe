var t = require('../test-lib/test.js');
var assert = require('assert');
var apos, apos2;
var request = require('request-promise');
var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

describe('Global', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, function() {
      return t.destroy(apos2, done);
    });
  });

  it('global should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        },
        'products': {
          alias: 'products',
          extend: 'apostrophe-pieces',
          name: 'product'
        },
        'apostrophe-global': {
          whileBusyDelay: 0.5,
          addFields: [
            {
              name: 'testString',
              type: 'string',
              def: 'populated def'
            },
            {
              name: '_featuredProducts',
              type: 'joinByArray',
              withType: 'product'
            }
          ]
        }
      },
      afterInit: function(callback) {
        assert(apos.global);
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

  it('should populate when global.addGlobalToData is used as middleware', function(done) {
    var req = apos.tasks.getAnonReq();
    req.res.status = function(n) {
      assert(n <= 400);
      return req.res;
    };
    req.res.send = function(m) {};
    return apos.global.addGlobalToData(req, req.res, function() {
      assert(req.data.global);
      assert(req.data.global.type === 'apostrophe-global');
      done();
    });
  });

  it('should populate when global.addGlobalToData is used with a callback', function(done) {
    var req = apos.tasks.getAnonReq();
    return apos.global.addGlobalToData(req, function(err) {
      assert(!err);
      assert(req.data.global);
      assert(req.data.global.type === 'apostrophe-global');
      done();
    });
  });

  it('should populate when global.addGlobalToData is used to return a promise', function() {
    var req = apos.tasks.getAnonReq();
    return apos.global.addGlobalToData(req).then(function() {
      assert(req.data.global);
      assert(req.data.global.type === 'apostrophe-global');
    });
  });

  it('should populate def values of schema properties at insert time', function(done) {
    var req = apos.tasks.getAnonReq();
    return apos.global.addGlobalToData(req, function(err) {
      assert(!err);
      assert(req.data.global.testString === 'populated def');
      done();
    });
  });

  it('insert products via task', function() {
    return apos.tasks.invoke('products:generate', [], {});
  });

  var product;

  it('set a product join up in the global doc', function() {
    var req = apos.tasks.getReq();
    return apos.products.find(req).sort({ sortTitle: 1 }).limit(1).toObject().then(function(object) {
      assert(object);
      product = object;
    }).then(function() {
      return apos.docs.db.update({
        slug: 'global'
      }, {
        $set: {
          featuredProductsIds: [ product._id ]
        }
      });
    });
  });

  it('fetch the global doc, verify join', function() {
    var req = apos.tasks.getAnonReq();
    return apos.global.addGlobalToData(req).then(function() {
      assert(req.data.global);
      assert(req.data.global._featuredProducts);
      assert(req.data.global._featuredProducts.length === 1);
      assert(req.data.global._featuredProducts[0].slug === product.slug);
    });
  });

  it('give global doc a workflowLocale property to simulate use with workflow', function() {
    return apos.docs.db.update({
      type: 'apostrophe-global'
    }, {
      $set: {
        workflowLocale: 'en'
      }
    });
  });

  it('busy mechanism (global)', function() {
    this.timeout(50000);
    var retrieved = false;
    return apos.global.whileBusy(function() {
      // Intentional parallelism: start a request while
      // we're busy, so we can verify it waits
      request('http://localhost:7900/').then(function(content) {
        // fn should complete before this is retrieved
        assert(content.indexOf('counts: 10') !== -1);
        retrieved = true;
      });
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      }).then(function(global) {
        assert(global.globalBusy);
      }).then(function() {
        return Promise.mapSeries(_.range(0, 10), function(i) {
          return apos.docs.db.update({
            type: 'apostrophe-global'
          }, {
            $inc: {
              counts: 1
            }
          }).then(function() {
            return Promise.delay(50);
          });
        }).then(function() {
          return apos.docs.db.findOne({
            type: 'apostrophe-global'
          });
        }).then(function(doc) {
          assert(doc.counts === 10);
        });
      }).then(function() {
        assert(!retrieved);
      });
    }).then(function() {
      // Wait up to 1 second more for the delayed request to succeed
      var start = Date.now();
      return check();
      function check() {
        if (retrieved) {
          return;
        }
        if (Date.now() - start > 1000) {
          assert(false);
        }
        return Promise.delay(50).then(check);
      }
    }).then(function() {
      // Now that we are no longer busy a new request should take less than a second
      return request('http://localhost:7900/').then(function(content) {
        assert(content.indexOf('counts: 10') !== -1);
      });
    }).then(function() {
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      });
    }).then(function(global) {
      assert(!global.globalBusy);
    });
  });

  it('reset counts', function() {
    return apos.docs.db.update({
      type: 'apostrophe-global'
    }, {
      $set: {
        counts: 0
      }
    });
  });

  it('busy mechanism (default locale)', function() {
    this.timeout(50000);
    var retrieved = false;
    return apos.global.whileBusy(function() {
      // Intentional parallelism: start a request while
      // we're busy, so we can verify it waits
      request('http://localhost:7900/').then(function(content) {
        // fn should complete before this is retrieved
        assert(content.indexOf('counts: 10') !== -1);
        retrieved = true;
      });
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      }).then(function(global) {
        assert(global.globalBusyen);
      }).then(function() {
        return Promise.mapSeries(_.range(0, 10), function(i) {
          return apos.docs.db.update({
            type: 'apostrophe-global'
          }, {
            $inc: {
              counts: 1
            }
          }).then(function() {
            return Promise.delay(50);
          });
        }).then(function() {
          return apos.docs.db.findOne({
            type: 'apostrophe-global'
          });
        }).then(function(doc) {
          assert(doc.counts === 10);
        });
      }).then(function() {
        assert(!retrieved);
      });
    }, { locale: 'en' }).then(function() {
      // Wait up to 1 second more for the delayed request to succeed
      var start = Date.now();
      return check();
      function check() {
        if (retrieved) {
          return;
        }
        if (Date.now() - start > 1000) {
          assert(false);
        }
        return Promise.delay(50).then(check);
      }
    }).then(function() {
      // Now that we are no longer busy a new request should take less than a second
      return request('http://localhost:7900/').then(function(content) {
        assert(content.indexOf('counts: 10') !== -1);
      });
    }).then(function() {
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      });
    }).then(function(global) {
      assert(!global.globalBusyen);
    });
  });

  it('reset counts', function() {
    return apos.docs.db.update({
      type: 'apostrophe-global'
    }, {
      $set: {
        counts: 0
      }
    });
  });

  it('busy mechanism (some other locale)', function() {
    this.timeout(50000);
    var retrieved = false;
    return apos.global.whileBusy(function() {
      // Intentional parallelism: start a request while
      // we're busy, so we can verify it doesn't wait
      request('http://localhost:7900/').then(function(content) {
        // Should not wait for all 10 additions because it is a request
        // for the en locale and we locked fr
        assert(content.indexOf('counts: 10') === -1);
        retrieved = true;
      });
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      }).then(function(global) {
        // This property would only appear on the global doc
        // for the fr locale, if there were one, and we are simulating
        // from the perspective of en
        assert(!global.globalBusyfr);
      }).then(function() {
        return Promise.mapSeries(_.range(0, 10), function(i) {
          return apos.docs.db.update({
            type: 'apostrophe-global'
          }, {
            $inc: {
              counts: 1
            }
          }).then(function() {
            return Promise.delay(50);
          });
        }).then(function() {
          return apos.docs.db.findOne({
            type: 'apostrophe-global'
          });
        }).then(function(doc) {
          assert(doc.counts === 10);
        });
      }).then(function() {
        // we locked fr, not en, so this should have got through already
        assert(retrieved);
      });
    }, { locale: 'fr' }).then(function() {
      // Wait up to 1 second more for the delayed request to succeed
      var start = Date.now();
      return check();
      function check() {
        if (retrieved) {
          return;
        }
        if (Date.now() - start > 1000) {
          assert(false);
        }
        return Promise.delay(50).then(check);
      }
    }).then(function() {
      // Now that we are no longer busy a new request should take less than a second
      return request('http://localhost:7900/').then(function(content) {
        assert(content.indexOf('counts: 10') !== -1);
      });
    }).then(function() {
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      });
    }).then(function(global) {
      assert(!global.globalBusyfr);
    });
  });
  it('global should exist on the second apos object', function(done) {
    apos2 = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7901
        },
        'apostrophe-global': {
          whileBusyDelay: 0.5,
          addFields: [
            {
              name: 'anotherString',
              type: 'string',
              def: 'populated anotherString def'
            }
          ]
        }
      },
      afterInit: function(callback) {
        assert(apos2.global);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos2.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should populate def values of schema properties at update time', function(done) {
    var req = apos.tasks.getAnonReq();
    return apos.global.addGlobalToData(req, function(err) {
      assert(!err);
      // First verify it's an update not an insert - apos2 schema doesn't contain this but it should
      // still be hanging around in the db
      assert(req.data.global.testString === 'populated def');
      assert(req.data.global.anotherString === 'populated anotherString def');
      done();
    });
  });
});

describe('Global with separateWhileBusyMiddleware', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('global should exist on the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        },
        'apostrophe-global': {
          separateWhileBusyMiddleware: true,
          whileBusyDelay: 0.5,
          construct: function(self, options) {
            var superAddGlobalToData = self.addGlobalToData;
            // For test purposes, use a simplified global middleware
            // that does not implement the locking, to verify that
            // the separateWhileBusyMiddleware successfully takes over
            // this role
            self.addGlobalToData = function(req, res, next) {
              if (arguments.length === 3) {
                return self.findGlobal(req, function(err, _global) {
                  assert(!err);
                  req.data.global = _global;
                  return next();
                });
              }
              return superAddGlobalToData.apply(self, arguments);
            };
          }
        }
      },
      afterInit: function(callback) {
        assert(apos.global);
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

  it('test findGlobal with callback', function(done) {
    var req = apos.tasks.getReq();
    return apos.global.findGlobal(req, function(err, global) {
      assert(!err);
      assert(global);
      assert(global.type === 'apostrophe-global');
      done();
    });
  });

  it('test findGlobal with promise', function() {
    var req = apos.tasks.getReq();
    return apos.global.findGlobal(req).then(function(global) {
      assert(global);
      assert(global.type === 'apostrophe-global');
    });
  });

  it('give global doc a workflowLocale property to simulate use with workflow', function() {
    return apos.docs.db.update({
      type: 'apostrophe-global'
    }, {
      $set: {
        workflowLocale: 'en'
      }
    });
  });

  it('busy mechanism (global)', function() {
    this.timeout(50000);
    var retrieved = false;
    return apos.global.whileBusy(function() {
      // Intentional parallelism: start a request while
      // we're busy, so we can verify it waits
      request('http://localhost:7900/').then(function(content) {
        // fn should complete before this is retrieved
        assert(content.indexOf('counts: 10') !== -1);
        retrieved = true;
      });
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      }).then(function(global) {
        assert(global.globalBusy);
      }).then(function() {
        return Promise.mapSeries(_.range(0, 10), function(i) {
          return apos.docs.db.update({
            type: 'apostrophe-global'
          }, {
            $inc: {
              counts: 1
            }
          }).then(function() {
            return Promise.delay(50);
          });
        }).then(function() {
          return apos.docs.db.findOne({
            type: 'apostrophe-global'
          });
        }).then(function(doc) {
          assert(doc.counts === 10);
        });
      }).then(function() {
        assert(!retrieved);
      });
    }).then(function() {
      // Wait up to 1 second more for the delayed request to succeed
      var start = Date.now();
      return check();
      function check() {
        if (retrieved) {
          return;
        }
        if (Date.now() - start > 1000) {
          assert(false);
        }
        return Promise.delay(50).then(check);
      }
    }).then(function() {
      // Now that we are no longer busy a new request should take less than a second
      return request('http://localhost:7900/').then(function(content) {
        assert(content.indexOf('counts: 10') !== -1);
      });
    }).then(function() {
      return apos.docs.db.findOne({
        type: 'apostrophe-global'
      });
    }).then(function(global) {
      assert(!global.globalBusy);
    });
  });

});
