const t = require('../test-lib/test');
const assert = require('assert').strict;

// The `project` query builder accepts field names from the query string.
// Those names must never be able to reach Object.prototype or other
// built-ins, whatever the database adapter (with the SQL adapters of
// db-connect, projections are applied in JavaScript). Run with
// APOS_TEST_DB_PROTOCOL=sqlite or postgres to exercise those adapters.

describe('Project builder security', function() {
  const marker = '__aposProjectPrototypeMarker';
  let apos;
  let jar;

  this.timeout(t.timeout);

  before(async function() {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article'
          }
        }
      }
    });
    await t.createUser(apos, 'contributor');
    jar = await t.loginAs(apos, 'contributor');
    await apos.article.insert(apos.task.getReq(), {
      ...apos.article.newInstance(),
      title: 'Article 1'
    });
  });

  after(async function() {
    await t.destroy(apos);
  });

  beforeEach(function() {
    // eslint-disable-next-line no-extend-native
    Object.defineProperty(Object.prototype, marker, {
      value: 'marker',
      configurable: true,
      writable: true,
      enumerable: false
    });
  });

  // Put Object.prototype back exactly as it was even if the test fails, so
  // that a vulnerable implementation cannot wreck the rest of the test run
  const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
  const { defineProperty } = Object;
  afterEach(function() {
    for (const key of Reflect.ownKeys(descriptors)) {
      defineProperty(Object.prototype, key, descriptors[key]);
    }
    delete Object.prototype[marker];
  });

  it('should launder away projection keys with unsafe path segments', function() {
    const req = apos.task.getReq();
    const query = apos.article.find(req).applyBuildersSafely({
      project: {
        title: '1',
        [`constructor.prototype.${marker}`]: '0',
        '__proto__.polluted': '1',
        'a.prototype.b': '0',
        constructor: '0'
      }
    });
    assert.deepEqual(query.get('project'), { title: true });
  });

  it('should not let a REST projection delete Object.prototype members', async function() {
    const response = await apos.http.get(
      `/api/v1/article?project[constructor.prototype.${marker}]=0&project[constructor.prototype.hasOwnProperty]=0`,
      { jar }
    );
    assert.equal(typeof Object.prototype.hasOwnProperty, 'function');
    assert.equal(({})[marker], 'marker');
    assert.equal(response.results.length, 1);
    assert.equal(response.results[0].title, 'Article 1');
  });
});
