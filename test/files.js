var assert = require('assert');
var _ = require('lodash');

var apos;

describe('Files', function() {

  var uploadSource = __dirname + "/data/upload_tests/";
  var uploadTarget = __dirname + "/public/uploads/files/";
  var mongoCol = 'aposFiles';

  function wipeIt() {
    apos.db.collection(mongoCol).drop();
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

      apos.files.accept(userReq(), {
        name: filename,
        path: uploadSource + filename
      }, function(err, info) {
        var t = uploadTarget + info[0]._id + '-' + info[0].name + '.' + info[0].extension;
        assert(!err);
        // file should be uploaded
        assert(fs.existsSync(t));

        // make sure it exists in mongo
        apos.db.collection(mongoCol).findOne({
          _id: info[0]._id
        }, function(err, result) {
          assert(!err);
          assert(result);

          done();
        });
      });
    });

    it('should not upload a text file using the apos api when anon', function(done) {
      var filename = 'upload_apos_api.txt';

      apos.files.accept(anonReq(), {
        name: filename,
        path: uploadSource + filename
      }, function(err, info) {
        assert(!info);
        assert(err === "forbidden");

        done();
      });
    });
  });

  describe('browse', function() {
    var fakeFiles;

    before(function(done) {
      wipeIt();

      fakeFiles = [
      {
        length: null,
        group: 'office',
        name: 'test-upload-1',
        title: 'test upload 1',
        extension: 'txt',
        md5: '',
        ownerId: 'anon-undefined',
        _edit: true,
        _id: apos.utils.generateId()
      },
      {
        length: null,
        group: 'office',
        name: 'test-upload-2',
        title: 'test upload 2',
        extension: 'pdf',
        md5: '',
        ownerId: 'anon-undefined',
        _edit: true,
        _id: apos.utils.generateId()
      },
      {
        length: null,
        group: 'image',
        name: 'test-upload-3',
        title: 'test upload 3',
        extension: 'png',
        md5: '',
        ownerId: 'anon-undefined',
        _edit: true,
        _id: apos.utils.generateId()
      },
      {
        length: null,
        group: 'image',
        name: 'test-upload-4',
        title: 'test upload 4',
        extension: 'jpg',
        md5: '',
        ownerId: 'anon-undefined',
        _edit: true,
        _id: apos.utils.generateId()
      }
    ];
      // Prep some fake data in mongo
      apos.db.collection(mongoCol).insert(
        fakeFiles,
        function(err, results) {
          assert(!err);

          done();
        }
      );

    });

    it('with no options should return a full list of files', function(done) {
      apos.files.browse(userReq(), {}, function(err, result) {
        assert(!err);
        assert(result.total === fakeFiles.length);

        done();
      });
    });

    it('should be able to filter files by ids', function(done) {
      var fakeFilesIndex = 3;
      apos.files.browse(userReq(), {
        ids: [fakeFiles[fakeFilesIndex]._id]
      }, function(err, result) {
        assert(!err);
        assert(result.total === 1);
        assert(result.files.length === 1);
        assert(result.files[0]._id = fakeFiles[fakeFilesIndex]._id);
        assert(result.files[0].name = fakeFiles[fakeFilesIndex].name);

        done();
      });
    });

    it('should be able to limit and skip file results', function(done) {
      var fakeFilesIndex = 1;
      apos.files.browse(userReq(), {
        limit: 2,
        skip: fakeFilesIndex
      }, function(err, result) {
        assert(!err);
        assert(result.total === 4); // This is just a mechanism for paging, shouldn't effect total
        assert(result.files.length === 2);
        assert(result.files[0]._id = fakeFiles[fakeFilesIndex]._id);
        assert(result.files[1]._id = fakeFiles[fakeFilesIndex + 1]._id);

        done();
      });
    });

    it('should be able to filter files by extension', function(done) {
      var fakeFilesIndex = 1;
      apos.files.browse(userReq(), {
        extension: ['pdf']
      }, function(err, result) {
        assert(!err);
        assert(result.total === 1);
        assert(result.files[0].name = fakeFiles[fakeFilesIndex].name);

        done();
      });
    });
  });

  describe("updateTrash", function() {
    var uploadId;
    var uploadPath;
    before(function(done){
      wipeIt();

      var filename = "updateTrash_apos_api.txt"

      // Upload a file using accept for testing updateTrash
      apos.files.accept(userReq(), {
        name: filename,
        path: uploadSource + filename
      }, function(err, info) {
        uploadPath = uploadTarget + info[0]._id + '-' + info[0].name + '.' + info[0].extension;
        uploadId = info[0]._id;
        assert(!err);
        assert(fs.existsSync(uploadPath));

        done();
      });
    });

    it('should not run for anon user', function(done) {
      apos.files.updateTrash(anonReq(), uploadId, true, function(err, result) {
        assert(err === "forbidden");

        done();
      });
    });

    it('should trash a file in mongo and make it inaccessible in the file system', function(done) {
      apos.files.updateTrash(userReq(), uploadId, true, function(err, result) {
        assert(!err);

        // file should still exist
        assert(fs.existsSync(uploadPath));
        // but not be readable
        assert.throws(function() {
          fs.openSync(uploadPath, 'r')
        }, Error);

        // make sure it exists and trash is true in mongo
        apos.db.collection(mongoCol).findOne({
          _id: uploadId
        }, function(err, result) {
          assert(!err);
          assert(result);
          assert(result.trash);

          done();
        });
      });
    });


  });


  // TODO add tests to express routes that call apos api
  // it('should upload a text file using the express api', function(done) {
  //   var filename = 'upload_express_api.txt';

  //   var req = request({
  //     method: 'POST',
  //     url: 'http://localhost:7938/modules/apostrophe-files/upload',
  //     formData: {
  //       files: {
  //         value: fs.createReadStream(uploadSource + filename)
  //       }
  //     }
  //   }, function(err, response, body) {
  //     console.log(err);
  //     console.log(response.statusCode);
  //     done();
  //   });
  // });

});
