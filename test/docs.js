const { strict: assert } = require('node:assert');
const _ = require('lodash');
const t = require('../test-lib/test.js');

describe('Docs', function() {
  const apiKey = 'this is a test api key';
  let apos;

  this.timeout(t.timeout);

  after(async function() {
    await apos.doc.db.deleteMany({});
    await apos.lock.db.deleteMany({});
    return t.destroy(apos);
  });

  before(async function() {
    apos = await t.create({
      root: module,

      modules: {
        '@apostrophecms/express': {
          options: {
            apiKeys: {
              [apiKey]: {
                role: 'admin'
              }
            }
          }
        },
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
        },
        unlocalized: {
          extend: '@apostrophecms/piece-type',
          options: {
            localized: false
          },
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
        },
        '@apostrophecms/page': {
          options: {
            park: [],
            types: [
              {
                name: 'test-page',
                label: 'Test Page'
              }
            ]
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type'
        }
      }
    });
  });

  afterEach(async function () {
    await apos.doc.db.deleteMany({ type: 'test-people' });
    await apos.doc.db.deleteMany({ type: 'test-page' });
    await apos.lock.db.deleteMany({});
  });

  it('should have a db property', function() {
    assert(apos.doc.db);
  });

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

  it('should be able to fetch schema relationships', async function() {
    await insertPeople(apos);
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

  it('should support custom context menu (legacy, required only)', async function() {
    const operation = {
      context: 'update',
      action: 'test',
      label: 'Menu Label',
      modal: 'SomeModalComponent'
    };
    const initialLength = apos.doc.contextOperations.length;

    apos.doc.addContextOperation('test-people', operation);

    assert.strictEqual(apos.doc.contextOperations.length, initialLength + 1);
    assert.deepStrictEqual(apos.doc.contextOperations.find(op => op.action === 'test'), {
      ...operation,
      moduleName: 'test-people'
    });
  });
  it('should support custom context menu (legacy, with optional)', async function() {
    apos.doc.contextOperations = [];
    const operation = {
      context: 'update',
      action: 'test',
      label: 'Menu Label',
      modal: 'SomeModalComponent',
      manuallyPublished: true,
      modifiers: [ 'danger' ]
    };
    assert.strictEqual(apos.doc.contextOperations.length, 0);

    apos.doc.addContextOperation('test-people', operation);
    assert.strictEqual(apos.doc.contextOperations.length, 1);
    assert.deepStrictEqual(apos.doc.contextOperations[0], {
      ...operation,
      moduleName: 'test-people'
    });
  });

  it('should support custom context menu (modern, required only)', async function() {
    const operation = {
      context: 'update',
      action: 'test2',
      label: 'Menu Label',
      modal: 'SomeModalComponent'
    };
    const initialLength = apos.doc.contextOperations.length;

    apos.doc.addContextOperation(operation);

    assert.strictEqual(apos.doc.contextOperations.length, initialLength + 1);
    // Front end is responsible for inferring moduleName here
    assert.deepStrictEqual(apos.doc.contextOperations.find(op => op.action === 'test2'), operation);
  });
  it('should support custom context menu (modern, with optional)', async function() {
    apos.doc.contextOperations = [];
    const operation = {
      context: 'update',
      action: 'test',
      label: 'Menu Label',
      modal: 'SomeModalComponent',
      manuallyPublished: true,
      modifiers: [ 'danger' ]
    };
    assert.strictEqual(apos.doc.contextOperations.length, 0);

    apos.doc.addContextOperation(operation);
    assert.strictEqual(apos.doc.contextOperations.length, 1);
    // Front end is responsible for inferring moduleName here
    assert.deepStrictEqual(apos.doc.contextOperations[0], operation);
  });

  it('should override custom context menu', async function() {
    apos.doc.contextOperations = [];
    const operation1 = {
      context: 'update',
      action: 'test',
      label: 'Op1',
      modal: 'SomeModalComponent'
    };
    const operation2 = {
      context: 'update',
      action: 'test',
      label: 'Op2',
      modal: 'SomeModalComponent'
    };
    assert.strictEqual(apos.doc.contextOperations.length, 0);

    apos.doc.addContextOperation('test-people', operation1);
    apos.doc.addContextOperation('test-people', operation2);
    assert.strictEqual(apos.doc.contextOperations.length, 1);
    assert.deepStrictEqual(apos.doc.contextOperations[0], {
      ...operation2,
      moduleName: 'test-people'
    });
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
    await insertPeople(apos);
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
    await insertPeople(apos);
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
    await insertPeople(apos);
    const cursor = apos.doc.find(apos.task.getAnonReq(), { type: 'test-people' }).sort({ age: 1 });
    const docs = await cursor.toArray();

    assert(docs[0].slug === 'larry');
  });

  it('should be able to sort by multiple keys', async function () {
    await insertPeople(apos);
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

  it('should be able to insert a new object into the docs collection in the database', async function() {
    const response = await insertOne(apos);
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
    assert(draft.slug === 'one');
    // Content properties coming through
    assert(draft.firstName === response.firstName);
    const cursor = apos.doc.find(apos.task.getReq(), {
      type: 'test-people',
      slug: 'one'
    });
    const docs = await cursor.toArray();

    assert(docs[0].slug === 'one');
  });

  it('should append the slug property with a numeral if inserting an object whose slug already exists in the database', async function() {
    await insertOne(apos);
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

  it('should add the aposDocId to the related documents\' relatedReverseIds field and update their `cacheInvalidatedAt` field', async function() {
    await insertPeople(apos);
    const response = await insertOneWithRelated(apos);

    const carlDoc = await apos.doc.db.findOne({
      slug: 'carl',
      aposLocale: 'en:published'
    });

    const larryDoc = await apos.doc.db.findOne({
      slug: 'larry',
      aposLocale: 'en:published'
    });

    assert(carlDoc.relatedReverseIds.length === 1);
    assert(carlDoc.relatedReverseIds[0] === 'paul');
    assert(carlDoc.cacheInvalidatedAt.getTime() === response.updatedAt.getTime());

    assert(larryDoc.relatedReverseIds.length === 1);
    assert(larryDoc.relatedReverseIds[0] === 'paul');
    assert(larryDoc.cacheInvalidatedAt.getTime() === response.updatedAt.getTime());

    apos.doc.db.deleteMany({ slug: { $in: [ 'paul', 'carl', 'larry' ] } });
  });

  it('should remove the related reverse IDs when you delete a draft document', async function () {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const personWithRelatedPublished = await insertOneWithRelated(apos);
    const personWithRelatedDraft = await apos.doc.find(apos.task.getReq({ mode: 'draft' }), { slug: 'paul' }).toObject();

    await apos.doc.delete(req, personWithRelatedPublished);

    const larryDoc = await apos.doc.db.findOne({
      slug: 'larry',
      aposLocale: 'en:published'
    });
    const carlDoc = await apos.doc.db.findOne({
      slug: 'carl',
      aposLocale: 'en:published'
    });

    await apos.doc.delete(req, personWithRelatedDraft);

    const larryDocUpdated = await apos.doc.db.findOne({
      slug: 'larry',
      aposLocale: 'en:published'
    });
    const carlDocUpdated = await apos.doc.db.findOne({
      slug: 'carl',
      aposLocale: 'en:published'
    });

    const actual = {
      larryHasRelatedBeforeDelete: larryDoc.relatedReverseIds.includes('paul'),
      carlHasRelatedBeforeDelete: carlDoc.relatedReverseIds.includes('paul'),
      larryHasRelatedAfterDelete: larryDocUpdated.relatedReverseIds.includes('paul'),
      carlHasRelatedAfterDelete: carlDocUpdated.relatedReverseIds.includes('paul')
    };

    const expected = {
      larryHasRelatedBeforeDelete: true,
      carlHasRelatedBeforeDelete: true,
      larryHasRelatedAfterDelete: false,
      carlHasRelatedAfterDelete: false
    };

    assert.deepEqual(actual, expected);
  });

  it('should remove the related reverse IDs when you delete an unlocalized document', async function () {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const unlocalizedDoc = await apos.doc.insert(req, {
      aposDocId: 'paul',
      aposLocale: 'en:published',
      slug: 'paul',
      visibility: 'public',
      type: 'unlocalized',
      friendsIds: [ 'carl', 'larry' ],
      _friends: [ { _id: 'carl:en:published' }, { _id: 'larry:en:published' } ]
    });

    const larryDoc = await apos.doc.db.findOne({
      slug: 'larry',
      aposLocale: 'en:published'
    });
    const carlDoc = await apos.doc.db.findOne({
      aposDocId: 'carl',
      aposLocale: 'en:published'
    });

    await apos.doc.delete(req, unlocalizedDoc);

    const larryDocUpdated = await apos.doc.db.findOne({
      slug: 'larry',
      aposLocale: 'en:published'
    });
    const carlDocUpdated = await apos.doc.db.findOne({
      slug: 'carl',
      aposLocale: 'en:published'
    });

    const actual = {
      larryHasRelatedBeforeDelete: larryDoc.relatedReverseIds.includes('paul'),
      carlHasRelatedBeforeDelete: carlDoc.relatedReverseIds.includes('paul'),
      larryHasRelatedAfterDelete: larryDocUpdated.relatedReverseIds.includes('paul'),
      carlHasRelatedAfterDelete: carlDocUpdated.relatedReverseIds.includes('paul')
    };

    const expected = {
      larryHasRelatedBeforeDelete: true,
      carlHasRelatedBeforeDelete: true,
      larryHasRelatedAfterDelete: false,
      carlHasRelatedAfterDelete: false
    };

    assert.deepEqual(actual, expected);
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
    await insertOne(apos);
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
    await insertPeople(apos);
    await insertOne(apos);
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
    await insertPeople(apos);
    const firstNames = await apos.doc.find(apos.task.getReq(), {
      type: 'test-people'
    }).toDistinct('firstName');

    assert(Array.isArray(firstNames));
    assert(firstNames.length === 4);
    assert(_.includes(firstNames, 'Larry'));
  });

  it('should be able to fetch all unique firstNames and their counts with toDistinct and distinctCounts', async function() {
    await insertPeople(apos);
    const req = apos.task.getReq();
    await apos.doc.db.insertOne({
      _id: 'random:en:published',
      slug: 'random',
      aposDocId: 'lori2',
      aposLocale: 'en:published',
      type: 'test-people',
      visibility: 'loginRequired',
      firstName: 'Lori',
      lastName: 'Lora',
      age: 70
    });
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

  it('should remove the aposDocId from the related documents\' relatedReverseIds field and update their `cacheInvalidatedAt` field', async function() {
    await insertPeople(apos);
    await insertOneWithRelated(apos);
    const paulDoc = await apos.doc.db.findOne({
      slug: 'paul',
      aposLocale: 'en:published'
    });

    // carl removed from paul's related friends, only larry remains
    const object = {
      ...paulDoc,
      friendsIds: [ 'larry' ],
      _friends: [ { _id: 'larry:en:published' } ]
    };

    const response = await apos.doc.update(apos.task.getReq(), object);

    const carlDoc = await apos.doc.db.findOne({
      slug: 'carl',
      aposLocale: 'en:published'
    });

    const larryDoc = await apos.doc.db.findOne({
      slug: 'larry',
      aposLocale: 'en:published'
    });

    assert(carlDoc.relatedReverseIds.length === 0);
    assert(carlDoc.cacheInvalidatedAt.getTime() === response.updatedAt.getTime());

    assert(larryDoc.relatedReverseIds.length === 1);
    assert(larryDoc.relatedReverseIds[0] === 'paul');
    assert(larryDoc.cacheInvalidatedAt.getTime() === response.updatedAt.getTime());
  });

  it('should update the related reverse documents\' `cacheInvalidatedAt` field', async function() {
    await insertPeople(apos);
    const object = {
      aposDocId: 'john',
      aposLocale: 'en:published',
      slug: 'john',
      visibility: 'public',
      type: 'test-people',
      firstName: 'John',
      lastName: 'McClane',
      age: 40,
      alive: true,
      friendsIds: [ 'carl' ],
      _friends: [ { _id: 'carl:en:published' } ]
    };

    await apos.doc.insert(apos.task.getReq(), object);

    const carlDoc = await apos.doc.db.findOne({
      slug: 'carl',
      aposLocale: 'en:published'
    });

    // update carl, now john (related reverse friend) should have its
    // `cacheInvalidatedAt` field updated as well
    const response = await apos.doc.update(apos.task.getReq(), {
      ...carlDoc,
      alive: false
    });

    const johnDoc = await apos.doc.db.findOne({
      slug: 'john',
      aposLocale: 'en:published'
    });

    assert(johnDoc.cacheInvalidatedAt.getTime() === response.updatedAt.getTime());
  });

  it('should update the pieces parent page\'s `cacheInvalidatedAt` field', async function() {
    const page = {
      slug: '/parent/new-page',
      visibility: 'public',
      type: 'test-page',
      title: 'New Page'
    };

    const object = {
      aposDocId: 'bruce',
      aposLocale: 'en:published',
      slug: 'bruce',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Bruce',
      lastName: 'Lee',
      age: 30,
      alive: false,
      _parentSlug: '/parent/new-page'
    };

    await apos.doc.insert(apos.task.getReq(), page);
    const response = await apos.doc.insert(apos.task.getReq(), object);

    const pageDoc = await apos.doc.db.findOne({
      slug: '/parent/new-page',
      aposLocale: 'en:published'
    });

    assert(pageDoc.cacheInvalidatedAt.getTime() === response.updatedAt.getTime());
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
    await insertPeople(apos);
    const req = apos.task.getReq();
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();
    const archived = await archiveDoc(apos, doc);

    assert(archived.archived === true);
  });

  it('should not be able to find the archived object', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const carlDoc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();
    await archiveDoc(apos, carlDoc);

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

  it('should be able to find the archived object when using the "archived" method on find()', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const carlDoc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();
    await archiveDoc(apos, carlDoc);
    // Look for the archived doc with the `deduplicate-` + its `_id` + its
    // `name` properties.
    const doc = await apos.doc.find(req, {
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
    await insertPeople(apos);
    const carlDoc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();
    await archiveDoc(apos, carlDoc);

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

  it('should not allow you to call the restore method if you are not an admin', async function() {
    try {
      await insertPeople(apos);
      const carlDoc = await apos.doc.find(apos.task.getReq(), {
        type: 'test-people',
        slug: 'carl'
      }).toObject();
      await archiveDoc(apos, carlDoc);
      await apos.doc.restore(apos.task.getAnonReq(), {
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

  it('should respect _ids()', async function() {
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
      ._ids([ 'i7:en:published', 'i3:en:published', 'i27:en:published', 'i9:en:published' ]).toArray();
    assert(docs[0]._id === 'i7:en:published');
    assert(docs[0].aposDocId === 'i7');
    assert(docs[0].aposLocale === 'en:published');
    assert(docs[1]._id === 'i3:en:published');
    assert(docs[2]._id === 'i27:en:published');
    assert(docs[3]._id === 'i9:en:published');
    assert(!docs[4]);

    const filteredDocs = await apos.doc.find(apos.task.getAnonReq(), {})
      ._ids([ 'i7:en:published', 'i3:en:published', 'i27:en:published', 'i9:en:published' ]).skip(2).limit(2).toArray();

    assert(filteredDocs[0]._id === 'i27:en:published');
    assert(filteredDocs[1]._id === 'i9:en:published');
    assert(!filteredDocs[2]);
  });

  it('should be able to lock a document', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const doc = await apos.doc.db.findOne({ _id: 'carl:en:published' });
    try {
      await apos.doc.lock(req, doc, 'abc');
    } catch (e) {
      assert(!e);
    }
  });

  it('should not be able to lock a document with a different tabId', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const doc = await apos.doc.db.findOne({ _id: 'carl:en:published' });

    try {
      await apos.doc.lock(req, doc, 'abc');
      const locked = await apos.doc.db.findOne({ _id: 'carl:en:published' });
      await apos.doc.lock(req, locked, 'def');
    } catch (e) {
      assert(e);
      assert(e.name === 'locked');
    }
  });

  it('should be able to refresh the lock with the same tabId', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const doc = await apos.doc.db.findOne({ _id: 'carl:en:published' });
    const wait = (time) => new Promise((resolve) => setTimeout(() => {
      resolve();
    }, time));

    try {
      await apos.doc.lock(req, doc, 'abc');
      const locked = await apos.doc.db.findOne({ _id: 'carl:en:published' });
      await wait(500);
      await apos.doc.lock(req, locked, 'abc');
    } catch (e) {
      assert(!e);
    }
  });

  it('should be able to unlock a document', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const doc = await apos.doc.db.findOne({ _id: 'carl:en:published' });

    try {
      await apos.doc.lock(req, doc, 'abc');
      await apos.doc.unlock(req, doc, 'abc');
    } catch (e) {
      assert(false);
    }
  });

  it('should be able to re-lock an unlocked document', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const doc = await apos.doc.db.findOne({ _id: 'carl:en:published' });

    try {
      await apos.doc.lock(req, doc, 'abc');
      await apos.doc.unlock(req, doc, 'abc');
      await apos.doc.lock(req, doc, 'def');
    } catch (e) {
      assert(false);
    }
  });

  it('should be able to lock a locked document with force: true', async function() {
    const req = apos.task.getReq();
    await insertPeople(apos);
    const doc = await apos.doc.db.findOne({ _id: 'carl:en:published' });

    try {
      await apos.doc.lock(req, doc, 'def');
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

  /// ///
  // MIGRATIONS
  /// ///

  it('should add via a migration the `cacheInvalidatedAt` field to any doc and set it to equal the doc\'s `updatedAt` field', async function() {
    const objects = [
      {
        slug: 'test-for-cacheInvalidatedAt-field-migration1',
        visibility: 'public',
        type: 'test-people',
        firstName: 'Kurt',
        lastName: 'Cobain',
        age: 27,
        alive: false,
        updatedAt: '2022-03-28T12:57:03.685Z'
      },
      {
        slug: 'test-for-cacheInvalidatedAt-field-migration2',
        visibility: 'public',
        type: 'test-people',
        firstName: 'Jim',
        lastName: 'Morrison',
        age: 27,
        alive: false,
        updatedAt: '2020-08-29T12:57:03.685Z'
      }
    ];

    await apos.doc.db.insertMany(objects);
    await apos.doc.setCacheField();

    const docs = await apos.doc.db.find({ slug: /test-for-cacheInvalidatedAt-field-migration/ }).toArray();
    docs.forEach((doc, index) => {
      const timestamps = {
        doc: new Date(doc.cacheInvalidatedAt).toString(),
        expected: new Date(objects[index].updatedAt).toString()

      };
      assert(timestamps.doc === timestamps.expected);
    });
  });

  it('should not add via a migration the `cacheInvalidatedAt` field to docs that already have it', async function() {
    const object = {
      slug: 'test-for-cacheInvalidatedAt-field-migration3',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Janis',
      lastName: 'Joplin',
      age: 27,
      alive: false,
      updatedAt: '2018-08-29T12:57:03.685Z',
      cacheInvalidatedAt: '2019-08-29T12:57:03.685Z'
    };

    await apos.doc.db.insert(object);
    await apos.doc.setCacheField();

    const doc = await apos.doc.db.findOne({ slug: 'test-for-cacheInvalidatedAt-field-migration3' });
    const timestamps = {
      doc: new Date(doc.cacheInvalidatedAt).toString(),
      expected: new Date(object.cacheInvalidatedAt).toString()
    };

    assert(timestamps.doc === timestamps.expected);
  });

  it('should preserve latin accents by default (piece)', async function () {
    const req = apos.task.getReq();
    const object = {
      title: 'C\'est déjà l\'été',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Janis',
      lastName: 'Joplin',
      age: 27,
      alive: false,
      updatedAt: '2018-08-29T12:57:03.685Z',
      cacheInvalidatedAt: '2019-08-29T12:57:03.685Z'
    };

    await apos.doc.insert(req, object);

    const doc = await apos.doc.db.findOne({ title: 'C\'est déjà l\'été' });
    assert.equal(doc.slug, 'c-est-déjà-l-été');
  });

  it('should remove latin accents when configured to do so (piece)', async function () {
    const req = apos.task.getReq();
    const object = {
      title: 'C\'est déjà l\'été',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Janis',
      lastName: 'Joplin',
      age: 27,
      alive: false,
      updatedAt: '2018-08-29T12:57:03.685Z',
      cacheInvalidatedAt: '2019-08-29T12:57:03.685Z'
    };
    const originalSetting = apos.i18n.options.stripUrlAccents;
    apos.i18n.options.stripUrlAccents = true;

    await apos.doc.insert(req, object);

    const doc = await apos.doc.db.findOne({ title: 'C\'est déjà l\'été' });
    apos.i18n.options.stripUrlAccents = originalSetting;

    assert.equal(doc.slug, 'c-est-deja-l-ete');
  });

  it('should remove latin accents when converting schema fields (piece)', async function () {
    const req = apos.task.getReq();
    const input = {
      title: 'C\'est déjà l\'été',
      slug: 'c-est-déjà-l-été',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Janis',
      lastName: 'Joplin',
      age: 27,
      alive: false,
      updatedAt: '2018-08-29T12:57:03.685Z',
      cacheInvalidatedAt: '2019-08-29T12:57:03.685Z'
    };
    const originalSetting = apos.i18n.options.stripUrlAccents;
    apos.i18n.options.stripUrlAccents = true;

    const manager = apos.doc.getManager('test-people');
    const page = manager.newInstance();
    await manager.convert(req, input, page);
    apos.i18n.options.stripUrlAccents = originalSetting;

    assert.equal(page.slug, 'c-est-deja-l-ete');
  });

  it('should preserve latin accents by default (page)', async function () {
    const req = apos.task.getReq();
    const object = {
      title: 'C\'est déjà l\'été',
      visibility: 'public',
      type: 'test-page'
    };

    await apos.doc.insert(req, object);

    const doc = await apos.doc.db.findOne({ title: 'C\'est déjà l\'été' });
    assert.equal(doc.slug, '/c-est-déjà-l-été');
  });

  it('should remove latin accents when configured to do so (page)', async function () {
    const req = apos.task.getReq();
    const object = {
      title: 'C\'est déjà l\'été',
      visibility: 'public',
      type: 'test-page'
    };
    const originalSetting = apos.i18n.options.stripUrlAccents;
    apos.i18n.options.stripUrlAccents = true;

    await apos.doc.insert(req, object);

    const doc = await apos.doc.db.findOne({ title: 'C\'est déjà l\'été' });
    apos.i18n.options.stripUrlAccents = originalSetting;

    assert.equal(doc.slug, '/c-est-deja-l-ete');
  });

  it('should remove latin accents when converting schema fields (page)', async function () {
    const req = apos.task.getReq();
    const input = {
      title: 'C\'est déjà l\'été',
      slug: '/c-est-déjà-l-été',
      visibility: 'public',
      type: 'test-page'
    };
    const originalSetting = apos.i18n.options.stripUrlAccents;
    apos.i18n.options.stripUrlAccents = true;

    const manager = apos.doc.getManager('test-page');
    const page = manager.newInstance();
    await manager.convert(req, input, page);
    apos.i18n.options.stripUrlAccents = originalSetting;

    assert.equal(page.slug, '/c-est-deja-l-ete');
  });

  /// ///
  // CACHING
  /// ///

  it('should add a `cacheInvalidatedAt` field and set it to equal `updatedAt` field when saving a doc', async function() {
    const object = {
      slug: 'test-for-cacheInvalidatedAt-field',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Michael',
      lastName: 'Jackson',
      age: 64,
      alive: true
    };

    const response = await apos.doc.insert(apos.task.getReq(), object);
    const draft = await apos.doc.db.findOne({
      _id: `${response.aposDocId}:en:draft`
    });

    assert(response.cacheInvalidatedAt.getTime() === response.updatedAt.getTime());
    assert(draft.cacheInvalidatedAt.getTime() === draft.updatedAt.getTime());
  });

  describe('beforeInsert handler', function() {
    it('should rely on req.mode when inserting a doc without _id', async function() {
      const req = apos.task.getReq();
      const draftReq = apos.task.getReq({ mode: 'draft' });
      const people = apos.modules['test-people'];
      const instance = people.newInstance();

      const piece1 = {
        ...instance,
        title: 'piece 1'
      };

      const piece2 = {
        ...instance,
        title: 'piece 2'
      };

      const pieceDraft = await people.insert(draftReq, piece1);
      const piecePublished = await people.insert(req, piece2);

      const actual = {
        draft: {
          idMode: pieceDraft._id.split(':').pop(),
          aposLocale: pieceDraft.aposLocale,
          aposMode: pieceDraft.aposMode
        },
        published: {
          idMode: piecePublished._id.split(':').pop(),
          aposLocale: piecePublished.aposLocale,
          aposMode: piecePublished.aposMode
        }
      };

      const expected = {
        draft: {
          idMode: 'draft',
          aposLocale: 'en:draft',
          aposMode: 'draft'
        },
        published: {
          idMode: 'published',
          aposLocale: 'en:published',
          aposMode: 'published'
        }
      };

      assert.deepEqual(actual, expected);
    });

    it('should rely on _id when present for aposMode and aposLocale even if req.mode does not match', async function() {
      const req = apos.task.getReq();
      const draftReq = apos.task.getReq({ mode: 'draft' });
      const people = apos.modules['test-people'];
      const instance = people.newInstance();

      const piece1 = {
        _id: 'testid:en:draft',
        ...instance,
        title: 'piece 1'
      };

      const piece2 = {
        _id: 'testid:en:published',
        ...instance,
        title: 'piece 2'
      };

      const pieceDraft = await people.insert(req, piece1);
      const piecePublished = await people.insert(draftReq, piece2);

      const actual = {
        draft: {
          idMode: pieceDraft._id.split(':').pop(),
          aposLocale: pieceDraft.aposLocale,
          aposMode: pieceDraft.aposMode
        },
        published: {
          idMode: piecePublished._id.split(':').pop(),
          aposLocale: piecePublished.aposLocale,
          aposMode: piecePublished.aposMode
        }
      };

      const expected = {
        draft: {
          idMode: 'draft',
          aposLocale: 'en:draft',
          aposMode: 'draft'
        },
        published: {
          idMode: 'published',
          aposLocale: 'en:published',
          aposMode: 'published'
        }
      };

      assert.deepEqual(actual, expected);
    });

    it('should rely on aposMode when present for _id and aposLocale even if req.mode does not match', async function() {
      const req = apos.task.getReq();
      const draftReq = apos.task.getReq({ mode: 'draft' });
      const people = apos.modules['test-people'];
      const instance = people.newInstance();

      const piece1 = {
        ...instance,
        title: 'piece 1',
        aposLocale: 'en:draft'
      };

      const piece2 = {
        ...instance,
        title: 'piece 2',
        aposLocale: 'en:published'
      };

      const pieceDraft = await people.insert(req, piece1);
      const piecePublished = await people.insert(draftReq, piece2);

      const actual = {
        draft: {
          idMode: pieceDraft._id.split(':').pop(),
          aposLocale: pieceDraft.aposLocale,
          aposMode: pieceDraft.aposMode
        },
        published: {
          idMode: piecePublished._id.split(':').pop(),
          aposLocale: piecePublished.aposLocale,
          aposMode: piecePublished.aposMode
        }
      };

      const expected = {
        draft: {
          idMode: 'draft',
          aposLocale: 'en:draft',
          aposMode: 'draft'
        },
        published: {
          idMode: 'published',
          aposLocale: 'en:published',
          aposMode: 'published'
        }
      };

      assert.deepEqual(actual, expected);
    });
  });

  describe('beforeUnpublish handler', function() {
    it('should prevent un-publishing of the global doc', async function() {
      const req = apos.task.getReq();

      const global = await apos.doc.find(req, { type: '@apostrophecms/global' }).toObject();

      try {
        await apos.http.post(
          `/api/v1/@apostrophecms/global/${global._id}/unpublish?apiKey=${apiKey}`,
          {
            body: {},
            busy: true
          }
        );
      } catch (error) {
        assert(error.status === 403);
        return;
      }
      throw new Error('Should have thrown a forbidden error (should not be able to unpublish the global doc)');
    });
  });

});

describe('Docs: tasks', function () {
  let apos;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        '@apostrophecms/i18n': {
          options: {
            locales: {
              en: {},
              fr: {
                prefix: '/fr'
              }
            }
          }
        },
        'test-people': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              _friends: {
                type: 'relationship',
                withType: 'test-people',
                label: 'Friends'
              }
            }
          }
        },
        unlocalized: {
          extend: '@apostrophecms/piece-type',
          options: {
            localized: false
          },
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
        },
        '@apostrophecms/page': {
          options: {
            park: [],
            types: [
              {
                name: 'test-page',
                label: 'Test Page'
              }
            ]
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type'
        }

      }
    });
  });

  after(async function() {
    await t.destroy(apos);
  });

  beforeEach(async function() {
    await apos.doc.db.deleteMany({});
    await apos.lock.db.deleteMany({});
  });

  it('should require the _id or slug when calling @apostrophecms/doc:get-apos-doc-id task', async function() {
    await insertI18nFixtures(apos);

    const actual = async () => {
      await apos.task.invoke(
        '@apostrophecms/doc:get-apos-doc-id',
        {
          locale: 'fr'
        }
      );
    };
    const expected = {
      message: 'Either _id or slug must be provided',
      name: 'invalid'
    };

    await assert.rejects(actual, expected);
  });

  it('should not require the locale when calling @apostrophecms/doc:get-apos-doc-id task with _id', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'en' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    const actual = await apos.task.invoke(
      '@apostrophecms/doc:get-apos-doc-id',
      {
        _id: doc._id
      }
    );
    const expected = doc.aposDocId;

    assert.equal(actual, expected);
  });

  it('should require the locale when calling @apostrophecms/doc:get-apos-doc-id task with slug', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'en' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    const actual = async () => {
      await apos.task.invoke(
        '@apostrophecms/doc:get-apos-doc-id',
        {
          slug: doc.slug
        }
      );
    };
    const expected = {
      message: 'Missing locale',
      name: 'invalid'
    };

    await assert.rejects(actual, expected);
  });

  it('should get the aposDocId when calling @apostrophecms/doc:get-apos-doc-id task with a slug', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'en' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    const actual = await apos.task.invoke(
      '@apostrophecms/doc:get-apos-doc-id',
      {
        slug: doc.slug,
        locale: 'en'
      }
    );
    const expected = doc.aposDocId;

    assert.equal(actual, expected);
  });

  it('should get the aposDocId when calling @apostrophecms/doc:get-apos-doc-id task with an _id', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'en' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    const actual = await apos.task.invoke(
      '@apostrophecms/doc:get-apos-doc-id',
      {
        _id: doc._id,
        locale: 'en'
      }
    );
    const expected = doc.aposDocId;

    assert.equal(actual, expected);
  });

  it('should require a new ID when calling @apostrophecms/doc:set-apos-doc-id task', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'fr' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    const actual = async () => {
      await apos.task.invoke(
        '@apostrophecms/doc:set-apos-doc-id',
        {
          'old-id': doc.aposDocId,
          locale: 'fr'
        }
      );
    };
    const expected = {
      message: 'Missing newId',
      name: 'invalid'
    };

    await assert.rejects(actual, expected);
  });

  it('should require an old-id or slug when calling @apostrophecms/doc:set-apos-doc-id task', async function() {
    await insertI18nFixtures(apos);

    const actual = async () => {
      await apos.task.invoke(
        '@apostrophecms/doc:set-apos-doc-id',
        {
          'new-id': 'carl',
          locale: 'fr'
        }
      );
    };
    const expected = {
      message: 'Either oldId or slug must be provided',
      name: 'invalid'
    };

    await assert.rejects(actual, expected);
  });

  it('should require a locale when calling @apostrophecms/doc:set-apos-doc-id task', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'fr' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    const actual = async () => {
      await apos.task.invoke(
        '@apostrophecms/doc:set-apos-doc-id',
        {
          'new-id': 'carl',
          'old-id': doc.aposDocId
        }
      );
    };
    const expected = {
      message: 'Missing locale',
      name: 'invalid'
    };

    await assert.rejects(actual, expected);
  });

  it('should update the aposDocId when calling @apostrophecms/doc:set-apos-doc-id task with a slug and a new aposDocId', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'fr' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    await apos.task.invoke(
      '@apostrophecms/doc:set-apos-doc-id',
      {
        'new-id': 'carl',
        slug: doc.slug,
        locale: 'fr'
      }
    );

    const paul = await apos.doc.find(
      apos.task.getReq({ locale: 'fr' }),
      { slug: 'paul' }
    ).toObject();
    const carl = await apos.doc.find(
      apos.task.getReq({ locale: 'fr' }),
      { slug: 'carl' }
    ).toObject();

    const actual = {
      carl: {
        _id: carl._id,
        aposDocId: carl.aposDocId,
        aposLocale: carl.aposLocale
      },
      paul: {
        friendsIds: paul.friendsIds
      }
    };
    const expected = {
      carl: {
        _id: 'carl:fr:published',
        aposDocId: 'carl',
        aposLocale: 'fr:published'
      },
      paul: {
        friendsIds: [ 'carl', 'test-people-larry' ]
      }
    };

    assert.deepEqual(actual, expected);
  });

  it('should update the aposDocId when calling @apostrophecms/doc:set-apos-doc-id task with an old and new aposDocId', async function() {
    await insertI18nFixtures(apos);

    const req = apos.task.getReq({ locale: 'fr' });
    const doc = await apos.doc.find(req, {
      type: 'test-people',
      slug: 'carl'
    }).toObject();

    await apos.task.invoke(
      '@apostrophecms/doc:set-apos-doc-id',
      {
        'new-id': 'carl',
        'old-id': doc.aposDocId,
        locale: 'fr'
      }
    );

    const paul = await apos.doc.find(
      apos.task.getReq({ locale: 'fr' }),
      { slug: 'paul' }
    ).toObject();
    const carl = await apos.doc.find(
      apos.task.getReq({ locale: 'fr' }),
      { slug: 'carl' }
    ).toObject();

    const actual = {
      carl: {
        _id: carl._id,
        aposDocId: carl.aposDocId,
        aposLocale: carl.aposLocale
      },
      paul: {
        friendsIds: paul.friendsIds
      }
    };
    const expected = {
      carl: {
        _id: 'carl:fr:published',
        aposDocId: 'carl',
        aposLocale: 'fr:published'
      },
      paul: {
        friendsIds: [ 'carl', 'test-people-larry' ]
      }
    };

    assert.deepEqual(actual, expected);
  });
});

async function insertPeople(apos) {
  return apos.doc.db.insertMany([
    {
      _id: 'lori:en:draft',
      aposDocId: 'lori',
      aposLocale: 'en:draft',
      slug: 'lori',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Lori',
      lastName: 'Pizzaroni',
      age: 32,
      alive: true
    },
    {
      _id: 'larry:en:draft',
      aposDocId: 'larry',
      aposLocale: 'en:draft',
      slug: 'larry',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Larry',
      lastName: 'Cherber',
      age: 28,
      alive: true
    },
    {
      _id: 'carl:en:draft',
      aposDocId: 'carl',
      aposLocale: 'en:draft',
      slug: 'carl',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Carl',
      lastName: 'Sagan',
      age: 62,
      alive: false,
      friendsIds: [ 'larry' ]
    },
    {
      _id: 'peter:en:draft',
      aposDocId: 'peter',
      aposLocale: 'en:draft',
      type: 'test-people',
      visibility: 'loginRequired',
      firstName: 'Peter',
      lastName: 'Pan',
      age: 70,
      slug: 'peter'
    },
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
    },
    {
      _id: 'peter:en:published',
      aposDocId: 'peter',
      aposLocale: 'en:published',
      type: 'test-people',
      visibility: 'loginRequired',
      firstName: 'Peter',
      lastName: 'Pan',
      age: 70,
      slug: 'peter'
    }
  ]);
}

