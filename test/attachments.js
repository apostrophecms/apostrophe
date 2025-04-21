const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

describe('Attachment', function() {

  let apos;

  after(async function() {
    await wipeIt();

    return t.destroy(apos);
  });

  this.timeout(t.timeout);

  const uploadSource = path.join(__dirname, '/data/upload_tests/');
  const uploadTarget = path.join(__dirname, '/public/uploads/attachments/');
  const collectionName = 'aposAttachments';

  async function wipeIt() {
    await fs.remove(path.join(__dirname, '/public/uploads'));

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

  let imageOne;

  describe('insert', function() {

    async function insert(filename) {
      const info = await apos.attachment.insert(apos.task.getReq(), {
        name: filename,
        path: uploadSource + filename
      });
      const t = uploadTarget + info._id + '-' + info.name + '.' + info.extension;

      // file should be uploaded
      assert(await fs.pathExists(t));

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

    it('should upload an image file using the attachments api when user', async function () {
      imageOne = await insert('upload_image.png');
      assert(imageOne && imageOne._id);
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

    it('should allow upload if extension has been added to the current fileGroups', async function() {
      let apos;
      let good = true;
      try {
        apos = await t.create({
          root: module,
          modules: {
            '@apostrophecms/attachment': {
              options: {
                addFileGroups: [
                  {
                    name: 'images',
                    extensions: [
                      'mp4'
                    ]
                  }
                ]
              }
            }
          }
        });
        const filename = 'tiny.mp4';
        await apos.attachment.insert(apos.task.getReq(), {
          name: filename,
          path: uploadSource + filename
        });
      } catch (e) {
        good = false;
      } finally {
        assert(good);
        t.destroy(apos);
      }
    });

    it('should allow upload if extension has been added in a new fileGroup', async function() {
      let apos;
      let good = true;
      try {
        apos = await t.create({
          root: module,
          modules: {
            '@apostrophecms/attachment': {
              options: {
                addFileGroups: [
                  {
                    name: 'testGroup',
                    extensions: [
                      'mp4'
                    ],
                    extensionMaps: {}
                  }
                ]
              }
            }
          }
        });
        const filename = 'tiny.mp4';
        await apos.attachment.insert(apos.task.getReq(), {
          name: filename,
          path: uploadSource + filename
        });
      } catch (e) {
        good = false;
      } finally {
        assert(good);
        t.destroy(apos);
      }
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
      assert.strictEqual(url, '/uploads/attachments/test-test.full.jpg');
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
      assert(attachment.archived === false);
      assert(attachment.docIds);
      // Should be 3 because of "previous"
      assert(attachment.docIds.length === 3);
      assert(attachment.docIds.find(docId => docId === `${image.aposDocId}:en:draft`));
      assert(attachment.docIds.find(docId => docId === `${image.aposDocId}:en:published`));
      assert(attachment.archivedDocIds);
      assert(attachment.archivedDocIds.length === 0);
      try {
        const fd = fs.openSync(apos.rootDir + '/public' + apos.attachment.url(attachment, { size: 'original' }), 'r');
        assert(fd);
        fs.closeSync(fd);
      } catch (e) {
        assert(false);
      }
      image.archived = true;
      await apos.image.update(req, image);
      attachment = await apos.attachment.db.findOne({ _id: image.attachment._id });
      assert(!attachment.archived);
      // Because "draft" and "previous" both have it, unarchived
      assert(attachment.docIds.length === 2);
      assert(attachment.archivedDocIds.length === 1);
      // Should still be accessible at this point because the draft still uses
      // it
      const fd = fs.openSync(apos.rootDir + '/public' + apos.attachment.url(attachment, { size: 'original' }), 'r');
      assert(fd);
      fs.closeSync(fd);
      // Now archive the draft
      const draftReq = apos.task.getReq({
        mode: 'draft'
      });
      const draft = await apos.image.find(draftReq, {
        aposDocId: image.aposDocId
      }).toObject();
      assert(draft);
      assert(draft.aposLocale === 'en:draft');
      draft.archived = true;
      await apos.image.update(req, draft);
      // Now it should be inaccessible
      attachment = await apos.attachment.db.findOne({ _id: image.attachment._id });
      assert(attachment.archived);
      assert(attachment.docIds.length === 0);
      assert(attachment.archivedDocIds.length === 3);
      let good = false;
      try {
        fs.openSync(apos.rootDir + '/public' + apos.attachment.url(attachment, { size: 'original' }), 'r');
      } catch (e) {
        good = true;
      }
      if (!good) {
        throw new Error('should not have been accessible');
      }
      // Now rescue the published version from the archive
      image.archived = false;
      await apos.image.update(req, image);
      attachment = await apos.attachment.db.findOne({ _id: image.attachment._id });
      assert(!attachment.archived);
      assert(attachment.docIds.length === 1);
      // Don't forget "previous"
      assert(attachment.archivedDocIds.length === 2);
      try {
        const fd = fs.openSync(apos.rootDir + '/public' + apos.attachment.url(attachment, { size: 'original' }), 'r');
        assert(fd);
        fs.closeSync(fd);
      } catch (e) {
        assert(false);
      }
    });
  });

  describe('api', async function () {
    const attachmentMock = {
      _id: 'cl1uqvv0z002oldgftrxk58e1',
      crop: null,
      group: 'images',
      name: 'test',
      title: 'test',
      extension: 'jpg',
      type: 'attachment',
      archivedDocIds: [],
      length: 184317,
      md5: '816e2fe1190b7aa81ed26d8479e26181',
      width: 960,
      height: 542,
      landscape: true,
      used: true,
      utilized: true,
      archived: false
    };

    const imageMock = {
      _id: 'cl1uqvvdr002qldgffbcflmmf:en:draft',
      attachment: {
        ...attachmentMock
      },
      title: 'test',
      alt: '',
      slug: 'image-test',
      archived: false,
      type: '@apostrophecms/image',
      _fields: {
        top: 100,
        left: 50,
        width: 300,
        height: 200,
        x: 50,
        y: 25
      }
    };

    it('should annotate images with URLs using .all method', async function () {
      assert(!imageOne._urls);

      apos.attachment.all({ imageOne }, { annotate: true });

      assert(imageOne._urls);
    });

    it('should return the attachment of a given image with the image cropping and focal point values', function () {
      const attachments = apos.attachment.all(imageMock, { annotate: true });

      assert(attachments[0]._crop.top === imageMock._fields.top);
      assert(attachments[0]._crop.left === imageMock._fields.left);
      assert(attachments[0]._crop.width === imageMock._fields.width);
      assert(attachments[0]._crop.height === imageMock._fields.height);

      assert(attachments[0]._focalPoint.x === imageMock._fields.x);
      assert(attachments[0]._focalPoint.y === imageMock._fields.y);
    });

    it('should return the attachment of a given image with the uncropped urls', function () {
      const [ attachment ] = apos.attachment.all(imageMock, { annotate: true });
      const imgVersions = [
        'original',
        'max',
        'full',
        'two-thirds',
        'one-half',
        'one-third',
        'one-sixth'
      ];

      assert(attachment._urls.uncropped);
      assert(!Array.isArray(attachment._urls.uncropped));
      assert(typeof attachment._urls.uncropped === 'object');

      imgVersions.forEach((version) => {
        assert(attachment._urls.uncropped[version]);
        assert(typeof attachment._urls.uncropped[version] === 'string');
      });
    });

    it('should not clone attachment', function () {
      const attachments = apos.attachment.all(imageMock, { annotate: true });

      assert(attachments[0] === imageMock.attachment);
    });

    it('should return the attachment width', async function () {
      const width = apos.attachment.getWidth(attachmentMock);

      assert(width === 960);
    });

    it('should return the attachment cropping width', async function () {
      const width = apos.attachment.getWidth({
        ...attachmentMock,
        _crop: {
          width: 300
        }
      });

      assert(width === 300);
    });

    it('should return the attachment height', async function () {
      const height = apos.attachment.getHeight(attachmentMock);

      assert(height === 542);
    });

    it('should return the attachment cropping height', async function () {
      const height = apos.attachment.getHeight({
        ...attachmentMock,
        _crop: {
          height: 400
        }
      });

      assert(height === 400);
    });

    it('should generate an appropriate missing attachment url', function() {
      const url = apos.attachment.url(null);
      assert.strictEqual(url, '/apos-frontend/default/modules/@apostrophecms/attachment/img/missing-icon.svg');
    });
  });
});
