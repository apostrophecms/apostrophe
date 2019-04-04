var t = require('../test-lib/test.js');
var assert = require('assert');

var apos;

var initDone = false;

describe('Versions', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  // EXISTENCE

  it('should should be a module', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        },

        // Create a custom schema for test-person so we can
        // play with comparing versions
        'test-people': {
          extend: 'apostrophe-pieces',
          name: 'test-person',
          label: 'Test Person',
          addFields: [
            {
              label: 'Alive',
              type: 'boolean',
              name: 'alive'
            },
            {
              label: 'Nicknames',
              type: 'array',
              name: 'nicknames',
              schema: [
                {
                  type: 'string',
                  name: 'nickname',
                  label: 'Nickname'
                }
              ]
            },
            {
              label: 'Poems',
              type: 'joinByArray',
              name: '_poems',
              withType: 'poem',
              idsField: 'poemIds'
            }
          ]
        },

        'poems': {
          extend: 'apostrophe-pieces',
          name: 'poem',
          label: 'Poem'
        },

        'test-person-pages': {
          extend: 'apostrophe-custom-pages'
        }
      },
      afterInit: function(callback) {
        assert(apos.versions);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        initDone = true;
        done();
      }
    });
  });

  it('should have a db property', function() {
    assert(initDone);
    assert(apos.versions.db);
  });

  it('should accept a direct mongo insert of poems for join test purposes', function(done) {
    return apos.docs.db.insert([
      {
        title: 'Poem ABC',
        slug: 'poem-abc',
        _id: 'abc',
        type: 'poem'
      },
      {
        title: 'Poem DEF',
        slug: 'poem-def',
        _id: 'def',
        type: 'poem'
      },
      {
        title: 'Poem QED',
        slug: 'poem-qed',
        _id: 'qed',
        type: 'poem'
      }
    ], function(err) {
      assert(!err);
      done();
    });
  });

  /// ///
  // Versioning
  /// ///

  it('inserting a doc should result in a version', function(done) {
    var object = {
      slug: 'one',
      published: true,
      type: 'test-person',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    apos.docs.insert(apos.tasks.getReq(), object, function(err, object) {
      assert(!err);
      assert(object);
      assert(object._id);
      var docId = object._id;
      // did the versions module kick-in?
      apos.versions.db.findWithProjection({ docId: docId }).toArray(function(err, versions) {
        assert(!err);
        // we should have a document
        assert(versions);
        // there should be only one document in our results
        assert(versions.length === 1);
        // does it have a property match?
        assert(versions[0].doc.age === 15);
        done();
      });
    });
  });

  it('should be able to update', function(done) {
    apos.docs.find(apos.tasks.getReq(), { slug: 'one' }).toArray(function(err, docs) {
      assert(!err);
      // we should have a document
      assert(docs);
      // there should be only one document in our results
      assert(docs.length === 1);

      // grab the object
      var object = docs[0];
      // we want update the alive property
      object.alive = false;

      apos.docs.update(apos.tasks.getReq(), object, function(err, object) {
        assert(!err);
        assert(object);
        // has the property been updated?
        assert(object.alive === false);

        // did the versions module kick-in?
        apos.versions.db.findWithProjection({ docId: object._id }).sort({createdAt: -1}).toArray(function(err, versions) {
          assert(!err);
          // we should have a document
          assert(versions);
          // there should be two documents now in our results
          assert(versions.length === 2);
          // the property should have been updated
          assert(versions[0].doc.alive === false);
          assert(versions[1].doc.alive === true);
          done();
        });
      });
    });
  });

  it('should be able to revert to a previous version', function(done) {
    apos.docs.find(apos.tasks.getReq(), { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      apos.versions.find(apos.tasks.getReq(), { docId: doc._id }, {}, function(err, versions) {
        assert(!err);
        assert(versions.length === 2);
        apos.versions.revert(apos.tasks.getReq(), versions[1], function(err) {
          assert(!err);
          // make sure the change propagated to the database
          apos.docs.find(apos.tasks.getReq(), { slug: 'one' }).toObject(function(err, doc) {
            assert(!err);
            assert(doc);
            assert(doc.alive === true);
            done();
          });
        });
      });
    });
  });

  it('should be able to fetch all versions in proper order', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      apos.versions.find(apos.tasks.getReq(), { docId: doc._id }, {}, function(err, versions) {
        assert(!err);
        assert(versions.length === 3);
        assert(versions[0].createdAt > versions[1].createdAt);
        assert(versions[1].createdAt > versions[2].createdAt);
        done();
      });
    });
  });

  it('should be able to compare versions and spot a simple field change', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      apos.versions.find(req, { docId: doc._id }, {}, function(err, versions) {
        assert(!err);
        assert(versions.length === 3);
        return apos.versions.compare(req, doc, versions[1], versions[0], function(err, changes) {
          assert(!err);
          assert(changes.length === 1);
          assert(changes[0].action === 'change');
          assert(changes[0].old === false);
          assert(changes[0].current === true);
          assert(changes[0].field);
          assert(changes[0].field.label === 'Alive');
          done();
        });
      });
    });
  });

  it('should be able to compare versions with areas and spot a widget addition', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(req, doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              }
            ]
          }
        }
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So amazing'
              }
            ]
          }
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'body');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'add');
        assert(change.current);
        assert(change.current._id === 'woo2');
        done();
      });
    });
  });

  it('should be able to compare versions with areas and spot a widget removal', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(req, doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So amazing'
              }
            ]
          }
        }
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              }
            ]
          }
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'body');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'remove');
        assert(change.old);
        assert(change.old._id === 'woo2');
        done();
      });
    });
  });

  it('should be able to compare versions with areas and spot a widget change', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(req, doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So amazing'
              }
            ]
          }
        }
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          body: {
            type: 'area',
            items: [
              {
                _id: 'woo',
                type: 'apostrophe-rich-text',
                content: 'So great'
              },
              {
                _id: 'woo2',
                type: 'apostrophe-rich-text',
                content: 'So wimpy'
              }
            ]
          }
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'body');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'change');
        assert(change.old);
        assert(change.old._id === 'woo2');
        assert(change.old.content === 'So amazing');
        assert(change.current);
        assert(change.current._id === 'woo2');
        assert(change.current.content === 'So wimpy');
        done();
      });
    });
  });

  it('should be able to compare versions with arrays and spot an addition', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(req, doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            }
          ]
        }
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'nicknames');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'add');
        assert(change.current);
        assert(change.current._id === 'a2');
        assert(change.current.nickname === 'jane');
        done();
      });
    });
  });

  it('should be able to compare versions with arrays and spot an item removal', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(req, doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'nicknames');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'remove');
        assert(change.old);
        assert(change.old._id === 'a1');
        done();
      });
    });
  });

  it('should be able to compare versions with arrays and spot an item change', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(req, doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'joe',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          nicknames: [
            {
              nickname: 'sarah',
              _id: 'a1'
            },
            {
              nickname: 'jane',
              _id: 'a2'
            }
          ]
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'nicknames');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 1);
        var change = changes[0].changes[0];
        assert(change.action === 'change');
        assert(change.old);
        assert(change.old._id === 'a1');
        assert(change.old.nickname === 'joe');
        assert(change.current);
        assert(change.current._id === 'a1');
        assert(change.current.nickname === 'sarah');
        done();
      });
    });
  });

  it('should be able to compare versions with joinByArray and spot an id change, providing the titles via a join', function(done) {
    var req = apos.tasks.getReq();
    apos.docs.find(req, { slug: 'one' }).toObject(function(err, doc) {
      assert(!err);
      assert(doc);
      // compare mock versions
      apos.versions.compare(req, doc, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          poemIds: [ 'abc', 'def' ]
        }
      }, {
        doc: {
          title: 'whatever',
          slug: 'whatever',
          poemIds: [ 'abc', 'qed' ]
        }
      }, function(err, changes) {
        assert(!err);
        assert(changes.length === 1);
        assert(changes[0].action === 'change');
        assert(changes[0].key === 'poemIds');
        assert(changes[0].changes);
        assert(changes[0].changes.length === 2);
        var change0 = changes[0].changes[0];
        var change1 = changes[0].changes[1];
        assert(change0.action === 'remove');
        assert(change0.old);
        assert(change0.old === 'def');
        assert(change0.text === 'Poem DEF');
        assert(change1.action === 'add');
        assert(change1.current);
        assert(change1.current === 'qed');
        assert(change1.text === 'Poem QED');
        done();
      });
    });
  });

  /// ///
  // When disabled the module does not create versions,
  // and docs can still be inserted
  /// ///
  // it('should not version pages if not set to enabled', function(done) {
  //   apos = require('../index.js')({
  //     root: module,
  //     shortName: 'test',
  //
  //     modules: {
  //       'apostrophe-express': {
  //         secret: 'xxx',
  //         port: 7900
  //       },
  //       'apostrophe-versions':{
  //         enabled: false
  //       }
  //     },
  //     afterInit: function(callback) {
  //       apos.argv._ = [];
  //       assert(!apos.versions.db);
  //       return callback(null);
  //     }
  //   });
  // });
});
