const t = require('../test-lib/test.js');
const assert = require('assert');
const { klona } = require('klona');

describe('Concurrent Array Joins', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  let apos;

  // EXISTENCE

  it('should be a property of the apos object', async function() {
    apos = await t.create({
      root: module,
      modules: {
        'test-person': {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'person'
          },
          fields: {
            add: {
              hobbies: {
                type: 'array',
                fields: {
                  add: {
                    name: {
                      type: 'string'
                    },
                    _friends: {
                      type: 'relationship',
                      withType: 'test-person'
                      // builders: {
                      //   project: {
                      //     title: 1
                      //   }
                      // }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  it('should be able to retrieve hobbies in parallel with all relationships', async function() {
    const req = apos.task.getReq();
    const hobbyists = [];
    for (let i = 0; (i < 10); i++) {
      hobbyists.push(await apos.person.insert(req, {
        title: `Hobbyist ${i}`,
        visibility: 'public'
      }));
    }
    for (let i = 0; (i < 10); i++) {
      await apos.person.update(req, {
        ...hobbyists[i],
        hobbies: [
          {
            name: `Hobby ${i}`,
            _friends: [
              // Deep clone to avoid infinite recursion during the save
              // operation as 4 points to 5 and vice versa
              klona(hobbyists[9 - i])
            ]
          }
        ]
      });
    }
    const promises = [];
    for (let i = 0; (i < 100); i++) {
      const req = apos.task.getReq();
      promises.push(apos.person.find(req).toArray());
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
        assert(person.hobbies[0]._friends);
        assert(person.hobbies[0]._friends[0]);
        assert.strictEqual(person.hobbies[0]._friends[0].title, `Hobbyist ${9 - i}`);
      }
    }
  });
});
