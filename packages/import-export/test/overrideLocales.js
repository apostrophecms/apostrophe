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

describe('#import - overriding locales integration tests', function() {
  this.timeout(t.timeout);

  let apos;
  let importExportManager;
  let attachmentPath;

  describe('when the site has only one locale', function() {
    before(async function() {
      apos = await t.create({
        root: module,
        testModule: true,
        modules: getAppConfig()
      });

      attachmentPath = path.join(apos.rootDir, 'public/uploads/attachments');
      importExportManager = apos.modules['@apostrophecms/import-export'];

      await insertAdminUser(apos);
    });

    after(async function() {
      await t.destroy(apos);
    });

    this.beforeEach(async function() {
      await deletePiecesAndPages(apos);
      await deleteAttachments(apos, attachmentPath);
      await cleanFixtures(apos);
      await copyFixtures(apos);
      await buildFixtures(apos);
    });

    it('should not rewrite the docs locale nor ask about it when the locale is the same', async function() {
      const req = apos.task.getReq({
        locale: 'en',
        body: {}
      });

      const {
        duplicatedDocs,
        notificationId
      } = await importExportManager.import(
        req.clone({
          files: {
            file: {
              path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft.tar.gz'),
              type: importExportManager.formats.gzip.allowedTypes[0]
            }
          }
        })
      );

      const notification = await apos.notification.db
        .findOne({ _id: notificationId });
      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      const actual = {
        duplicatedDocs,
        notification: {
          name: notification.event?.name
        },
        topics
      };
      const expected = {
        duplicatedDocs: [],
        notification: {
          name: undefined
        },
        topics: [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':en:draft'),
            aposMode: 'draft',
            aposLocale: 'en:draft',
            slug: 'topic1',
            title: 'topic1',
            type: 'topic'
          }
        ]
      };

      assert.deepEqual(actual, expected);
    });

    // FIX
    it('should rewrite the docs locale without asking about it when the locale is different', async function() {
      const req = apos.task.getReq({
        locale: 'en',
        body: {}
      });

      const {
        duplicatedDocs,
        notificationId
      } = await importExportManager.import(
        req.clone({
          files: {
            file: {
              path: path.join(apos.rootDir, 'data/tmp/uploads/fr-topic-draft.tar.gz'),
              type: importExportManager.formats.gzip.allowedTypes[0]
            }
          }
        })
      );

      const notification = await apos.notification.db
        .findOne({ _id: notificationId });
      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      const actual = {
        duplicatedDocs,
        notification: {
          name: notification.event?.name
        },
        topics
      };
      const expected = {
        duplicatedDocs: [],
        notification: {
          name: undefined
        },
        topics: [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':en:draft'),
            aposMode: 'draft',
            aposLocale: 'en:draft',
            slug: 'topic1-fr',
            title: 'topic1 FR',
            type: 'topic'
          }
        ]
      };

      assert.deepEqual(actual, expected);
    });
  });

  describe('when the site has multiple locales', function() {
    before(async function() {
      apos = await t.create({
        root: module,
        testModule: true,
        modules: getAppConfig({
          '@apostrophecms/express': {
            options: {
              session: { secret: 'supersecret' }
            }
          },
          '@apostrophecms/i18n': {
            options: {
              defaultLocale: 'en',
              locales: {
                en: { label: 'English' },
                fr: {
                  label: 'French',
                  prefix: '/fr'
                }
              }
            }
          }
        })
      });

      attachmentPath = path.join(apos.rootDir, 'public/uploads/attachments');
      importExportManager = apos.modules['@apostrophecms/import-export'];

      await insertAdminUser(apos);
    });

    after(async function() {
      await t.destroy(apos);
    });

    this.beforeEach(async function() {
      await deletePiecesAndPages(apos);
      await deleteAttachments(apos, attachmentPath);
      await cleanFixtures(apos);
      await copyFixtures(apos);
      await buildFixtures(apos);
    });

    it('should not rewrite the docs locale nor ask about it when the locale is the same', async function() {
      const req = apos.task.getReq({
        locale: 'fr',
        body: {}
      });

      await apos.topic.insert(
        apos.task.getReq({
          locale: 'fr',
          mode: 'draft'
        }),
        {
          ...apos.topic.newInstance(),
          _id: '4:fr:draft',
          slug: 'topic1-fr-existing-draft',
          title: 'topic1 FR EXISTING DRAFT'
        }
      );

      await apos.topic.insert(
        apos.task.getReq({
          locale: 'fr',
          mode: 'published'
        }),
        {
          ...apos.topic.newInstance(),
          _id: '4:fr:published',
          slug: 'topic1-fr-existing-published',
          title: 'topic1 FR EXISTING PUBLISHED'
        }
      );

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
              path: path.join(apos.rootDir, 'data/tmp/uploads/fr-topic-draft.tar.gz'),
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

      const notification = await apos.notification.db
        .findOne({ _id: notificationId });
      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      const actual = {
        notification: {
          name: notification.event?.name
        },
        topics
      };
      const expected = {
        notification: {
          name: undefined
        },
        topics: [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':fr:draft'),
            aposLocale: 'fr:draft',
            aposMode: 'draft',
            modified: true,
            slug: 'topic1-fr',
            title: 'topic1 FR'
          },
          {
            ...topics.at(1),
            _id: topics.at(1).aposDocId.concat(':fr:published'),
            aposLocale: 'fr:published',
            aposMode: 'published',
            slug: 'topic1-fr-existing-published',
            title: 'topic1 FR EXISTING PUBLISHED'
          }

        ]
      };

      assert.deepEqual(actual, expected);
    });

    it('should not rewrite the docs locales nor insert them but ask about it when the locale is different', async function() {
      const req = apos.task.getReq({
        locale: 'fr',
        body: {}
      });

      const {
        notificationId
      } = await importExportManager.import(
        req.clone({
          files: {
            file: {
              path: path.join(apos.rootDir, 'data/tmp/uploads/topic-draft.tar.gz'),
              type: importExportManager.formats.gzip.allowedTypes[0]
            }
          }
        })
      );

      const notification = await apos.notification.db
        .findOne({ _id: notificationId });
      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      const actual = {
        notification: {
          name: notification.event.name
        },
        topics
      };
      const expected = {
        notification: {
          name: 'import-export-import-locale-differs'
        },
        topics: []
      };

      assert.deepEqual(actual, expected);
    });

    it('should rewrite the docs locale when the locale is different and the `overrideLocale` param is provided', async function() {
      const req = apos.task.getReq({
        locale: 'en',
        body: {}
      });

      const {
        exportId,
        formatLabel,
        importDraftsOnly,
        translate,
        notificationId: notificationId1
      } = await importExportManager.import(
        req.clone({
          files: {
            file: {
              path: path.join(apos.rootDir, 'data/tmp/uploads/fr-topic-draft.tar.gz'),
              type: importExportManager.formats.gzip.allowedTypes[0]
            }
          }
        })
      );

      const {
        duplicatedDocs,
        notificationId: notificationId2
      } = await importExportManager.import(
        req.clone({
          body: {
            ...req.body,
            importDraftsOnly,
            translate,
            overrideLocale: true,
            exportId,
            formatLabel
          }
        })
      );

      const notification1 = await apos.notification.db
        .findOne({ _id: notificationId1 });
      const notification2 = await apos.notification.db
        .findOne({ _id: notificationId2 });
      const topics = await apos.doc.db
        .find({ type: 'topic' })
        .toArray();

      const actual = {
        duplicatedDocs,
        notification1: {
          name: notification1.event?.name
        },
        notification2: {
          name: notification2.event?.name
        },
        topics
      };
      const expected = {
        duplicatedDocs: [],
        notification1: {
          name: 'import-export-import-locale-differs'
        },
        notification2: {
          name: undefined
        },
        topics: [
          {
            ...topics.at(0),
            _id: topics.at(0).aposDocId.concat(':en:draft'),
            aposMode: 'draft',
            aposLocale: 'en:draft',
            slug: 'topic1-fr',
            title: 'topic1 FR',
            type: 'topic'
          }
        ]
      };

      assert.deepEqual(actual, expected);
    });
  });
});
