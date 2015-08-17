
var assert = require('assert');
var _ = require('lodash');

var apos;

describe('Attachment', function() {

  var uploadSource = __dirname + "/data/upload_tests/";
  var uploadTarget = __dirname + "/public/uploads/attachments/";
  var collectionName = 'aposAttachments';

  function wipeIt() {
    apos.db.collection(collectionName).drop();
    deleteFolderRecursive(__dirname + '/public/uploads');

    function deleteFolderRecursive (path) {
      var files = [];
      if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
          var curPath = path + "/" + file;
          if(fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
          } else { // delete file
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(path);
      }
    }
  }

  // after(wipeIt);

  it('should be a property of the apos object', function(done) {
    this.timeout(5000);
    this.slow(2000);

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
        assert(apos.attachments);
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
  function anonReq() {
    return {
      res: {
        __: function(x) { return x; }
      },
      browserCall: apos.app.request.browserCall,
      getBrowserCalls: apos.app.request.getBrowserCalls,
      query: {}
    };
  }

  function adminReq() {
    return _.merge(anonReq(), {
      user: {
        _id: 'testfileuser',
        _permissions: {
          admin: true
        }
      }
    });
  }

  describe('accept', function() {
    before(function() {
      wipeIt();
    });

    function accept(filename, callback) {
      return apos.attachments.accept(adminReq(), {
        name: filename,
        path: uploadSource + filename
      }, function(err, info) {
        assert(!err);
        var t = uploadTarget + info._id + '-' + info.name + '.' + info.extension;
        // file should be uploaded
        assert(fs.existsSync(t));

        // make sure it exists in mongo
        apos.db.collection(collectionName).findOne({
          _id: info._id
        }, function(err, result) {
          assert(!err);
          assert(result);

          return callback(result);
        });
      });
    }

    it('should upload a text file using the attachments api when user', function(done) {
      return accept('upload_apos_api.txt', function(result) {
        done();
      });
    });

    it('should upload an image file using the attachments api when user', function(done) {
      return accept('upload_image.png', function(result) {
        done();
      });
    });

    it('should not upload an exe file', function(done) {
      var filename = 'bad_file.exe';

      return apos.attachments.accept(adminReq(), {
        name: filename,
        path: uploadSource + filename
      }, function(err, info) {
        assert(err);
        assert(!info);
        done();
      });
    });

    it('should crop an image file when user', function(done) {
      return accept('crop_image.png', function(result) {
        var crop = { top: 10, left: 10, width: 80, height: 80 };

        return apos.attachments.crop(
          adminReq(),
          result._id,
          crop,
          function(err) {
            assert(!err);

            // make sure it exists in mongo
            apos.db.collection(collectionName).findOne({
              _id: result._id
            }, function(err, result) {
              assert(!err);
              assert(result);
              assert(result.crops.length);
              var t = uploadTarget + result._id + '-' + result.name + '.' + result.crops[0].left + '.' + result.crops[0].top + '.' + result.crops[0].width + '.' + result.crops[0].height + '.' + result.extension;
              assert(fs.existsSync(t));

              done();

            });
          }
        );
      });
    });

    it('should clone an attachment', function(done) {
      return accept('clone.txt', function(result) {

        return apos.attachments.clone(adminReq(), result, function(err, targetInfo) {
          assert(!err);
          assert(targetInfo._id !== result._id);

          // make sure it exists in mongo
          apos.db.collection(collectionName).findOne({
            _id: result._id
          }, function(err, result) {
            assert(!err);
            assert(result);
            var t = uploadTarget + result._id + '-' + result.name + '.' + result.extension;
            assert(fs.existsSync(t));

            done();
          });
        }); 
      });
    });

  });

})
