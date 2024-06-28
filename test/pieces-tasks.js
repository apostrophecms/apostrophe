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

  it.only('should generate pieces', async function () {
    const countBefore = await apos.doc.db.find({ type: 'article' }).count();
    const countProduct = await apos.doc.db.find({ type: 'product' }).count();
    const count = await apos.doc.db.find().count();
    // const articles = await apos.doc.db.find({ type: 'article' }).toArray();
    const all = await apos.doc.db.find().toArray();
    console.log(JSON.stringify(all, null, 2), countBefore, countProduct, count);
    assert.equal(countBefore, 0);
    await apos.task.invoke('article:generate', {
      total: 10
    });
    const countAfter = await apos.doc.db.find({ type: 'article' }).count();
    // const articlesAfter = await apos.doc.db.find({ type: 'article' }).toArray();
    // console.log(JSON.stringify(articlesAfter, null, 2));
    assert.equal(countAfter, 20);
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
