/* global describe, it, before, after, beforeEach */
/* eslint-disable no-unused-expressions */
const { expect } = require('chai');

// Test suite for the universal database adapter
// Based on actual MongoDB usage patterns in ApostropheCMS

const ADAPTER = process.env.ADAPTER || 'mongodb';
const TEST_DB_NAME = 'dbtest-adapter';

describe(`Database Adapter (${ADAPTER})`, function() {
  let client;
  let db;

  before(async function() {
    if (ADAPTER === 'mongodb') {
      const mongodb = require('../adapters/mongodb');
      client = await mongodb.connect(`mongodb://localhost:27017/${TEST_DB_NAME}`);
      db = client.db();
    } else if (ADAPTER === 'postgres') {
      const postgres = require('../adapters/postgres');
      const user = process.env.PGUSER || process.env.USER;
      const password = process.env.PGPASSWORD || '';
      const auth = password ? `${user}:${password}@` : `${user}@`;
      client = await postgres.connect(`postgres://${auth}localhost:5432/dbtest_adapter`);
      db = client.db('dbtest_adapter');
    }
  });

  after(async function() {
    if (db) {
      // Clean up test database
      const collections = await db.listCollections().toArray();
      for (const col of collections) {
        await db.collection(col.name).drop();
      }
    }
    if (client) {
      await client.close();
    }
  });

  beforeEach(async function() {
    // Clean up test collection before each test
    try {
      await db.collection('test').drop();
    } catch (e) {
      // Collection may not exist, ignore
    }
  });

  // ============================================
  // SECTION 1: Basic CRUD Operations
  // ============================================

  describe('insertOne', function() {
    it('should insert a document and return insertedId', async function() {
      const result = await db.collection('test').insertOne({
        _id: 'doc1',
        title: 'Test Document',
        value: 42
      });
      expect(result.insertedId).to.equal('doc1');
      expect(result.acknowledged).to.equal(true);
    });

    it('should auto-generate _id if not provided', async function() {
      const result = await db.collection('test').insertOne({
        title: 'Auto ID Document'
      });
      expect(result.insertedId).to.exist;
      expect(result.acknowledged).to.equal(true);
    });

    it('should reject duplicate _id', async function() {
      await db.collection('test').insertOne({
        _id: 'dup',
        value: 1
      });
      try {
        await db.collection('test').insertOne({
          _id: 'dup',
          value: 2
        });
        expect.fail('Should have thrown duplicate key error');
      } catch (e) {
        expect(e.message).to.match(/duplicate|unique|already exists/i);
      }
    });
  });

  describe('insertMany', function() {
    it('should insert multiple documents', async function() {
      const docs = [
        {
          _id: 'many1',
          title: 'First'
        },
        {
          _id: 'many2',
          title: 'Second'
        },
        {
          _id: 'many3',
          title: 'Third'
        }
      ];
      const result = await db.collection('test').insertMany(docs);
      expect(result.insertedCount).to.equal(3);
      expect(result.acknowledged).to.equal(true);
      expect(Object.keys(result.insertedIds)).to.have.lengthOf(3);
    });

    it('should reject if any document has duplicate _id', async function() {
      await db.collection('test').insertOne({
        _id: 'existing',
        value: 1
      });
      try {
        await db.collection('test').insertMany([
          {
            _id: 'new1',
            value: 2
          },
          {
            _id: 'existing',
            value: 3
          }
        ]);
        expect.fail('Should have thrown duplicate key error');
      } catch (e) {
        expect(e.message).to.match(/duplicate|unique|already exists/i);
      }
    });
  });

  describe('findOne', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'find1',
          type: 'article',
          title: 'First Article',
          views: 100
        },
        {
          _id: 'find2',
          type: 'article',
          title: 'Second Article',
          views: 200
        },
        {
          _id: 'find3',
          type: 'page',
          title: 'Home Page',
          views: 500
        }
      ]);
    });

    it('should find a document by _id', async function() {
      const doc = await db.collection('test').findOne({ _id: 'find1' });
      expect(doc).to.exist;
      expect(doc._id).to.equal('find1');
      expect(doc.title).to.equal('First Article');
    });

    it('should find a document by field value', async function() {
      const doc = await db.collection('test').findOne({ type: 'page' });
      expect(doc).to.exist;
      expect(doc._id).to.equal('find3');
    });

    it('should return null if no match', async function() {
      const doc = await db.collection('test').findOne({ _id: 'nonexistent' });
      expect(doc).to.be.null;
    });

    it('should support projection', async function() {
      const doc = await db.collection('test').findOne(
        { _id: 'find1' },
        { projection: { title: 1 } }
      );
      expect(doc).to.exist;
      expect(doc._id).to.equal('find1');
      expect(doc.title).to.equal('First Article');
      expect(doc.type).to.be.undefined;
      expect(doc.views).to.be.undefined;
    });

    it('should support projection exclusion', async function() {
      const doc = await db.collection('test').findOne(
        { _id: 'find1' },
        { projection: { views: 0 } }
      );
      expect(doc).to.exist;
      expect(doc._id).to.equal('find1');
      expect(doc.title).to.equal('First Article');
      expect(doc.type).to.equal('article');
      expect(doc.views).to.be.undefined;
    });
  });

  describe('find', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'a1',
          type: 'article',
          title: 'Alpha',
          order: 1,
          tags: [ 'news', 'featured' ]
        },
        {
          _id: 'a2',
          type: 'article',
          title: 'Beta',
          order: 2,
          tags: [ 'news' ]
        },
        {
          _id: 'a3',
          type: 'article',
          title: 'Gamma',
          order: 3,
          tags: [ 'featured' ]
        },
        {
          _id: 'p1',
          type: 'page',
          title: 'Home',
          order: 1,
          tags: []
        },
        {
          _id: 'p2',
          type: 'page',
          title: 'About',
          order: 2,
          tags: [ 'info' ]
        }
      ]);
    });

    it('should find all documents with toArray()', async function() {
      const docs = await db.collection('test').find({}).toArray();
      expect(docs).to.have.lengthOf(5);
    });

    it('should find documents matching criteria', async function() {
      const docs = await db.collection('test').find({ type: 'article' }).toArray();
      expect(docs).to.have.lengthOf(3);
      docs.forEach(doc => expect(doc.type).to.equal('article'));
    });

    it('should support sort()', async function() {
      const docs = await db.collection('test')
        .find({ type: 'article' })
        .sort({ order: -1 })
        .toArray();
      expect(docs).to.have.lengthOf(3);
      expect(docs[0]._id).to.equal('a3');
      expect(docs[1]._id).to.equal('a2');
      expect(docs[2]._id).to.equal('a1');
    });

    it('should support limit()', async function() {
      const docs = await db.collection('test')
        .find({})
        .sort({ _id: 1 })
        .limit(2)
        .toArray();
      expect(docs).to.have.lengthOf(2);
    });

    it('should support skip()', async function() {
      const docs = await db.collection('test')
        .find({})
        .sort({ _id: 1 })
        .skip(2)
        .toArray();
      expect(docs).to.have.lengthOf(3);
    });

    it('should support skip() and limit() together', async function() {
      const docs = await db.collection('test')
        .find({})
        .sort({ _id: 1 })
        .skip(1)
        .limit(2)
        .toArray();
      expect(docs).to.have.lengthOf(2);
      expect(docs[0]._id).to.equal('a2');
      expect(docs[1]._id).to.equal('a3');
    });

    it('should support project()', async function() {
      const docs = await db.collection('test')
        .find({ _id: 'a1' })
        .project({ title: 1 })
        .toArray();
      expect(docs).to.have.lengthOf(1);
      expect(docs[0]._id).to.equal('a1');
      expect(docs[0].title).to.equal('Alpha');
      expect(docs[0].type).to.be.undefined;
    });

    it('should support count()', async function() {
      const count = await db.collection('test')
        .find({ type: 'article' })
        .count();
      expect(count).to.equal(3);
    });

    it('should support clone()', async function() {
      const cursor = db.collection('test').find({ type: 'article' });
      const cloned = cursor.clone();
      const docs1 = await cursor.toArray();
      const docs2 = await cloned.toArray();
      expect(docs1).to.have.lengthOf(3);
      expect(docs2).to.have.lengthOf(3);
    });

    it('should support next() with promises', async function() {
      const cursor = db.collection('test')
        .find({ type: 'article' })
        .sort({ _id: 1 });
      const doc1 = await cursor.next();
      expect(doc1).to.exist;
      expect(doc1._id).to.equal('a1');
      const doc2 = await cursor.next();
      expect(doc2).to.exist;
      expect(doc2._id).to.equal('a2');
      const doc3 = await cursor.next();
      expect(doc3).to.exist;
      expect(doc3._id).to.equal('a3');
      const doc4 = await cursor.next();
      expect(doc4).to.be.null;
    });

    it('should support next() with callbacks', function(done) {
      const cursor = db.collection('test')
        .find({ type: 'page' })
        .sort({ _id: 1 });
      cursor.next(function(err, doc1) {
        if (err) {
          return done(err);
        }
        expect(doc1).to.exist;
        expect(doc1._id).to.equal('p1');
        cursor.next(function(err, doc2) {
          if (err) {
            return done(err);
          }
          expect(doc2).to.exist;
          expect(doc2._id).to.equal('p2');
          cursor.next(function(err, doc3) {
            if (err) {
              return done(err);
            }
            expect(doc3).to.be.null;
            done();
          });
        });
      });
    });

    it('should support next() with projection', async function() {
      const cursor = db.collection('test')
        .find({ _id: 'a1' })
        .project({ title: 1 });
      const doc = await cursor.next();
      expect(doc).to.exist;
      expect(doc._id).to.equal('a1');
      expect(doc.title).to.equal('Alpha');
      expect(doc.type).to.be.undefined;
    });

    if (ADAPTER === 'postgres') {
      it('should support close() for early termination', async function() {
        const cursor = db.collection('test')
          .find({})
          .sort({ _id: 1 });
        const doc1 = await cursor.next();
        expect(doc1).to.exist;
        await cursor.close();
        const doc2 = await cursor.next();
        expect(doc2).to.be.null;
      });
    }
  });

  describe('updateOne', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'u1',
          title: 'Original',
          views: 10,
          active: true
        },
        {
          _id: 'u2',
          title: 'Another',
          views: 20,
          active: false
        }
      ]);
    });

    it('should update a single document', async function() {
      const result = await db.collection('test').updateOne(
        { _id: 'u1' },
        { $set: { title: 'Updated' } }
      );
      expect(result.matchedCount).to.equal(1);
      expect(result.modifiedCount).to.equal(1);
      expect(result.acknowledged).to.equal(true);

      const doc = await db.collection('test').findOne({ _id: 'u1' });
      expect(doc.title).to.equal('Updated');
      expect(doc.views).to.equal(10);
    });

    it('should return matchedCount 0 if no match', async function() {
      const result = await db.collection('test').updateOne(
        { _id: 'nonexistent' },
        { $set: { title: 'Updated' } }
      );
      expect(result.matchedCount).to.equal(0);
      expect(result.modifiedCount).to.equal(0);
    });

    it('should support upsert', async function() {
      const result = await db.collection('test').updateOne(
        { _id: 'new1' },
        {
          $set: {
            title: 'Upserted',
            value: 100
          }
        },
        { upsert: true }
      );
      expect(result.upsertedId).to.equal('new1');
      expect(result.upsertedCount).to.equal(1);

      const doc = await db.collection('test').findOne({ _id: 'new1' });
      expect(doc.title).to.equal('Upserted');
    });
  });

  describe('updateMany', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'm1',
          type: 'article',
          status: 'draft'
        },
        {
          _id: 'm2',
          type: 'article',
          status: 'draft'
        },
        {
          _id: 'm3',
          type: 'page',
          status: 'draft'
        }
      ]);
    });

    it('should update multiple documents', async function() {
      const result = await db.collection('test').updateMany(
        { type: 'article' },
        { $set: { status: 'published' } }
      );
      expect(result.matchedCount).to.equal(2);
      expect(result.modifiedCount).to.equal(2);

      const docs = await db.collection('test').find({ status: 'published' }).toArray();
      expect(docs).to.have.lengthOf(2);
    });
  });

  describe('replaceOne', function() {
    beforeEach(async function() {
      await db.collection('test').insertOne({
        _id: 'r1',
        title: 'Original',
        extra: 'field',
        count: 5
      });
    });

    it('should replace entire document', async function() {
      const result = await db.collection('test').replaceOne(
        { _id: 'r1' },
        {
          _id: 'r1',
          title: 'Replaced',
          newField: 'value'
        }
      );
      expect(result.matchedCount).to.equal(1);
      expect(result.modifiedCount).to.equal(1);

      const doc = await db.collection('test').findOne({ _id: 'r1' });
      expect(doc.title).to.equal('Replaced');
      expect(doc.newField).to.equal('value');
      expect(doc.extra).to.be.undefined;
      expect(doc.count).to.be.undefined;
    });

    it('should support upsert', async function() {
      const result = await db.collection('test').replaceOne(
        { _id: 'r2' },
        {
          _id: 'r2',
          title: 'New Doc'
        },
        { upsert: true }
      );
      expect(result.upsertedId).to.equal('r2');
    });
  });

  describe('deleteOne', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'd1',
          value: 1
        },
        {
          _id: 'd2',
          value: 2
        }
      ]);
    });

    it('should delete a single document', async function() {
      const result = await db.collection('test').deleteOne({ _id: 'd1' });
      expect(result.deletedCount).to.equal(1);
      expect(result.acknowledged).to.equal(true);

      const doc = await db.collection('test').findOne({ _id: 'd1' });
      expect(doc).to.be.null;
    });

    it('should return deletedCount 0 if no match', async function() {
      const result = await db.collection('test').deleteOne({ _id: 'nonexistent' });
      expect(result.deletedCount).to.equal(0);
    });
  });

  describe('deleteMany', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'dm1',
          type: 'temp',
          value: 1
        },
        {
          _id: 'dm2',
          type: 'temp',
          value: 2
        },
        {
          _id: 'dm3',
          type: 'keep',
          value: 3
        }
      ]);
    });

    it('should delete multiple documents', async function() {
      const result = await db.collection('test').deleteMany({ type: 'temp' });
      expect(result.deletedCount).to.equal(2);

      const docs = await db.collection('test').find({}).toArray();
      expect(docs).to.have.lengthOf(1);
      expect(docs[0]._id).to.equal('dm3');
    });

    it('should delete all documents with empty filter', async function() {
      const result = await db.collection('test').deleteMany({});
      expect(result.deletedCount).to.equal(3);
    });
  });

  // ============================================
  // SECTION 2: Query Operators
  // ============================================

  describe('Query Operators', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'q1',
          name: 'Alice',
          age: 25,
          active: true,
          tags: [ 'admin', 'user' ]
        },
        {
          _id: 'q2',
          name: 'Bob',
          age: 30,
          active: false,
          tags: [ 'user' ]
        },
        {
          _id: 'q3',
          name: 'Carol',
          age: 35,
          active: true,
          tags: [ 'guest' ]
        },
        {
          _id: 'q4',
          name: 'Dave',
          age: 25,
          active: true,
          tags: []
        },
        {
          _id: 'q5',
          name: 'Eve',
          age: 40,
          optional: 'present',
          tags: [ 'admin' ]
        }
      ]);
    });

    describe('Comparison Operators', function() {
      it('$eq - should match equal values', async function() {
        const docs = await db.collection('test').find({ age: { $eq: 25 } }).toArray();
        expect(docs).to.have.lengthOf(2);
      });

      it('$ne - should match not equal values', async function() {
        const docs = await db.collection('test').find({ age: { $ne: 25 } }).toArray();
        expect(docs).to.have.lengthOf(3);
      });

      it('$gt - should match greater than', async function() {
        const docs = await db.collection('test').find({ age: { $gt: 30 } }).toArray();
        expect(docs).to.have.lengthOf(2);
      });

      it('$gte - should match greater than or equal', async function() {
        const docs = await db.collection('test').find({ age: { $gte: 30 } }).toArray();
        expect(docs).to.have.lengthOf(3);
      });

      it('$lt - should match less than', async function() {
        const docs = await db.collection('test').find({ age: { $lt: 30 } }).toArray();
        expect(docs).to.have.lengthOf(2);
      });

      it('$lte - should match less than or equal', async function() {
        const docs = await db.collection('test').find({ age: { $lte: 30 } }).toArray();
        expect(docs).to.have.lengthOf(3);
      });

      it('$in - should match values in array', async function() {
        const docs = await db.collection('test').find({ age: { $in: [ 25, 35 ] } }).toArray();
        expect(docs).to.have.lengthOf(3);
      });

      it('$nin - should match values not in array', async function() {
        const docs = await db.collection('test').find({ age: { $nin: [ 25, 35 ] } }).toArray();
        expect(docs).to.have.lengthOf(2);
      });
    });

    describe('Logical Operators', function() {
      it('$and - should match all conditions', async function() {
        const docs = await db.collection('test').find({
          $and: [
            { age: { $gte: 25 } },
            { active: true }
          ]
        }).toArray();
        expect(docs).to.have.lengthOf(3);
      });

      it('$or - should match any condition', async function() {
        const docs = await db.collection('test').find({
          $or: [
            { name: 'Alice' },
            { name: 'Bob' }
          ]
        }).toArray();
        expect(docs).to.have.lengthOf(2);
      });

      it('$not - should negate condition', async function() {
        const docs = await db.collection('test').find({
          age: { $not: { $gt: 30 } }
        }).toArray();
        expect(docs).to.have.lengthOf(3);
      });

      it('should support implicit $and with multiple fields', async function() {
        const docs = await db.collection('test').find({
          age: 25,
          active: true
        }).toArray();
        expect(docs).to.have.lengthOf(2);
      });
    });

    describe('Element Operators', function() {
      it('$exists: true - should match documents with field', async function() {
        const docs = await db.collection('test').find({ optional: { $exists: true } }).toArray();
        expect(docs).to.have.lengthOf(1);
        expect(docs[0].name).to.equal('Eve');
      });

      it('$exists: false - should match documents without field', async function() {
        const docs = await db.collection('test').find({ optional: { $exists: false } }).toArray();
        expect(docs).to.have.lengthOf(4);
      });
    });

    describe('String Operators', function() {
      it('$regex - should match regex pattern', async function() {
        const docs = await db.collection('test').find({ name: { $regex: /^[AB]/ } }).toArray();
        expect(docs).to.have.lengthOf(2);
      });

      it('$regex - should support string pattern', async function() {
        const docs = await db.collection('test').find({
          name: {
            $regex: 'li',
            $options: 'i'
          }
        }).toArray();
        expect(docs).to.have.lengthOf(1);
        expect(docs[0].name).to.equal('Alice');
      });
    });

    describe('Array Operators', function() {
      it('should match array containing value (implicit)', async function() {
        const docs = await db.collection('test').find({ tags: 'admin' }).toArray();
        expect(docs).to.have.lengthOf(2);
      });

      it('$all - should match arrays containing all values', async function() {
        const docs = await db.collection('test').find({ tags: { $all: [ 'admin', 'user' ] } }).toArray();
        expect(docs).to.have.lengthOf(1);
        expect(docs[0].name).to.equal('Alice');
      });
    });
  });

  // ============================================
  // SECTION 3: Update Operators
  // ============================================

  describe('Update Operators', function() {
    describe('$set', function() {
      it('should set field value', async function() {
        await db.collection('test').insertOne({
          _id: 'set1',
          a: 1,
          b: 2
        });
        await db.collection('test').updateOne({ _id: 'set1' }, {
          $set: {
            a: 10,
            c: 3
          }
        });
        const doc = await db.collection('test').findOne({ _id: 'set1' });
        expect(doc.a).to.equal(10);
        expect(doc.b).to.equal(2);
        expect(doc.c).to.equal(3);
      });

      it('should set nested field value', async function() {
        await db.collection('test').insertOne({
          _id: 'set2',
          nested: { a: 1 }
        });
        await db.collection('test').updateOne({ _id: 'set2' }, { $set: { 'nested.b': 2 } });
        const doc = await db.collection('test').findOne({ _id: 'set2' });
        expect(doc.nested.a).to.equal(1);
        expect(doc.nested.b).to.equal(2);
      });
    });

    describe('$unset', function() {
      it('should remove field', async function() {
        await db.collection('test').insertOne({
          _id: 'unset1',
          a: 1,
          b: 2,
          c: 3
        });
        await db.collection('test').updateOne({ _id: 'unset1' }, { $unset: { b: '' } });
        const doc = await db.collection('test').findOne({ _id: 'unset1' });
        expect(doc.a).to.equal(1);
        expect(doc.b).to.be.undefined;
        expect(doc.c).to.equal(3);
      });
    });

    describe('$inc', function() {
      it('should increment numeric field', async function() {
        await db.collection('test').insertOne({
          _id: 'inc1',
          count: 5
        });
        await db.collection('test').updateOne({ _id: 'inc1' }, { $inc: { count: 3 } });
        const doc = await db.collection('test').findOne({ _id: 'inc1' });
        expect(doc.count).to.equal(8);
      });

      it('should decrement with negative value', async function() {
        await db.collection('test').insertOne({
          _id: 'inc2',
          count: 10
        });
        await db.collection('test').updateOne({ _id: 'inc2' }, { $inc: { count: -4 } });
        const doc = await db.collection('test').findOne({ _id: 'inc2' });
        expect(doc.count).to.equal(6);
      });

      it('should create field if it does not exist', async function() {
        await db.collection('test').insertOne({ _id: 'inc3' });
        await db.collection('test').updateOne({ _id: 'inc3' }, { $inc: { count: 1 } });
        const doc = await db.collection('test').findOne({ _id: 'inc3' });
        expect(doc.count).to.equal(1);
      });
    });

    describe('$push', function() {
      it('should add element to array', async function() {
        await db.collection('test').insertOne({
          _id: 'push1',
          items: [ 'a', 'b' ]
        });
        await db.collection('test').updateOne({ _id: 'push1' }, { $push: { items: 'c' } });
        const doc = await db.collection('test').findOne({ _id: 'push1' });
        expect(doc.items).to.deep.equal([ 'a', 'b', 'c' ]);
      });

      it('should create array if it does not exist', async function() {
        await db.collection('test').insertOne({ _id: 'push2' });
        await db.collection('test').updateOne({ _id: 'push2' }, { $push: { items: 'a' } });
        const doc = await db.collection('test').findOne({ _id: 'push2' });
        expect(doc.items).to.deep.equal([ 'a' ]);
      });
    });

    describe('$pull', function() {
      it('should remove matching elements from array', async function() {
        await db.collection('test').insertOne({
          _id: 'pull1',
          items: [ 'a', 'b', 'c', 'b' ]
        });
        await db.collection('test').updateOne({ _id: 'pull1' }, { $pull: { items: 'b' } });
        const doc = await db.collection('test').findOne({ _id: 'pull1' });
        expect(doc.items).to.deep.equal([ 'a', 'c' ]);
      });
    });

    describe('$addToSet', function() {
      it('should add element only if not present', async function() {
        await db.collection('test').insertOne({
          _id: 'add1',
          tags: [ 'a', 'b' ]
        });
        await db.collection('test').updateOne({ _id: 'add1' }, { $addToSet: { tags: 'c' } });
        const doc = await db.collection('test').findOne({ _id: 'add1' });
        expect(doc.tags).to.deep.equal([ 'a', 'b', 'c' ]);
      });

      it('should not add duplicate element', async function() {
        await db.collection('test').insertOne({
          _id: 'add2',
          tags: [ 'a', 'b' ]
        });
        await db.collection('test').updateOne({ _id: 'add2' }, { $addToSet: { tags: 'b' } });
        const doc = await db.collection('test').findOne({ _id: 'add2' });
        expect(doc.tags).to.deep.equal([ 'a', 'b' ]);
      });
    });

    describe('$currentDate', function() {
      it('should set field to current date', async function() {
        await db.collection('test').insertOne({
          _id: 'date1',
          name: 'test'
        });
        const before = new Date();
        await db.collection('test').updateOne({ _id: 'date1' }, { $currentDate: { updatedAt: true } });
        const after = new Date();
        const doc = await db.collection('test').findOne({ _id: 'date1' });
        expect(doc.updatedAt).to.be.instanceOf(Date);
        expect(doc.updatedAt.getTime()).to.be.at.least(before.getTime());
        expect(doc.updatedAt.getTime()).to.be.at.most(after.getTime());
      });
    });
  });

  // ============================================
  // SECTION 4: Counting and Distinct
  // ============================================

  describe('countDocuments', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'c1',
          type: 'a',
          value: 1
        },
        {
          _id: 'c2',
          type: 'a',
          value: 2
        },
        {
          _id: 'c3',
          type: 'b',
          value: 3
        }
      ]);
    });

    it('should count all documents', async function() {
      const count = await db.collection('test').countDocuments({});
      expect(count).to.equal(3);
    });

    it('should count matching documents', async function() {
      const count = await db.collection('test').countDocuments({ type: 'a' });
      expect(count).to.equal(2);
    });
  });

  describe('distinct', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'd1',
          category: 'food',
          tag: 'healthy'
        },
        {
          _id: 'd2',
          category: 'food',
          tag: 'junk'
        },
        {
          _id: 'd3',
          category: 'tech',
          tag: 'healthy'
        },
        {
          _id: 'd4',
          category: 'tech',
          tag: 'new'
        }
      ]);
    });

    it('should return distinct values for field', async function() {
      const values = await db.collection('test').distinct('category');
      expect(values.sort()).to.deep.equal([ 'food', 'tech' ]);
    });

    it('should return distinct values with filter', async function() {
      const values = await db.collection('test').distinct('tag', { category: 'food' });
      expect(values.sort()).to.deep.equal([ 'healthy', 'junk' ]);
    });
  });

  // ============================================
  // SECTION 5: Aggregation (Limited)
  // ============================================

  describe('aggregate', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'agg1',
          category: 'fruit',
          name: 'apple',
          qty: 10
        },
        {
          _id: 'agg2',
          category: 'fruit',
          name: 'banana',
          qty: 5
        },
        {
          _id: 'agg3',
          category: 'vegetable',
          name: 'carrot',
          qty: 8
        },
        {
          _id: 'agg4',
          category: 'vegetable',
          name: 'broccoli',
          qty: 3
        }
      ]);
    });

    it('$match - should filter documents', async function() {
      const results = await db.collection('test').aggregate([
        { $match: { category: 'fruit' } }
      ]).toArray();
      expect(results).to.have.lengthOf(2);
    });

    it('$group - should group and aggregate', async function() {
      const results = await db.collection('test').aggregate([
        {
          $group: {
            _id: '$category',
            total: { $sum: '$qty' }
          }
        }
      ]).toArray();
      expect(results).to.have.lengthOf(2);
      const fruit = results.find(r => r._id === 'fruit');
      const vegetable = results.find(r => r._id === 'vegetable');
      expect(fruit.total).to.equal(15);
      expect(vegetable.total).to.equal(11);
    });

    it('$project - should project fields', async function() {
      const results = await db.collection('test').aggregate([
        { $match: { _id: 'agg1' } },
        {
          $project: {
            name: 1,
            qty: 1
          }
        }
      ]).toArray();
      expect(results).to.have.lengthOf(1);
      expect(results[0].name).to.equal('apple');
      expect(results[0].category).to.be.undefined;
    });

    it('$unwind - should unwind array field', async function() {
      await db.collection('test').insertOne({
        _id: 'agg5',
        name: 'mixed',
        items: [ 'x', 'y', 'z' ]
      });
      const results = await db.collection('test').aggregate([
        { $match: { _id: 'agg5' } },
        { $unwind: '$items' }
      ]).toArray();
      expect(results).to.have.lengthOf(3);
      expect(results.map(r => r.items)).to.deep.equal([ 'x', 'y', 'z' ]);
    });
  });

  // ============================================
  // SECTION 6: Index Operations
  // ============================================

  describe('Index Operations', function() {
    it('createIndex - should create a single field index', async function() {
      await db.collection('test').insertOne({
        _id: 'idx1',
        field: 'value'
      });
      const indexName = await db.collection('test').createIndex({ field: 1 });
      expect(indexName).to.be.a('string');

      const indexes = await db.collection('test').indexes();
      const fieldIndex = indexes.find(i => i.key && i.key.field === 1);
      expect(fieldIndex).to.exist;
    });

    it('createIndex - should create a compound index', async function() {
      await db.collection('test').insertOne({
        _id: 'idx2',
        a: 1,
        b: 2
      });
      const indexName = await db.collection('test').createIndex({
        a: 1,
        b: -1
      });
      expect(indexName).to.be.a('string');
    });

    it('createIndex - should create a unique index', async function() {
      await db.collection('test').insertOne({
        _id: 'idx3',
        email: 'test@example.com'
      });
      await db.collection('test').createIndex({ email: 1 }, { unique: true });

      // Should reject duplicate
      try {
        await db.collection('test').insertOne({
          _id: 'idx4',
          email: 'test@example.com'
        });
        expect.fail('Should have thrown duplicate key error');
      } catch (e) {
        expect(e.message).to.match(/duplicate|unique|already exists/i);
      }
    });

    it('createIndex - should support text index', async function() {
      await db.collection('test').insertOne({
        _id: 'txt1',
        content: 'hello world'
      });
      const indexName = await db.collection('test').createIndex({ content: 'text' });
      expect(indexName).to.be.a('string');
    });

    it('dropIndex - should drop an index', async function() {
      await db.collection('test').insertOne({
        _id: 'drop1',
        field: 'value'
      });
      const indexName = await db.collection('test').createIndex({ field: 1 });

      await db.collection('test').dropIndex(indexName);

      const indexes = await db.collection('test').indexes();
      const fieldIndex = indexes.find(i => i.name === indexName);
      expect(fieldIndex).to.not.exist;
    });

    it('indexes - should list all indexes', async function() {
      await db.collection('test').insertOne({
        _id: 'list1',
        a: 1,
        b: 2
      });
      await db.collection('test').createIndex({ a: 1 });
      await db.collection('test').createIndex({ b: 1 });

      const indexes = await db.collection('test').indexes();
      expect(indexes.length).to.be.at.least(3); // _id index + a + b
    });

    it('createIndex - should create index on nested field', async function() {
      await db.collection('test').insertOne({
        _id: 'nested1',
        user: { profile: { name: 'Alice' } }
      });
      const indexName = await db.collection('test').createIndex({ 'user.profile.name': 1 });
      expect(indexName).to.be.a('string');

      // Verify we can query using the indexed field
      const doc = await db.collection('test').findOne({ 'user.profile.name': 'Alice' });
      expect(doc).to.exist;
      expect(doc._id).to.equal('nested1');
    });

    it('createIndex - should create sparse index', async function() {
      // Insert docs with and without the indexed field
      await db.collection('test').insertMany([
        {
          _id: 'sparse1',
          optionalField: 'present'
        },
        { _id: 'sparse2' }, // no optionalField
        {
          _id: 'sparse3',
          optionalField: 'also present'
        }
      ]);

      const indexName = await db.collection('test').createIndex(
        { optionalField: 1 },
        { sparse: true }
      );
      expect(indexName).to.be.a('string');

      // Both docs with the field should be findable
      const docs = await db.collection('test').find({ optionalField: { $exists: true } }).toArray();
      expect(docs).to.have.lengthOf(2);
    });

    it('createIndex - should create unique sparse index', async function() {
      // Unique sparse index allows multiple docs without the field
      await db.collection('test').insertMany([
        {
          _id: 'us1',
          uniqueOptional: 'value1'
        },
        { _id: 'us2' }, // no uniqueOptional - allowed with sparse
        { _id: 'us3' }  // no uniqueOptional - also allowed with sparse
      ]);

      await db.collection('test').createIndex(
        { uniqueOptional: 1 },
        {
          unique: true,
          sparse: true
        }
      );

      // Should reject duplicate value
      try {
        await db.collection('test').insertOne({
          _id: 'us4',
          uniqueOptional: 'value1'
        });
        expect.fail('Should have thrown duplicate key error');
      } catch (e) {
        expect(e.message).to.match(/duplicate|unique|already exists/i);
      }

      // But allow another doc without the field
      await db.collection('test').insertOne({ _id: 'us5' });
      const count = await db.collection('test').countDocuments({ _id: { $in: [ 'us2', 'us3', 'us5' ] } });
      expect(count).to.equal(3);
    });

    // Typed index tests - these are PostgreSQL-specific optimizations
    // but should work (be ignored) for MongoDB as well
    it('createIndex - should create numeric index for range queries', async function() {
      await db.collection('test').insertMany([
        {
          _id: 'num1',
          price: 10
        },
        {
          _id: 'num2',
          price: 25
        },
        {
          _id: 'num3',
          price: 50
        },
        {
          _id: 'num4',
          price: 100
        }
      ]);

      // Create numeric index for efficient range queries
      const indexName = await db.collection('test').createIndex(
        { price: 1 },
        { type: 'number' }
      );
      expect(indexName).to.be.a('string');

      // Range queries should work correctly
      const cheap = await db.collection('test').find({ price: { $lt: 30 } }).toArray();
      expect(cheap).to.have.lengthOf(2);
      expect(cheap.map(d => d._id).sort()).to.deep.equal([ 'num1', 'num2' ]);

      const expensive = await db.collection('test').find({ price: { $gte: 50 } }).toArray();
      expect(expensive).to.have.lengthOf(2);
      expect(expensive.map(d => d._id).sort()).to.deep.equal([ 'num3', 'num4' ]);

      const midRange = await db.collection('test').find({
        price: {
          $gt: 10,
          $lt: 100
        }
      }).toArray();
      expect(midRange).to.have.lengthOf(2);
      expect(midRange.map(d => d._id).sort()).to.deep.equal([ 'num2', 'num3' ]);
    });

    it('createIndex - should create date index for range queries', async function() {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      await db.collection('test').insertMany([
        {
          _id: 'date1',
          createdAt: lastMonth
        },
        {
          _id: 'date2',
          createdAt: lastWeek
        },
        {
          _id: 'date3',
          createdAt: yesterday
        },
        {
          _id: 'date4',
          createdAt: now
        }
      ]);

      // Create date index for efficient range queries
      const indexName = await db.collection('test').createIndex(
        { createdAt: 1 },
        { type: 'date' }
      );
      expect(indexName).to.be.a('string');

      // Range queries should work correctly
      const recent = await db.collection('test').find({
        createdAt: { $gte: yesterday }
      }).toArray();
      expect(recent).to.have.lengthOf(2);
      expect(recent.map(d => d._id).sort()).to.deep.equal([ 'date3', 'date4' ]);

      const older = await db.collection('test').find({
        createdAt: { $lt: lastWeek }
      }).toArray();
      expect(older).to.have.lengthOf(1);
      expect(older[0]._id).to.equal('date1');

      const midRange = await db.collection('test').find({
        createdAt: {
          $gt: lastMonth,
          $lt: now
        }
      }).toArray();
      expect(midRange).to.have.lengthOf(2);
      expect(midRange.map(d => d._id).sort()).to.deep.equal([ 'date2', 'date3' ]);
    });

    it('createIndex - should create unique numeric index', async function() {
      await db.collection('test').insertMany([
        {
          _id: 'unum1',
          rank: 1
        },
        {
          _id: 'unum2',
          rank: 2
        }
      ]);

      await db.collection('test').createIndex(
        { rank: 1 },
        {
          type: 'number',
          unique: true
        }
      );

      // Should reject duplicate
      try {
        await db.collection('test').insertOne({
          _id: 'unum3',
          rank: 1
        });
        expect.fail('Should have thrown duplicate key error');
      } catch (e) {
        expect(e.message).to.match(/duplicate|unique|already exists/i);
      }

      // Different value should work
      await db.collection('test').insertOne({
        _id: 'unum3',
        rank: 3
      });
      const count = await db.collection('test').countDocuments({ _id: { $regex: '^unum' } });
      expect(count).to.equal(3);
    });
  });

  // ============================================
  // SECTION 7: Bulk Operations
  // ============================================

  describe('bulkWrite', function() {
    it('should execute multiple operations', async function() {
      await db.collection('test').insertOne({
        _id: 'bulk1',
        value: 1
      });

      const result = await db.collection('test').bulkWrite([
        {
          insertOne: {
            document: {
              _id: 'bulk2',
              value: 2
            }
          }
        },
        {
          updateOne: {
            filter: { _id: 'bulk1' },
            update: { $set: { value: 10 } }
          }
        },
        {
          insertOne: {
            document: {
              _id: 'bulk3',
              value: 3
            }
          }
        },
        { deleteOne: { filter: { _id: 'bulk3' } } }
      ]);

      expect(result.insertedCount).to.equal(2);
      expect(result.modifiedCount).to.equal(1);
      expect(result.deletedCount).to.equal(1);

      const docs = await db.collection('test').find({}).toArray();
      expect(docs).to.have.lengthOf(2);
      expect(docs.find(d => d._id === 'bulk1').value).to.equal(10);
    });
  });

  // ============================================
  // SECTION 8: findOneAndUpdate
  // ============================================

  describe('findOneAndUpdate', function() {
    beforeEach(async function() {
      await db.collection('test').insertOne({
        _id: 'fau1',
        value: 1,
        name: 'original'
      });
    });

    it('should update and return the document', async function() {
      const result = await db.collection('test').findOneAndUpdate(
        { _id: 'fau1' },
        { $set: { name: 'updated' } },
        { returnDocument: 'after' }
      );
      expect(result._id).to.equal('fau1');
      expect(result.name).to.equal('updated');
    });

    it('should return original by default', async function() {
      const result = await db.collection('test').findOneAndUpdate(
        { _id: 'fau1' },
        { $set: { name: 'updated' } }
      );
      expect(result._id).to.equal('fau1');
      expect(result.name).to.equal('original');
    });

    it('should support upsert', async function() {
      const result = await db.collection('test').findOneAndUpdate(
        { _id: 'fau2' },
        { $set: { name: 'new' } },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );
      expect(result._id).to.equal('fau2');
      expect(result.name).to.equal('new');
    });
  });

  // ============================================
  // SECTION 9: Database Operations
  // ============================================

  describe('Database Operations', function() {
    it('should get collection reference', function() {
      const collection = db.collection('newcollection');
      expect(collection).to.exist;
      expect(collection.collectionName || collection.name).to.equal('newcollection');
    });

    it('should list collections', async function() {
      await db.collection('listtest1').insertOne({ _id: '1' });
      await db.collection('listtest2').insertOne({ _id: '2' });

      const collections = await db.listCollections().toArray();
      const names = collections.map(c => c.name);
      expect(names).to.include('listtest1');
      expect(names).to.include('listtest2');
    });

    it('should drop collection', async function() {
      await db.collection('dropme').insertOne({ _id: '1' });

      let collections = await db.listCollections().toArray();
      expect(collections.map(c => c.name)).to.include('dropme');

      await db.collection('dropme').drop();

      collections = await db.listCollections().toArray();
      expect(collections.map(c => c.name)).to.not.include('dropme');
    });

    it('should rename collection', async function() {
      await db.collection('oldname').insertOne({
        _id: 'rename1',
        value: 42
      });

      await db.collection('oldname').rename('newname');

      const doc = await db.collection('newname').findOne({ _id: 'rename1' });
      expect(doc.value).to.equal(42);

      const oldDoc = await db.collection('oldname').findOne({ _id: 'rename1' });
      expect(oldDoc).to.be.null;
    });
  });

  // ============================================
  // SECTION 10: Nested Field Queries
  // ============================================

  describe('Nested Field Queries', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'n1',
          user: {
            name: 'Alice',
            role: 'admin'
          },
          metadata: { views: 100 }
        },
        {
          _id: 'n2',
          user: {
            name: 'Bob',
            role: 'user'
          },
          metadata: { views: 50 }
        },
        {
          _id: 'n3',
          user: {
            name: 'Carol',
            role: 'admin'
          },
          metadata: { views: 200 }
        }
      ]);
    });

    it('should query nested fields with dot notation', async function() {
      const docs = await db.collection('test').find({ 'user.role': 'admin' }).toArray();
      expect(docs).to.have.lengthOf(2);
    });

    it('should update nested fields with dot notation', async function() {
      await db.collection('test').updateOne(
        { _id: 'n1' },
        { $set: { 'user.name': 'Alicia' } }
      );
      const doc = await db.collection('test').findOne({ _id: 'n1' });
      expect(doc.user.name).to.equal('Alicia');
      expect(doc.user.role).to.equal('admin');
    });

    it('should project nested fields', async function() {
      const doc = await db.collection('test').findOne(
        { _id: 'n1' },
        { projection: { 'user.name': 1 } }
      );
      expect(doc._id).to.equal('n1');
      expect(doc.user.name).to.equal('Alice');
      expect(doc.user.role).to.be.undefined;
      expect(doc.metadata).to.be.undefined;
    });
  });

  // ============================================
  // SECTION 11: Sort on Multiple Fields
  // ============================================

  describe('Multi-field Sort', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 's1',
          category: 'a',
          priority: 2
        },
        {
          _id: 's2',
          category: 'b',
          priority: 1
        },
        {
          _id: 's3',
          category: 'a',
          priority: 1
        },
        {
          _id: 's4',
          category: 'b',
          priority: 2
        }
      ]);
    });

    it('should sort by multiple fields', async function() {
      const docs = await db.collection('test')
        .find({})
        .sort({
          category: 1,
          priority: -1
        })
        .toArray();

      expect(docs[0]._id).to.equal('s1'); // a, 2
      expect(docs[1]._id).to.equal('s3'); // a, 1
      expect(docs[2]._id).to.equal('s4'); // b, 2
      expect(docs[3]._id).to.equal('s2'); // b, 1
    });
  });

  // ============================================
  // SECTION 12: Database Switching
  // ============================================

  describe('Database Switching', function() {
    it('should switch to sibling database', async function() {
      // Get a reference to a different database
      const siblingDb = ADAPTER === 'mongodb'
        ? client.db('dbtest-sibling')
        : client.db('dbtest_sibling');

      // Write to sibling
      await siblingDb.collection('siblingcol').insertOne({
        _id: 'sib1',
        from: 'sibling'
      });

      // Verify it's not in original
      const origDoc = await db.collection('siblingcol').findOne({ _id: 'sib1' });
      expect(origDoc).to.be.null;

      // Verify it's in sibling
      const sibDoc = await siblingDb.collection('siblingcol').findOne({ _id: 'sib1' });
      expect(sibDoc).to.exist;
      expect(sibDoc.from).to.equal('sibling');

      // Clean up sibling
      await siblingDb.collection('siblingcol').drop();
    });
  });

  // ============================================
  // SECTION 13: Empty Results
  // ============================================

  describe('Empty Results Handling', function() {
    it('should return empty array for find with no matches', async function() {
      const docs = await db.collection('test').find({ nonexistent: true }).toArray();
      expect(docs).to.be.an('array').that.is.empty;
    });

    it('should return 0 for count with no matches', async function() {
      const count = await db.collection('test').countDocuments({ nonexistent: true });
      expect(count).to.equal(0);
    });

    it('should return empty array for distinct with no matches', async function() {
      const values = await db.collection('test').distinct('field', { nonexistent: true });
      expect(values).to.be.an('array').that.is.empty;
    });
  });

  // ============================================
  // SECTION 14: Date Handling
  // ============================================

  describe('Date Handling', function() {
    it('should store and retrieve Date objects', async function() {
      const now = new Date();
      await db.collection('test').insertOne({
        _id: 'date1',
        createdAt: now
      });

      const doc = await db.collection('test').findOne({ _id: 'date1' });
      expect(doc.createdAt).to.be.instanceOf(Date);
      expect(doc.createdAt.getTime()).to.equal(now.getTime());
    });

    it('should query by date comparison', async function() {
      const old = new Date('2020-01-01');
      const recent = new Date('2024-01-01');
      const cutoff = new Date('2022-01-01');

      await db.collection('test').insertMany([
        {
          _id: 'old',
          createdAt: old
        },
        {
          _id: 'recent',
          createdAt: recent
        }
      ]);

      const docs = await db.collection('test').find({ createdAt: { $gte: cutoff } }).toArray();
      expect(docs).to.have.lengthOf(1);
      expect(docs[0]._id).to.equal('recent');
    });
  });

  // ============================================
  // SECTION 15: Null and Undefined Handling
  // ============================================

  describe('Null and Undefined Handling', function() {
    beforeEach(async function() {
      await db.collection('test').insertMany([
        {
          _id: 'null1',
          value: null
        },
        {
          _id: 'null2',
          value: 'present'
        },
        { _id: 'null3' } // value field missing
      ]);
    });

    it('should find documents with null value', async function() {
      const docs = await db.collection('test').find({ value: null }).toArray();
      // MongoDB matches both null and missing fields with { value: null }
      expect(docs.length).to.be.at.least(1);
    });

    it('should distinguish null from missing with $exists', async function() {
      const withField = await db.collection('test').find({ value: { $exists: true } }).toArray();
      expect(withField).to.have.lengthOf(2);

      const withoutField = await db.collection('test').find({ value: { $exists: false } }).toArray();
      expect(withoutField).to.have.lengthOf(1);
      expect(withoutField[0]._id).to.equal('null3');
    });
  });

  // ============================================
  // SECTION 16: Mixed Type Arrays
  // ============================================

  describe('Mixed Type Arrays', function() {
    it('should handle arrays with mixed types', async function() {
      await db.collection('test').insertOne({
        _id: 'mixed1',
        items: [ 1, 'two', { three: 3 }, [ 4, 5 ], null ]
      });

      const doc = await db.collection('test').findOne({ _id: 'mixed1' });
      expect(doc.items).to.deep.equal([ 1, 'two', { three: 3 }, [ 4, 5 ], null ]);
    });
  });

  // ============================================
  // SECTION 17: Large Documents
  // ============================================

  describe('Large Documents', function() {
    it('should handle documents with many fields', async function() {
      const doc = { _id: 'large1' };
      for (let i = 0; i < 100; i++) {
        doc[`field${i}`] = `value${i}`;
      }

      await db.collection('test').insertOne(doc);
      const retrieved = await db.collection('test').findOne({ _id: 'large1' });

      expect(retrieved.field0).to.equal('value0');
      expect(retrieved.field99).to.equal('value99');
    });

    it('should handle large string values', async function() {
      const largeString = 'x'.repeat(100000);
      await db.collection('test').insertOne({
        _id: 'largestr',
        content: largeString
      });

      const doc = await db.collection('test').findOne({ _id: 'largestr' });
      expect(doc.content).to.equal(largeString);
    });
  });

  // ============================================
  // SECTION 18: Multiple Update Operators
  // ============================================

  describe('Multiple Update Operators Combined', function() {
    it('should apply multiple update operators in single update', async function() {
      await db.collection('test').insertOne({
        _id: 'multi1',
        count: 5,
        name: 'original',
        tags: [ 'a' ],
        toRemove: 'value'
      });

      await db.collection('test').updateOne(
        { _id: 'multi1' },
        {
          $set: { name: 'updated' },
          $inc: { count: 3 },
          $push: { tags: 'b' },
          $unset: { toRemove: '' }
        }
      );

      const doc = await db.collection('test').findOne({ _id: 'multi1' });
      expect(doc.name).to.equal('updated');
      expect(doc.count).to.equal(8);
      expect(doc.tags).to.deep.equal([ 'a', 'b' ]);
      expect(doc.toRemove).to.be.undefined;
    });
  });

  // ============================================
  // SECTION 19: Atomicity
  // ============================================

  describe('Atomicity', function() {
    it('should ensure atomic _id uniqueness', async function() {
      // Run multiple concurrent inserts with same _id
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          db.collection('test').insertOne({
            _id: 'atomic1',
            value: i
          })
            .then(() => 'success')
            .catch(() => 'duplicate')
        );
      }

      const results = await Promise.all(promises);
      const successes = results.filter(r => r === 'success');
      const duplicates = results.filter(r => r === 'duplicate');

      // Exactly one should succeed
      expect(successes).to.have.lengthOf(1);
      expect(duplicates).to.have.lengthOf(9);

      // Verify only one document exists
      const count = await db.collection('test').countDocuments({ _id: 'atomic1' });
      expect(count).to.equal(1);
    });
  });

  // ============================================
  // SECTION 20: Type Preservation
  // ============================================

  describe('Type Preservation', function() {
    it('should preserve JavaScript types', async function() {
      const testDoc = {
        _id: 'types1',
        string: 'hello',
        number: 42,
        float: 3.14159,
        boolean: true,
        date: new Date('2024-01-15T12:00:00Z'),
        array: [ 1, 2, 3 ],
        nested: {
          a: 1,
          b: { c: 2 }
        },
        nullValue: null
      };

      await db.collection('test').insertOne(testDoc);
      const doc = await db.collection('test').findOne({ _id: 'types1' });

      expect(typeof doc.string).to.equal('string');
      expect(typeof doc.number).to.equal('number');
      expect(typeof doc.float).to.equal('number');
      expect(typeof doc.boolean).to.equal('boolean');
      expect(doc.date).to.be.instanceOf(Date);
      expect(Array.isArray(doc.array)).to.be.true;
      expect(typeof doc.nested).to.equal('object');
      expect(doc.nullValue).to.be.null;
    });
  });
});
