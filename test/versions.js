let t = require('../test-lib/test.js');
let assert = require('assert');

let apos;

describe('Versions', function() {

  this.timeout(t.timeout);

  after(() => {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should should be a module', async () => {
    apos = await t.create({
      root: module,
      modules: {

        // Create a custom schema for test-people so we can
        // play with comparing versions
        'test-people': {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'test-people',
            label: 'Test Person'
          },
          fields: {
            add: {
              alive: {
                label: 'Alive',
                type: 'boolean'
              },
              nicknames: {
                label: 'Nicknames',
                type: 'array',
                schema: [
                  {
                    type: 'string',
                    name: 'nickname',
                    label: 'Nickname'
                  }
                ]
              },
              _poems: {
                label: 'Poems',
                type: 'joinByArray',
                withType: 'poem',
                idsField: 'poemIds'
              },
              body: {
                type: 'area',
                widgets: {
                  '@apostrophecms/rich-text': {}
                }
              }
            }
          }
        },

        'poems': {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'poem',
            label: 'Poem'
          }
        },

        'test-people-pages': {
          extend: '@apostrophecms/page-type'
        }
      }
    });
    assert(apos.versions);
    assert(apos.versions.db);
  });

  it('should accept a direct mongo insert of poems for join test purposes', async () => {
    return apos.docs.db.insertMany([
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
    ]);
  });

  /// ///
  // Versioning
  /// ///

  it('inserting a doc should result in a version', async () => {
    let object = {
      slug: 'one',
      published: true,
      type: 'test-people',
      firstName: 'Gary',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    const object2 = await apos.docs.insert(apos.tasks.getReq(), object);
    assert(object2);
    assert(object2._id);
    let docId = object2._id;
    // did the versions module kick in?
    const versions = await apos.versions.db.find({ docId: docId }).toArray();
    // we should have a document
    assert(versions);
    // there should be only one document in our results
    assert(versions.length === 1);
    // does it have a property match?
    assert(versions[0].doc.age === 15);
  });

  it('should be able to update', async () => {
    const docs = await apos.docs.find(apos.tasks.getReq(), { slug: 'one' }).toArray();
    // we should have a document
    assert(docs);
    // there should be only one document in our results
    assert(docs.length === 1);

    // grab the object
    let object = docs[0];
    // we want update the alive property
    object.alive = false;

    const object2 = await apos.docs.update(apos.tasks.getReq(), object);
    assert(object2);
    // has the property been updated?
    assert(object2.alive === false);

    // did the versions module kick in?
    const versions = await apos.versions.db.find({ docId: object._id }).sort({ createdAt: -1 }).toArray();
    // we should have a document
    assert(versions);
    // there should be two documents now in our results
    assert(versions.length === 2);
    // the property should have been updated
    assert(versions[0].doc.alive === false);
    assert(versions[1].doc.alive === true);
  });

  it('should be able to revert to a previous version', async () => {
    const doc = await apos.docs.find(apos.tasks.getReq(), { slug: 'one' }).toObject();
    const versions = await apos.versions.find(apos.tasks.getReq(), { docId: doc._id }, {});
    assert(versions.length === 2);
    await apos.versions.revert(apos.tasks.getReq(), versions[1]);
    // make sure the change propagated to the database
    const doc2 = await apos.docs.find(apos.tasks.getReq(), { slug: 'one' }).toObject();
    assert(doc2);
    assert(doc2.alive === true);
  });

  it('should be able to fetch all versions in proper order', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    const versions = await apos.versions.find(apos.tasks.getReq(), { docId: doc._id }, {});
    assert(versions.length === 3);
    assert(versions[0].createdAt > versions[1].createdAt);
    assert(versions[1].createdAt > versions[2].createdAt);
  });

  it('should be able to compare versions and spot a simple field change', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    const versions = await apos.versions.find(req, { docId: doc._id }, {});
    assert(versions.length === 3);
    const changes = await apos.versions.compare(req, doc, versions[1], versions[0]);
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].old === false);
    assert(changes[0].current === true);
    assert(changes[0].field);
    assert(changes[0].field.label === 'Alive');
  });

  it('should be able to compare versions with areas and spot a widget addition', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    assert(doc);
    // compare mock versions
    const changes = await apos.versions.compare(req, doc, {
      doc: {
        title: 'whatever',
        slug: 'whatever',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              _id: 'woo',
              type: '@apostrophecms/rich-text',
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
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              _id: 'woo',
              type: '@apostrophecms/rich-text',
              content: 'So great'
            },
            {
              metaType: 'widget',
              _id: 'woo2',
              type: '@apostrophecms/rich-text',
              content: 'So amazing'
            }
          ]
        }
      }
    });
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].key === 'body');
    assert(changes[0].changes);
    assert(changes[0].changes.length === 1);
    let change = changes[0].changes[0];
    assert(change.action === 'add');
    assert(change.current);
    assert(change.current._id === 'woo2');
  });

  it('should be able to compare versions with areas and spot a widget removal', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    assert(doc);
    // compare mock versions
    const changes = await apos.versions.compare(req, doc, {
      doc: {
        title: 'whatever',
        slug: 'whatever',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              _id: 'woo',
              type: '@apostrophecms/rich-text',
              content: 'So great'
            },
            {
              metaType: 'widget',
              _id: 'woo2',
              type: '@apostrophecms/rich-text',
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
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              _id: 'woo',
              type: '@apostrophecms/rich-text',
              content: 'So great'
            }
          ]
        }
      }
    });
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].key === 'body');
    assert(changes[0].changes);
    assert(changes[0].changes.length === 1);
    let change = changes[0].changes[0];
    assert(change.action === 'remove');
    assert(change.old);
    assert(change.old._id === 'woo2');
  });

  it('should be able to compare versions with areas and spot a widget change', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    assert(doc);
    // compare mock versions
    const changes = await apos.versions.compare(req, doc, {
      doc: {
        title: 'whatever',
        slug: 'whatever',
        body: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              _id: 'woo',
              type: '@apostrophecms/rich-text',
              content: 'So great'
            },
            {
              metaType: 'widget',
              _id: 'woo2',
              type: '@apostrophecms/rich-text',
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
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              _id: 'woo',
              type: '@apostrophecms/rich-text',
              content: 'So great'
            },
            {
              metaType: 'widget',
              _id: 'woo2',
              type: '@apostrophecms/rich-text',
              content: 'So wimpy'
            }
          ]
        }
      }
    });
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].key === 'body');
    assert(changes[0].changes);
    assert(changes[0].changes.length === 1);
    let change = changes[0].changes[0];
    assert(change.action === 'change');
    assert(change.old);
    assert(change.old._id === 'woo2');
    assert(change.old.content === 'So amazing');
    assert(change.current);
    assert(change.current._id === 'woo2');
    assert(change.current.content === 'So wimpy');
  });

  it('should be able to compare versions with arrays and spot an addition', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    assert(doc);
    // compare mock versions
    const changes = await apos.versions.compare(req, doc, {
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
    });
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].key === 'nicknames');
    assert(changes[0].changes);
    assert(changes[0].changes.length === 1);
    let change = changes[0].changes[0];
    assert(change.action === 'add');
    assert(change.current);
    assert(change.current._id === 'a2');
    assert(change.current.nickname === 'jane');
  });

  it('should be able to compare versions with arrays and spot an item removal', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    assert(doc);
    // compare mock versions
    const changes = await apos.versions.compare(req, doc, {
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
    });
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].key === 'nicknames');
    assert(changes[0].changes);
    assert(changes[0].changes.length === 1);
    let change = changes[0].changes[0];
    assert(change.action === 'remove');
    assert(change.old);
    assert(change.old._id === 'a1');
  });

  it('should be able to compare versions with arrays and spot an item change', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    assert(doc);
    // compare mock versions
    const changes = await apos.versions.compare(req, doc, {
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
    });
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].key === 'nicknames');
    assert(changes[0].changes);
    assert(changes[0].changes.length === 1);
    let change = changes[0].changes[0];
    assert(change.action === 'change');
    assert(change.old);
    assert(change.old._id === 'a1');
    assert(change.old.nickname === 'joe');
    assert(change.current);
    assert(change.current._id === 'a1');
    assert(change.current.nickname === 'sarah');
  });

  it('should be able to compare versions with joinByArray and spot an id change, providing the titles via a join', async () => {
    let req = apos.tasks.getReq();
    const doc = await apos.docs.find(req, { slug: 'one' }).toObject();
    assert(doc);
    // compare mock versions
    const changes = await apos.versions.compare(req, doc, {
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
    });
    assert(changes.length === 1);
    assert(changes[0].action === 'change');
    assert(changes[0].key === 'poemIds');
    assert(changes[0].changes);
    assert(changes[0].changes.length === 2);
    let change0 = changes[0].changes[0];
    let change1 = changes[0].changes[1];
    assert(change0.action === 'remove');
    assert(change0.old);
    assert(change0.old === 'def');
    assert(change0.text === 'Poem DEF');
    assert(change1.action === 'add');
    assert(change1.current);
    assert(change1.current === 'qed');
    assert(change1.text === 'Poem QED');
  });

});
