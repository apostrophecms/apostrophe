const assert = require('assert').strict;
const fs = require('node:fs');
const path = require('node:path');
const t = require('../test-lib/test.js');
const {
  USERNAME, MODES, createMcpApos, withClient
} = require('./utils/mcp.js');

// The MCP server's own image tools. `save_image_to_media` adds an image to
// the media library from base64, through the attachment module's intake and
// the harness's write path; `get_image` reads one back as links, never as
// bytes. Each test runs on both protocol versions.

const JPG = fs.readFileSync(path.join(__dirname, 'public/test-image.jpg'));
// 104 KB, over the limit these tests set
const PNG = fs.readFileSync(path.join(__dirname, 'data/upload_tests/upload_image.png'));
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
    '<rect width="10" height="10" fill="red"/></svg>'
);
const MAX = 64 * 1024;

describe('MCP: image tools', function () {
  this.timeout(t.timeout);

  let apos;
  let editor;

  before(async function () {
    apos = await createMcpApos(module, {
      role: 'editor',
      options: { maxImageSize: MAX },
      modules: {
        'mcp-article': {
          extend: '@apostrophecms/piece-type'
        }
      }
    });
    editor = await apos.user.find(apos.task.getReq(), { username: USERNAME }).toObject();
  });

  after(async function () {
    await t.destroy(apos);
  });

  it('lists the image tools for MCP, and not for the assistant', async function () {
    const mcp = apos.harness.getDoorTools('mcp').map(tool => tool.name);
    const assistant = apos.harness.getDoorTools('assistant').map(tool => tool.name);
    assert(mcp.includes('save_image_to_media'));
    assert(mcp.includes('get_image'));
    assert(!assistant.includes('save_image_to_media'));
    assert(!assistant.includes('get_image'));

    const { tools } = await withClient(apos, 'auto', client => client.listTools());
    const save = tools.find(tool => tool.name === 'save_image_to_media');
    const get = tools.find(tool => tool.name === 'get_image');
    assert.equal(save.title, 'Add an image to the media library');
    assert.match(save.description, /up to 64 KB/);
    assert.equal(save.annotations.readOnlyHint, false);
    assert.equal(save.annotations.destructiveHint, false);
    assert.equal(get.annotations.readOnlyHint, true);
  });

  // The file is stored before the image document is created; a refused
  // document leaves no file behind
  it('removes the stored file when the image itself is refused', async function () {
    const filesBefore = countFiles();
    const before = await countAttachments();
    const createDocument = apos.harness.createDocument;
    apos.harness.createDocument = async () => ({
      written: [],
      refused: [ {
        title: 'Refused',
        reason: 'invalid',
        message: 'Some values were refused.',
        fields: [ {
          path: 'credit',
          reason: 'required'
        } ]
      } ]
    });
    let result;
    try {
      result = await save('auto', {
        data: JPG.toString('base64'),
        fileName: 'refused.jpg',
        title: 'Refused',
        alt: 'Refused'
      });
    } finally {
      apos.harness.createDocument = createDocument;
    }

    assert.equal(result.isError, true);
    assert.equal(
      result.content[0].text,
      'The image was refused: Some values were refused.\ncredit: required'
    );
    assert.equal(await countAttachments(), before);
    assert.equal(countFiles(), filesBefore);
  });

  for (const mode of MODES) {
    describe(`with a ${mode === 'auto' ? '2026-07-28' : '2025-era'} client`, function () {
      it('saves an image, live, and returns its id', async function () {
        const result = await save(mode, {
          data: JPG.toString('base64'),
          fileName: 'team-photo.jpg',
          title: `Team photo ${mode}`,
          alt: 'The team on the office steps'
        });

        assert.equal(result.isError, undefined);
        const image = result.structuredContent;
        assert.equal(image.type, '@apostrophecms/image');
        assert.equal(image.title, `Team photo ${mode}`);
        assert.equal(image.alt, 'The team on the office steps');
        assert.equal(image.published, true);
        assert.match(image.notice, /live/);
        assert.equal(image.fileType, 'jpg');
        assert.equal(typeof image.width, 'number');
        assert.equal(typeof image.requestId, 'string');
        assert.equal(image.doc, undefined);

        const live = await apos.doc.db.findOne({
          _id: image._id.replace(':draft', ':published')
        });
        assert.equal(live.title, `Team photo ${mode}`);
        assert.equal(live.alt, 'The team on the office steps');
        assert.equal(live.attachment.extension, 'jpg');
        assert.equal(live.attachment.length, JPG.length);
      });

      it('records the image in the change log under the user, through the mcp door', async function () {
        const image = (await save(mode, {
          data: JPG.toString('base64'),
          fileName: 'logged.jpg',
          title: 'Logged',
          alt: 'Logged'
        })).structuredContent;

        const entry = await apos.harness.changes.findOne({
          requestId: image.requestId,
          docId: image._id
        });
        assert(entry);
        assert.equal(entry.effect, 'create');
        assert.equal(entry.door, 'mcp');
        assert.equal(entry.ai, true);
        assert.equal(entry.userId, editor._id);
        assert.deepEqual(entry.toolCalls, [ {
          id: image.requestId,
          name: 'save_image_to_media'
        } ]);
      });

      it('takes a data URL, and corrects an extension the file contradicts', async function () {
        const image = (await save(mode, {
          data: `data:image/png;base64,${JPG.toString('base64')}`,
          fileName: 'mislabeled.png',
          title: 'Mislabeled',
          alt: 'Mislabeled'
        })).structuredContent;

        assert.equal(image.fileType, 'jpg');
      });

      it('saves an SVG', async function () {
        const result = await save(mode, {
          data: SVG.toString('base64'),
          fileName: 'square.svg',
          title: 'Square',
          alt: 'A red square'
        });

        assert.equal(result.isError, undefined);
        assert.equal(result.structuredContent.fileType, 'svg');
      });

      it('refuses an image over the limit, stating it, and stores nothing', async function () {
        const before = await countAttachments();
        const result = await save(mode, {
          data: PNG.toString('base64'),
          fileName: 'big.png',
          title: 'Too big',
          alt: 'Too big'
        });

        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /^The image is 102 KB, over the limit of 64 KB/);
        assert.equal(await countAttachments(), before);
        assert.equal(await countImages('Too big'), 0);
      });

      it('refuses a file type the media library doesn\'t take', async function () {
        const before = await countAttachments();
        const result = await save(mode, {
          data: Buffer.from('Just some notes').toString('base64'),
          fileName: 'notes.txt',
          title: 'Notes',
          alt: 'Notes'
        });

        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /"notes.txt" isn't an image type/);
        assert.match(result.content[0].text, /jpg/);
        assert.equal(await countAttachments(), before);
      });

      it('refuses data that isn\'t an image, whatever its name says', async function () {
        const before = await countAttachments();
        const png = await save(mode, {
          data: Buffer.from('Not an image at all').toString('base64'),
          fileName: 'fake.png',
          title: 'Fake',
          alt: 'Fake'
        });
        const svg = await save(mode, {
          data: JPG.toString('base64'),
          fileName: 'fake.svg',
          title: 'Fake',
          alt: 'Fake'
        });

        assert.equal(png.isError, true);
        assert.match(png.content[0].text, /isn't an image the media library takes/);
        assert.equal(svg.isError, true);
        assert.match(svg.content[0].text, /isn't an SVG image/);
        assert.equal(await countAttachments(), before);
        assert.equal(await countImages('Fake'), 0);
      });

      it('refuses data that isn\'t base64', async function () {
        const result = await save(mode, {
          data: 'not base64 at all!',
          fileName: 'photo.jpg',
          title: 'Photo',
          alt: 'Photo'
        });

        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /isn't valid base64/);
      });

      it('reads an image back as working links, with no image data', async function () {
        const saved = (await save(mode, {
          data: JPG.toString('base64'),
          fileName: 'read-back.jpg',
          title: 'Read back',
          alt: 'A photo to read back'
        })).structuredContent;

        const result = await call(mode, 'get_image', { _id: saved._id });

        assert.equal(result.isError, undefined);
        const image = result.structuredContent;
        assert.equal(image._id, saved._id);
        assert.equal(image.title, 'Read back');
        assert.equal(image.alt, 'A photo to read back');
        assert.equal(image.width, saved.width);
        assert.equal(image.height, saved.height);
        assert.equal(image.fileType, 'jpg');
        // Every default size, smallest first, at the dimensions uploadfs
        // makes from a 450×600 photo: fitted inside each box, never enlarged
        assert.deepEqual(
          image.sizes.map(size => `${size.name} ${size.width}×${size.height}`),
          [
            'one-sixth 190×253',
            'one-third 380×507',
            'one-half 450×600',
            'two-thirds 450×600',
            'full 450×600',
            'max 450×600'
          ]
        );
        for (const { url } of image.sizes) {
          assert.match(url, /^http:\/\/localhost:\d+\/uploads\/attachments\//);
          const response = await fetch(url);
          assert.equal(response.status, 200);
          assert.match(response.headers.get('content-type'), /^image\/jpeg/);
        }
        // Links only: nothing near the size of the file, and no base64
        const text = result.content[0].text;
        assert(text.length < 2000);
        assert(!text.includes(JPG.toString('base64').slice(0, 40)));
      });

      it('links an SVG as its one file', async function () {
        const saved = (await save(mode, {
          data: SVG.toString('base64'),
          fileName: 'linked.svg',
          title: 'Linked',
          alt: 'Linked'
        })).structuredContent;

        const { sizes } = (await call(mode, 'get_image', { _id: saved._id }))
          .structuredContent;

        assert.deepEqual(sizes.map(size => size.name), [ 'original' ]);
        assert.equal((await fetch(sizes[0].url)).status, 200);
      });

      it('refuses a document that isn\'t an image', async function () {
        const article = await apos.modules['mcp-article'].insert(
          apos.task.getReq({ mode: 'draft' }),
          { title: 'An article' }
        );

        const result = await call(mode, 'get_image', { _id: article._id });

        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /is not an image: it is a "mcp-article"/);
      });

      it('refuses an id that names nothing', async function () {
        const result = await call(mode, 'get_image', { _id: 'nonexistent' });

        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /^No document "nonexistent" the user can read/);
      });
    });
  }

  // The files stored for attachments
  function countFiles() {
    const uploads = path.join(apos.rootDir, 'public/uploads/attachments');
    return fs.existsSync(uploads) ? fs.readdirSync(uploads).length : 0;
  }

  function countAttachments() {
    return apos.attachment.db.countDocuments({});
  }

  function countImages(title) {
    return apos.doc.db.countDocuments({
      type: '@apostrophecms/image',
      title
    });
  }

  function save(mode, args) {
    return call(mode, 'save_image_to_media', args);
  }

  function call(mode, name, args) {
    return withClient(apos, mode, client => client.callTool({
      name,
      arguments: args
    }));
  }
});

