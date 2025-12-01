const path = require('node:path');
const fs = require('node:fs/promises');
const t = require('../test-lib/test.js');
const assert = require('assert/strict');

const uploadFilename = 'upload_image.png';
const uploadSource = path.join(__dirname, `/data/upload_tests/${uploadFilename}`);
const uploadTarget = path.join(__dirname, '/public/uploads/attachments');

describe('Relationships (area)', function () {

  let apos;
  let jar;

  before(async function () {
    apos = await t.create({
      root: module,
      modules: getModules()
    });
    await t.createAdmin(apos, 'admin', {
      username: 'admin',
      password: 'admin'
    });
    jar = await t.loginAs(apos, 'admin', 'admin');
    await insertRelationships(apos);
    await deletePublicUploadsDirectory();
  });

  after(async function () {
    await t.destroy(apos);
    apos = null;
    jar = null;
    await deletePublicUploadsDirectory();
  });

  this.timeout(t.timeout);

  // PRO-8108 regression test
  it('should not duplicate resolved relationships found in area widget relation of an relation when working with lists', async function () {
    const response = await apos.http.get('/api/v1/article', { jar });

    const actual = {
      articles: response.results?.length,
      authorsPerArticle: response.results.map(article => {
        return {
          authors: article._author.length,
          imageWidgets: article._author[0]?.profileImage?.items?.length || 0,
          resolvedAuthorImages: article._author[0]?.profileImage?.items?.[0]
            ?._image?.length || 0
        };
      })
    };
    const expected = {
      articles: 3,
      authorsPerArticle: [
        {
          authors: 1,
          imageWidgets: 1,
          resolvedAuthorImages: 1
        },
        {
          authors: 1,
          imageWidgets: 1,
          resolvedAuthorImages: 1
        },
        {
          authors: 1,
          imageWidgets: 1,
          resolvedAuthorImages: 1
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });
});

function getModules() {
  return {
    article: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'article'
      },
      fields: {
        add: {
          _author: {
            type: 'relationship',
            label: 'Author',
            withType: 'author',
            withRelationships: [ '_articles' ]
          }
        }
      }
    },
    author: {
      extend: '@apostrophecms/piece-type',
      options: {
        alias: 'author'
      },
      fields: {
        add: {
          profileImage: {
            type: 'area',
            options: {
              max: 1,
              widgets: {
                '@apostrophecms/image': {}
              }
            }
          }
        }
      }
    }
  };
}

// TEST UTILS

async function insertRelationships(apos) {
  const req = apos.task.getReq({
    mode: 'published'
  });

  // Image
  const attachment = await apos.attachment.insert(req, {
    name: uploadFilename,
    path: uploadSource
  });
  const image = apos.image.newInstance();
  const input = {
    title: 'Test Image',
    slug: 'test-image',
    attachment
  };
  await apos.schema.convert(req, apos.image.schema, input, image);
  await apos.image.insert(req, image);

  // Author
  let author = apos.author.newInstance();
  const authorInput = {
    title: 'Author',
    slug: 'author',
    profileImage: {
      items: [
        {
          type: '@apostrophecms/image',
          _image: [ image ]
        }
      ]
    }
  };
  await apos.schema.convert(req, apos.author.schema, authorInput, author);
  author = await apos.author.insert(req, author);

  // Articles
  for (let i = 0; i < 3; i++) {
    const article = apos.article.newInstance();
    const articleInput = {
      title: `Article ${i + 1}`,
      slug: `article-${i + 1}`,
      _author: [ author ]
    };
    await apos.schema.convert(req, apos.article.schema, articleInput, article);
    await apos.article.insert(req, article);
  }
};

async function deletePublicUploadsDirectory() {
  await fs.rm(uploadTarget, {
    recursive: true,
    force: true
  });
  await fs.mkdir(uploadTarget, { recursive: true });
}
