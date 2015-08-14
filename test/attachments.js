
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

  after(wipeIt);

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

  function userReq() {
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

    it('should upload a text file using the apos api when user', function(done) {
      var filename = 'upload_apos_api.txt';

      apos.attachments.accept(userReq(), {
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

          done();
        });
      });
    });


  });

})