const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

describe('Concurrent Array Joins', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  // EXISTENCE

  it('should be a property of the apos object', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7900
        },
        'test-people': {
          extend: 'apostrophe-pieces',
          name: 'test-person',
          alias: 'persons',
          addFields: [
            {
              name: 'hobbies',
              type: 'array',
              schema: [
                {
                  type: 'string',
                  name: 'name'
                },
                {
                  type: 'joinByOne',
                  name: '_friend',
                  withType: 'test-person'
                }
              ]
            }
          ]
        }
      },
      afterInit: function(callback) {
        assert(apos.docs);
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('should be able to retrieve hobbies in parallel with all joins', async function() {
    const req = apos.tasks.getReq();
    const hobbyists = [];
    for (let i = 0; (i < 10); i++) {
      hobbyists.push(await apos.persons.insert(req, {
        title: `Hobbyist ${i}`,
        published: true
      }));
    }
    for (let i = 0; (i < 10); i++) {
      hobbyists[i].hobbies = [
        {
          name: `Hobby ${i}`,
          friendId: hobbyists[9 - i]._id
        }
      ];
      await apos.persons.update(req, hobbyists[i]);
    }
    const promises = [];
    for (let i = 0; (i < 100); i++) {
      promises.push(apos.persons.find(req).toArray());
    }
    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 100);
    for (const result of results) {
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
      result.sort((a, b) => a.title.localeCompare(b.title));
      assert.strictEqual(result.length, 10);
      for (let i = 0; (i < 10); i++) {
        const person = result[i];
        assert.strictEqual(person.title, `Hobbyist ${i}`);
        assert.strictEqual(person.hobbies.length, 1);
        assert.strictEqual(person.hobbies[0].name, `Hobby ${i}`);
        assert(person.hobbies[0]._friend);
        assert.strictEqual(person.hobbies[0]._friend.title, `Hobbyist ${9 - i}`);
      }
    }
  });
});
