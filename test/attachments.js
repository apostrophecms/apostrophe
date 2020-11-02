const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let apos;

describe('Attachment', function() {

  after(async function() {
    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  const uploadSource = path.join(__dirname, '/data/upload_tests/');
  const uploadTarget = path.join(__dirname, '/public/uploads/attachments/');
  const collectionName = 'aposAttachments';

  async function wipeIt() {
    deleteFolderRecursive(path.join(__dirname, '/public/uploads'));

    function deleteFolderRecursive (path) {
      let files = [];
      if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function(file, index) {
          const curPath = path + '/' + file;
          if (fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
          } else { // delete file
            fs.unlinkSync(curPath);
          }
        });
        fs.rmdirSync(path);
      }
    }

    return apos.db.collection(collectionName).removeMany({});
  }

  it('should be a property of the apos object', async function() {
    this.timeout(t.timeout);
    this.slow(2000);

    apos = await t.create({
      root: module
    });
    assert(apos.attachment);
  });

  describe('wipe', function() {
    it('should clear previous material if any', async function() {
      return wipeIt();
    });
  });

  describe('insert', async function() {

    async function insert(filename) {
      const info = await apos.attachment.insert(apos.task.getReq(), {
        name: filename,
        path: uploadSource + filename
      });
      const t = uploadTarget + info._id + '-' + info.name + '.' + info.extension;
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
      return insert('upload_apos_api.txt');
    });

    it('should upload an image file using the attachments api when user', async function() {
      return insert('upload_image.png');
    });

    it('should not upload an exe file', async function() {
      const filename = 'bad_file.exe';
      let good = false;
      try {
        await apos.attachment.insert(apos.task.getReq(), {
          name: filename,
          path: uploadSource + filename
        });
      } catch (e) {
        good = true;
      }
      assert(good);
    });

    it('should crop an image file when requested', async function() {
      let result = await insert('crop_image.png');
      const crop = {
        top: 10,
        left: 10,
        width: 80,
        height: 80
      };
      await apos.attachment.crop(
        apos.task.getReq(),
        result._id,
        crop
      );
      result = await apos.db.collection(collectionName).findOne({
        _id: result._id
      });
      assert(result);
      assert(result.crops.length);
      const t = uploadTarget + result._id + '-' + result.name + '.' + result.crops[0].left + '.' + result.crops[0].top + '.' + result.crops[0].width + '.' + result.crops[0].height + '.' + result.extension;
      assert(fs.existsSync(t));
    });

    it('should handle a file with a jpeg extension properly and set extension to jpg', async function() {
      let result = await insert('crop_image.jpeg');
      const crop = {
        top: 10,
        left: 10,
        width: 80,
        height: 80
      };
      await apos.attachment.crop(
        apos.task.getReq(),
        result._id,
        crop
      );
      result = await apos.db.collection(collectionName).findOne({
        _id: result._id
      });
      assert(result);
      assert(result.crops.length);
      const t = uploadTarget + result._id + '-' + result.name + '.' + result.crops[0].left + '.' + result.crops[0].top + '.' + result.crops[0].width + '.' + result.crops[0].height + '.jpg';
      assert(fs.existsSync(t));
      assert(result.extension === 'jpg');
    });

    it('should generate the "full" URL when no size specified for image', function() {
      const url = apos.attachment.url({
        group: 'images',
        name: 'test',
        extension: 'jpg',
        _id: 'test'
      });
      assert(url === '/uploads/attachments/test-test.full.jpg');
    });

    it('should generate the "one-half" URL when one-half size specified for image', function() {
      const url = apos.attachment.url({
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
      const url = apos.attachment.url({
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
      const url = apos.attachment.url({
        group: 'office',
        name: 'test',
        extension: 'pdf',
        _id: 'test'
      });
      assert(url === '/uploads/attachments/test-test.pdf');
    });

    it('should save and track docIds properly as part of an @apostrophecms/image', async function() {
      let image = apos.image.newInstance();
      const req = apos.task.getReq();
      let attachment = await apos.attachment.insert(apos.task.getReq(), {
        name: 'upload_image.png',
        path: uploadSource + 'upload_image.png'
      });
      assert(attachment);
      image.title = 'Test Image';
      image.attachment = attachment;
      image = await apos.image.insert(req, image);
      assert(image);
      attachment = await apos.attachment.db.findOne({ _id: image.attachment._id });
      assert(attachment);
      assert(attachment.trash === false);
      assert(attachment.docIds);
      assert(attachment.docIds.length === 1);
      assert(attachment.docIds[0] === image._id);
      assert(attachment.trashDocIds);
      assert(attachment.trashDocIds.length === 0);
      try {
        const fd = fs.openSync(apos.rootDir + '/public' + apos.attachment.url(attachment, { size: 'original' }), 'r');
        assert(fd);
        fs.closeSync(fd);
      } catch (e) {
        assert(false);
      }
      image.trash = true;
      await apos.image.update(req, image);
      attachment = await apos.attachment.db.findOne({ _id: image.attachment._id });
      assert(attachment.trash);
      assert(attachment.docIds.length === 0);
      assert(attachment.trashDocIds.length === 1);
      let good = false;
      try {
        fs.openSync(apos.rootDir + '/public' + apos.attachment.url(attachment, { size: 'original' }), 'r');
      } catch (e) {
        good = true;
      }
      if (!good) {
        throw new Error('should not have been accessible');
      }
      image.trash = false;
      await apos.image.update(req, image);
      attachment = await apos.attachment.db.findOne({ _id: image.attachment._id });
      assert(!attachment.trash);
      assert(attachment.docIds.length === 1);
      assert(attachment.trashDocIds.length === 0);
      try {
        const fd = fs.openSync(apos.rootDir + '/public' + apos.attachment.url(attachment, { size: 'original' }), 'r');
        assert(fd);
        fs.closeSync(fd);
      } catch (e) {
        assert(false);
      }
    });

  });

});
