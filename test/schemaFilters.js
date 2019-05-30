const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');
// const async = require('async');

let apos;
const cats = [];
const people = [];

describe('Schema Filters', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('test modules exist', async function() {
    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      },
      modules: {
        'apostrophe-express': {
          session: {
            secret: 'xxx'
          },
          port: 7900
        },
        'cats': {
          extend: 'apostrophe-pieces',
          name: 'cat',
          label: 'Cat',
          alias: 'cats',
          addFields: [
            {
              type: 'select',
              name: 'flavor',
              label: 'Flavor',
              choices: [
                {
                  label: 'Grape',
                  value: 'grape'
                },
                {
                  label: 'Cherry',
                  value: 'cherry'
                },
                {
                  label: 'Mint',
                  value: 'mint'
                }
              ]
            }
          ]
        },
        'people': {
          extend: 'apostrophe-pieces',
          name: 'person',
          label: 'Person',
          addFields: [
            {
              name: '_cats',
              type: 'joinByArray',
              idsField: 'catsIds',
              label: 'Cats',
              withType: 'cat'
            },
            {
              name: '_favorite',
              type: 'joinByOne',
              idField: 'favoriteId',
              label: 'Favorite',
              withType: 'cat'
            }
          ],
          alias: 'people'
        }
      }
    });

    assert(apos.schemas);
    assert(apos.cats);
    assert(apos.people);

    let i;

    for (i = 0; (i < 11); i++) {
      cats[i] = {};
      cats[i].type = 'cat';
      cats[i].title = 'Cat ' + i;
      cats[i].i = i;
      cats[i].published = true;
      people[i] = {};
      people[i].type = 'person';
      people[i].title = 'Person ' + i;
      people[i].i = i;
      people[i].published = true;
    }
    cats[0].flavor = 'cherry';
    cats[1].flavor = 'mint';
    cats[4].flavor = 'mint';

    const req = apos.tasks.getReq();

    await purgeCats();
    await insertCats();
    await purgePeople();
    await insertPeople();

    async function purgeCats() {
      return apos.docs.db.remove({ type: 'cat' });
    }

    async function insertCats() {
      for (const cat of cats) {
        await apos.cats.insert(req, cat);
      }
    }

    function purgePeople() {
      return apos.docs.db.remove({ type: 'person' });
    }

    async function insertPeople() {
      for (const person of people) {
        // person 10 has no favorite cat
        if (person.i < 10) {
          person.favoriteId = cats[person.i]._id;
        }
        person.catsIds = [];

        let i;
        // person 10 is allergic to cats
        if (person.i < 10) {
          for (i = 0; (i < person.i); i++) {
            person.catsIds.push(cats[i]._id);
          }
        }
        await apos.people.insert(req, person);
      };
    }
  });

  it('filter for _cats exists', function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);

    assert(cursor._cats);
  });

  it('filter for _cats can select people with a specified cat', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);

    // Four people should have cat 5 (because their i is greater than 5, see
    // the sample data generator above)
    cursor._cats(cats[5]._id);

    const peopleArray = await cursor.toArray();
    assert(peopleArray.length === 4);
  });

  it('filter for _cats can select people with any of three cats via array', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor._cats([ cats[0]._id, cats[1]._id, cats[2]._id ]);

    const peopleArray = await cursor.toArray();
    // Everybody except person 0 has the first cat
    assert(peopleArray.length === 9);
  });

  it('_catsAnd filter can select people with all three cats', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor._catsAnd([ cats[0]._id, cats[1]._id, cats[2]._id ]);

    const people = await cursor.toArray();

    // Only people 3-9 have cat 2
    assert(people.length === 7);
  });

  it('filter for _cats can select sad people with no cat', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor._cats('none');

    const _people = await cursor.toArray();

    // Persons 0 and 10 have no cats
    assert(_people.length === 2);
    const ids = _.map(_people, '_id');
    assert(_.includes(ids, people[0]._id));
    assert(_.includes(ids, people[10]._id));
  });

  it('when not used filter for _cats has no effect', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    const peopleArray = await cursor.toArray();

    assert(peopleArray.length === 11);
  });

  it('can obtain choices for _cats', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    const choiceCats = await cursor.toChoices('_cats');

    // Only the cats that are actually somebody's cat come up
    assert(choiceCats.length === 9);
    assert(choiceCats[0].value);
    assert(choiceCats[0].label);
    assert(choiceCats[0].slug);
  });

  it('filter for cats exists', function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    assert(cursor.cats);
  });

  it('filter for cats can select people with a specified cat (by slug)', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    // Four people should have cat 5 (because their i is greater than 5, see
    // the sample data generator above)
    cursor.cats(cats[5].slug);

    const peopleArray = await cursor.toArray();
    assert(peopleArray.length === 4);
  });

  it('filter for cats can select people with any of three cats via array (by slug)', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);

    cursor.cats([ cats[0].slug, cats[1].slug, cats[2].slug ]);

    const peopleArray = await cursor.toArray();

    // Everybody except person 0 has the first cat
    assert(peopleArray.length === 9);
  });

  it('catsAnd filter can select people with all three cats (by slug)', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor.catsAnd([ cats[0].slug, cats[1].slug, cats[2].slug ]);

    const peopleArray = await cursor.toArray();

    // Only people 3-9 have cat 2
    assert(peopleArray.length === 7);
  });

  it('filter for cats can select sad people with no cat (by slug)', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor.cats('none');
    const _people = await cursor.toArray();

    // Persons 0 and 10 have no cats
    assert(_people.length === 2);
    const ids = _.map(_people, '_id');
    assert(_.includes(ids, people[0]._id));
    assert(_.includes(ids, people[10]._id));
  });

  it('when not used filter for cats (by slug) has no effect', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);

    const peopleArray = await cursor.toArray();

    assert(peopleArray.length === 11);
  });

  it('can obtain choices for cats (by slug)', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);

    const choiceCats = await cursor.toChoices('cats');

    // Only the cats that are actually somebody's cat come up
    assert(choiceCats.length === 9);
    assert(choiceCats[0].value);
    assert(choiceCats[0].label);
    assert(choiceCats[0].value === 'cat-0');
  });

  it('filter for _favorite exists', function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    assert(cursor._favorite);
  });

  it('filter for _favorite can select people with a specified favorite cat', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    // Only one person has each favorite
    cursor._favorite(cats[3]._id);

    const peopleArray = await cursor.toArray();

    assert(peopleArray.length === 1);
    assert(peopleArray[0].i === 3);
  });

  it('filter for _favorite can use array syntax', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor._favorite([ cats[7]._id ]);
    const peopleArray = await cursor.toArray();

    // Only person 0 prefers the first cat
    assert(peopleArray.length === 1);
    assert(peopleArray[0].i === 7);
  });

  it('filter for _favorite can select sad people who dislike cats', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor._favorite('none');
    const peopleArray = await cursor.toArray();

    // Only person 10 has no favorite cat
    assert(peopleArray.length === 1);
    assert(peopleArray[0].i === 10);
  });

  it('when not used filter for _favorite has no effect', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    const peopleArray = await cursor.toArray();

    assert(peopleArray.length === 11);
  });

  it('can obtain choices for _favorite', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    const choiceCats = await cursor.toChoices('_favorite');

    // Only the cats that are actually someone's favorite come up
    assert(choiceCats.length === 10);
    assert(choiceCats[0].value);
    assert(choiceCats[0].label);
    assert(choiceCats[0].slug);
  });

  it('filter for favorite (by slug) exists', function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    assert(cursor._favorite);
  });

  it('filter for favorite can select people with a specified favorite cat (by slug)', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    // Only one person has each favorite
    cursor.favorite(cats[3].slug);
    const peopleArray = await cursor.toArray();

    assert(peopleArray.length === 1);
    assert(peopleArray[0].i === 3);
  });

  it('filter for favorite can select people with a specified favorite cat (by slug) plus a search without a refinalize crash', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    // Only one person has each favorite
    cursor.favorite(cats[3].slug);
    const peopleArray = await cursor.search('person').toArray();

    assert(peopleArray.length === 1);
    assert(peopleArray[0].i === 3);
  });

  it('filter for favorite (by slug) can use array syntax', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor.favorite([ cats[7].slug ]);
    const peopleArray = await cursor.toArray();

    // Only person 0 prefers the first cat
    assert(peopleArray.length === 1);
    assert(peopleArray[0].i === 7);
  });

  it('filter for favorite (by slug) can select sad people who dislike cats', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    cursor.favorite('none');
    const peopleArray = await cursor.toArray();

    // Only person 10 has no favorite cat
    assert(peopleArray.length === 1);
    assert(peopleArray[0].i === 10);
  });

  it('when not used filter for favorite (by slug) has no effect', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    const peopleArray = await cursor.toArray();

    assert(peopleArray.length === 11);
  });

  it('can obtain choices for favorite (by slug)', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.people.find(req);
    const choiceCats = await cursor.toChoices('favorite');

    // Only the cats that are actually someone's favorite come up
    assert(choiceCats.length === 10);
    assert(choiceCats[0].value);
    assert(choiceCats[0].label);
    assert(choiceCats[0].value === 'cat-0');
  });

  it('filter for flavor exists', function() {
    const req = apos.tasks.getReq();
    const cursor = apos.cats.find(req);
    assert(cursor.flavor);
  });

  it('filter for flavor can select cats of a specified flavor', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.cats.find(req);
    cursor.flavor('mint');
    const catsArray = await cursor.toArray();

    assert(catsArray.length === 2);
    assert(_.find(catsArray, { i: 1 }));
    assert(_.find(catsArray, { i: 4 }));
  });

  it('filter for flavor can use array syntax', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.cats.find(req);
    cursor.flavor([ 'mint', 'cherry' ]);
    const catsArray = await cursor.toArray();

    assert(catsArray.length === 3);
    assert(_.find(catsArray, { i: 0 }));
    assert(_.find(catsArray, { i: 1 }));
    assert(_.find(catsArray, { i: 4 }));
  });

  it('when not used filter for flavor has no effect', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.cats.find(req);
    const catsArray = await cursor.toArray();

    assert(catsArray.length === 11);
  });

  it('can obtain choices for flavor', async function() {
    const req = apos.tasks.getReq();
    const cursor = apos.cats.find(req);

    const flavors = await cursor.toChoices('flavor');

    // Only the flavors associated with at least one cat come up, in alpha order
    assert(flavors.length === 2);
    assert(flavors[0].value === 'cherry');
    assert(flavors[0].label === 'Cherry');
    assert(flavors[1].value === 'mint');
    assert(flavors[1].label === 'Mint');
  });
});
