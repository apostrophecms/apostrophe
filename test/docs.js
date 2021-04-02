const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');
let apos;

describe('Docs', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  // EXISTENCE

  it('should be a property of the apos object', async function() {
    apos = await t.create({
      root: module,

      modules: {
        'test-people': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              _friends: {
                type: 'relationship',
                max: 1,
                withType: 'test-people',
                label: 'Friends'
              }
            }
          }
        }
      }
    });

    assert(apos.doc);

  });

  it('should have a db property', function() {
    assert(apos.doc.db);
  });

  /// ///
  // SETUP
  /// ///

  it('should make sure all of the expected indexes are configured', async function() {
    const expectedIndexes = [
      'type',
      'slug',
      'titleSortified'
    ];
    const actualIndexes = [];

    const info = await apos.doc.db.indexInformation();
    // Extract the actual index info we care about.
    _.forEach(info, function(index) {
      actualIndexes.push(index[0][0]);
    });

    // Now make sure everything in expectedIndexes is in actualIndexes.
    _.forEach(expectedIndexes, function(index) {
      assert(_.includes(actualIndexes, index));
    });

    // Lastly, make sure there is a text index present
    assert(info.highSearchText_text_lowSearchText_text_title_text_searchBoost_text[0][1] === 'text');
  });

  it('should make sure there is no test data hanging around from last time', async function() {
    // Attempt to purge the entire aposDocs collection
    await apos.doc.db.deleteMany({});

    // Make sure it went away
    const docs = await apos.doc.db.find({ slug: 'larry' }).toArray();

    assert(docs.length === 0);
  });

  it('should be able to use db to insert documents', async function() {
    const testItems = [
      {
        _id: 'lori:en:published',
        aposDocId: 'lori',
        aposLocale: 'en:published',
        slug: 'lori',
        visibility: 'public',
        type: 'test-people',
        firstName: 'Lori',
        lastName: 'Pizzaroni',
        age: 32,
        alive: true
      },
      {
        _id: 'larry:en:published',
        aposDocId: 'larry',
        aposLocale: 'en:published',
        slug: 'larry',
        visibility: 'public',
        type: 'test-people',
        firstName: 'Larry',
        lastName: 'Cherber',
        age: 28,
        alive: true
      },
      {
        _id: 'carl:en:published',
        aposDocId: 'carl',
        aposLocale: 'en:published',
        slug: 'carl',
        visibility: 'public',
        type: 'test-people',
        firstName: 'Carl',
        lastName: 'Sagan',
        age: 62,
        alive: false,
        friendsIds: [ 'larry' ]
      }
    ];

    const response = await apos.doc.db.insertMany(testItems);

    assert(response.result.ok === 1);
    assert(response.insertedCount === 3);
  });

  it('should be able to fetch schema relationships', async function() {
    const manager = apos.doc.getManager('test-people');
    const req = apos.task.getAnonReq();

    assert(manager);
    assert(manager.find);
    assert(manager.schema);

    const cursor = await manager.find(req, { slug: 'carl' });
    assert(cursor);

    const person = await cursor.toObject();
    assert(person);
    assert(person.slug === 'carl');
    assert(person._friends);
    assert(person._friends[0].slug === 'larry');
  });

  /// ///
  // UNIQUENESS
  /// ///

  it('should fail if you try to insert a document with the same unique key twice', async function() {
    try {
      await apos.doc.db.insertMany([
        {
          _id: 'peter:en:published',
          aposDocId: 'peter',
          aposLocale: 'en:published',
          type: 'test-people',
          visibility: 'loginRequired',
          age: 70,
          slug: 'peter'
        },
        // ids will not conflict, but slug will
        {
          _id: 'peter2:en:published',
          aposDocId: 'peter2',
          aposLocale: 'en:published',
          type: 'test-people',
          visibility: 'loginRequired',
          age: 70,
          slug: 'peter'
        }
      ]);
      assert(false);
    } catch (e) {
      assert(e);
      assert(e.code === 11000);
    }
  });

  /// ///
  // FINDING
  /// ///

  it('should have a find method on docs that returns a query', function() {
    const query = apos.doc.find(apos.task.getAnonReq());
    assert(query);
    assert(query.toArray);
  });

  it('should be able to find all test documents and output them as an array', async function () {
    const cursor = apos.doc.find(apos.task.getAnonReq(), { type: 'test-people' });

    const docs = await cursor.toArray();

    // There should be only 3 results.
    assert(docs.length === 3);
    // They should all have a type of test-people
    assert(docs[0].type === 'test-people');
  });

  /// ///
  // PROJECTIONS
  /// ///

  it('should be able to specify which fields to get by passing a projection object', async function() {
    const cursor = apos.doc.find(apos.task.getAnonReq(), { type: 'test-people' }, {
      project: {
        age: 1
      }
    });
    const docs = await cursor.toArray();

    // There SHOULD be an age
    assert(docs[0].age);
    // There SHOULD NOT be a firstName
    assert(!docs[0].firstName);
  });

  /// ///
  // SORTING
  /// ///

  it('should be able to sort', async function () {
    const cursor = apos.doc.find(apos.task.getAnonReq(), { type: 'test-people' }).sort({ age: 1 });
    const docs = await cursor.toArray();

    assert(docs[0].slug === 'larry');
  });

  it('should be able to sort by multiple keys', async function () {
    const cursor = apos.doc.find(apos.task.getAnonReq(), { type: 'test-people' }).sort({
      firstName: 1,
      age: 1
    });
    const docs = await cursor.toArray();

    assert(docs[0].slug === 'carl');
    assert(docs[1].slug === 'larry');
  });

  /// ///
  // INSERTING
  /// ///

  it('should have an "insert" method that returns a new database object', async function() {
    const object = {
      slug: 'one',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Lori',
      lastName: 'Ferber',
      age: 15,
      alive: true
    };

    const response = await apos.doc.insert(apos.task.getReq(), object);

    assert(response);
    assert(response._id);
    assert(response._id.endsWith(':en:published'));
    assert(response._id === `${response.aposDocId}:${response.aposLocale}`);
    // Direct insertion in published locale should autocreate
    // a corresponding draft for internal consistency
    const draft = await apos.doc.db.findOne({
      _id: `${response.aposDocId}:en:draft`
    });
    assert(draft);
    // Unique index allows for duplicates across locales
    assert(object.slug === draft.slug);
    // Content properties coming through
    assert(draft.firstName === response.firstName);
  });

  it('should be able to insert a new object into the docs collection in the database', async function() {
    const cursor = apos.doc.find(apos.task.getReq(), {
      type: 'test-people',
      slug: 'one'
    });
    const docs = await cursor.toArray();

    assert(docs[0].slug === 'one');
  });

  it('should append the slug property with a numeral if inserting an object whose slug already exists in the database', async function() {
    const object = {
      slug: 'one',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Harry',
      lastName: 'Gerber',
      age: 29,
      alive: true
    };

    const doc = await apos.doc.insert(apos.task.getReq(), object);

    assert(doc);
    assert(doc.slug.match(/^one\d+$/));
  });

  it('should not allow you to call the insert method if you are not an admin', async function() {
    const object = {
      slug: 'not-for-you',
      visibility: 'loginRequired',
      type: 'test-people',
      firstName: 'Darry',
      lastName: 'Derrber',
      age: 5,
      alive: true
    };

    try {
      await apos.doc.insert(apos.task.getAnonReq(), object);
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  /// ///
  // UPDATING
  /// ///

  it('should have an "update" method on docs that updates an existing database object', async function() {
    const req = apos.task.getReq();
    const docs = await apos.doc.find(req, { slug: 'one' }).toArray();

    // We should have one document in our results.
    assert(docs);
    assert(docs.length === 1);

    // Grab the object and update the `alive` property.
    const object = docs[0];
    object.alive = false;

    const updated = await apos.doc.update(apos.task.getReq(), object);

    // Has the property been updated?
    assert(updated);
    assert(updated.alive === false);
  });

  it('should append an updated slug with a numeral if the updated slug already exists', async function() {
    const req = apos.task.getReq();
    const cursor = apos.doc.find(req, {
      type: 'test-people',
      slug: 'one'
    });
    const doc = await cursor.toObject();

    assert(doc);

    doc.slug = 'peter';

    const updated = await apos.doc.update(req, doc);
    assert(updated);
    // Has the updated slug been appended?
    assert(updated.slug.match(/^peter\d+$/));
  });
  it('should be able to fetch all unique firstNames with toDistinct', async function() {
    const firstNames = await apos.doc.find(apos.task.getReq(), {
      type: 'test-people'
    }).toDistinct('firstName');

    assert(Array.isArray(firstNames));
    assert(firstNames.length === 4);
    assert(_.includes(firstNames, 'Larry'));
  });

  it('should be able to fetch all unique firstNames and their counts with toDistinct and distinctCounts', async function() {
    const req = apos.task.getReq();
    const cursor = apos.doc.find(req, {
      type: 'test-people'
    }).distinctCounts(true);
    const firstNames = await cursor.toDistinct('firstName');

    assert(Array.isArray(firstNames));
    assert(firstNames.length === 4);
    assert(_.includes(firstNames, 'Larry'));

    const counts = await cursor.get('distinctCounts');

    assert(counts.Larry === 1);
    assert(counts.Lori === 2);
  });

  it('should not allow you to call the update method if you are not an admin', async function() {
    const cursor = apos.doc.find(apos.task.getAnonReq(), {
      type: 'test-people',
      slug: 'lori'
    });

    const doc = cursor.toObject();

    assert(doc);
    doc.slug = 'laurie';

    try {
      await apos.doc.update(apos.task.getAnonReq(), doc);
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  /// ///
  // ARCHIVE
  /// ///

  it('should archive docs by updating them', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();
    const archived = await apos.doc.update(req, {
      ...doc,
      archived: true
    });

    assert(archived.archived === true);
  });

  it('should not be able to find the archiveed object', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.find(req, {
      slug: 'carl'
    }).toObject();

    assert(!doc);
  });

  it('should not allow you to call the archive method if you are not an admin', async function() {
    try {
      await apos.doc.archived(apos.task.getAnonReq(), {
        slug: 'lori'
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should be able to find the archiveed object when using the "archived" method on find()', async function() {
    // Look for the archiveed doc with the `deduplicate-` + its `_id` + its `name` properties.
    const doc = await apos.doc.find(apos.task.getReq(), {
      slug: 'deduplicate-carl-carl'
    }).archived(true).toObject();

    assert(doc);
    assert(doc.archived);
  });

  /// ///
  // RESCUE
  /// ///

  it('should rescue a doc by updating the "archived" property from an object', async function() {
    const req = apos.task.getReq();

    const doc = await apos.doc.find(req, {
      slug: 'deduplicate-carl-carl'
    }).archived(null).toObject();

    await apos.doc.update(req, {
      ...doc,
      archived: false
    });
    const newDoc = await apos.doc.find(req, { slug: 'carl' }).toObject();

    // We should have a document.
    assert(newDoc);
    assert(newDoc.slug === 'carl');
    assert(newDoc.archived === false);
  });

  it('should not allow you to call the rescue method if you are not an admin', async function() {
    try {
      await apos.doc.rescue(apos.task.getAnonReq(), {
        slug: 'carl'
      });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should throw an exception on find() if you fail to pass req as the first argument', async function() {
    try {
      await apos.doc.find({ slug: 'larry' });
      assert(false);
    } catch (e) {
      assert(e);
    }
  });

  it('should respect explicitOrder()', async function() {
    const testItems = [];
    let i;

    for (i = 0; (i < 100); i++) {
      testItems.push({
        _id: `i${i}:en:published`,
        aposDocId: `i${i}`,
        aposLocale: 'en:published',
        slug: `i${i}`,
        visibility: 'public',
        type: 'test',
        title: 'title: ' + i
      });
    }

    await apos.doc.db.insertMany(testItems);

    const docs = await apos.doc.find(apos.task.getAnonReq(), {})
      .explicitOrder([ 'i7:en:published', 'i3:en:published', 'i27:en:published', 'i9:en:published' ]).toArray();

    assert(docs[0]._id === 'i7:en:published');
    assert(docs[0].aposDocId === 'i7');
    assert(docs[0].aposLocale === 'en:published');
    assert(docs[1]._id === 'i3:en:published');
    assert(docs[2]._id === 'i27:en:published');
    assert(docs[3]._id === 'i9:en:published');
    assert(!docs[4]);
  });

  it('should respect explicitOrder with skip and limit', async function() {
    // Relies on test data of previous test
    const docs = await apos.doc.find(apos.task.getAnonReq(), {})
      .explicitOrder([ 'i7:en:published', 'i3:en:published', 'i27:en:published', 'i9:en:published' ]).skip(2).limit(2).toArray();

    assert(docs[0]._id === 'i27:en:published');
    assert(docs[1]._id === 'i9:en:published');
    assert(!docs[2]);
  });

  it('should be able to lock a document', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.db.findOne({ _id: 'i27:en:published' });
    try {
      await apos.doc.lock(req, doc, 'abc');
    } catch (e) {
      assert(!e);
    }
  });

  it('should not be able to lock a document with a different tabId', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.db.findOne({ _id: 'i27:en:published' });

    try {
      await apos.doc.lock(req, doc, 'def');
    } catch (e) {
      assert(e);
      assert(e.name === 'locked');
    }
  });

  it('should be able to refresh the lock with the same tabId', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.db.findOne({ _id: 'i27:en:published' });

    try {
      await apos.doc.lock(req, doc, 'abc');
    } catch (e) {
      assert(!e);
    }
  });

  it('should be able to unlock a document', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.db.findOne({ _id: 'i27:en:published' });

    try {
      await apos.doc.unlock(req, doc, 'abc');
    } catch (e) {
      assert(false);
    }
  });

  it('should be able to re-lock an unlocked document', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.db.findOne({ _id: 'i27:en:published' });

    try {
      await apos.doc.lock(req, doc, 'def');
    } catch (e) {
      assert(false);
    }
  });

  it('should be able to lock a locked document with force: true', async function() {
    const req = apos.task.getReq();
    const doc = await apos.doc.db.findOne({ _id: 'i27:en:published' });

    try {
      await apos.doc.lock(req, doc, 'abc', { force: true });
    } catch (e) {
      assert(false);
    }
  });

  it('should be able to recover if the text index weights are mysteriously wrong at startup', async function() {
    await apos.doc.db.dropIndex('highSearchText_text_lowSearchText_text_title_text_searchBoost_text');
    await apos.doc.db.createIndex({
      highSearchText: 'text',
      lowSearchText: 'text',
      title: 'text',
      searchBoost: 'text'
    }, {
      default_language: 'none',
      weights: {
        // These are the weird weights we've seen when this
        // mystery bug crops up, flunking createIndex on a
        // later startup
        title: 1,
        searchBoost: 1,
        highSearchText: 1,
        lowSearchText: 1
      }
    });
    await apos.doc.createTextIndex();
  });

});
