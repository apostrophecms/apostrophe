var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var t = require('./testUtils');

var apos;
var cats = [], people = [];

describe('Schema Filters', function() {

  this.timeout(5000);

  //////
  // EXISTENCE
  //////

  it('test modules exist', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          secret: 'xxx',
          port: 7956
        },
        'cats': {
          extend: 'apostrophe-pieces',
          name: 'cat',
          label: 'Cat',
          alias: 'cats'
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
        var req = t.req.admin(apos);
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
        done();
      }
    });
  });

  it('filter for _cats exists', function() {
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    assert(cursor._cats);
  });

  it('filter for _cats can select people with a specified cat', function(done) {
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    cursor._cats([ cats[0]._id, cats[1]._id, cats[2]._id ]);
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Everybody except person 0 has the first cat
      assert(people.length === 9);
      done();
    });
  });

  it('filter for _cats can select people with any of three cats via "or"', function(done) {
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    cursor._cats({ rule: 'or', ids: [ cats[0]._id, cats[1]._id, cats[2]._id ] });
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Everybody except person 0 has the first cat
      assert(people.length === 9);
      done();
    });
  });

  it('filter for _cats can select people with all of three cats via "and"', function(done) {
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    cursor._cats({ rule: 'and', ids: [ cats[0]._id, cats[1]._id, cats[2]._id ] });
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only people 3-9 have cat 2
      assert(people.length === 7);
      done();
    });
  });

  it('filter for _cats can select sad people with no cat', function(done) {
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 11);
      done();
    });
  });

  it('filter for _favorite exists', function() {
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    assert(cursor._favorite);
  });

  it('filter for _favorite can select people with a specified favorite cat', function(done) {
    var req = t.req.admin(apos);
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

  it('filter for _favorite can use "and" syntax (although that is silly)', function(done) {
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    cursor._favorite({ rule: 'and', ids: [ cats[0]._id ] });
    return cursor.toArray(function(err, people) {
      assert(!err);
      // Only person 0 prefers the first cat
      assert(people.length === 1);
      assert(people[0].i === 0);
      done();
    });
  });

  it('filter for _favorite can use array syntax', function(done) {
    var req = t.req.admin(apos);
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

  it('filter for _favorite can use "or" syntax', function(done) {
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    cursor._favorite({ rule: 'or', ids: [ cats[0]._id, cats[1]._id, cats[2]._id ] });
    return cursor.toArray(function(err, people) {
      assert(!err);
      // There should be as many people preferring these cats as there are cats
      assert(people.length === 3);
      done();
    });
  });

  it('filter for _favorite can select sad people who dislike cats', function(done) {
    var req = t.req.admin(apos);
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
    var req = t.req.admin(apos);
    var cursor = apos.people.find(req);
    return cursor.toArray(function(err, people) {
      assert(!err);
      assert(people.length === 11);
      done();
    });
  });

});
