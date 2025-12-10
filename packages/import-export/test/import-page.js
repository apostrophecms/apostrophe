const assert = require('assert').strict;
const path = require('path');
const fs = require('fs/promises');
const t = require('apostrophe/test-lib/util.js');
const { getAppConfig } = require('./util/index.js');

async function createPages(apos) {
  const req = apos.task.getReq({ mode: 'draft' });
  const level1Page1 = await apos.page.insert(
    req,
    '_home',
    'lastChild',
    {
      title: 'Level 1 Page 1',
      type: 'test-page',
      slug: '/level-1-page-1'
    }
  );
  const level1Page2 = await apos.page.insert(
    req,
    '_home',
    'lastChild',
    {
      title: 'Level 1 Page 2',
      type: 'test-page',
      slug: '/level-1-page-2'
    }
  );
  const level1Page3 = await apos.page.insert(
    req,
    '_home',
    'lastChild',
    {
      title: 'Level 1 Page 3',
      type: 'test-page',
      slug: '/level-1-page-3'
    }
  );
  const attachment = apos.attachment.insert(req, {
    name: 'test-image.jpg',
    path: `${apos.rootDir}/public/test-image.jpg`
  });

  const inlineImage = await apos.image.insert(req, {
    ...apos.image.newInstance(),
    title: 'inline-image',
    attachment
  });

  const richTextRaw = {
    type: '@apostrophecms/rich-text',
    content: `
        <p>
          <a href="#apostrophe-permalink-${level1Page3.aposDocId}?updateTitle=1">Test Link</a>
        </p>
        <figure>
          <img src="/api/v1/@apostrophecms/image/${inlineImage.aposDocId}/src" alt="alt text" />
          <figcaption></figcaption>
        </figure>
      `
  };

  const richTextWidget = await apos.modules['@apostrophecms/rich-text-widget'].sanitize(req, richTextRaw, {
    insert: [ 'image' ]
  });

  const level1Page4 = await apos.page.insert(
    req,
    '_home',
    'lastChild',
    {
      title: 'Level 1 Page 4',
      type: 'rich-text-page',
      slug: '/level-1-page-4',
      main: {
        metaType: 'area',
        items: [
          richTextWidget
        ]
      }
    }
  );

  const level2Page1 = await apos.page.insert(
    req,
    level1Page1._id,
    'lastChild',
    {
      title: 'Level 2 Page 1',
      type: 'test-page',
      slug: '/level-1-page-1/level-2-page-1'
    }
  );
  const level3Page1 = await apos.page.insert(
    req,
    level2Page1._id,
    'lastChild',
    {
      title: 'Level 3 Page 1',
      type: 'test-page',
      slug: '/level-1-page-1/level-2-page-1/level-3-page-1'
    }
  );
  const level4Page1 = await apos.page.insert(
    req,
    level3Page1._id,
    'lastChild',
    {
      title: 'Level 4 Page 1',
      type: 'test-page',
      slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1'
    }
  );
  const level5Page1 = await apos.page.insert(
    req,
    level4Page1._id,
    'lastChild',
    {
      title: 'Level 5 Page 1',
      type: 'test-page',
      slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1/level-5-page-1'
    }
  );
  const level5Page2 = await apos.page.insert(
    req,
    level4Page1._id,
    'lastChild',
    {
      title: 'Level 5 Page 2',
      type: 'test-page',
      slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1/level-5-page-2'
    }
  );

  await apos.page.publish(req, level1Page1);
  await apos.page.publish(req, level1Page2);
  await apos.page.publish(req, level1Page3);
  await apos.page.publish(req, level1Page4);
  await apos.page.publish(req, level2Page1);
  await apos.page.publish(req, level3Page1);
  await apos.page.publish(req, level4Page1);
  await apos.page.publish(req, level5Page1);
  await apos.page.publish(req, level5Page2);
}

