const assert = require('assert').strict;
const t = require('../test-lib/test.js');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

describe('PATCH Image Widget to Area', function() {
  let apos;
  let jar;
  let image;

  this.timeout(t.timeout);

  before(async function() {
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
                    '@apostrophecms/image': {},
                    '@apostrophecms/rich-text': {}
                  }
                }
              },
              secondary: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {}
                  }
                }
              }
            }
          }
        }
      }
    });
  });

  after(function() {
    return t.destroy(apos);
  });

  it('should be able to insert test user', async function() {
    const user = apos.user.newInstance();
    user.title = 'admin';
    user.username = 'admin';
    user.password = 'admin';
    user.email = 'ad@min.com';
    user.role = 'admin';
    await apos.user.insert(apos.task.getReq(), user);
  });

  it('should be able to login as admin', async function() {
    jar = apos.http.jar();

    // establish session
    await apos.http.get('/', { jar });

    // Log in
    await apos.http.post('/api/v1/@apostrophecms/login/login', {
      body: {
        username: 'admin',
        password: 'admin',
        session: true
      },
      jar
    });
  });

  it('should be able to upload an image and create an image piece', async function() {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(path.join(__dirname, '/public/test-image.jpg')));

    const attachment = await apos.http.post('/api/v1/@apostrophecms/attachment/upload', {
      body: formData,
      jar
    });

    assert(attachment);
    assert(attachment._id);

    image = await apos.http.post('/api/v1/@apostrophecms/image', {
      body: {
        title: 'Test Image for PATCH',
        attachment
      },
      jar
    });

    assert(image);
    assert(image._id);
    assert(image.aposDocId);
  });

  it('can use PATCH with $push to add an image widget to an area', async function() {
    // Create a test piece with an empty main area
    let piece = await apos.http.post('/api/v1/test-piece', {
      body: {
        title: 'Test Piece for $push'
      },
      jar
    });

    assert(piece);
    assert(piece._id);
    assert(piece.main);
    assert(piece.main._id);

    // Use PATCH with $push to add an image widget
    piece = await apos.http.patch(`/api/v1/test-piece/${piece._id}`, {
      body: {
        $push: {
          'main.items': {
            metaType: 'widget',
            type: '@apostrophecms/image',
            _image: [image]
          }
        }
      },
      jar
    });

    assert(piece.main);
    assert(piece.main.items);
    assert.strictEqual(piece.main.items.length, 1);
    assert.strictEqual(piece.main.items[0].type, '@apostrophecms/image');
    // Verify the image relationship is present
    assert(piece.main.items[0].imageIds);
    assert.strictEqual(piece.main.items[0].imageIds.length, 1);
    assert.strictEqual(piece.main.items[0].imageIds[0], image.aposDocId);
  });

  it('can use PATCH with @ syntax to add an image widget to an area by _id', async function() {
    // Create a test piece with an empty main area
    let piece = await apos.http.post('/api/v1/test-piece', {
      body: {
        title: 'Test Piece for @ syntax'
      },
      jar
    });

    assert(piece);
    assert(piece._id);
    assert(piece.main);
    assert(piece.main._id);

    const areaId = piece.main._id;

    // Use PATCH with @ syntax to update the area by its _id
    piece = await apos.http.patch(`/api/v1/test-piece/${piece._id}`, {
      body: {
        [`@${areaId}`]: {
          _id: areaId,
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/image',
              _image: [image]
            }
          ]
        }
      },
      jar
    });

    assert(piece.main);
    assert(piece.main.items);
    assert(piece.main.items.length === 1);
    assert(piece.main.items[0].type === '@apostrophecms/image');
    assert(piece.main.items[0].imageIds[0] === image.aposDocId);
  });

  it('can use PATCH with @ syntax to update two rich text widgets in separate areas in a single call', async function() {
    // Create a test piece with two areas containing rich text widgets
    let piece = await apos.http.post('/api/v1/test-piece', {
      body: {
        title: 'Test Piece for dual @ syntax',
        main: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: '<p>Original main content</p>'
            }
          ]
        },
        secondary: {
          metaType: 'area',
          items: [
            {
              metaType: 'widget',
              type: '@apostrophecms/rich-text',
              content: '<p>Original secondary content</p>'
            }
          ]
        }
      },
      jar
    });

    assert(piece);
    assert(piece._id);
    assert(piece.main);
    assert(piece.main.items);
    assert.strictEqual(piece.main.items.length, 1);
    assert(piece.secondary);
    assert(piece.secondary.items);
    assert.strictEqual(piece.secondary.items.length, 1);

    const mainWidgetId = piece.main.items[0]._id;
    const secondaryWidgetId = piece.secondary.items[0]._id;

    // Use PATCH with @ syntax to update both widgets by their _id in a single call
    piece = await apos.http.patch(`/api/v1/test-piece/${piece._id}`, {
      body: {
        [`@${mainWidgetId}`]: {
          _id: mainWidgetId,
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>Updated main content</p>'
        },
        [`@${secondaryWidgetId}`]: {
          _id: secondaryWidgetId,
          metaType: 'widget',
          type: '@apostrophecms/rich-text',
          content: '<p>Updated secondary content</p>'
        }
      },
      jar
    });

    // Verify both widgets were updated in the response
    assert(piece.main);
    assert(piece.main.items);
    assert.strictEqual(piece.main.items.length, 1);
    assert.strictEqual(piece.main.items[0]._id, mainWidgetId);
    assert.strictEqual(piece.main.items[0].content, '<p>Updated main content</p>');

    assert(piece.secondary);
    assert(piece.secondary.items);
    assert.strictEqual(piece.secondary.items.length, 1);
    assert.strictEqual(piece.secondary.items[0]._id, secondaryWidgetId);
    assert.strictEqual(piece.secondary.items[0].content, '<p>Updated secondary content</p>');

    // Fetch the piece again to verify the changes persisted
    const fetched = await apos.http.get(`/api/v1/test-piece/${piece._id}`, { jar });

    assert.strictEqual(fetched.main.items[0].content, '<p>Updated main content</p>');
    assert.strictEqual(fetched.secondary.items[0].content, '<p>Updated secondary content</p>');
  });
});
