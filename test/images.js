const t = require('../test-lib/test.js');
const assert = require('assert/strict');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const FormData = require('form-data');

const publicFolderPath = path.join(process.cwd(), 'test/public');

describe('Images', function() {

  let apos;
  let jar;
  let inserted;
  let image;

  const mockImages = [
    {
      type: '@apostrophecms/image',
      slug: 'image-1',
      visibility: 'public',
      attachment: {
        extension: 'jpg',
        width: 500,
        height: 400
      }
    },
    {
      type: '@apostrophecms/image',
      slug: 'image-2',
      visibility: 'public',
      attachment: {
        extension: 'jpg',
        width: 500,
        height: 400
      }
    },
    {
      type: '@apostrophecms/image',
      slug: 'image-3',
      visibility: 'public',
      attachment: {
        extension: 'jpg',
        width: 150,
        height: 150
      }
    },
    {
      type: '@apostrophecms/image',
      slug: 'image-4',
      visibility: 'public',
      attachment: {
        extension: 'svg'
      }
    }
  ];

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
      const response = await apos.doc.db.deleteMany(
        { type: '@apostrophecms/image' }
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

    inserted = await Promise.all(insertPromises);

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

  it('should be able to insert test users', async function() {

    await insertUser({
      title: 'admin',
      username: 'admin',
      password: 'admin',
      email: 'ad@min.com',
      role: 'admin'
    });

    await insertUser({
      title: 'contributor',
      username: 'contributor',
      password: 'contributor',
      email: 'con@tributor.com',
      role: 'contributor'
    });

  });

  it('REST: should be able to log in as admin', async function() {
    jar = await login('admin');
  });

  it('"editable" API includes images for admin', async function() {

    const editable = await getEditableImages(jar);
    assert(editable.length === 4);
  });

  it('REST: should be able to log in as contributor', async function() {
    jar = await login('contributor');
  });

  it('"editable" API does not include images for contributor', async function() {
    const editable = await getEditableImages(jar);
    assert(editable.length === 0);
  });

  it('REST: should be able to upload an image with an attachment as an admin', async function() {
    jar = await login('admin');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(path.join(apos.rootDir, '/public/test-image.jpg')));

    // Make an async request to upload the image.
    const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
      body: formData,
      jar
    });

    image = await apos.http.post('/api/v1/@apostrophecms/image', {
      body: {
        title: 'Test Image',
        attachment
      },
      jar
    });
    assert(image);
    assert(image.title === 'Test Image');
  });

  it('REST: autocrop should have no effect when there are no widget options', async function() {
    const result = await apos.http.post('/api/v1/@apostrophecms/image/autocrop', {
      body: {
        relationship: [ image ],
        widgetOptions: {}
      },
      jar
    });
    assert(result.relationship);
    assert(result.relationship[0]);
    assert(result.relationship[0].title === 'Test Image');
    assert(!result.relationship[0]._fields);
  });

  it('REST: autocrop should work when aspectRatio is less than actual image', async function() {
    const result = await apos.http.post('/api/v1/@apostrophecms/image/autocrop', {
      body: {
        relationship: [ image ],
        widgetOptions: {
          aspectRatio: [ 1, 2 ]
        }
      },
      jar
    });
    assert(result.relationship);
    const output = result.relationship[0];
    assert(output);
    assert(output.title === 'Test Image');
    const fields = output._fields;
    assert(fields);
    // Useful for visual verification
    // require('child_process').execSync(`open
    // test/public${output.attachment._urls.full} &`);

    assert.strictEqual(fields.top, 0);
    assert.strictEqual(fields.left, 75);
    assert.strictEqual(fields.width, 300);
    assert.strictEqual(fields.height, 600);
  });

  it('REST: autocrop should work when aspectRatio is greater than actual image', async function() {
    const result = await apos.http.post('/api/v1/@apostrophecms/image/autocrop', {
      body: {
        relationship: [ image ],
        widgetOptions: {
          aspectRatio: [ 2, 1 ]
        }
      },
      jar
    });
    assert(result.relationship);
    const output = result.relationship[0];
    assert(output);
    assert(output.title === 'Test Image');
    const fields = output._fields;
    assert(fields);
    // Useful for visual verification
    // require('child_process').execSync(`open
    // test/public${output.attachment._urls.full} &`);
    assert.strictEqual(fields.top, 187);
    assert.strictEqual(fields.left, 0);
    assert.strictEqual(fields.width, 450);
    assert.strictEqual(fields.height, 225);
  });

  it('should update crop fields when replacing an image attachment', async function () {
    await t.destroy(apos);
    await fsp.rm(path.join(publicFolderPath, 'uploads'), {
      recursive: true,
      force: true
    });
    apos = await t.create({
      root: module,
      modules: {
        'test-piece': {
          extend: '@apostrophecms/piece-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/image': {
                      aspectRatio: [ 3, 2 ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    await insertUser({
      title: 'admin',
      username: 'admin',
      password: 'admin',
      email: 'ad@min.com',
      role: 'admin'
    });

    // Upload an image (landscape), crop it, insert a piece with the cropped
    // image
    jar = await login('admin');
    const formData = new FormData();
    const stream = fs.createReadStream(
      path.join(apos.rootDir, '/public/test-image-landscape.jpg')
    );
    formData.append('file', stream);
    const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
      body: formData,
      jar
    });
    stream.close();
    image = await apos.http.post('/api/v1/@apostrophecms/image', {
      body: {
        title: 'Test Image Landscape',
        attachment
      },
      jar
    });
    assert.equal(image._prevAttachmentId, attachment._id);
    const crop = await apos.http.post('/api/v1/@apostrophecms/image/autocrop', {
      body: {
        relationship: [ image ],
        widgetOptions: {
          aspectRatio: [ 3, 2 ]
        }
      },
      jar
    });
    let piece = await apos.http.post('/api/v1/test-piece', {
      jar,
      body: {
        title: 'Test Piece',
        slug: 'test-piece',
        type: 'test-piece',
        main: {
          metaType: 'area',
          items: [
            {
              type: '@apostrophecms/image',
              metaType: 'widget',
              imageIds: [ image.aposDocId ],
              imageFields: {
                [image.aposDocId]: crop.relationship[0]._fields
              },
              _image: [ crop.relationship[0] ]
            }
          ]
        }
      }
    });

    let imageFields = piece.main.items[0].imageFields[image.aposDocId];
    assert(imageFields, 'imageFields should be present when creating the piece');
    assert.equal(imageFields.width / imageFields.height, 3 / 2, 'aspect ratio should be 3:2');
    await fsp.access(
      path.join(
        publicFolderPath,
        attachment._urls.original.replace(
          '.jpg',
        `.${imageFields.left}.${imageFields.top}.${imageFields.width}.${imageFields.height}.jpg`
        )
      )
    );

    // Replace the image with portrait orientation, verify that the aspect
    // ratio is preserved
    const formDataPortrait = new FormData();
    const streamPortrait = fs.createReadStream(path.join(apos.rootDir, '/public/test-image.jpg'));
    formDataPortrait.append('file', streamPortrait);
    const attachmentPortrait = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
      body: formDataPortrait,
      jar
    });
    image = await apos.http.put(`/api/v1/@apostrophecms/image/${image._id}`, {
      body: {
        title: 'Test Image Portrait',
        attachment: attachmentPortrait
      },
      jar
    });
    streamPortrait.close();
    piece = await apos.http.get(`/api/v1/test-piece/${piece._id}`, {
      jar
    });
    imageFields = piece.main.items[0].imageFields[image.aposDocId];
    assert(imageFields, 'imageFields should be present after replacing the image attachment');
    assert.equal(imageFields.width / imageFields.height, 3 / 2, 'aspect ratio should be 3:2');
    await fsp.access(
      path.join(
        publicFolderPath,
        attachmentPortrait._urls.original.replace(
          '.jpg',
        `.${imageFields.left}.${imageFields.top}.${imageFields.width}.${imageFields.height}.jpg`
        )
      )
    );
  });

  async function insertUser(info) {
    const user = apos.user.newInstance();
    assert(user);
    Object.assign(user, info);
    await apos.user.insert(apos.task.getReq(), user);
  }

  async function login(username, password) {
    if (!password) {
      password = username;
    }
    jar = apos.http.jar();

    // establish session
    let page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged out/));

    // Log in

    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username,
        password,
        session: true
      },
      jar
    });

    // Confirm login
    page = await apos.http.get('/', {
      jar
    });

    assert(page.match(/logged in/));
    return jar;
  }

  async function getEditableImages(jar) {
    return (await apos.http.post('/api/v1/@apostrophecms/doc/editable?aposMode=draft', {
      body: {
        ids: inserted.map(doc => doc._id.replace(':published', ':draft'))
      },
      jar
    })).editable;
  }
});
