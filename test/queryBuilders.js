const t = require('../test-lib/test.js');
const assert = require('assert');

describe('Query Builders', function() {
  this.timeout(t.timeout);

  let apos;
  after(function() {
    return t.destroy(apos);
  });

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        young: {
          options: {
            alias: 'young'
          },
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              age: {
                label: 'Age',
                type: 'integer',
                required: true
              }
            }
          },
          queries(self, query) {
            return {
              builders: {
                age: {
                  launder(str) {
                    return [ 'children', 'adult' ].includes(str) ? str : null;
                  },
                  finalize() {
                    const age = query.get('age');

                    if ([ 'children', 'adults' ].includes(age)) {
                      const ageCriteria = age === 'children' ? { $lte: 18 } : { $gt: 18 };
                      query.and({ age: ageCriteria });
                    }
                  }
                }
              },
              methods: {
                async sortByAge() {
                  await query.finalize();

                  const pipeline = [
                    { $match: query.get('criteria') },
                    { $sort: { age: 1 } }
                  ];

                  const results = await self.apos.doc.db.aggregate(pipeline).toArray();

                  return results;
                }
              }
            };
          }
        },
        person: {
          extend: 'young',
          options: {
            alias: 'person'
          },
          extendQueries(self, query) {
            return {
              builders: {
                age: {
                  def: 'adult',
                  launder(_super, val) {
                    const laundered = _super();

                    if (laundered !== null) {
                      return laundered;
                    }

                    return val === 'senior' ? val : null;
                  },
                  async finalize(_super) {
                    await _super();

                    const age = query.get('age');

                    if (age === 'seniors') {
                      query.and({ age: { $gt: 60 } });
                    }
                  }
                }
              },
              methods: {
                async sortByAge(_super) {
                  assert(typeof _super === 'function');

                  await query.finalize();

                  const pipeline = [
                    { $match: query.get('criteria') },
                    { $sort: { age: -1 } }
                  ];

                  const results = await self.apos.doc.db.aggregate(pipeline).toArray();

                  return results;
                }
              }
            };
          }
        }
      }
    });
  });

  it('should insert person pieces and verify age query builder is working', async function() {
    const req = apos.task.getReq();
    const persons = getPersons(apos.young);
    const { insertedCount } = await apos.doc.db.insertMany(persons);

    assert(insertedCount === 6);

    const children = await apos.young.find(req).age('children').toArray();
    const adults = await apos.young.find(req).age('adults').toArray();

    assert(children.length === 2);
    children.forEach((child) => {
      assert(child.age <= 18);
    });

    assert(adults.length === 4);
    adults.forEach((adult) => {
      assert(adult.age > 18);
    });
  });

  it('should insert seniors and verify the query builders have been properly extended', async function() {
    const req = apos.task.getReq();
    const persons = getPersons(apos.person, true);
    const { insertedCount } = await apos.doc.db.insertMany(persons);

    assert(insertedCount === 8);

    const children = await apos.person.find(req).age('children').toArray();
    const adults = await apos.person.find(req).age('adults').toArray();
    const seniors = await apos.person.find(req).age('seniors').toArray();

    assert(children.length === 2);
    children.forEach((child) => {
      assert(child.age <= 18);
    });

    assert(adults.length === 6);
    adults.forEach((adult) => {
      assert(adult.age > 18);
    });

    assert(seniors.length === 2);
    seniors.forEach((senior) => {
      assert(senior.age > 60);
    });
  });

  it('should verify that query methods work and can be extende', async function() {
    const req = apos.task.getReq();
    const youngSorted = await apos.young.find(req).age('adults').sortByAge();
    assert(youngSorted[0].age === 25);
    assert(youngSorted[1].age === 32);
    assert(youngSorted[2].age === 50);
    assert(youngSorted[3].age === 58);

    const personsSorted = await apos.person.find(req).age('adults').sortByAge();
    assert(personsSorted[0].age === 80);
    assert(personsSorted[1].age === 72);
    assert(personsSorted[2].age === 58);
    assert(personsSorted[3].age === 50);
    assert(personsSorted[4].age === 32);
  });
});

function getPersons(instance, withSeniors = false) {
  const moduleName = instance.__meta.name;
  return [
    {
      title: 'Jean',
      age: 32
    },
    {
      title: 'Julie',
      age: 25
    },
    {
      title: 'Victor',
      age: 14
    },
    {
      title: 'Marc',
      age: 58
    },
    {
      title: 'Hector',
      age: 7
    },
    {
      title: 'Marie',
      age: 50
    },
    ...withSeniors ? [
      {
        title: 'Jules',
        age: 72
      },
      {
        title: 'Renée',
        age: 80
      }
    ] : []
  ].map((p, i) => ({
    _id: `${moduleName}${i}`,
    ...instance.newInstance(),
    slug: `${moduleName}-${p.title.toLowerCase()}`,
    ...p
  }));
}
