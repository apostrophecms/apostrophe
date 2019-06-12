const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs');

let apos;

describe('Attachment', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  let uploadSource = __dirname + "/data/upload_tests/";
  let uploadTarget = __dirname + "/public/uploads/attachments/";
  let collectionName = 'aposAttachments';

  async function wipeIt() {
    deleteFolderRecursive(__dirname + '/public/uploads');

    function deleteFolderRecursive (path) {
      let files = [];
      if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function(file, index) {
          let curPath = path + "/" + file;
          if (fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
          } else { // delete file
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(path);
      }
    }

    return apos.db.collection(collectionName).remove({});
  }

  it('should be a property of the apos object', async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await require('../index.js')({
      root: module,
      shortName: 'test',
      argv: {
        _: []
      }
    });
    assert(apos.attachments);
  });

  describe('wipe', function() {
    it('should clear previous material if any', async function() {
      return wipeIt();
    });
  });

  describe('accept', async function() {

    async function accept(filename) {
      const info = await apos.attachments.insert(apos.tasks.getReq(), {
        name: filename,
        path: uploadSource + filename
      });
      let t = uploadTarget + info._id + '-' + info.name + '.' + info.extension;
      // file should be uploaded
      assert(fs.existsSync(t));

      // make sure it exists in mongo
      const result = await apos.db.collection(collectionName).findOne({
        _id: info._id
      });
      assert(result);
      return result;
    }

    it('should upload a text file using the attachments api when user', async function() {
      return accept('upload_apos_api.txt');
    });

    it('should upload an image file using the attachments api when user', async function() {
      return accept('upload_image.png');
    });

    it('should not upload an exe file', async function() {
      let filename = 'bad_file.exe';
      let good = false;
      try {
        await apos.attachments.insert(apos.tasks.getReq(), {
          name: filename,
          path: uploadSource + filename
        });
      } catch (e) {
        good = true;
      }
      assert(good);
    });

    it('should crop an image file when user', async function() {
      let result = await accept('crop_image.png');
      let crop = { top: 10, left: 10, width: 80, height: 80 };
      await apos.attachments.crop(
        apos.tasks.getReq(),
        result._id,
        crop
      );
      result = await apos.db.collection(collectionName).findOne({
        _id: result._id
      });
      assert(result);
      assert(result.crops.length);
      let t = uploadTarget + result._id + '-' + result.name + '.' + result.crops[0].left + '.' + result.crops[0].top + '.' + result.crops[0].width + '.' + result.crops[0].height + '.' + result.extension;
      assert(fs.existsSync(t));
    });

    it('should generate the "full" URL when no size specified for image', function() {
      let url = apos.attachments.url({
        group: 'images',
        name: 'test',
        extension: 'jpg',
        _id: 'test'
      });
      assert(url === '/uploads/attachments/test-test.full.jpg');
    });

    it('should generate the "one-half" URL when one-half size specified for image', function() {
      let url = apos.attachments.url({
        group: 'images',
        name: 'test',
        extension: 'jpg',
        _id: 'test'
      }, {
        size: 'one-half'
      });
      assert(url === '/uploads/attachments/test-test.one-half.jpg');
    });

    it('should generate the original URL when "original" size specified for image', function() {
      let url = apos.attachments.url({
        group: 'images',
        name: 'test',
        extension: 'jpg',
        _id: 'test'
      }, {
        size: 'original'
      });
      assert(url === '/uploads/attachments/test-test.jpg');
    });

    it('should generate the original URL when no size specified for pdf', function() {
      let url = apos.attachments.url({
        group: 'office',
        name: 'test',
        extension: 'pdf',
        _id: 'test'
      });
      assert(url === '/uploads/attachments/test-test.pdf');
    });

    it('should save and track docIds properly as part of an apostrophe-image', async function() {
      let image = apos.images.newInstance();
      let req = apos.tasks.getReq();
      let attachment = await apos.attachments.insert(apos.tasks.getReq(), {
        name: 'upload_image.png',
        path: uploadSource + 'upload_image.png'
      });
      assert(attachment);
      image.title = 'Test Image';
      image.attachment = attachment;
      image = await apos.images.insert(req, image);
      assert(image);
      attachment = await apos.attachments.db.findOne({ _id: image.attachment._id });
      assert(attachment);
      assert(attachment.trash === false);
      assert(attachment.docIds);
      assert(attachment.docIds.length === 1);
      assert(attachment.docIds[0] === image._id);
      assert(attachment.trashDocIds);
      assert(attachment.trashDocIds.length === 0);
      try {
        let fd = fs.openSync(apos.rootDir + '/public' + apos.attachments.url(attachment, { size: 'original' }), 'r');
        assert(fd);
        fs.closeSync(fd);
      } catch (e) {
        assert(false);
      }
      await apos.images.trash(req, image._id);
      attachment = await apos.attachments.db.findOne({ _id: image.attachment._id });
      assert(attachment.trash);
      assert(attachment.docIds.length === 0);
      assert(attachment.trashDocIds.length === 1);
      let good = false;
      try {
        fs.openSync(apos.rootDir + '/public' + apos.attachments.url(attachment, { size: 'original' }), 'r');
      } catch (e) {
        good = true;
      }
      if (!good) {
        throw new Error('should not have been accessible');
      }
      await apos.images.rescue(req, image._id);
      attachment = await apos.attachments.db.findOne({ _id: image.attachment._id });
      assert(!attachment.trash);
      assert(attachment.docIds.length === 1);
      assert(attachment.trashDocIds.length === 0);
      try {
        let fd = fs.openSync(apos.rootDir + '/public' + apos.attachments.url(attachment, { size: 'original' }), 'r');
        assert(fd);
        fs.closeSync(fd);
      } catch (e) {
        assert(false);
      }
    });

  });

});
