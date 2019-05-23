var t = require('../test-lib/test.js');
var assert = require('assert');
var _ = require('@sailshq/lodash');
var async = require('async');
var Promise = require('bluebird');
var apos;
var cats = [];
var people = [];

describe('Schema Filters', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('test modules exist', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          secret: 'xxx',
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
            },
            {
              type: 'checkboxes',
              name: 'flavors',
              label: 'Flavors',
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
                },
                {
                  label: 'Chocolate',
                  value: 'chocolate'
                }
              ]
            },
            {
              type: 'select',
              name: 'dynamicFlavor',
              label: 'Dynamic Flavor',
              choices: 'getDynamicFlavorChoices'
            },
            {
              type: 'checkboxes',
              name: 'dynamicFlavors',
              label: 'Dynamic Flavors',
              choices: 'getDynamicFlavorChoices'
            }
          ],
          construct: function(self, options) {
            self.getDynamicFlavorChoices = function(req) {
              return Promise.delay(100).then(function() {
                return [
                  {
                    label: 'Dynamic Grape',
                    value: 'dynamic grape'
                  },
                  {
                    label: 'Dynamic Cherry',
                    value: 'dynamic cherry'
                  },
                  {
                    label: 'Dynamic Mint',
                    value: 'dynamic mint'
                  },
                  {
                    label: 'Dynamic Chocolate',
                    value: 'dynamic chocolate'
                  }
                ];
              });
            };
          }
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
      },
      afterInit: function(callback) {
        assert(apos.schemas);
        assert(apos.cats);
        assert(apos.people);
        apos.argv._ = [];
        var i;
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
        cats[0].flavors = [ 'cherry', 'mint' ];
        cats[4].flavors = [ 'chocolate' ];
        cats[1].flavor = 'mint';
        cats[4].flavor = 'mint';
        cats[0].dynamicFlavor = 'dynamic cherry';
        cats[4].dynamicFlavors = [ 'dynamic cherry', 'dynamic chocolate' ];
        var req = apos.tasks.getReq();
        return async.series([
          purgeCats,
          insertCats,
          purgePeople,
          insertPeople
        ], function(err) {
          return callback(err);
        });
        function purgeCats(callback) {
          return apos.docs.db.remove({ type: 'cat' }, callback);
        }
        function insertCats(callback) {
          return async.eachSeries(cats, function(cat, callback) {
            return apos.cats.insert(req, cat, callback);
          }, callback);
        }
        function purgePeople(callback) {
          return apos.docs.db.remove({ type: 'person' }, callback);
        }
        function insertPeople(callback) {
          return async.eachSeries(people, function(person, callback) {
            // person 10 has no favorite cat
            if (person.i < 10) {
              person.favoriteId = cats[person.i]._id;
            }
            person.catsIds = [];
            var i;
            // person 10 is allergic to cats
            if (person.i < 10) {
              for (i = 0; (i < person.i); i++) {
                person.catsIds.push(cats[i]._id);
              }
            }
            return apos.people.insert(req, person, callback);
          }, callback);
        }
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  it('filter for _cats exists', function() {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    assert(cursor._cats);
  });

  it('filter for _cats can select people with a specified cat', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    // Four people should have cat 5 (because their i is greater than 5, see
    // the sample data generator above)
    cursor._cats(cats[5]._id);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 4);
      done();
    });
  });

  it('filter for _cats can select people with any of three cats via array', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor._cats([ cats[0]._id, cats[1]._id, cats[2]._id ]);
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Everybody except person 0 has the first cat
      assert(people.length === 9);
      done();
    });
  });

  it('_catsAnd filter can select people with all three cats', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor._catsAnd([ cats[0]._id, cats[1]._id, cats[2]._id ]);
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only people 3-9 have cat 2
      assert(people.length === 7);
      done();
    });
  });

  it('filter for _cats can select sad people with no cat', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor._cats('none');
    return cursor.toArray(function(err, _people) {
      assert(!err);
      // Persons 0 and 10 have no cats
      assert(_people.length === 2);
      var ids = _.pluck(_people, '_id');
      assert(_.contains(ids, people[0]._id));
      assert(_.contains(ids, people[10]._id));
      done();
    });
  });

  it('when not used filter for _cats has no effect', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 11);
      done();
    });
  });

  it('can obtain choices for _cats', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toChoices('_cats', function(err, cats) {
      assert(!err);
      // Only the cats that are actually somebody's cat come up
      assert(cats.length === 9);
      assert(cats[0].value);
      assert(cats[0].label);
      assert(cats[0].slug);
      done();
    });
  });

  it('filter for cats exists', function() {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    assert(cursor.cats);
  });

  it('filter for cats can select people with a specified cat (by slug)', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    // Four people should have cat 5 (because their i is greater than 5, see
    // the sample data generator above)
    cursor.cats(cats[5].slug);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 4);
      done();
    });
  });

  it('filter for cats can select people with any of three cats via array (by slug)', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor.cats([ cats[0].slug, cats[1].slug, cats[2].slug ]);
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Everybody except person 0 has the first cat
      assert(people.length === 9);
      done();
    });
  });

  it('catsAnd filter can select people with all three cats (by slug)', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor.catsAnd([ cats[0].slug, cats[1].slug, cats[2].slug ]);
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only people 3-9 have cat 2
      assert(people.length === 7);
      done();
    });
  });

  it('filter for cats can select sad people with no cat (by slug)', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor.cats('none');
    return cursor.toArray(function(err, _people) {
      assert(!err);
      // Persons 0 and 10 have no cats
      assert(_people.length === 2);
      var ids = _.pluck(_people, '_id');
      assert(_.contains(ids, people[0]._id));
      assert(_.contains(ids, people[10]._id));
      done();
    });
  });

  it('when not used filter for cats (by slug) has no effect', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 11);
      done();
    });
  });

  it('can obtain choices for cats (by slug)', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toChoices('cats', function(err, cats) {
      assert(!err);
      // Only the cats that are actually somebody's cat come up
      assert(cats.length === 9);
      assert(cats[0].value);
      assert(cats[0].label);
      assert(cats[0].value === 'cat-0');
      done();
    });
  });

  it('filter for _favorite exists', function() {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    assert(cursor._favorite);
  });

  it('filter for _favorite can select people with a specified favorite cat', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    // Only one person has each favorite
    cursor._favorite(cats[3]._id);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 1);
      assert(people[0].i === 3);
      done();
    });
  });

  it('filter for _favorite can use array syntax', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor._favorite([ cats[7]._id ]);
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only person 0 prefers the first cat
      assert(people.length === 1);
      assert(people[0].i === 7);
      done();
    });
  });

  it('filter for _favorite can select sad people who dislike cats', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor._favorite('none');
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only person 10 has no favorite cat
      assert(people.length === 1);
      assert(people[0].i === 10);
      done();
    });
  });

  it('when not used filter for _favorite has no effect', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 11);
      done();
    });
  });

  it('can obtain choices for _favorite', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toChoices('_favorite', function(err, cats) {
      assert(!err);
      // Only the cats that are actually someone's favorite come up
      assert(cats.length === 10);
      assert(cats[0].value);
      assert(cats[0].label);
      assert(cats[0].slug);
      done();
    });
  });

  it('filter for favorite (by slug) exists', function() {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    assert(cursor._favorite);
  });

  it('filter for favorite can select people with a specified favorite cat (by slug)', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    // Only one person has each favorite
    cursor.favorite(cats[3].slug);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 1);
      assert(people[0].i === 3);
      done();
    });
  });

  it('filter for favorite can select people with a specified favorite cat (by slug) plus a search without a refinalize crash', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    // Only one person has each favorite
    cursor.favorite(cats[3].slug);
    return cursor.search('person').toArray(function(err, people) {
      assert(!err);
      assert(people.length === 1);
      assert(people[0].i === 3);
      done();
    });
  });

  it('filter for favorite (by slug) can use array syntax', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor.favorite([ cats[7].slug ]);
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only person 0 prefers the first cat
      assert(people.length === 1);
      assert(people[0].i === 7);
      done();
    });
  });

  it('filter for favorite (by slug) can select sad people who dislike cats', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    cursor.favorite('none');
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only person 10 has no favorite cat
      assert(people.length === 1);
      assert(people[0].i === 10);
      done();
    });
  });

  it('when not used filter for favorite (by slug) has no effect', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 11);
      done();
    });
  });

  it('can obtain choices for favorite (by slug)', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.people.find(req);
    return cursor.toChoices('favorite', function(err, cats) {
      assert(!err);
      // Only the cats that are actually someone's favorite come up
      assert(cats.length === 10);
      assert(cats[0].value);
      assert(cats[0].label);
      assert(cats[0].value === 'cat-0');
      done();
    });
  });

  it('filter for flavor exists', function() {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    assert(cursor.flavor);
  });

  it('filter for flavor can select cats of a specified flavor', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    cursor.flavor('mint');
    return cursor.toArray(function(err, cats) {
      assert(!err);
      assert(cats.length === 2);
      assert(_.find(cats, { i: 1 }));
      assert(_.find(cats, { i: 4 }));
      done();
    });
  });

  it('filter for flavor can use array syntax', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    cursor.flavor([ 'mint', 'cherry' ]);
    return cursor.toArray(function(err, cats) {
      assert(!err);
      assert(cats.length === 3);
      assert(_.find(cats, { i: 0 }));
      assert(_.find(cats, { i: 1 }));
      assert(_.find(cats, { i: 4 }));
      done();
    });
  });

  it('when not used filter for flavor has no effect', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(cats.length === 11);
      done();
    });
  });

  it('can obtain choices for flavor', function(done) {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    return cursor.toChoices('flavor', function(err, flavors) {
      assert(!err);
      // Only the flavor choices associated with at least one cat come up, in alpha order
      assert(flavors.length === 2);
      assert(flavors[0].value === 'cherry');
      assert(flavors[0].label === 'Cherry');
      assert(flavors[1].value === 'mint');
      assert(flavors[1].label === 'Mint');
      done();
    });
  });

  it('can obtain choices for flavors', function (done) {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    return cursor.toChoices('flavors', function (err, flavors) {
      assert(!err);
      // Only the flavors choices associated with at least one cat come up, in alpha order
      assert(flavors.length === 3);
      assert(flavors[0].value === 'cherry');
      assert(flavors[0].label === 'Cherry');
      assert(flavors[1].value === 'chocolate');
      assert(flavors[1].label === 'Chocolate');
      assert(flavors[2].value === 'mint');
      assert(flavors[2].label === 'Mint');
      done();
    });
  });

  it('can obtain choices for dynamicFlavor', function (done) {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    return cursor.toChoices('dynamicFlavor', function (err, flavors) {
      assert(!err);
      // Only the dynamicFlavor choices associated with at least one cat come up, in alpha order
      assert(flavors.length === 1);
      assert(flavors[0].value === 'dynamic cherry');
      assert(flavors[0].label === 'Dynamic Cherry');
      done();
    });
  });

  it('can obtain choices for dynamicFlavors', function (done) {
    var req = apos.tasks.getReq();
    var cursor = apos.cats.find(req);
    return cursor.toChoices('dynamicFlavors', function (err, flavors) {
      assert(!err);
      // Only the dynamicFlavors choices associated with at least one cat come up, in alpha order
      assert(flavors.length === 2);
      assert(flavors[0].value === 'dynamic cherry');
      assert(flavors[0].label === 'Dynamic Cherry');
      assert(flavors[1].value === 'dynamic chocolate');
      assert(flavors[1].label === 'Dynamic Chocolate');
      done();
    });
  });
});
