
var t = require('../test-lib/test.js');
var assert = require('assert');
var async = require('async');

var apos;

var mockImages = [
  {
    type: 'apostrophe-image',
    slug: 'image-1',
    published: true,
    attachment: {
      extension: 'jpg',
      width: 500,
      height: 400
    }
  },
  {
    type: 'apostrophe-image',
    slug: 'image-2',
    published: true,
    attachment: {
      extension: 'jpg',
      width: 500,
      height: 400
    }
  },
  {
    type: 'apostrophe-image',
    slug: 'image-3',
    published: true,
    attachment: {
      extension: 'jpg',
      width: 150,
      height: 150
    }
  },
  {
    type: 'apostrophe-image',
    slug: 'image-4',
    published: true,
    attachment: {
      extension: 'svg'
    }
  }
];

describe('Images', function() {

  this.timeout(t.timeout);

  after(function(done) {
    return t.destroy(apos, done);
  });

  it('should be a property of the apos object', function(done) {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      modules: {
        'apostrophe-express': {
          port: 7900
        }
      },
      afterInit: function(callback) {
        assert(apos.images);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        assert(!err);
        done();
      }
    });
  });

  // Test pieces.list()
  it('should clean up any existing images for testing', function(done) {
    // Newer mongo returns a promise from remove even if there's a callback,
    // which in turn confuses mocha if we use a return statement here. So don't. -Tom
    apos.docs.db.remove({ type: 'apostrophe-image' }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should add images for testing', function(done) {
    assert(apos.images.insert);
    return async.each(mockImages, function(image, callback) {
      return apos.images.insert(apos.tasks.getReq(), image, callback);
    }, function(err) {
      assert(!err);
      done();
    });
  });

  it('should respect minSize filter (svg is always OK)', function(done) {
    var req = apos.tasks.getAnonReq();
    return apos.images.find(req).minSize([ 200, 200 ]).toArray(function(err, images) {
      assert(!err);
      assert(images.length === 3);
      return done();
    });
  });

  it('should respect minSize filter in toCount, which uses a cloned cursor', function(done) {
    var req = apos.tasks.getAnonReq();
    return apos.images.find(req).minSize([ 200, 200 ]).toCount(function(err, count) {
      assert(!err);
      assert(count === 3);
      return done();
    });
  });

  it('should generate a srcset string for an image', function() {
    var srcset = apos.images.srcset({
      name: 'test',
      _id: 'test',
      extension: 'jpg',
      width: 1200,
      height: 800
    });
    assert.equal(srcset, ['/uploads/attachments/test-test.max.jpg 1200w',
      '/uploads/attachments/test-test.full.jpg 1140w',
      '/uploads/attachments/test-test.two-thirds.jpg 760w',
      '/uploads/attachments/test-test.one-half.jpg 570w',
      '/uploads/attachments/test-test.one-third.jpg 380w',
      '/uploads/attachments/test-test.one-sixth.jpg 190w'].join(', '));
  });

  it('should not generate a srcset string for an SVG image', function() {
    var srcset = apos.images.srcset({
      name: 'test',
      _id: 'test',
      extension: 'svg',
      width: 1200,
      height: 800
    });
    assert.equal(srcset, '');
  });
});
