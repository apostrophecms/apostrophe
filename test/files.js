var assert = require('assert');

var apos;

describe('Files', function() {

  var uploadSource = __dirname + "/data/upload_tests/";
  var uploadTarget = __dirname + "/public/uploads/files/";

  it('should have a files property', function(done) {
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      modules: {
        'apostrophe-express': {
          port: 7938
        }
      },
      afterInit: function(callback) {
        assert(apos.files);
        // In tests this will be the name of the test file,
        // so override that in order to get apostrophe to
        // listen normally and not try to run a task. -Tom
        apos.argv._ = [];
        return callback(null);
      },
      afterListen: function(err) {
        // assert(!err);
        done();
      }
    });
  });

  var request = require('request');
  var fs = require('fs');

  // mock up a request
  function newReq() {
    return {
      res: {
        __: function(x) { return x; }
      },
      browserCall: apos.app.request.browserCall,
      getBrowserCalls: apos.app.request.getBrowserCalls,
      query: {}
    };
  }

  it('should upload a text file using the apos api', function(done) {
    var filename = 'upload_apos_api.txt';

    apos.files.accept(newReq, {
      name: 'upload.txt', 
      path: uploadSource + filename
    }, function(err, info) {
      var t = uploadTarget + info[0]._id + '-' + info[0].name + '.' + info[0].extension;

      assert(err == null);
      assert(fs.existsSync(t));

      done();
    });
  });

  // it('should upload a text file using the express api', function(done) {
  //   var filename = 'upload_express_api.txt';
  //   fs.createReadStream(uploadSource + filename)
  //     .pipe(
  //       request({
  //         method: 'POST',
  //         url: 'http://localhost:7938/modules/apostrophe-files/upload'
  //       }, function(err, response, body) {
  //         done();
  //       })
  //     );
  // });

});