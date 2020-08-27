const t = require('../test-lib/test.js');
const assert = require('assert');
let apos;

const mockImages = [
  {
    type: '@apostrophecms/image',
    slug: 'image-1',
    published: true,
    attachment: {
      extension: 'jpg',
      width: 500,
      height: 400
    }
  },
  {
    type: '@apostrophecms/image',
    slug: 'image-2',
    published: true,
    attachment: {
      extension: 'jpg',
      width: 500,
      height: 400
    }
  },
  {
    type: '@apostrophecms/image',
    slug: 'image-3',
    published: true,
    attachment: {
      extension: 'jpg',
      width: 150,
      height: 150
    }
  },
  {
    type: '@apostrophecms/image',
    slug: 'image-4',
    published: true,
    attachment: {
      extension: 'svg'
    }
  }
];

describe('Images', function() {

  this.timeout(t.timeout);

  after(function() {
    return t.destroy(apos);
  });

  it('should be a property of the apos object', async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await t.create({
      root: module
    });

    assert(apos.image);
    assert(apos.image.__meta.name === '@apostrophecms/image');
  });

  // Test pieces.list()
  it('should clean up any existing images for testing', async function() {
    try {
      const response = await apos.doc.db.deleteMany({ type: '@apostrophecms/image' }
      );
      assert(response.result.ok === 1);
    } catch (e) {
      assert(false);
    }
  });

  it('should add images for testing', async function() {
    assert(apos.image.insert);

    const req = apos.task.getReq();

    const insertPromises = mockImages.map(async (image) => {
      return apos.image.insert(req, image);
    });

    const inserted = await Promise.all(insertPromises);

    assert(inserted.length === mockImages.length);
    assert(inserted[0]._id);
  });

  it('should respect minSize filter (svg is always OK)', async function() {
    const req = apos.task.getAnonReq();
    const images = await apos.image.find(req).minSize([ 200, 200 ]).toArray();

    assert(images.length === 3);
  });

  it('should respect minSize filter in toCount, which uses a cloned cursor', async function() {
    const req = apos.task.getAnonReq();
    const count = await apos.image.find(req).minSize([ 200, 200 ]).toCount();

    assert(count === 3);
  });

  it('should generate a srcset string for an image', function() {
    const srcset = apos.image.srcset({
      name: 'test',
      _id: 'test',
      extension: 'jpg',
      width: 1200,
      height: 800
    });

    assert.strictEqual(srcset, [ '/uploads/attachments/test-test.max.jpg 1200w',
      '/uploads/attachments/test-test.full.jpg 1140w',
      '/uploads/attachments/test-test.two-thirds.jpg 760w',
      '/uploads/attachments/test-test.one-half.jpg 570w',
      '/uploads/attachments/test-test.one-third.jpg 380w',
      '/uploads/attachments/test-test.one-sixth.jpg 190w' ].join(', '));
  });

  it('should not generate a srcset string for an SVG image', function() {
    const srcset = apos.image.srcset({
      name: 'test',
      _id: 'test',
      extension: 'svg',
      width: 1200,
      height: 800
    });

    assert.strictEqual(srcset, '');
  });
});