async function insertOne(apos) {
  return apos.doc.insert(apos.task.getReq(), {
    slug: 'one',
    visibility: 'public',
    type: 'test-people',
    firstName: 'Lori',
    lastName: 'Ferber',
    age: 15,
    alive: true
  });
}

async function insertOneWithRelated(apos) {
  return apos.doc.insert(apos.task.getReq(), {
    aposDocId: 'paul',
    aposLocale: 'en:published',
    slug: 'paul',
    visibility: 'public',
    type: 'test-people',
    firstName: 'Paul',
    lastName: 'McCartney',
    age: 24,
    alive: false,
    friendsIds: [ 'carl', 'larry' ],
    _friends: [ { _id: 'carl:en:published' }, { _id: 'larry:en:published' } ]
  });
}

async function archiveDoc(apos, doc) {
  return apos.doc.update(apos.task.getReq(), {
    ...doc,
    archived: true
  });
}

async function insertI18nFixtures(apos) {
  const larry = await apos.modules['test-people'].insert(
    apos.task.getReq({
      locale: 'en',
      mode: 'published'
    }),
    {
      ...apos.modules['test-people'].newInstance(),
      // _id: 'larry:en:published',
      aposDocId: 'larry',
      aposLocale: 'en:published',
      slug: 'larry',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Larry',
      lastName: 'Cherber',
      age: 28,
      alive: true
    }
  );

  const carl = await apos.modules['test-people'].insert(
    apos.task.getReq({
      locale: 'en',
      mode: 'published'
    }),
    {
      ...apos.modules['test-people'].newInstance(),
      // _id: 'carl:en:published',
      aposDocId: 'carl',
      aposLocale: 'en:published',
      slug: 'carl',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Carl',
      lastName: 'Sagan',
      age: 62,
      alive: false,
      _friends: [ larry ]
    }
  );

  const paul = await apos.modules['test-people'].insert(
    apos.task.getReq({
      locale: 'en',
      mode: 'published'
    }),
    {
      ...apos.modules['test-people'].newInstance(),
      // _id: 'paul:en:published',
      aposDocId: 'paul',
      aposLocale: 'en:published',
      slug: 'paul',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Paul',
      lastName: 'McCartney',
      age: 24,
      alive: false,
      _friends: [ carl, larry ]
    }
  );

  const larryFr = await apos.modules['test-people'].insert(
    apos.task.getReq({
      locale: 'fr',
      mode: 'published'
    }),
    {
      ...apos.modules['test-people'].newInstance(),
      // _id: 'larry:fr:published',
      aposDocId: 'test-people-larry',
      aposLocale: 'fr:published',
      slug: 'larry',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Larry',
      lastName: 'Cherber',
      age: 28,
      alive: true
    }
  );

  const carlFr = await apos.modules['test-people'].insert(
    apos.task.getReq({
      locale: 'fr',
      mode: 'published'
    }),
    {
      ...apos.modules['test-people'].newInstance(),
      // _id: 'carl:fr:published',
      aposDocId: 'test-people-carl',
      aposLocale: 'fr:published',
      slug: 'carl',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Carl',
      lastName: 'Sagan',
      age: 62,
      alive: false,
      _friends: [ larryFr ]
    }
  );

  const paulFr = await apos.modules['test-people'].insert(
    apos.task.getReq({
      locale: 'fr',
      mode: 'published'
    }),
    {
      ...apos.modules['test-people'].newInstance(),
      // _id: 'paul:fr:published',
      aposDocId: 'test-people-paul',
      aposLocale: 'fr:published',
      slug: 'paul',
      visibility: 'public',
      type: 'test-people',
      firstName: 'Paul',
      lastName: 'McCartney',
      age: 24,
      alive: false,
      _friends: [ carlFr, larryFr ]
    }
  );

  return {
    larry,
    carl,
    paul,
    larryFr,
    carlFr,
    paulFr
  };
}
