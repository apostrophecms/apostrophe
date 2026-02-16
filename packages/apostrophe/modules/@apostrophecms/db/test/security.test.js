const { expect } = require('chai');

// Security tests for SQL injection prevention
// These tests verify that inputs are properly escaped or rejected as appropriate

const ADAPTER = process.env.ADAPTER || 'mongodb';

describe(`Security Tests (${ADAPTER})`, function() {
  let client;
  let db;

  before(async function() {
    if (ADAPTER === 'mongodb') {
      const mongodb = require('../adapters/mongodb');
      client = await mongodb.connect('mongodb://localhost:27017/dbtest-security');
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
      try {
        await db.collection('sectest').drop();
      } catch (e) {
        // ignore
      }
    }
    if (client) {
      await client.close();
    }
  });

  // These tests only apply to postgres adapter since MongoDB doesn't have SQL
  if (ADAPTER === 'postgres') {
    describe('SQL Injection Prevention', function() {
      describe('Field Names (escaping, not rejection)', function() {
        it('should safely escape field names with single quotes', async function() {
          // Field names with quotes should be escaped, not cause SQL injection
          await db.collection('sectest').insertOne({ _id: 'esc1', "field'test": 'value' });
          const doc = await db.collection('sectest').findOne({ "field'test": 'value' });
          expect(doc).to.exist;
          expect(doc["field'test"]).to.equal('value');
          await db.collection('sectest').deleteOne({ _id: 'esc1' });
        });

        it('should safely escape field names with SQL-like content', async function() {
          // This should NOT execute SQL injection, just be a weird field name
          await db.collection('sectest').insertOne({ _id: 'esc2', 'field; DROP TABLE users;': 'value' });
          const doc = await db.collection('sectest').findOne({ 'field; DROP TABLE users;': 'value' });
          expect(doc).to.exist;
          await db.collection('sectest').deleteOne({ _id: 'esc2' });
        });

        it('should safely handle field names with special characters', async function() {
          await db.collection('sectest').insertOne({ _id: 'esc3', 'field()': 'value', 'field"quote': 'test' });
          const doc = await db.collection('sectest').findOne({ _id: 'esc3' });
          expect(doc).to.exist;
          expect(doc['field()']).to.equal('value');
          expect(doc['field"quote']).to.equal('test');
          await db.collection('sectest').deleteOne({ _id: 'esc3' });
        });

        it('should allow nested field names with dots', async function() {
          await db.collection('sectest').insertOne({ _id: 'sec1', user: { name: 'test' } });
          const doc = await db.collection('sectest').findOne({ 'user.name': 'test' });
          expect(doc).to.exist;
          await db.collection('sectest').deleteOne({ _id: 'sec1' });
        });

        it('should allow field names with hyphens', async function() {
          await db.collection('sectest').insertOne({ _id: 'sec4', 'my-field-name': 'value' });
          const doc = await db.collection('sectest').findOne({ 'my-field-name': 'value' });
          expect(doc).to.exist;
          await db.collection('sectest').deleteOne({ _id: 'sec4' });
        });
      });

      describe('Collection Names', function() {
        it('should reject collection names with SQL injection', async function() {
          try {
            db.collection("test'; DROP TABLE users;--");
            expect.fail('Should have rejected malicious collection name');
          } catch (e) {
            expect(e.message).to.include('Invalid table name');
          }
        });

        it('should reject collection names with double quotes', async function() {
          try {
            db.collection('test"injection');
            expect.fail('Should have rejected malicious collection name');
          } catch (e) {
            expect(e.message).to.include('Invalid table name');
          }
        });

        it('should allow collection names with hyphens (converted to underscores)', async function() {
          const col = db.collection('test-collection');
          expect(col.name).to.equal('test-collection');
          // The internal table name should have underscores and be prefixed with db name
          expect(col._tableName).to.include('test_collection');
        });

        it('should allow standard alphanumeric collection names', async function() {
          const col = db.collection('MyCollection123');
          expect(col.name).to.equal('MyCollection123');
        });
      });

      describe('Index Names', function() {
        beforeEach(async function() {
          try {
            await db.collection('sectest').drop();
          } catch (e) {
            // ignore
          }
          await db.collection('sectest').insertOne({ _id: 'idx1', field: 'value' });
        });

        it('should reject malicious index names', async function() {
          try {
            await db.collection('sectest').createIndex({ field: 1 }, { name: "idx'; DROP TABLE users;--" });
            expect.fail('Should have rejected malicious index name');
          } catch (e) {
            expect(e.message).to.include('Invalid table name');
          }
        });

        it('should allow valid index names', async function() {
          const indexName = await db.collection('sectest').createIndex({ field: 1 }, { name: 'my_custom_index' });
          expect(indexName).to.equal('my_custom_index');
        });
      });

      describe('Operator Values', function() {
        beforeEach(async function() {
          try {
            await db.collection('sectest').drop();
          } catch (e) {
            // ignore
          }
          await db.collection('sectest').insertOne({ _id: 'op1', name: 'test', count: 5 });
        });

        it('should safely handle malicious string values (parameterized)', async function() {
          // This should not cause SQL injection because values are parameterized
          const doc = await db.collection('sectest').findOne({ name: "'; DROP TABLE users;--" });
          expect(doc).to.be.null; // No match, but no error either
        });

        it('should safely handle malicious _id values (parameterized)', async function() {
          const doc = await db.collection('sectest').findOne({ _id: "'; DROP TABLE users;--" });
          expect(doc).to.be.null; // No match, but no error either
        });

        it('should safely handle malicious values in $in operator', async function() {
          const docs = await db.collection('sectest').find({
            name: { $in: ["'; DROP TABLE users;--", "normal"] }
          }).toArray();
          expect(docs).to.have.lengthOf(0);
        });

        it('should safely handle malicious regex patterns', async function() {
          // Regex patterns are parameterized
          const docs = await db.collection('sectest').find({
            name: { $regex: "'; DROP TABLE" }
          }).toArray();
          expect(docs).to.have.lengthOf(0);
        });
      });

      describe('LIMIT and OFFSET Validation', function() {
        beforeEach(async function() {
          try {
            await db.collection('sectest').drop();
          } catch (e) {
            // ignore
          }
          await db.collection('sectest').insertMany([
            { _id: 'lim1', value: 1 },
            { _id: 'lim2', value: 2 },
            { _id: 'lim3', value: 3 }
          ]);
        });

        it('should reject non-integer limit values', async function() {
          try {
            await db.collection('sectest').find({}).limit('1; DROP TABLE users;--').toArray();
            expect.fail('Should have rejected non-integer limit');
          } catch (e) {
            expect(e.message).to.include('must be a non-negative integer');
          }
        });

        it('should reject negative limit values', async function() {
          try {
            await db.collection('sectest').find({}).limit(-1).toArray();
            expect.fail('Should have rejected negative limit');
          } catch (e) {
            expect(e.message).to.include('must be a non-negative integer');
          }
        });

        it('should reject non-integer skip values', async function() {
          try {
            await db.collection('sectest').find({}).skip('1; DROP TABLE users;--').toArray();
            expect.fail('Should have rejected non-integer skip');
          } catch (e) {
            expect(e.message).to.include('must be a non-negative integer');
          }
        });

        it('should allow valid integer limit and skip', async function() {
          const docs = await db.collection('sectest').find({}).skip(1).limit(1).toArray();
          expect(docs).to.have.lengthOf(1);
        });
      });
    });
  }

  // Basic tests that apply to both adapters
  describe('Basic Security', function() {
    it('should prevent duplicate _id atomically', async function() {
      await db.collection('sectest').insertOne({ _id: 'atomic1', value: 1 });

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          db.collection('sectest').insertOne({ _id: 'atomic1', value: i })
            .then(() => 'success')
            .catch(() => 'duplicate')
        );
      }

      const results = await Promise.all(promises);
      const successes = results.filter(r => r === 'success');
      expect(successes).to.have.lengthOf(0); // First insert already succeeded above

      // Only one document should exist
      const count = await db.collection('sectest').countDocuments({ _id: 'atomic1' });
      expect(count).to.equal(1);
    });
  });
});