const server = {
  start: () => {
    const appConfig = getAppConfig();

    return t.create({
      root: module,
      testModule: true,
      modules: {
        ...appConfig,
        '@apostrophecms/page': {
          options: {
            park: [
              {
                parkedId: 'custom',
                type: 'custom-page',
                _defaults: {
                  slug: '/custom',
                  title: 'Custom'
                }
              }
            ],
            types: [
              {
                name: '@apostrophecms/home-page',
                label: 'Home'
              },
              {
                name: 'test-page',
                label: 'Test Page'
              },
              {
                name: 'custom-page',
                label: 'Custom Page'
              },
              {
                name: 'rich-text-page',
                label: 'Rich Text Page'
              }
            ]
          }
        },
        'custom-page': {
          extend: '@apostrophecms/page-type'
        },
        'rich-text-page': {
          extend: '@apostrophecms/page-type',
          fields: {
            add: {
              main: {
                type: 'area',
                options: {
                  widgets: {
                    '@apostrophecms/rich-text': {
                      insert: [ 'image' ]
                    }
                  }
                }
              }
            }
          }
        },
        'test-page': {
          extend: '@apostrophecms/page-type'
        },
        '@apostrophecms/import-export': {
          options: {
            importExport: {
              export: {
                expiration: 10 * 1000
              }
            }
          }
        }
      }
    });
  },
  stop: async (apos) => {
    await t.destroy(apos);
  },
  cleanup: async (apos) => {
    await apos.doc.db.deleteMany({ type: '@apostrophecms/archive-page' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/home-page' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/image' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/image-tag' });
    await apos.doc.db.deleteMany({ type: 'custom-page' });
    await apos.doc.db.deleteMany({ type: 'test-page' });
    await apos.doc.db.deleteMany({ type: 'rich-text-page' });
  }
};

describe('@apostrophecms/import-export:import-page', function () {
  let apos;
  let exportsPath;
  let tempPath;

  this.timeout(t.timeout);

  beforeEach(async function() {
    apos = await server.start();
    exportsPath = path.join(apos.rootDir, 'public/uploads/exports');
    tempPath = path.join(apos.rootDir, 'data/temp/uploadfs');

    await createPages(apos);
    // TODO: add rich text with link to pages and images with tags
  });

  afterEach(async function() {
    await apos.doc.db.deleteMany({ type: '@apostrophecms/archive-page' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/home-page' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/image' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/image-tag' });
    await apos.doc.db.deleteMany({ type: 'custom-page' });
    await apos.doc.db.deleteMany({ type: 'test-page' });

    await server.stop(apos);
  });

  it('should import pages', async function () {
    const req = apos.task.getReq({ mode: 'draft' });

    const manager = apos.page;
    const ids = await manager
      .find(
        req,
        {
          title: {
            $in: [
              'Level 2 Page 1',
              'Level 4 Page 1'
            ]
          }
        },
        {
          project: {
            _id: 1
          }
        }
      )
      .toArray();

    // export
    const exportReq = apos.task.getReq({
      body: {
        _ids: ids.map(({ _id }) => _id),
        extension: 'gzip',
        relatedTypes: [ '@apostrophecms/home-page', '@apostrophecms/image', '@apostrophecms/image-tag', 'test-page' ],
        type: req.t('apostrophe:pages')
      }
    });
    const { url } = await apos.modules['@apostrophecms/import-export'].export(exportReq, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    await server.cleanup(apos);
    await server.stop(apos);
    apos = await server.start();

    // import
    const mimeType = apos.modules['@apostrophecms/import-export'].formats.gzip.allowedTypes.at(0);
    const importReq = apos.task.getReq({
      body: {},
      files: {
        file: {
          path: importFilePath,
          type: mimeType
        }
      }
    });
    await apos.modules['@apostrophecms/import-export'].import(importReq);

    const importedDocs = await apos.doc.db
      .find({ type: /@apostrophecms\/image|@apostrophecms\/image-tag|test-page/ })
      .sort({
        type: 1,
        title: 1,
        aposMode: 1
      })
      .toArray();

    const homeDraft = await apos.page.find(apos.task.getReq({ mode: 'draft' }), { slug: '/' }).toObject();
    const homePublished = await apos.page.find(apos.task.getReq({ mode: 'published' }), { slug: '/' }).toObject();

    const actual = {
      docs: importedDocs.map(doc => {
        const { main, ...rest } = doc;
        return rest;
      })
    };
    const expected = {
      docs: [
        {
          _id: importedDocs.at(0)._id,
          aposDocId: importedDocs.at(0).aposDocId,
          aposLocale: 'en:draft',
          aposMode: 'draft',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(0).cacheInvalidatedAt,
          createdAt: importedDocs.at(0).createdAt,
          highSearchText: importedDocs.at(0).highSearchText,
          highSearchWords: [
            'level',
            '2',
            'page',
            '1',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(0).lastPublishedAt,
          level: 1,
          lowSearchText: importedDocs.at(0).lowSearchText,
          metaType: 'doc',
          modified: false,
          path: `${homeDraft.aposDocId}/${importedDocs.at(0).aposDocId}`,
          rank: 1,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1',
          title: 'Level 2 Page 1',
          titleSortified: 'level 2 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(0).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(1)._id,
          aposDocId: importedDocs.at(1).aposDocId,
          aposLocale: 'en:published',
          aposMode: 'published',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(1).cacheInvalidatedAt,
          createdAt: importedDocs.at(1).createdAt,
          highSearchText: importedDocs.at(1).highSearchText,
          highSearchWords: [
            'level',
            '2',
            'page',
            '1',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(1).lastPublishedAt,
          level: 1,
          lowSearchText: importedDocs.at(1).lowSearchText,
          metaType: 'doc',
          orphan: false,
          path: `${homePublished.aposDocId}/${importedDocs.at(1).aposDocId}`,
          parked: null,
          parkedId: null,
          rank: 1,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1',
          title: 'Level 2 Page 1',
          titleSortified: 'level 2 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(1).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(2)._id,
          aposDocId: importedDocs.at(2).aposDocId,
          aposLocale: 'en:draft',
          aposMode: 'draft',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(2).cacheInvalidatedAt,
          createdAt: importedDocs.at(2).createdAt,
          highSearchText: importedDocs.at(2).highSearchText,
          highSearchWords: [
            'level',
            '4',
            'page',
            '1',
            '2',
            '3',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(2).lastPublishedAt,
          level: 2,
          lowSearchText: importedDocs.at(2).lowSearchText,
          metaType: 'doc',
          modified: false,
          path: `${homeDraft.aposDocId}/${importedDocs.at(0).aposDocId}/${importedDocs.at(2).aposDocId}`,
          rank: 0,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1',
          title: 'Level 4 Page 1',
          titleSortified: 'level 4 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(2).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(3)._id,
          aposDocId: importedDocs.at(3).aposDocId,
          aposLocale: 'en:published',
          aposMode: 'published',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(3).cacheInvalidatedAt,
          createdAt: importedDocs.at(3).createdAt,
          highSearchText: importedDocs.at(3).highSearchText,
          highSearchWords: [
            'level',
            '4',
            'page',
            '1',
            '2',
            '3',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(3).lastPublishedAt,
          level: 2,
          lowSearchText: importedDocs.at(3).lowSearchText,
          metaType: 'doc',
          orphan: false,
          path: `${homePublished.aposDocId}/${importedDocs.at(1).aposDocId}/${importedDocs.at(3).aposDocId}`,
          parked: null,
          parkedId: null,
          rank: 0,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1',
          title: 'Level 4 Page 1',
          titleSortified: 'level 4 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(3).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should import pages from same tarball twice without issues', async function () {
    const req = apos.task.getReq({ mode: 'draft' });

    const manager = apos.page;
    const ids = await manager
      .find(
        req,
        {
          title: {
            $in: [
              'Level 2 Page 1',
              'Level 4 Page 1'
            ]
          }
        },
        {
          project: {
            _id: 1
          }
        }
      )
      .toArray();

    // export
    const exportReq = apos.task.getReq({
      body: {
        _ids: ids.map(({ _id }) => _id),
        extension: 'gzip',
        relatedTypes: [ '@apostrophecms/home-page', '@apostrophecms/image', '@apostrophecms/image-tag', 'test-page' ],
        type: req.t('apostrophe:pages')
      }
    });
    const { url } = await apos.modules['@apostrophecms/import-export'].export(exportReq, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    const importFilePathDuplicate = importFilePath.concat('-duplicate.tar.gz');
    await fs.copyFile(exportFilePath, importFilePath);
    await fs.copyFile(exportFilePath, importFilePathDuplicate);

    await server.cleanup(apos);
    await server.stop(apos);
    apos = await server.start();

    // import
    const mimeType = apos.modules['@apostrophecms/import-export'].formats.gzip.allowedTypes.at(0);
    const importReq = apos.task.getReq({
      body: {},
      files: {
        file: {
          path: importFilePath,
          type: mimeType
        }
      }
    });
    const importDuplicateReq = apos.task.getReq({
      body: {},
      files: {
        file: {
          path: importFilePathDuplicate,
          type: mimeType
        }
      }
    });
    await apos.modules['@apostrophecms/import-export'].import(importReq);
    await apos.modules['@apostrophecms/import-export'].import(importDuplicateReq);

    const importedDocs = await apos.doc.db
      .find({ type: /@apostrophecms\/image|@apostrophecms\/image-tag|test-page/ })
      .sort({
        type: 1,
        title: 1,
        aposMode: 1
      })
      .toArray();

    const homeDraft = await apos.page.find(apos.task.getReq({ mode: 'draft' }), { slug: '/' }).toObject();
    const homePublished = await apos.page.find(apos.task.getReq({ mode: 'published' }), { slug: '/' }).toObject();

    const actual = {
      docs: importedDocs.map(doc => {
        const { main, ...rest } = doc;
        return rest;
      })
    };
    const expected = {
      docs: [
        {
          _id: importedDocs.at(0)._id,
          aposDocId: importedDocs.at(0).aposDocId,
          aposLocale: 'en:draft',
          aposMode: 'draft',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(0).cacheInvalidatedAt,
          createdAt: importedDocs.at(0).createdAt,
          highSearchText: importedDocs.at(0).highSearchText,
          highSearchWords: [
            'level',
            '2',
            'page',
            '1',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(0).lastPublishedAt,
          level: 1,
          lowSearchText: importedDocs.at(0).lowSearchText,
          metaType: 'doc',
          modified: false,
          path: `${homeDraft.aposDocId}/${importedDocs.at(0).aposDocId}`,
          rank: 1,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1',
          title: 'Level 2 Page 1',
          titleSortified: 'level 2 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(0).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(1)._id,
          aposDocId: importedDocs.at(1).aposDocId,
          aposLocale: 'en:published',
          aposMode: 'published',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(1).cacheInvalidatedAt,
          createdAt: importedDocs.at(1).createdAt,
          highSearchText: importedDocs.at(1).highSearchText,
          highSearchWords: [
            'level',
            '2',
            'page',
            '1',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(1).lastPublishedAt,
          level: 1,
          lowSearchText: importedDocs.at(1).lowSearchText,
          metaType: 'doc',
          orphan: false,
          path: `${homePublished.aposDocId}/${importedDocs.at(1).aposDocId}`,
          parked: null,
          parkedId: null,
          rank: 1,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1',
          title: 'Level 2 Page 1',
          titleSortified: 'level 2 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(1).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(2)._id,
          aposDocId: importedDocs.at(2).aposDocId,
          aposLocale: 'en:draft',
          aposMode: 'draft',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(2).cacheInvalidatedAt,
          createdAt: importedDocs.at(2).createdAt,
          highSearchText: importedDocs.at(2).highSearchText,
          highSearchWords: [
            'level',
            '4',
            'page',
            '1',
            '2',
            '3',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(2).lastPublishedAt,
          level: 2,
          lowSearchText: importedDocs.at(2).lowSearchText,
          metaType: 'doc',
          modified: false,
          path: `${homeDraft.aposDocId}/${importedDocs.at(0).aposDocId}/${importedDocs.at(2).aposDocId}`,
          rank: 0,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1',
          title: 'Level 4 Page 1',
          titleSortified: 'level 4 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(2).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(3)._id,
          aposDocId: importedDocs.at(3).aposDocId,
          aposLocale: 'en:published',
          aposMode: 'published',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(3).cacheInvalidatedAt,
          createdAt: importedDocs.at(3).createdAt,
          highSearchText: importedDocs.at(3).highSearchText,
          highSearchWords: [
            'level',
            '4',
            'page',
            '1',
            '2',
            '3',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(3).lastPublishedAt,
          level: 2,
          lowSearchText: importedDocs.at(3).lowSearchText,
          metaType: 'doc',
          orphan: false,
          path: `${homePublished.aposDocId}/${importedDocs.at(1).aposDocId}/${importedDocs.at(3).aposDocId}`,
          parked: null,
          parkedId: null,
          rank: 0,
          searchSummary: '',
          slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1',
          title: 'Level 4 Page 1',
          titleSortified: 'level 4 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(3).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should import related documents referenced by rich text', async function() {
    const req = apos.task.getReq({ mode: 'draft' });

    const manager = apos.page;
    const ids = await manager
      .find(
        req,
        {
          title: 'Level 1 Page 4'
        },
        {
          project: {
            _id: 1
          }
        }
      )
      .toArray();

    // export
    const exportReq = apos.task.getReq({
      body: {
        _ids: ids.map(({ _id }) => _id),
        extension: 'gzip',
        // Because @apostrophecms/any-page-type is what is allowed by default by
        // the rich text editor link widget, and will show up accordingly as a related
        // type choice. An explicit page type here won't match
        relatedTypes: [ '@apostrophecms/image', 'test-page' ],
        type: req.t('apostrophe:pages')
      }
    });
    const { url } = await apos.modules['@apostrophecms/import-export'].export(exportReq, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    await server.cleanup(apos);
    await server.stop(apos);
    apos = await server.start();

    // import
    const mimeType = apos.modules['@apostrophecms/import-export'].formats.gzip.allowedTypes.at(0);
    const importReq = apos.task.getReq({
      body: {},
      files: {
        file: {
          path: importFilePath,
          type: mimeType
        }
      }
    });
    await apos.modules['@apostrophecms/import-export'].import(importReq);

    const importedDocs = await apos.doc.db
      .find({ type: /rich-text-page|@apostrophecms\/image|test-page/ })
      .sort({
        type: 1,
        title: 1,
        aposMode: 1
      })
      .toArray();
    const importedLevel1Page4 = importedDocs.find(({ title }) => title === 'Level 1 Page 4');
    assert(importedLevel1Page4);
    assert.strictEqual(importedLevel1Page4.type, 'rich-text-page');
    const content = importedLevel1Page4.main?.items?.[0]?.content;
    assert(content.includes('<figure'));
    assert(content.includes('<a '));
    const inlineImage = importedDocs.find(({ title }) => title === 'inline-image');
    assert(inlineImage);
    assert(content.includes(inlineImage.aposDocId));
    const importedLevel1Page3 = importedDocs.find(({ title }) => title === 'Level 1 Page 3');
    assert(importedLevel1Page3);
    assert(content.includes(importedLevel1Page3.aposDocId));
  });

  it('should import pages with existing parkedId and children', async function () {
    const req = apos.task.getReq({ mode: 'draft' });

    const manager = apos.page;
    const customPage = await manager.find(req, { slug: '/custom' }).toObject();
    const customLevel2Page1 = await manager.insert(
      req,
      customPage._id,
      'lastChild',
      {
        title: 'Custom Level 2 Page 1',
        type: 'test-page',
        slug: '/custom/custom-level-2-page-1'
      }
    );
    const customLevel3Page1 = await manager.insert(
      req,
      customLevel2Page1._id,
      'lastChild',
      {
        title: 'Custom Level 3 Page 1',
        type: 'test-page',
        slug: '/custom/custom-level-2-page-1/custom-level-3-page-1'
      }
    );
    await manager.publish(req, customLevel2Page1);
    await manager.publish(req, customLevel3Page1);

    const ids = await manager
      .find(
        req,
        {
          title: {
            $in: [
              'Custom',
              'Custom Level 3 Page 1'
            ]
          }
        },
        {
          project: {
            _id: 1
          }
        }
      )
      .toArray();

    // export
    const exportReq = apos.task.getReq({
      body: {
        _ids: ids.map(({ _id }) => _id),
        extension: 'gzip',
        relatedTypes: [ '@apostrophecms/home-page', '@apostrophecms/image', '@apostrophecms/image-tag', 'custom-page', 'test-page' ],
        type: req.t('apostrophe:pages')
      }
    });
    const { url } = await apos.modules['@apostrophecms/import-export'].export(exportReq, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    // cleanup
    await apos.doc.db.deleteMany({ type: '@apostrophecms/archive-page' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/home-page' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/image' });
    await apos.doc.db.deleteMany({ type: '@apostrophecms/image-tag' });
    await apos.doc.db.deleteMany({ type: 'custom-page' });
    await apos.doc.db.deleteMany({ type: 'test-page' });
    await server.stop(apos);
    apos = await server.start();

    const customDraft = await apos.page.find(apos.task.getReq({ mode: 'draft' }), { slug: '/custom' }).toObject();
    const customPublished = await apos.page.find(apos.task.getReq({ mode: 'published' }), { slug: '/custom' }).toObject();
    const newCustomDraft = await apos.page.update(
      apos.task.getReq({ mode: 'draft' }),
      {
        ...customDraft,
        title: 'New Custom'
      }
    );
    await apos.page.publish(apos.task.getReq({ mode: 'draft' }), newCustomDraft);

    // import
    const mimeType = apos.modules['@apostrophecms/import-export'].formats.gzip.allowedTypes.at(0);
    const importReq = apos.task.getReq({
      body: {},
      files: {
        file: {
          path: importFilePath,
          type: mimeType
        }
      }
    });
    const {
      duplicatedDocs,
      importedAttachments,
      exportId,
      jobId,
      notificationId,
      formatLabel
    } = await apos.modules['@apostrophecms/import-export'].import(importReq);
    const importDuplicateReq = apos.task.getReq({
      body: {
        docIds: duplicatedDocs.map(({ aposDocId }) => aposDocId),
        duplicatedDocs,
        importedAttachments,
        exportId,
        jobId,
        notificationId,
        formatLabel
      }
    });
    await apos.modules['@apostrophecms/import-export'].overrideDuplicates(importDuplicateReq);

    const importedDocs = await apos.doc.db
      .find({ type: /@apostrophecms\/image|@apostrophecms\/image-tag|custom-page|test-page/ })
      .sort({
        type: 1,
        title: 1,
        aposMode: 1
      })
      .toArray();
    const homeDraft = await apos.page.find(apos.task.getReq({ mode: 'draft' }), { slug: '/' }).toObject();
    const homePublished = await apos.page.find(apos.task.getReq({ mode: 'published' }), { slug: '/' }).toObject();

    const actual = {
      docs: importedDocs
    };
    const expected = {
      docs: [
        {
          _id: importedDocs.at(0)._id,
          aposDocId: importedDocs.at(0).aposDocId,
          aposLocale: 'en:draft',
          aposMode: 'draft',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(0).cacheInvalidatedAt,
          createdAt: importedDocs.at(0).createdAt,
          highSearchText: importedDocs.at(0).highSearchText,
          highSearchWords: [
            'custom',
            'page',
            'public'
          ],
          lastPublishedAt: importedDocs.at(0).lastPublishedAt,
          level: 1,
          lowSearchText: importedDocs.at(0).lowSearchText,
          metaType: 'doc',
          modified: false,
          orphan: false,
          parked: [
            'parkedId',
            'type'
          ],
          parkedId: 'custom',
          path: `${homeDraft.aposDocId}/${customDraft.aposDocId}`,
          rank: 0,
          searchSummary: '',
          slug: '/custom',
          title: 'Custom',
          titleSortified: 'custom',
          type: 'custom-page',
          updatedAt: importedDocs.at(0).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(1)._id,
          aposDocId: importedDocs.at(1).aposDocId,
          aposLocale: 'en:previous',
          aposMode: 'previous',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(1).cacheInvalidatedAt,
          createdAt: importedDocs.at(1).createdAt,
          highSearchText: importedDocs.at(1).highSearchText,
          highSearchWords: [
            'custom',
            'page',
            'public'
          ],
          lastPublishedAt: importedDocs.at(1).lastPublishedAt,
          level: 1,
          lowSearchText: importedDocs.at(1).lowSearchText,
          metaType: 'doc',
          orphan: false,
          path: `${homePublished.aposDocId}/${customPublished.aposDocId}`,
          parked: [
            'parkedId',
            'type'
          ],
          parkedId: 'custom',
          rank: 0,
          searchSummary: '',
          slug: `/custom-deduplicate-${importedDocs.at(1).aposDocId}`,
          title: 'Custom',
          titleSortified: 'custom',
          type: 'custom-page',
          updatedAt: importedDocs.at(1).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(2)._id,
          aposDocId: importedDocs.at(2).aposDocId,
          aposLocale: 'en:published',
          aposMode: 'published',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(2).cacheInvalidatedAt,
          createdAt: importedDocs.at(2).createdAt,
          highSearchText: importedDocs.at(2).highSearchText,
          highSearchWords: [
            'custom',
            'page',
            'public'
          ],
          lastPublishedAt: importedDocs.at(2).lastPublishedAt,
          level: 1,
          lowSearchText: importedDocs.at(2).lowSearchText,
          metaType: 'doc',
          orphan: false,
          path: `${homePublished.aposDocId}/${customPublished.aposDocId}`,
          parked: [
            'parkedId',
            'type'
          ],
          parkedId: 'custom',
          rank: 0,
          searchSummary: '',
          slug: '/custom',
          title: 'Custom',
          titleSortified: 'custom',
          type: 'custom-page',
          updatedAt: importedDocs.at(2).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(3)._id,
          aposDocId: importedDocs.at(3).aposDocId,
          aposLocale: 'en:draft',
          aposMode: 'draft',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(3).cacheInvalidatedAt,
          createdAt: importedDocs.at(3).createdAt,
          highSearchText: importedDocs.at(3).highSearchText,
          highSearchWords: [
            'custom',
            'level',
            '3',
            'page',
            '1',
            '2',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(3).lastPublishedAt,
          level: 2,
          lowSearchText: importedDocs.at(3).lowSearchText,
          metaType: 'doc',
          modified: false,
          path: `${homeDraft.aposDocId}/${customDraft.aposDocId}/${importedDocs.at(3).aposDocId}`,
          rank: 0,
          searchSummary: '',
          slug: '/custom/custom-level-2-page-1/custom-level-3-page-1',
          title: 'Custom Level 3 Page 1',
          titleSortified: 'custom level 3 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(3).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        },
        {
          _id: importedDocs.at(4)._id,
          aposDocId: importedDocs.at(4).aposDocId,
          aposLocale: 'en:published',
          aposMode: 'published',
          archived: false,
          cacheInvalidatedAt: importedDocs.at(4).cacheInvalidatedAt,
          createdAt: importedDocs.at(4).createdAt,
          highSearchText: importedDocs.at(4).highSearchText,
          highSearchWords: [
            'custom',
            'level',
            '3',
            'page',
            '1',
            '2',
            'test',
            'public'
          ],
          lastPublishedAt: importedDocs.at(4).lastPublishedAt,
          level: 2,
          lowSearchText: importedDocs.at(4).lowSearchText,
          metaType: 'doc',
          orphan: false,
          path: `${homePublished.aposDocId}/${customPublished.aposDocId}/${importedDocs.at(4).aposDocId}`,
          parked: null,
          parkedId: null,
          rank: 0,
          searchSummary: '',
          slug: '/custom/custom-level-2-page-1/custom-level-3-page-1',
          title: 'Custom Level 3 Page 1',
          titleSortified: 'custom level 3 page 1',
          type: 'test-page',
          updatedAt: importedDocs.at(4).updatedAt,
          updatedBy: {
            _id: null, // TODO: should be my user id
            title: 'System Task',
            username: null
          },
          visibility: 'public'
        }
      ]
    };

    assert.deepEqual(actual, expected);
  });

  it('should import a child page in the correct position by slug (level 2)', async function () {
    // export a child
    const req = apos.task.getReq({ mode: 'draft' });

    const manager = apos.page;
    const ids = await manager
      .find(
        req,
        {
          title: 'Level 2 Page 1'
        },
        {
          project: {
            _id: 1
          }
        }
      )
      .toArray();
    const exportReq = apos.task.getReq({
      body: {
        _ids: ids.map(({ _id }) => _id),
        extension: 'gzip',
        relatedTypes: [ '@apostrophecms/home-page', '@apostrophecms/image', '@apostrophecms/image-tag', 'test-page' ],
        type: req.t('apostrophe:pages')
      }
    });
    const { url } = await apos.modules['@apostrophecms/import-export'].export(exportReq, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    // Reset the database
    await server.cleanup(apos);
    await server.stop(apos);
    apos = await server.start();

    // Create the pages again
    await createPages(apos);
    const reqDraft = apos.task.getReq({ mode: 'draft' });
    const parent = await apos.page
      .find(reqDraft, { slug: '/level-1-page-1' })
      .toObject();
    assert(parent);

    // Remove the child that we want to import
    await apos.doc.db.deleteMany(
      {
        slug: '/level-1-page-1/level-2-page-1'
      });
    const existingChild = await apos.page
      .find(reqDraft, { slug: '/level-1-page-1/level-2-page-1' })
      .toObject();

    assert.equal(existingChild, undefined);

    // import the page
    const mimeType = apos.modules['@apostrophecms/import-export']
      .formats.gzip.allowedTypes.at(0);
    const importReq = apos.task.getReq({
      body: {},
      files: {
        file: {
          path: importFilePath,
          type: mimeType
        }
      }
    });
    await apos.modules['@apostrophecms/import-export'].import(importReq);

    // find the imported page
    const child = await apos.page
      .find(reqDraft, {
        slug: '/level-1-page-1/level-2-page-1',
        aposMode: 'draft'
      })
      .toObject();

    assert(child);

    const actual = child.path;
    const expected = `${parent.path}/${child.aposDocId}`;
    assert.equal(actual, expected, 'Child path is incorrect');
  });

  it('should import a child page in the correct position by slug (level 4)', async function () {
    // export a child
    const req = apos.task.getReq({ mode: 'draft' });

    const manager = apos.page;
    const ids = await manager
      .find(
        req,
        {
          title: 'Level 4 Page 1'
        },
        {
          project: {
            _id: 1
          }
        }
      )
      .toArray();
    const exportReq = apos.task.getReq({
      body: {
        _ids: ids.map(({ _id }) => _id),
        extension: 'gzip',
        relatedTypes: [ '@apostrophecms/home-page', '@apostrophecms/image', '@apostrophecms/image-tag', 'test-page' ],
        type: req.t('apostrophe:pages')
      }
    });
    const { url } = await apos.modules['@apostrophecms/import-export'].export(exportReq, manager);
    const fileName = path.basename(url);
    const exportFilePath = path.join(exportsPath, fileName);
    const importFilePath = path.join(tempPath, fileName);
    await fs.copyFile(exportFilePath, importFilePath);

    // Reset the database
    await server.cleanup(apos);
    await server.stop(apos);
    apos = await server.start();

    // Create the pages again
    await createPages(apos);
    const reqDraft = apos.task.getReq({ mode: 'draft' });
    const parent = await apos.page
      .find(reqDraft, { slug: '/level-1-page-1/level-2-page-1/level-3-page-1' })
      .toObject();
    assert(parent);

    // Remove the child that we want to import
    await apos.doc.db.deleteMany(
      {
        slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1'
      });
    const existingChild = await apos.page
      .find(reqDraft, {
        slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1'
      })
      .toObject();
    assert.equal(existingChild, undefined);

    // import the page
    const mimeType = apos.modules['@apostrophecms/import-export']
      .formats.gzip.allowedTypes.at(0);
    const importReq = apos.task.getReq({
      body: {},
      files: {
        file: {
          path: importFilePath,
          type: mimeType
        }
      }
    });
    await apos.modules['@apostrophecms/import-export'].import(importReq);

    // find the imported page
    const child = await apos.page
      .find(reqDraft, {
        slug: '/level-1-page-1/level-2-page-1/level-3-page-1/level-4-page-1',
        aposMode: 'draft'
      })
      .toObject();

    assert(child);

    const actual = child.path;
    const expected = `${parent.path}/${child.aposDocId}`;
    assert.equal(actual, expected, 'Child path is incorrect');
  });
});
