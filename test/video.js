var t = require('../test-lib/test.js');
var assert = require('assert');

var apos;

describe('Video Field', function() {

  after(function(done) {
    return t.destroy(apos, done);
  });

  this.timeout(t.timeout);

  it('should be a property of the apos object', function(done) {

    apos = require('../index.js')({
      root: module,
      shortName: 'test',

      modules: {
        'apostrophe-express': {
          port: 7900
        }
      },
      afterInit: function(callback) {
        assert(apos.videoFields);
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

  it('schema field should accept a valid video', function(done) {
    var req = apos.tasks.getReq();
    var object = {
      url: 'https://www.youtube.com/watch?v=mrVSt0pbo1g&t=38s',
      title: 'Simpsons: The PTA Has Disbanded!',
      thumbnail: 'http://youtube.com/imaginary-thumbnail.png'
    };
    var schema = [
      {
        name: 'video',
        type: 'video'
      }
    ];
    var output = {};
    apos.schemas.convert(
      req,
      schema,
      'form',
      {
        video: object
      },
      output,
      function(err) {
        assert(!err);
        assert(output.video.url === 'https://www.youtube.com/watch?v=mrVSt0pbo1g&t=38s');
        done();
      }
    );
  });

  it('schema field should not panic if video is absent', function(done) {
    var req = apos.tasks.getReq();
    var schema = [
      {
        name: 'video',
        type: 'video'
      }
    ];
    var output = {};
    apos.schemas.convert(
      req,
      schema,
      'form',
      {},
      output,
      function(err) {
        assert(!err);
        assert(!output.video);
        done();
      }
    );
  });

  it('schema field should complain if video is absent and required', function(done) {
    var req = apos.tasks.getReq();
    var schema = [
      {
        name: 'video',
        type: 'video',
        required: true
      }
    ];
    var output = {};
    apos.schemas.convert(
      req,
      schema,
      'form',
      {},
      output,
      function(err) {
        assert(err);
        assert(err === 'video.required');
        assert(!output.video);
        done();
      }
    );
  });

});