// A user who may neither add images nor read the media library's drafts
describe('MCP: image tools for a user without media rights', function () {
  this.timeout(t.timeout);

  let apos;
  let image;

  before(async function () {
    apos = await createMcpApos(module, { role: 'guest' });
    const req = apos.task.getReq({ mode: 'draft' });
    const attachment = await apos.attachment.insert(req, {
      name: 'test-image.jpg',
      path: path.join(__dirname, 'public/test-image.jpg')
    });
    image = await apos.image.insert(req, {
      title: 'An image',
      attachment
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  for (const mode of MODES) {
    describe(`with a ${mode === 'auto' ? '2026-07-28' : '2025-era'} client`, function () {
      it('refuses to save an image, storing nothing', async function () {
        const before = await apos.attachment.db.countDocuments({});
        const result = await call(mode, 'save_image_to_media', {
          data: JPG.toString('base64'),
          fileName: 'photo.jpg',
          title: 'Not allowed',
          alt: 'Not allowed'
        });

        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /may not add images/);
        assert.equal(await apos.attachment.db.countDocuments({}), before);
      });

      it('refuses to read an image it can\'t see, as not found', async function () {
        const result = await call(mode, 'get_image', { _id: image._id });

        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /^No document ".+" the user can read/);
        assert(!result.content[0].text.includes('An image'));
      });
    });
  }

  function call(mode, name, args) {
    return withClient(apos, mode, client => client.callTool({
      name,
      arguments: args
    }));
  }
});

// A project with its own image sizes: `get_image` links to exactly those,
// whatever their names
describe('MCP: image tools with a project\'s own image sizes', function () {
  this.timeout(t.timeout);

  let apos;
  let image;

  before(async function () {
    apos = await createMcpApos(module, {
      modules: {
        '@apostrophecms/attachment': {
          imageSizes: {
            remove: [ 'full', 'two-thirds', 'one-half', 'one-third', 'one-sixth' ],
            add: {
              hero: {
                width: 2000,
                height: 800
              },
              thumb: {
                width: 100,
                height: 100
              }
            }
          }
        }
      }
    });
    const req = apos.task.getReq({ mode: 'draft' });
    const attachment = await apos.attachment.insert(req, {
      name: 'test-image.jpg',
      path: path.join(__dirname, 'public/test-image.jpg')
    });
    image = await apos.image.insert(req, {
      title: 'An image',
      alt: 'An image',
      attachment
    });
  });

  after(async function () {
    await t.destroy(apos);
  });

  for (const mode of MODES) {
    describe(`with a ${mode === 'auto' ? '2026-07-28' : '2025-era'} client`, function () {
      it('links every size the project has, with its dimensions', async function () {
        const result = await withClient(apos, mode, client => client.callTool({
          name: 'get_image',
          arguments: { _id: image._id }
        }));

        assert.equal(result.isError, undefined);
        const { sizes } = result.structuredContent;
        assert.deepEqual(
          sizes.map(size => `${size.name} ${size.width}×${size.height}`),
          [
            'thumb 75×100',
            'max 450×600',
            'hero 450×600'
          ]
        );
        for (const { url } of sizes) {
          const response = await fetch(url);
          assert.equal(response.status, 200);
        }
      });
    });
  }
});
