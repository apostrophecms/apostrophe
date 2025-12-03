const assert = require('assert').strict;
const t = require('../test-lib/test.js');

describe('Pieces - tasks', function() {
  this.timeout(t.timeout);
  let apos;

  before(async function () {
    apos = await t.create({
      root: module,
      modules: {
        article: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'article',
            name: 'article',
            label: 'Article'
          }
        }
      }
    });
  });

  beforeEach(async function () {
    await apos.doc.db.deleteMany({ type: 'article' });
  });

  after(function () {
    return t.destroy(apos);
  });

  it('should generate pieces', async function () {
    const before = await apos.doc.db.find({ type: 'article' }).count();
    assert.equal(before, 0);
    await apos.task.invoke('article:generate', {
      total: 10
    });
    const after = await apos.doc.db.find({ type: 'article' }).count();
    assert.equal(after, 20);
  });

  it('should touch pieces', async function () {
    await apos.task.invoke('article:generate', {
      total: 10
    });
    const docs = await apos.doc.db.find({ type: 'article' }).toArray();
    assert.equal(docs.length, 20);

    const result = await apos.task.invoke('article:touch');
    assert.equal(result.touched, 20);
    assert.equal(result.errors, 0);

    const touched = await apos.doc.db.find({ type: 'article' }).toArray();
    assert.equal(touched.length, 20);

    for (const doc of touched) {
      const old = docs.find(d => d._id === doc._id);
      assert(old);
      assert(old.updatedAt);
      assert(doc.updatedAt);
      assert.equal(
        new Date(doc.updatedAt) > new Date(old.updatedAt),
        true
      );
    }
  });

  it('should touch pieces with autopublish enabled', async function () {
    apos.article.options.autopublish = true;
    await apos.task.invoke('article:generate', {
      total: 10
    });
    const docs = await apos.doc.db.find({ type: 'article' }).toArray();
    assert.equal(docs.length, 30);

    const result = await apos.task.invoke('article:touch');
    assert.equal(result.touched, 10);
    assert.equal(result.errors, 0);

    const touched = await apos.doc.db.find({ type: 'article' }).toArray();
    assert.equal(touched.length, 30);

    for (const doc of touched) {
      const old = docs.find(d => d._id === doc._id);
      assert(old);
      assert(old.updatedAt);
      assert(doc.updatedAt);
      assert.equal(
        new Date(doc.updatedAt) > new Date(old.updatedAt),
        true
      );
    }
  });
});
