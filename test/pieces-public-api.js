const t = require('../test-lib/test.js');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Pieces Public API', function() {

  let apos;

  this.timeout(t.timeout);

  after(async function () {
    return t.destroy(apos);
  });

  /// ///
  // EXISTENCE
  /// ///

  it('should initialize with a schema', async function() {
    apos = await t.create({
      root: module,

      modules: {
        thing: {
          extend: '@apostrophecms/piece-type',
          options: {
            alias: 'thing',
            label: 'Thing'
          },
          fields: {
            add: {
              foo: {
                label: 'Foo',
                type: 'string'
              },
              _image: {
                label: 'Image',
                type: 'relationship',
                withType: '@apostrophecms/image',
                max: 1
              }
            }
          }
        }
      }
    });
    assert(apos.modules.thing);
    assert(apos.modules.thing.schema);
  });

  const testThing = {
    _id: 'testThing:en:published',
    title: 'hello',
    foo: 'bar',
    visibility: 'public'
  };

  it('should be able to insert a piece into the database', async function() {
    await apos.thing.insert(apos.task.getReq(), testThing);
    const thing = await apos.thing.find(apos.task.getReq(), { _id: 'testThing:en:published' }).toObject();
    assert(thing);
  });

  it('should not be able to anonymously retrieve a piece by id from the database without a public API projection', async function() {
    try {
      await apos.http.get('/api/v1/thing');
      // Bad, we expected a 404
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

  it('should not be able to retrieve a piece by id from the database without a public API projection as a guest', async function() {
    await t.createUser(apos, 'guest');
    const jar = await t.loginAs(apos, 'guest');
    try {
      await apos.http.get('/api/v1/thing', {
        jar
      });
      // Bad, we expected a 404
      assert(false);
    } catch (e) {
      assert(e.status === 404);
    }
  });

  it('should be able to retrieve a piece by id from the database without a public API projection as a guest if guest API access is enabled', async function() {
    let response;
    try {
      apos.modules.thing.options.guestApiAccess = true;
      const jar = await t.loginAs(apos, 'guest');
      response = await apos.http.get('/api/v1/thing', {
        jar
      });
    } finally {
      apos.modules.thing.options.guestApiAccess = false;
    }
    assert(response);
    assert(response.results);
    assert(response.results.length === 1);
    assert(response.results[0].title === 'hello');
    assert(response.results[0].foo === 'bar');
  });

  it('should be able to anonymously retrieve a piece by id from the database with a public API projection', async function() {
    // Patch the option setting to simplify the test code
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    const response = await apos.http.get('/api/v1/thing');
    assert(response);
    assert(response.results);
    assert(response.results.length === 1);
    assert(response.results[0].title === 'hello');
    assert(!response.results[0].foo);
  });

  it('should not set a "max-age" cache-control value when retrieving pieces, when cache option is not set, with a public API projection', async function() {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };

    const response1 = await apos.http.get('/api/v1/thing', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response1.headers['cache-control'] === undefined);
    assert(response2.headers['cache-control'] === undefined);
  });

  it('should not set a "max-age" cache-control value when retrieving a single piece, when "etags" cache option is set, with a public API projection', async function() {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.thing.options.cache = {
      api: {
        maxAge: 2222,
        etags: true
      }
    };

    const response = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response.headers['cache-control'] === undefined);
  });

  it('should set a "max-age" cache-control value when retrieving pieces, with a public API projection', async function() {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.thing.options.cache = {
      api: {
        maxAge: 2222
      }
    };

    const response1 = await apos.http.get('/api/v1/thing', { fullResponse: true });
    const response2 = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    assert(response1.headers['cache-control'] === 'max-age=2222');
    assert(response2.headers['cache-control'] === 'max-age=2222');

    delete apos.thing.options.cache;
  });

  it('should set a custom etag when retrieving a single piece', async function() {
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1
    };
    apos.thing.options.cache = {
      api: {
        maxAge: 1111,
        etags: true
      }
    };

    const response = await apos.http.get('/api/v1/thing/testThing:en:published', { fullResponse: true });

    const eTagParts = response.headers.etag.split(':');

    assert(eTagParts[0] === apos.asset.getReleaseId());
    assert(
      eTagParts[1] === (new Date(response.body.cacheInvalidatedAt)).getTime().toString()
    );
    assert(eTagParts[2]);

    delete apos.thing.options.cache;
  });

  it('should resolve _urls for image attachments', async function () {
    // Reproduces https://github.com/apostrophecms/apostrophe/issues/3643
    // Create piece with image
    await await apos.doc.db.deleteMany({ type: 'thing' });
    const req = apos.task.getReq();
    await wipeUploads();
    const attachment = await upload('upload_image.png');
    const image = await apos.image.insert(req, {
      type: '@apostrophecms/image',
      slug: 'image-1',
      visibility: 'public',
      attachment
    });
    await apos.thing.insert(req, {
      ...testThing,
      _id: 'testThingAttachment:en:published',
      title: 'Hello Image',
      _image: [ image ]
    });
    apos.thing.options.publicApiProjection = {
      title: 1,
      _url: 1,
      _image: 1
    };

    // Test
    const response = await apos.http.get('/api/v1/thing');
    assert(response);
    assert.strictEqual(response.results.length, 1);

    const [ img ] = response.results[0]._image;
    assert(img);
    const att = img.attachment;
    assert(att);
    assert(att._urls);
    assert(Object.keys(att._urls).length > 0);
  });

  // HELPERS
  const uploadSource = path.join(__dirname, '/data/upload_tests/');

  async function wipeUploads() {
    deleteFolderRecursive(path.join(__dirname, '/public/uploads'));
    await await apos.doc.db.deleteMany({ type: '@apostrophecms/image' });
    return apos.db.collection('aposAttachments').deleteMany({});

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
  }

  async function upload(filename) {
    const info = await apos.attachment.insert(apos.task.getReq(), {
      name: filename,
      path: uploadSource + filename
    });
    // make sure it exists in mongo
    const result = await apos.db.collection('aposAttachments').findOne({
      _id: info._id
    });
    assert(result);
    return result;
  }

});
