const t = require('../test-lib/test.js');
const assert = require('assert/strict');

describe('Search', function () {
  let apos;
  let jar;

  this.timeout(t.timeout);

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        blog: {
          extend: '@apostrophecms/piece-type',
          options: {
            label: 'Blog',
            alias: 'blog',
            perPage: 10
          }
        }
      }
    });
    await t.createAdmin(apos, 'admin', {
      username: 'admin',
      password: 'admin'
    });
    jar = await t.loginAs(apos, 'admin', 'admin');
    await createManyPieces(apos, 20);
  });

  after(async function () {
    await t.destroy(apos);
    apos = null;
  });

  it('should return the same results for same search term (autocomplete)', async function () {
    const searchTerm = 'test';
    const response1 = await apos.http.get(apos.blog.action, {
      qs: {
        autocomplete: searchTerm,
        page: 1
      },
      jar
    });
    const response2 = await apos.http.get(apos.blog.action, {
      qs: {
        autocomplete: searchTerm,
        page: 1
      },
      jar
    });

    assert.equal(response1.results.length, 10);
    assert.deepEqual(response1, response2);
  });

  it('should return the same results for same search term (search)', async function () {
    const searchTerm = 'test';
    const response1 = await apos.http.get(apos.blog.action, {
      qs: {
        search: searchTerm,
        page: 1
      },
      jar
    });
    const response2 = await apos.http.get(apos.blog.action, {
      qs: {
        search: searchTerm,
        page: 1
      },
      jar
    });

    assert.equal(response1.results.length, 10);
    assert.deepEqual(response1, response2);
  });

  it('should not contain duplicates in the results between pages (autocomplete)', async function () {
    const searchTerm = 'test';
    const response1 = await apos.http.get(apos.blog.action, {
      qs: {
        autocomplete: searchTerm,
        page: 1
      },
      jar
    });
    const response2 = await apos.http.get(apos.blog.action, {
      qs: {
        autocomplete: searchTerm,
        page: 2
      },
      jar
    });
    assertNoDuplicates(response1, response2);
  });

  it('should not contain duplicates in the results between pages (search)', async function () {
    const searchTerm = 'test';
    const response1 = await apos.http.get(apos.blog.action, {
      qs: {
        search: searchTerm,
        page: 1
      },
      jar
    });
    const response2 = await apos.http.get(apos.blog.action, {
      qs: {
        search: searchTerm,
        page: 2
      },
      jar
    });
    assertNoDuplicates(response1, response2);
  });
});

function assertNoDuplicates(response1, response2) {
  const results1 = response1.results.map((result) => result._id);
  const results1Unique = new Set(results1);

  const results2 = response2.results.map((result) => result._id);
  const results2Unique = new Set(results2);

  const resultsTotal = results1.length + results2.length;
  const resultsTotalUnique = new Set(
    [ ...results1, ...results2 ]
  );

  const actual = {
    results1: results1.length,
    results2: results2.length,
    total: resultsTotal
  };

  const expected = {
    results1: results1Unique.size,
    results2: results2Unique.size,
    total: resultsTotalUnique.size
  };

  assert.deepEqual(actual, expected);
}

async function createManyPieces(apos, count) {
  const req = apos.task.getReq();
  for (let i = 0; i < count; i++) {
    const piece = {
      title: `Test${i}`,
      type: 'blog',
      slug: `test-${i}`
    };
    await apos.doc.getManager(piece.type).insert(req, piece);
  }
}
