const assert = require('node:assert/strict');
const path = require('node:path');
const t = require('apostrophe/test-lib/util.js');
const {
  getAppConfig,
  insertAdminUser,
  deletePiecesAndPages,
  deleteAttachments,
  buildFixtures,
  copyFixtures,
  cleanFixtures
} = require('./util/index.js');

describe('#import - when `importDraftsOnly` option is set to `true`', function () {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let attachmentPath;

  before(async function () {
    apos = await t.create({
      root: module,
      testModule: true,
      modules: getAppConfig({
        '@apostrophecms/express': {
          options: {
            session: { secret: 'supersecret' }
          }
        }
      })
    });

    attachmentPath = path.join(apos.rootDir, 'public/uploads/attachments');
    importExportManager = apos.modules['@apostrophecms/import-export'];

    await insertAdminUser(apos);
  });

  after(async function () {
    await t.destroy(apos);
  });

  describe('when `importDraftsOnly` option is not set', function () {
    this.beforeEach(async function () {
      await deletePiecesAndPages(apos);
      await deleteAttachments(apos, attachmentPath);
      await cleanFixtures(apos);
      await copyFixtures(apos);
      await buildFixtures(apos);
    });

    it('should import all the documents', async function () {
      const req = apos.task.getReq({
        locale: 'en',
        body: {}
      });

      await importExportManager.import(
        req.clone({
          files: {
            file: {
              path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft-published.tar.gz'),
              type: importExportManager.formats.gzip.allowedTypes[0]
            }
          }
        })
      );

      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      const actual = topics;
      const expected = [
        {
          ...topics.at(0),
          _id: topics.at(0).aposDocId.concat(':en:draft'),
          aposMode: 'draft',
          aposLocale: 'en:draft',
          title: 'topic1 DRAFT',
          type: 'topic'
        },
        {
          ...topics.at(1),
          _id: topics.at(1).aposDocId.concat(':en:published'),
          aposMode: 'published',
          aposLocale: 'en:published',
          title: 'topic1 PUBLISHED',
          type: 'topic'
        }
      ];

      assert.deepEqual(actual, expected);
    });
  });

  describe('when `importDraftsOnly` option is set to `true`', function () {
    this.beforeEach(async function () {
      await deletePiecesAndPages(apos);
      await deleteAttachments(apos, attachmentPath);
      await cleanFixtures(apos);
      await copyFixtures(apos);
      await buildFixtures(apos);
    });

    describe('when inserting a imported document', function () {
      it('should import only the published documents as draft', async function () {
        const req = apos.task.getReq({
          locale: 'en',
          body: {
            importDraftsOnly: true,
            formatLabel: 'gzip'
          }
        });

        await importExportManager.import(
          req.clone({
            files: {
              file: {
                path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft-published-lastPublishedAt.tar.gz'),
                type: importExportManager.formats.gzip.allowedTypes[0]
              }
            }
          })
        );

        const topics = await apos.doc.db
          .find({ type: 'topic' })
          .toArray();

        const actual = topics.map(topic => ({
          ...topic,
          lastPublishedAt: topic.lastPublishedAt
        }));
        const expected = [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':en:draft'),
            aposLocale: 'en:draft',
            aposMode: 'draft',
            lastPublishedAt: undefined,
            title: 'topic1 PUBLISHED'
          }
        ];

        assert.deepEqual(actual, expected);
      });

      it('should import the documents in draft if they do not have a published version to import', async function () {
        const req = apos.task.getReq({
          locale: 'en',
          body: {
            importDraftsOnly: true,
            formatLabel: 'gzip'
          }
        });

        await importExportManager.import(
          req.clone({
            files: {
              file: {
                path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft-lastPublishedAt.tar.gz'),
                type: importExportManager.formats.gzip.allowedTypes[0]
              }
            }
          })
        );

        const topics = await apos.doc.db
          .find({ type: 'topic' })
          .toArray();

        const actual = topics.map(topic => ({
          ...topic,
          lastPublishedAt: topic.lastPublishedAt
        }));
        const expected = [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':en:draft'),
            aposLocale: 'en:draft',
            aposMode: 'draft',
            lastPublishedAt: undefined,
            title: 'topic1 DRAFT'
          }
        ];

        assert.deepEqual(actual, expected);
      });

      describe('when importing from a CSV file', function() {
        this.beforeEach(async function () {
          await deletePiecesAndPages(apos);
          await deleteAttachments(apos, attachmentPath);
          await cleanFixtures(apos);
          await copyFixtures(apos);
          await buildFixtures(apos);
        });

        it('should import a piece from a csv file that was not made from the import-export module, as draft only', async function() {
          const req = apos.task.getReq({
            locale: 'en',
            body: {
              importDraftsOnly: true,
              formatLabel: 'CSV'
            }
          });

          await importExportManager.import(
            req.clone({
              files: {
                file: {
                  path: path.join(apos.rootDir, 'data/tmp/uploads/topic-type-title-lastPublishedAt.csv'),
                  type: importExportManager.formats.csv.allowedTypes[0]
                }
              }
            })
          );

          const topics = await apos.doc.db
            .find({ type: 'topic' })
            .toArray();

          const actual = topics.map(topic => ({
            ...topic,
            lastPublishedAt: topic.lastPublishedAt
          }));
          const expected = [
            {
              ...topics.at(0),
              _id: topics.at(0).aposDocId.concat(':en:draft'),
              aposMode: 'draft',
              aposLocale: 'en:draft',
              title: 'topic1',
              lastPublishedAt: undefined
            }
          ];

          assert.deepEqual(actual, expected);
        });

        it('should import a piece from a csv file without a type column, as long as the module name is known', async function() {
          const req = apos.task.getReq({
            locale: 'en',
            body: {
              importDraftsOnly: true,
              formatLabel: 'CSV'
            }
          });

          await importExportManager.import(
            req.clone({
              files: {
                file: {
                  path: path.join(apos.rootDir, 'data/tmp/uploads/topic-title.csv'),
                  type: importExportManager.formats.csv.allowedTypes[0]
                }
              }
            }),
            'topic'
          );

          const topics = await apos.doc.db
            .find({ type: 'topic' })
            .toArray();

          const actual = topics.map(topic => ({
            ...topic,
            lastPublishedAt: topic.lastPublishedAt
          }));
          const expected = [
            {
              ...topics.at(0),
              _id: topics.at(0).aposDocId.concat(':en:draft'),
              aposMode: 'draft',
              aposLocale: 'en:draft',
              title: 'topic1',
              lastPublishedAt: undefined
            }
          ];

          assert.deepEqual(actual, expected);
        });

        it('should import a page from a csv file that was not made from the import-export module, as draft only', async function() {
          const req = apos.task.getReq({
            locale: 'en',
            body: {
              importDraftsOnly: true,
              formatLabel: 'CSV'
            }
          });

          await importExportManager.import(
            req.clone({
              files: {
                file: {
                  path: path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-title-lastPublishedAt.csv'),
                  type: importExportManager.formats.csv.allowedTypes[0]
                }
              }
            })
          );

          const pages = await apos.doc.db
            .find({ type: 'default-page' })
            .toArray();

          const actual = pages.map(page => ({
            ...page,
            lastPublishedAt: page.lastPublishedAt
          }));
          const expected = [
            {
              ...pages.at(0),
              _id: pages.at(0).aposDocId.concat(':en:draft'),
              aposLocale: 'en:draft',
              aposMode: 'draft',
              lastPublishedAt: undefined,
              title: 'page1'
            }
          ];

          assert.deepEqual(actual, expected);
        });
      });
    });

    describe('when updating an imported document', function () {
      it('should import only the published documents as draft', async function () {
        const req = apos.task.getReq({
          locale: 'en',
          body: {
            importDraftsOnly: true,
            formatLabel: 'gzip'
          }
        });

        await apos.topic.insert(apos.task.getReq({ mode: 'draft' }), {
          ...apos.topic.newInstance(),
          _id: '4:en:draft',
          title: 'topic1 EXISTING DRAFT'
        });

        await apos.topic.insert(apos.task.getReq({ mode: 'published' }), {
          ...apos.topic.newInstance(),
          _id: '4:en:published',
          title: 'topic1 EXISTING PUBLISHED'
        });

        const {
          duplicatedDocs,
          importedAttachments,
          exportId,
          jobId,
          notificationId,
          formatLabel
        } = await importExportManager.import(
          req.clone({
            files: {
              file: {
                path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft-published-aposDocId.tar.gz'),
                type: importExportManager.formats.gzip.allowedTypes[0]
              }
            }
          })
        );

        const _req = req.clone({
          body: {
            ...req.body,
            docIds: duplicatedDocs.map(({ aposDocId }) => aposDocId),
            duplicatedDocs,
            importedAttachments,
            exportId,
            jobId,
            notificationId,
            formatLabel
          }
        });

        await importExportManager.overrideDuplicates(_req);

        const topics = await apos.doc.db
          .find({ type: 'topic' })
          .toArray();

        const actual = topics;
        const expected = [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':en:draft'),
            aposLocale: 'en:draft',
            aposMode: 'draft',
            modified: true,
            title: 'topic1 PUBLISHED'
          },
          {
            ...topics.at(1),
            _id: topics.at(1).aposDocId.concat(':en:published'),
            aposLocale: 'en:published',
            aposMode: 'published',
            title: 'topic1 EXISTING PUBLISHED'
          }
        ];

        assert.deepEqual(actual, expected);
      });

      it('should import only the published documents as draft and not set modified if the draft does not differ from publish', async function () {
        const req = apos.task.getReq({
          locale: 'en',
          body: {
            importDraftsOnly: true,
            formatLabel: 'gzip'
          }
        });

        await apos.topic.insert(apos.task.getReq({ mode: 'draft' }), {
          ...apos.topic.newInstance(),
          _id: '4:en:draft',
          slug: 'topic1-draft',
          title: 'topic1 EXISTING DRAFT'
        });

        await apos.topic.insert(apos.task.getReq({ mode: 'published' }), {
          ...apos.topic.newInstance(),
          _id: '4:en:published',
          slug: 'topic1-published',
          title: 'topic1 PUBLISHED'
        });

        const {
          duplicatedDocs,
          importedAttachments,
          exportId,
          jobId,
          notificationId,
          formatLabel
        } = await importExportManager.import(
          req.clone({
            files: {
              file: {
                path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft-published-aposDocId.tar.gz'),
                type: importExportManager.formats.gzip.allowedTypes[0]
              }
            }
          })
        );

        const _req = req.clone({
          body: {
            ...req.body,
            docIds: duplicatedDocs.map(({ aposDocId }) => aposDocId),
            duplicatedDocs,
            importedAttachments,
            exportId,
            jobId,
            notificationId,
            formatLabel
          }
        });

        await importExportManager.overrideDuplicates(_req);

        const topics = await apos.doc.db
          .find({ type: 'topic' })
          .toArray();

        const actual = topics;
        const expected = [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':en:draft'),
            aposLocale: 'en:draft',
            aposMode: 'draft',
            modified: false, // IMPORTANT, should be set to false
            slug: 'topic1-published',
            title: 'topic1 PUBLISHED'
          },
          {
            ...topics.at(1),
            _id: topics.at(1).aposDocId.concat(':en:published'),
            aposLocale: 'en:published',
            aposMode: 'published',
            slug: 'topic1-published',
            title: 'topic1 PUBLISHED'
          }
        ];

        assert.deepEqual(actual, expected);
      });

      describe('when importing from a CSV file', function() {
        this.beforeEach(async function () {
          await deletePiecesAndPages(apos);
          await deleteAttachments(apos, attachmentPath);
          await cleanFixtures(apos);
          await copyFixtures(apos);
          await buildFixtures(apos);
        });

        it('should import a piece from a csv file that was not made from the import-export module, as draft only', async function() {
          const req = apos.task.getReq({
            locale: 'en',
            body: {
              importDraftsOnly: true,
              formatLabel: 'CSV'
            }
          });

          await apos.topic.insert(apos.task.getReq({ mode: 'published' }), {
            ...apos.topic.newInstance(),
            title: 'topic1'
          });

          await importExportManager.import(
            req.clone({
              files: {
                file: {
                  path: path.join(apos.rootDir, 'data/tmp/uploads/topic-type-titleKey-title-lastPublishedAt.csv'),
                  type: importExportManager.formats.csv.allowedTypes[0]
                }
              }
            })
          );

          const topics = await apos.doc.db
            .find({ type: 'topic' })
            .toArray();

          const actual = topics;
          const expected = [
            {
              ...topics.at(0),
              _id: topics.at(0).aposDocId.concat(':en:draft'),
              aposLocale: 'en:draft',
              aposMode: 'draft',
              lastPublishedAt: topics.at(0).lastPublishedAt,
              modified: true,
              title: 'topic1 - edited'
            },
            {
              ...topics.at(1),
              _id: topics.at(1).aposDocId.concat(':en:published'),
              aposLocale: 'en:published',
              aposMode: 'published',
              lastPublishedAt: topics.at(1).lastPublishedAt,
              title: 'topic1'
            }
          ];

          assert.deepEqual(actual, expected);
        });

        it('should import a piece from a csv file that was not made from the import-export module, as draft only and not set modified if the draft does not differ from publish', async function() {
          const req = apos.task.getReq({
            locale: 'en',
            body: {
              importDraftsOnly: true,
              formatLabel: 'CSV'
            }
          });

          const piece = await apos.topic.insert(apos.task.getReq({ mode: 'published' }), {
            ...apos.topic.newInstance(),
            title: 'topic1 bbb',
            slug: 'topic1-bbb'
          });

          await apos.doc.db.updateOne({ _id: piece._id.replace(':published', ':draft') }, {
            $set: {
              title: 'topic1 aaa',
              slug: 'topic1-aaa'
            }
          });

          await importExportManager.import(
            req.clone({
              files: {
                file: {
                  path: path.join(apos.rootDir, 'data/tmp/uploads/topic-type-titleKey-title-slug-lastPublishedAt.csv'),
                  type: importExportManager.formats.csv.allowedTypes[0]
                }
              }
            })
          );

          const topics = await apos.doc.db
            .find({ type: 'topic' })
            .toArray();

          const actual = topics;
          const expected = [
            {
              ...topics.at(0),
              _id: topics.at(0).aposDocId.concat(':en:draft'),
              aposLocale: 'en:draft',
              aposMode: 'draft',
              lastPublishedAt: topics.at(0).lastPublishedAt,
              modified: false, // IMPORTANT, should be set to false
              slug: 'topic1-bbb',
              title: 'topic1 bbb'
            },
            {
              ...topics.at(1),
              _id: topics.at(1).aposDocId.concat(':en:published'),
              aposLocale: 'en:published',
              aposMode: 'published',
              lastPublishedAt: topics.at(1).lastPublishedAt,
              slug: 'topic1-bbb',
              title: 'topic1 bbb'
            }
          ];

          assert.deepEqual(actual, expected);
        });

        it('should import a page from a csv file that was not made from the import-export module, as draft only', async function() {
          const req = apos.task.getReq({
            locale: 'en',
            body: {
              importDraftsOnly: true,
              formatLabel: 'CSV'
            }
          });

          await apos.page.insert(apos.task.getReq({ mode: 'published' }), '_home', 'lastChild', {
            ...apos.modules['default-page'].newInstance(),
            title: 'page1'
          });

          await importExportManager.import(
            req.clone({
              files: {
                file: {
                  path: path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-titleKey-title-lastPublishedAt.csv'),
                  type: importExportManager.formats.csv.allowedTypes[0]
                }
              }
            })
          );

          const pages = await apos.doc.db
            .find({ type: 'default-page' })
            .toArray();

          const actual = pages;
          const expected = [
            {
              ...pages.at(0),
              _id: pages.at(0).aposDocId.concat(':en:draft'),
              aposLocale: 'en:draft',
              aposMode: 'draft',
              lastPublishedAt: pages.at(0).lastPublishedAt,
              modified: true,
              title: 'page1 - edited'
            },
            {
              ...pages.at(1),
              _id: pages.at(1).aposDocId.concat(':en:published'),
              aposLocale: 'en:published',
              aposMode: 'published',
              lastPublishedAt: pages.at(1).lastPublishedAt,
              title: 'page1'
            }
          ];

          assert.deepEqual(actual, expected);
        });

        it('should import a page from a csv file that was not made from the import-export module, as draft only and not set modified if the draft does not differ from publish', async function() {
          const req = apos.task.getReq({
            locale: 'en',
            body: {
              importDraftsOnly: true,
              formatLabel: 'CSV'
            }
          });

          const page = await apos.page.insert(apos.task.getReq({ mode: 'published' }), '_home', 'lastChild', {
            ...apos.modules['default-page'].newInstance(),
            title: 'page1 bbb',
            slug: '/page1-bbb'
          });

          await apos.doc.db.updateOne({ _id: page._id.replace(':published', ':draft') }, {
            $set: {
              title: 'page1 aaa',
              slug: '/page1-aaa'
            }
          });

          await importExportManager.import(
            req.clone({
              files: {
                file: {
                  path: path.join(apos.rootDir, 'data/tmp/uploads/default-page-type-titleKey-title-slug-lastPublishedAt.csv'),
                  type: importExportManager.formats.csv.allowedTypes[0]
                }
              }
            })
          );

          const pages = await apos.doc.db
            .find({ type: 'default-page' })
            .toArray();

          const actual = pages;
          const expected = [
            {
              ...pages.at(0),
              _id: pages.at(0).aposDocId.concat(':en:draft'),
              aposLocale: 'en:draft',
              aposMode: 'draft',
              lastPublishedAt: pages.at(0).lastPublishedAt,
              modified: false, // IMPORTANT, should be set to false
              slug: '/page1-bbb',
              title: 'page1 bbb'
            },
            {
              ...pages.at(1),
              _id: pages.at(1).aposDocId.concat(':en:published'),
              aposLocale: 'en:published',
              aposMode: 'published',
              lastPublishedAt: pages.at(1).lastPublishedAt,
              slug: '/page1-bbb',
              title: 'page1 bbb'
            }
          ];

          assert.deepEqual(actual, expected);
        });
      });
    });
  });
});
