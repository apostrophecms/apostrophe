const t = require('../test-lib/test.js');
const assert = require('assert');
const _ = require('lodash');

let apos;
const cats = [];
const people = [];

describe('Schema builders', function() {

  this.timeout(t.timeout);

  after(async () => {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('test modules exist', async () => {
    apos = await t.create({
      root: module,
      modules: {
        cats: {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              flavor: {
                type: 'select',
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
            }
          },
          options: {
            name: 'cat',
            label: 'Cat',
            alias: 'cats'
          }
        },
        people: {
          extend: '@apostrophecms/piece-type',
          options: {
            name: 'person',
            label: 'Person',
            alias: 'people'
          },
          fields: {
            add: {
              _cats: {
                type: 'join',
                idsField: 'catsIds',
                label: 'Cats',
                withType: 'cat'
              },
              _favorites: {
                type: 'join',
                max: 1,
                idsField: 'favoriteIds',
                label: 'Favorites',
                withType: 'cat'
              }
            }
          }
        }
      }
    });
    assert(apos.schema);
    assert(apos.cats);
    assert(apos.people);
    apos.argv._ = [];
    let i;
    for (i = 0; (i < 11); i++) {
      cats[i] = {};
      cats[i].title = 'Cat ' + i;
      cats[i].i = i;
      cats[i].published = true;
      people[i] = {};
      people[i].title = 'Person ' + i;
      people[i].i = i;
      people[i].published = true;
    }
    cats[0].flavor = 'cherry';
    cats[1].flavor = 'mint';
    cats[4].flavor = 'mint';
    const req = apos.task.getReq();
    await apos.doc.db.deleteMany({ type: 'cat' });
    for (const cat of cats) {
      await apos.cats.insert(req, cat);
    }
    for (const person of people) {
      // person 10 has no favorite cat
      if (person.i < 10) {
        person.favoriteIds = [ cats[person.i]._id ];
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
    }
  });

  it('builder for _cats exists', async () => {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    assert(query._cats);
  });

  it('builder for _cats can select people with a specified cat', async () => {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    // Four people should have cat 5 (because their i is greater than 5, see
    // the sample data generator above)
    query._cats(cats[5]._id);
    const people = await query.toArray();
    assert(people.length === 4);
  });

  it('builder for _cats can select people with any of three cats via array', async () => {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query._cats([ cats[0]._id, cats[1]._id, cats[2]._id ]);
    const people = await query.toArray();
    // Everybody except person 0 has the first cat
    assert(people.length === 9);
  });

  it('_catsAnd builder can select people with all three cats', async () => {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query._catsAnd([ cats[0]._id, cats[1]._id, cats[2]._id ]);
    const people = await query.toArray();
    // Only people 3-9 have cat 2
    assert(people.length === 7);
  });

  it('builder for _cats can select sad people with no cat', async () => {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query._cats('none');
    const _people = await query.toArray();
    // Persons 0 and 10 have no cats
    assert(_people.length === 2);
    const ids = _.map(_people, '_id');
    assert(_.includes(ids, people[0]._id));
    assert(_.includes(ids, people[10]._id));
  });

  it('when not used builder for _cats has no effect', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const people = await query.toArray();
    assert(people.length === 11);
  });

  it('can obtain choices for _cats', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const cats = await query.toChoices('_cats');
    // Only the cats that are actually somebody's cat come up
    assert(cats.length === 9);
    assert(cats[0].value);
    assert(cats[0].label);
    assert(cats[0].slug);
  });

  it('builder for cats exists', function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    assert(query.cats);
  });

  it('builder for cats can select people with a specified cat (by slug)', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    // Four people should have cat 5 (because their i is greater than 5, see
    // the sample data generator above)
    query.cats(cats[5].slug);
    const people = await query.toArray();
    assert(people.length === 4);
  });

  it('builder for cats can select people with any of three cats via array (by slug)', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query.cats([ cats[0].slug, cats[1].slug, cats[2].slug ]);
    const people = await query.toArray();
    // Everybody except person 0 has the first cat
    assert(people.length === 9);
  });

  it('catsAnd builder can select people with all three cats (by slug)', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query.catsAnd([ cats[0].slug, cats[1].slug, cats[2].slug ]);
    const people = await query.toArray();
    // Only people 3-9 have cat 2
    assert(people.length === 7);
  });

  it('builder for cats can select sad people with no cat (by slug)', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query.cats('none');
    const _people = await query.toArray();
    // Persons 0 and 10 have no cats
    assert(_people.length === 2);
    const ids = _.map(_people, '_id');
    assert(_.includes(ids, people[0]._id));
    assert(_.includes(ids, people[10]._id));
  });

  it('when not used builder for cats (by slug) has no effect', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const people = await query.toArray();
    assert(people.length === 11);
  });

  it('can obtain choices for cats (by slug)', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const cats = await query.toChoices('cats');
    // Only the cats that are actually somebody's cat come up
    assert(cats.length === 9);
    assert(cats[0].value);
    assert(cats[0].label);
    assert(cats[0].value === 'cat-0');
  });

  it('builder for _favorites exists', function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    assert(query._favorites);
  });

  it('builder for _favorites can select people with a specified favorite cat', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    // Only one person has each favorite
    query._favorites(cats[3]._id);
    const people = await query.toArray();
    assert(people.length === 1);
    assert(people[0].i === 3);
  });

  it('builder for _favorites can use array syntax', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query._favorites([ cats[7]._id ]);
    const people = await query.toArray();
    // Only person 0 prefers the first cat
    assert(people.length === 1);
    assert(people[0].i === 7);
  });

  it('builder for _favorites can select sad people who dislike cats', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query._favorites('none');
    const people = await query.toArray();
    // Only person 10 has no favorite cat
    assert(people.length === 1);
    assert(people[0].i === 10);
  });

  it('when not used builder for _favorites has no effect', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const people = await query.toArray();
    assert(people.length === 11);
  });

  it('can obtain choices for _favorites', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const cats = await query.toChoices('_favorites');
    // Only the cats that are actually someone's favorite come up
    assert(cats.length === 10);
    assert(cats[0].value);
    assert(cats[0].label);
    assert(cats[0].slug);
  });

  it('builder for favorite (by slug) exists', function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    assert(query._favorites);
  });

  it('builder for favorite can select people with a specified favorite cat (by slug)', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    // Only one person has each favorite
    query.favorites(cats[3].slug);
    const people = await query.toArray();
    assert(people.length === 1);
    assert(people[0].i === 3);
  });

  it('builder for favorite can select people with a specified favorite cat (by slug) plus a search without a refinalize crash', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    // Only one person has each favorite
    query.favorites(cats[3].slug);
    const people = await query.search('person').toArray();
    assert(people.length === 1);
    assert(people[0].i === 3);
  });

  it('builder for favorite (by slug) can use array syntax', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query.favorites([ cats[7].slug ]);
    const people = await query.toArray();
    // Only person 0 prefers the first cat
    assert(people.length === 1);
    assert(people[0].i === 7);
  });

  it('builder for favorite (by slug) can select sad people who dislike cats', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    query.favorites('none');
    const people = await query.toArray();
    // Only person 10 has no favorite cat
    assert(people.length === 1);
    assert(people[0].i === 10);
  });

  it('when not used builder for favorite (by slug) has no effect', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const people = await query.toArray();
    assert(people.length === 11);
  });

  it('can obtain choices for favorite (by slug)', async function() {
    const req = apos.task.getReq();
    const query = apos.people.find(req);
    const cats = await query.toChoices('favorites');
    // Only the cats that are actually someone's favorite come up
    assert(cats.length === 10);
    assert(cats[0].value);
    assert(cats[0].label);
    assert(cats[0].value === 'cat-0');
  });

  it('builder for flavor exists', function() {
    const req = apos.task.getReq();
    const query = apos.cats.find(req);
    assert(query.flavor);
  });

  it('builder for flavor can select cats of a specified flavor', async function() {
    const req = apos.task.getReq();
    const query = apos.cats.find(req);
    query.flavor('mint');
    const cats = await query.toArray();
    assert(cats.length === 2);
    assert(_.find(cats, { i: 1 }));
    assert(_.find(cats, { i: 4 }));
  });

  it('builder for flavor can use array syntax', async function() {
    const req = apos.task.getReq();
    const query = apos.cats.find(req);
    query.flavor([ 'mint', 'cherry' ]);
    const cats = await query.toArray();
    assert(cats.length === 3);
    assert(_.find(cats, { i: 0 }));
    assert(_.find(cats, { i: 1 }));
    assert(_.find(cats, { i: 4 }));
  });

  it('when not used builder for flavor has no effect', async function() {
    const req = apos.task.getReq();
    const query = apos.cats.find(req);
    const cats = await query.toArray();
    assert(cats.length === 11);
  });

  it('can obtain choices for flavor', async function() {
    const req = apos.task.getReq();
    const query = apos.cats.find(req);
    const flavors = await query.toChoices('flavor');
    // Only the flavors associated with at least one cat come up, in alpha order
    assert(flavors.length === 2);
    assert(flavors[0].value === 'cherry');
    assert(flavors[0].label === 'Cherry');
    assert(flavors[1].value === 'mint');
    assert(flavors[1].label === 'Mint');
  });
});
