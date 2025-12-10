const fs = require('node:fs/promises');
const path = require('node:path');
const util = require('node:util');
const { cloneDeep } = require('lodash');
const importPage = require('./import-page.js');

module.exports = self => {
  const storage = {
    download: async (id) => {
      const artifactsPath = await self.getExportArtifactsPath(id);
      try {
        if (artifactsPath && await fs.access(artifactsPath, fs.constants.R_OK)) {
          return;
        }
      } catch (error) {
        // NOTE: artifactsPath does not exist, the file will be downloaded
      }

      const exportPath = await self.getExportPath(id);
      try {
        const exportPathStats = await fs.stat(exportPath);
        if (exportPathStats.isFile() || exportPathStats.isDirectory()) {
          return;
        }
      } catch (error) {
        // NOTE: exportPath does not exist, the file will be downloaded
      }

      const target = path.resolve('/import-export', path.basename(exportPath));
      await util.promisify(self.apos.attachment.uploadfs.copyOut)(target, exportPath);
    },
    upload: async (id) => {
      const exportPath = await self.getExportPath(id);
      const source = exportPath;
      const target = path.resolve('/import-export', path.basename(exportPath));
      await util.promisify(self.apos.attachment.uploadfs.copyIn)(source, target);
    },
    remove: async (id) => {
      const exportPath = await self.getExportPath(id);
      const artifactsPath = await self.getExportArtifactsPath(id);
      const target = path.resolve('/import-export', path.basename(exportPath));

      try {
        const stats = await fs.stat(artifactsPath);
        if (stats.isFile() || stats.isDirectory()) {
          await self.remove(artifactsPath);
        }
      } catch (error) {
        // NOTE: Nothing to remove, file or folder does not exist
      }

      try {
        const stats = await fs.stat(exportPath);
        if (stats.isFile() || stats.isDirectory()) {
          await self.remove(exportPath);
        }
      } catch (error) {
        // NOTE: Nothing to remove, file or folder does not exist
      }

      try {
        await util.promisify(self.apos.attachment.uploadfs.remove)(target);
      } catch (error) {
        console.error(error, `Unable to remove uploadfs path: "${target}"`);
      }
    }
  };

  return {
    async import(req, moduleName) {
      if (!req.user) {
        throw self.apos.error('forbidden');
      }
      const { file } = req.files || {};
      const importDraftsOnly = self.apos.launder.boolean(req.body.importDraftsOnly);
      const translate = self.apos.launder.boolean(req.body.translate);
      const overrideLocale = self.apos.launder.boolean(req.body.overrideLocale);
      const formatLabel = self.apos.launder.string(req.body.formatLabel);

      let exportPath = await self.getExportPath(
        self.apos.launder.string(req.body.exportId)
      );
      let artifactsPath;
      let format;
      let docs;
      let attachmentsInfo;

      try {
        if (overrideLocale) {
          if (!formatLabel) {
            throw self.apos.error('invalid: no `formatLabel` provided');
          }

          format = Object
            .values(self.formats)
            .find(format => format.label === formatLabel);

          if (!exportPath) {
            throw self.apos.error('invalid: no `exportPath` provided');
          }

          const exportId = await self.getExportId(exportPath);
          await storage.download(exportId);
          ({
            docs, attachmentsInfo = [], exportPath: artifactsPath
          } = await format.input(exportPath));
          await self.setExportArtifactsPath(exportId, artifactsPath);
        } else {
          if (!file) {
            throw new Error('invalid: no file provided');
          }

          format = Object
            .values(self.formats)
            .find(format => format.allowedTypes.includes(file.type));

          const exportId = await self.setExportId(file.path);
          exportPath = await self.getExportPath(exportId);
          await storage.upload(exportId);

          ({
            docs, attachmentsInfo = [], exportPath: artifactsPath
          } = await format.input(exportPath));
          await self.setExportArtifactsPath(exportId, artifactsPath);
        }

        // CSV and similar formats usually won't have a type column. For pieces,
        // this should not cause the import to fail
        if (moduleName && (moduleName !== '@apostrophecms/page')) {
          for (const doc of docs) {
            doc.type = doc.type || moduleName;
          }
        }
      } catch (error) {
        const [ errKey, type ] = !format && (file?.type || formatLabel)
          ? [ 'aposImportExport:unsupportedFileType', file?.type || formatLabel ]
          : [ 'aposImportExport:importFileError', format?.label ];

        await self.apos.notify(req, errKey, {
          interpolate: { type },
          dismiss: true,
          icon: 'alert-circle-icon',
          type: 'danger'
        });
        throw self.apos.error(error.message);
      }

      const exportId = await self.getExportId(exportPath);

      if (importDraftsOnly) {
        docs = self.getPublishedDocsAsDraft(docs);
      }

      const differentDocsLocale = self.getFirstDifferentLocale(req, docs);
      const siteHasMultipleLocales = Object.keys(self.apos.i18n.locales).length > 1;

      if (differentDocsLocale) {
        if (siteHasMultipleLocales && !overrideLocale) {
          // Display confirmation modal to ask the user if he wants to
          // continue the import with the current locale overriding the docs one:
          const { noteId: notificationId } = await self.apos.notify(req, ' ', {
            type: 'warning',
            event: {
              name: 'import-export-import-locale-differs',
              data: {
                moduleName,
                exportId,
                formatLabel: format.label,
                importDraftsOnly,
                translate,
                content: {
                  heading: req.t('aposImportExport:importWithCurrentLocaleHeading'),
                  description: req.t('aposImportExport:importWithCurrentLocaleDescription', {
                    docsLocale: differentDocsLocale,
                    currentLocale: req.locale
                  }),
                  negativeLabel: 'apostrophe:no',
                  affirmativeLabel: 'apostrophe:yes'
                }
              }
            },
            classes: [ 'apos-notification--hidden' ]
          });

          return {
            importDraftsOnly,
            overrideLocale,
            duplicatedDocs: [],
            importedAttachments: [],
            type: moduleName,
            exportId,
            jobId: null,
            notificationId,
            formatLabel: format.label,
            translate
          };
        }

        // Re-write if user decided to continue the import (`overrideLocale` param sent)
        // or if the site has only one locale configured
        self.rewriteDocsWithCurrentLocale(req, docs);
      }

      const total = docs.length + attachmentsInfo.length;
      const idsAndTypes = self.getIdsAndTypes(docs);
      const {
        reporting, jobId, notificationId
      } = await self.instantiateJob(req, total, idsAndTypes);

      const failedIds = [];
      const failedLog = {};

      await self.checkDocTypes(req, {
        reporting,
        docs,
        failedIds,
        failedLog
      });

      const { duplicatedDocs, duplicatedIds } = await self.checkDuplicates(req, {
        reporting,
        docs,
        failedIds,
        failedLog
      });

      const importedAttachments = await self.insertAttachments(req, {
        attachmentsInfo,
        reporting,
        duplicatedIds,
        failedIds,
        failedLog,
        docIds: new Set(docs.map(({ aposDocId }) => aposDocId))
      });

      await self.insertDocs(req, {
        docs,
        reporting,
        duplicatedIds,
        duplicatedDocs,
        failedIds,
        failedLog,
        importDraftsOnly,
        translate
      });

      if (!duplicatedDocs.length) {
        const logs = Object.values(failedLog);
        reporting.end(true, logs);

        const notifMsg = `aposImportExport:${logs.length ? 'importFailedForSome' : 'importSucceed'}`;

        await self.apos.notify(req, notifMsg, {
          interpolate: {
            count: logs.length
          },
          dismiss: true,
          icon: 'database-import-icon',
          type: logs.length ? 'danger' : 'success',
          event: {
            name: 'import-export-import-ended',
            data: {
              failedLog: logs
            }
          }
        });

        self.apos.notification
          .dismiss(req, notificationId, 2000)
          .catch(() => {
            // Do nothing because it's not an issue
          });

        await storage.remove(exportId);

        // One call to fix all bookkeeping re: docIds, archivedDocIds, etc.
        await self.apos.attachment.recomputeAllDocReferences();

        return {
          importDraftsOnly,
          overrideLocale,
          duplicatedDocs,
          importedAttachments,
          type: moduleName,
          exportId,
          jobId,
          notificationId,
          formatLabel: format.label,
          translate
        };
      }

      const logs = Object.values(failedLog);
      // save the failed log in the job so that it can be displayed
      // after the duplicates modal is closed
      await self.updateJobResults(jobId, {
        failedLog: logs
      });

      const results = {
        importDraftsOnly,
        overrideLocale,
        duplicatedDocs,
        importedAttachments,
        type: moduleName,
        exportId,
        jobId,
        notificationId,
        formatLabel: format.label,
        translate
      };

      // we only care about the event here,
      // to display the duplicated docs modal
      await self.apos.notify(req, ' ', {
        type: 'warning',
        event: {
          name: 'import-export-import-duplicates',
          data: results
        },
        classes: [ 'apos-notification--hidden' ]
      });

      return results;
    },

    async instantiateJob(req, total, { ids, types }) {
      const jobManager = self.apos.modules['@apostrophecms/job'];
      const job = await jobManager.start();

      const { noteId } = await self.apos.notify(req, 'aposImportExport:importing', {
        icon: 'database-import-icon',
        type: 'success',
        job: {
          _id: job._id,
          ids,
          action: 'import',
          docTypes: [ ...types ]
        },
        return: true
      });

      await jobManager.setTotal(job, total);

      return {
        reporting: {
          success(n) {
            return jobManager.success(job, n);
          },
          failure(n) {
            return jobManager.failure(job, n);
          },
          end(success = true, results) {
            return jobManager.end(job, success, results);
          }
        },
        jobId: job._id,
        notificationId: noteId
      };
    },

    async updateJobResults(jobId, results) {
      const jobManager = self.apos.modules['@apostrophecms/job'];
      try {
        await jobManager.db.updateOne({ _id: jobId }, { $set: { results } });
      } catch (err) {
        self.apos.util.error(err);
      }
    },

    getFirstDifferentLocale(req, docs) {
      const doc = docs
        .find(doc => self.isLocaleDifferent(req, doc));

      return doc && self.extractLocale(doc.aposLocale);
    },

    rewriteDocsWithCurrentLocale(req, docs) {
      for (const doc of docs) {
        if (self.isLocaleDifferent(req, doc)) {
          const [ id ] = doc._id.split(':');

          doc.__originalLocale = self.extractLocale(doc.aposLocale);
          doc._id = [ id, req.locale, doc.aposMode ].join(':');
          doc.aposLocale = [ req.locale, doc.aposMode ].join(':');
        }
      }
    },

    // Get only the published docs and convert them into draft.
    // If a doc is a draft and has no published version, we keep it.
    // If a doc has no aposMode, we keep it.
    getPublishedDocsAsDraft(docs) {
      return docs
        .filter(isPublishedOrDraftAlone)
        .map(convertToDraft);

      function isPublishedOrDraftAlone(doc) {
        // i.e "is draft without a published version"
        const isDraftAlone =
          doc.aposMode === 'draft' &&
          !docs.some(item => item.aposDocId === doc.aposDocId && item.aposMode === 'published');

        return !doc.aposMode || doc.aposMode === 'published' || isDraftAlone;
      }

      function convertToDraft(doc) {
        if (doc.aposMode === 'published') {
          return {
            ...doc,
            _id: doc._id?.replace(':published', ':draft'),
            aposLocale: doc.aposLocale?.replace(':published', ':draft'),
            aposMode: 'draft'
          };
        }

        return doc;
      }
    },

    isLocaleDifferent(req, doc) {
      return doc.aposLocale && self.extractLocale(doc.aposLocale) !== req.locale;
    },

    extractLocale(aposLocale) {
      const [ locale ] = aposLocale.split(':');

      return locale;
    },

    async checkDocTypes(req, {
      reporting, docs, failedIds, failedLog
    }) {
      const checkedTypes = new Set();

      for (const {
        _id, title, type, aposDocId, aposLocale
      } of docs) {
        const manager = self.apos.doc.getManager(type);
        if (!manager) {
          failedIds.push(aposDocId);
          failedLog[_id] = {
            _id,
            title,
            type,
            aposDocId,
            aposLocale,
            detail: req.t('aposImportExport:typeUnknown', { type })
          };
          reporting.failure();
        }

        checkedTypes.add(type);
      }
    },

    async checkDuplicates(req, {
      reporting, docs, failedIds, failedLog
    }) {
      const docIds = [];
      const replaceItems = [];
      const aposLocale = `${req.locale}:draft`;
      const alreadyFailed = [ ...failedIds ];

      for (const {
        _id, type, aposDocId, parkedId, title, updatedAt, aposMode, aposLocale
      } of docs) {
        if (alreadyFailed.includes(aposDocId)) {
          continue;
        }
        if (!self.canImport(req, type)) {
          failedIds.push(aposDocId);
          failedLog[_id] = {
            _id,
            aposDocId,
            type,
            title,
            aposLocale,
            detail: req.t('aposImportExport:errorCantImportType', { type })
          };
          reporting.failure();
          continue;
        }

        const isSingleton = self.apos.modules[type] &&
          self.apos.modules[type].options.singleton === true;

        // Mark singleton and parked docs as "replace" items.
        // Be sure to always continue the loop to avoid duplicates.
        // If the parked/singleton doc is not found, it should be processed as a
        // regular doc.
        if (isSingleton || parkedId) {
          // TODO: what about singleton with localized = false, we don't have aposMode
          // TODO: do I need that for parked page?
          if (aposMode !== 'draft' || !aposDocId) {
            continue;
          }
        }
        const replaceId = isSingleton
          ? await self.findSingletonAposDocId({
            type,
            aposLocale
          })
          : parkedId
            ? await self.findParkedAposDocId({
              parkedId,
              type,
              aposLocale
            })
            : null;
        if (replaceId) {
          // NOTE: please update duplicatedDocs launder in overrideDuplicates
          replaceItems.push({
            aposDocId,
            title,
            type,
            updatedAt,
            replaceId
          });
          continue;
        }
        if (aposDocId && !docIds.includes(aposDocId)) {
          docIds.push(aposDocId);
        }
      }

      const criteria = {
        $and: [
          { aposDocId: { $in: docIds } },
          {
            $or: [
              { aposLocale: { $exists: false } },
              { aposLocale }
            ]
          }
        ]
      };

      const duplicates = await self.apos.doc.db.distinct('aposDocId', criteria);
      const duplicatedIds = new Set(duplicates);

      const duplicatedDocs = docs
        .filter(doc => duplicatedIds.has(doc.aposDocId) && (!doc.aposMode || doc.aposMode === 'draft'))
        .map(({
          aposDocId, title, type, updatedAt
        }) => ({
          // NOTE: please update duplicatedDocs launder in overrideDuplicates
          aposDocId,
          title,
          type,
          updatedAt
        }));

      // Append the replace items to the duplicate lists, so that we can
      // get confirmation from the user to replace them
      for (const item of replaceItems) {
        duplicatedIds.add(item.aposDocId);
        duplicatedDocs.push(item);
      }

      return {
        duplicatedIds,
        duplicatedDocs
      };
    },

    async insertDocs(req, {
      docs, reporting, duplicatedIds, duplicatedDocs, failedIds, failedLog,
      importDraftsOnly, translate
    }) {
      for (const doc of docs) {
        if (duplicatedIds.has(doc.aposDocId) || failedIds.includes(doc.aposDocId)) {
          continue;
        }
        const { updateKey, updateField } = self.getUpdateKey(doc);

        // If an update key is found, we try to update the document.
        // It also means that we are in a "simple" import (CSV or Excel),
        // not in a full import process like Gzip with JSON formats.
        if (updateKey) {
          try {
            await self.insertOrUpdateDocWithKey(req, {
              doc,
              updateKey,
              updateField,
              duplicatedDocs,
              importDraftsOnly,
              translate
            });
            reporting.success();
          } catch (error) {
            reporting.failure();
            failedIds.push(doc.aposDocId);
            failedLog[doc._id] = {
              _id: doc._id,
              aposDocId: doc.aposDocId,
              type: doc.type,
              title: doc.title,
              aposLocale: doc.aposLocale,
              detail: error.data?.detail || req.t(
                'aposImportExport:errorInsertingDocument',
                { message: error.message }
              )
            };
            self.apos.util.error(error);
          }

          continue;
        }

        const cloned = cloneDeep(doc);

        try {
          const inserted = await self.insertOrUpdateDoc(req, {
            doc,
            failedIds,
            duplicatedDocs,
            importDraftsOnly,
            translate
          });
          if (inserted) {
            reporting.success();
          }
        } catch (error) {
          reporting.failure();
          failedIds.push(cloned.aposDocId);
          failedLog[cloned._id] = {
            _id: cloned._id,
            aposDocId: cloned.aposDocId,
            type: cloned.type,
            title: cloned.title,
            aposLocale: cloned.aposLocale,
            detail: error.data?.detail || req.t(
              'aposImportExport:errorInsertingDocument',
              { message: error.message }
            )
          };
          self.apos.util.error(error);
        }
      }
    },

    async insertOrUpdateDocWithKey(req, {
      doc,
      updateKey,
      updateField,
      duplicatedDocs = [],
      importDraftsOnly,
      translate
    }) {
      const manager = self.apos.doc.getManager(doc.type);
      if (!self.canImport(req, doc.type)) {
        throw new Error(`Import is disabled for this module: ${doc.type}`);
      }

      if (!doc[updateField]) {
        doc[updateField] = doc[updateKey];
      }

      self.handleRichTextFields(manager, doc);

      if (!doc[updateKey]) {
        return insert();
      }

      const matchingDraftPromise = manager.findForEditing(
        req.clone({ mode: 'draft' }),
        {
          aposMode: 'draft',
          [updateField]: doc[updateKey]
        }).toObject();

      const matchingPublishedPromise = manager.findForEditing(
        req.clone({ mode: 'published' }),
        {
          aposMode: 'published',
          [updateField]: doc[updateKey]
        }).toObject();

      let [ matchingDraft, matchingPublished ] = await Promise.all([
        matchingDraftPromise,
        matchingPublishedPromise
      ]);

      if (!matchingDraft && !matchingPublished) {
        return insert();
      }
      return update();

      async function insert() {
        // Insert as "published" to insert
        // in both draft and published versions:
        const _req = req.clone({ mode: importDraftsOnly ? 'draft' : 'published' });

        const type = doc.type;
        const docToInsert = {};

        await manager.convert(_req, doc, docToInsert, {
          presentFieldsOnly: true,
          fetchRelationships: false
        });

        if (importDraftsOnly) {
          delete docToInsert.lastPublishedAt;
        }

        let modified = translate;
        if (translate) {
          modified = await self.translateDocument(req, docToInsert);
        }
        if (manager.options.autopublish === true) {
          modified = false;
        }

        if (self.isPage(manager)) {
          // TODO: check if this is still true
          // `convert` sets the type to `@apostrophecms/home-page`,
          // let's set it back to the original type:
          docToInsert.type = type;

          return importPage.insert({
            manager: self.apos.page,
            doc: docToInsert,
            req: _req,
            duplicatedDocs,
            modified
          });
        }

        return manager.insert(_req, docToInsert, { setModified: modified });
      }

      async function update() {
        // Get the corresponding draft or published document.
        // At this point, we know that at least one of them exists.
        if (!matchingDraft) {
          matchingDraft = await manager
            .findForEditing(req.clone({ mode: 'draft' }), {
              aposMode: 'draft',
              aposDocId: matchingPublished.aposDocId
            })
            .toObject();
        }
        if (!matchingPublished) {
          matchingPublished = await manager
            .findForEditing(req.clone({ mode: 'published' }), {
              aposMode: 'published',
              aposDocId: matchingDraft.aposDocId
            })
            .toObject();
        }

        const docsToUpdate = [ matchingDraft, matchingPublished ].filter(doc => {
          if (!doc) {
            return false;
          }
          // If `importDraftsOnly` is true, we only update the existing draft version.
          if (importDraftsOnly && doc.aposMode === 'published' && matchingDraft) {
            return false;
          }
          return true;
        });

        for (const docToUpdate of docsToUpdate) {
          const _req = req.clone({ mode: docToUpdate.aposMode });

          await manager.convert(_req, doc, docToUpdate, {
            presentFieldsOnly: true,
            fetchRelationships: false
          });

          if (translate) {
            await self.translateDocument(req, docToUpdate, { update: true });
          }

          self.isPage(manager)
            ? await importPage.update({
              manager: self.apos.page,
              doc: docToUpdate,
              req: _req,
              duplicatedDocs
            })
            : await manager.update(_req, docToUpdate);
        }

        // Set the `modified` property to true if the draft version
        // is different from the published one
        if (matchingDraft) {
          await self.apos.doc.db.updateOne({ _id: matchingDraft._id }, {
            $set: {
              // If no published version exists, we consider the draft as unmodified
              modified: matchingPublished
                ? !self.apos.schema.isEqual(
                  req,
                  manager.schema,
                  matchingDraft,
                  matchingPublished
                )
                : false
            }
          });
        }
      }
    },

    getUpdateKey (doc) {
      const [ updateKey, ...rest ] = Object
        .keys(doc)
        .filter(key => key.endsWith(':key'));

      if (rest.length) {
        throw new Error('You can have only one key column for updates.');
      }

      return {
        updateKey,
        updateField: updateKey && updateKey.replace(':key', '')
      };
    },

    // Convert to rich text area if not already an area.
    handleRichTextFields(manager, doc) {
      manager.schema.forEach(field => {
        if (field.options?.importAsRichText && typeof doc[field.name] === 'string') {
          doc[field.name] = self.apos.area.fromRichText(doc[field.name]);
        }
      });
    },

    async insertAttachments(req, {
      attachmentsInfo, reporting, duplicatedIds, failedIds, failedLog, docIds
    }) {
      const importedAttachments = [];

      for (const attachmentInfo of attachmentsInfo) {
        try {
          await self.insertOrUpdateAttachment(req, {
            attachmentInfo,
            duplicatedIds,
            failedIds,
            docIds
          });
          importedAttachments.push(attachmentInfo.attachment._id);
          reporting.success();
        } catch (err) {
          self.apos.util.error(err);
          // Only register an error if no duplicated docs because
          // this attachment might be related to a duplicated doc.
          // After the duplicated docs are imported, we will check
          // if the attachment can be imported using `insertOrUpdateAttachment`
          // handler directly.
          if (!duplicatedIds.size) {
            failedLog[attachmentInfo.attachment._id] = {
              _id: attachmentInfo.attachment._id,
              aposDocId: attachmentInfo.attachment._id,
              title: attachmentInfo.attachment.title,
              type: '@apostrophecms/attachment',
              aposLocale: null,
              detail: err.message
            };
          }
        }
      }

      return importedAttachments;
    },

    async insertOrUpdateDoc(req, {
      doc, method = 'insert', failedIds = [], duplicatedDocs = [],
      existingAposDocId, importDraftsOnly, translate
    }) {
      const manager = self.apos.doc.getManager(doc.type);
      if (existingAposDocId) {
        method = 'update';
      }

      // Import can be disable at the page-type level
      if (!self.canImport(req, doc.type)) {
        throw new Error(`Import is disabled for this module: ${doc.type}`);
      }

      // In the case of a "simple" import (CSV or Excel), there are good chances that the
      // `aposMode` property is not set. We set it to `draft` by default.
      if (!doc.aposMode) {
        doc.aposMode = 'draft';
      }

      if (doc.aposMode === 'published') {
        if (failedIds.includes(doc.aposDocId)) {
          throw new Error('Inserting document failed');
        }

        if (manager.options.autopublish === true) {
          return true;
        }
      }

      await self.replaceDocId(doc, existingAposDocId);
      self.handleRichTextFields(manager, doc);

      if (method === 'insert') {
        return insert();
      }
      return update();

      async function insert() {
        const _req = req.clone({ mode: doc.aposMode });

        self.apos.schema.simulateRelationshipsFromStorage(req, doc, manager.schema);

        const type = doc.type;
        const docToInsert = doc;
        await manager.convert(_req, doc, docToInsert, {
          presentFieldsOnly: true,
          fetchRelationships: false
        });

        if (importDraftsOnly) {
          delete docToInsert.lastPublishedAt;
        }

        let modified = translate;
        if (translate) {
          modified = await self.translateDocument(req, docToInsert);
        }
        // If the piece is autopublished, the translation will be published
        // and we don't want to set the modified flag.
        if (manager.options.autopublish === true) {
          modified = false;
        }

        if (self.isPage(manager)) {
          // TODO: check if this is still true
          // `convert` sets the type to `@apostrophecms/home- page`,
          // let's set it back to the original type:
          docToInsert.type = type;

          return importPage.insert({
            manager: self.apos.page,
            doc: docToInsert,
            req: _req,
            duplicatedDocs,
            modified
          });
        }

        return manager.insert(_req, docToInsert, { setModified: modified });
      }

      async function update() {
        const _req = req.clone({ mode: doc.aposMode });
        self.apos.schema.simulateRelationshipsFromStorage(req, doc, manager.schema);
        const docToUpdate = await self.apos.doc.db.findOne({ _id: doc._id });
        if (!docToUpdate) {
          return;
        }
        await manager.convert(_req, doc, docToUpdate, {
          presentFieldsOnly: true,
          fetchRelationships: false
        });
        if (translate) {
          docToUpdate.__originalLocale = doc.__originalLocale;
          await self.translateDocument(req, docToUpdate, { update: true });
        }
        if (self.isPage(manager)) {
          await importPage.update({
            manager: self.apos.page,
            doc: docToUpdate,
            req: _req,
            duplicatedDocs
          });
        } else {
          await manager.update(_req, docToUpdate);
        }

        const docToCompare = doc.aposMode === 'draft'
          ? await self.apos.doc.db.findOne({ _id: docToUpdate._id.replace(':draft', ':published') })
          : await self.apos.doc.db.findOne({ _id: docToUpdate._id.replace(':published', ':draft') });

        if (!docToCompare) {
          return;
        }

        // Set the `modified` property to true if the draft version
        // is different from the published one
        await self.apos.doc.db.updateOne(
          { _id: docToUpdate._id.replace(':published', ':draft') },
          {
            $set: {
              modified: !self.apos.schema.isEqual(
                req,
                manager.schema,
                docToUpdate,
                docToCompare
              )
            }
          }
        );
      }
    },

    async translateDocument(req, doc, { update } = {}) {
      if (!self.apos.translation.isEnabled()) {
        throw self.apos.error('invalid', 'No translation module found');
      }

      // Only draft documents can be translated
      if (doc.aposMode !== 'draft') {
        return false;
      }

      const source = doc.__originalLocale || self.extractLocale(doc.aposLocale);
      const target = req.locale;

      // Can't translate a document that doesn't support localization
      if (!source) {
        return false;
      }
      // Can't translate a document to the same locale
      if (source === target) {
        return false;
      }

      const provider = self.apos.translation.getProvider();
      const manager = self.apos.translation.getProviderModule(provider.name);
      return manager.translate(req, provider.name, doc, source, target, {
        existing: update,
        silent: false
      });
    },

    canImport(req, docType) {
      return self.canImportOrExport(req, docType, 'import');
    },

    // `self.apos.page.isPage` does not work here since
    // the slug can be omitted in a CSV or Excel file.
    isPage(manager) {
      return self.apos.instanceOf(manager, '@apostrophecms/page-type') ||
        self.apos.instanceOf(manager, '@apostrophecms/any-page-type');
    },

    async insertOrUpdateAttachment(req, {
      attachmentInfo: { attachment, file },
      duplicatedIds = new Set(),
      failedIds = [],
      docIds
    }) {
      // TODO: Find a more efficient way to compare only relatedIds
      // (we need to find a way to keep autopublish published IDs in that case)
      if (docIds && (duplicatedIds.size || failedIds.length)) {
        const relatedIds = attachment.docIds
          .reduce((acc, id) => {
            const aposId = id.replace(/:.+$/, '');
            return [
              ...acc,
              ...acc.includes(aposId) || !docIds.has(aposId) ? [] : [ aposId ]
            ];
          }, []);

        if (relatedIds.every((id) => duplicatedIds.has(id) || failedIds.includes(id))) {
          throw self.apos.error(
            `Related documents have not been imported for attachment: ${attachment._id}`
          );
        }
      }

      const existing = await self.apos.attachment.db.findOne({
        _id: attachment._id
      });
      if (!existing) {
        await self.apos.attachment.insert(
          req,
          file,
          { attachmentId: attachment._id }
        );
        for (const crop of (attachment.crops || [])) {
          await self.apos.attachment.crop(req, attachment._id, crop);
        }
      } else {
        // Same _id === same original file, same scaled versions, etc.
        // The only differences will be in the crops and the
        // docIds etc. We will take care of docIds in one shot later via
        // recomputeAllDocReferences
        //
        // Perform any crops not found in the existing attachment
        for (const crop of attachment.crops || []) {
          const noCrop = !(existing.crops || [])
            .some(c => JSON.stringify(c) === JSON.stringify(crop));
          if (noCrop) {
            await self.apos.attachment.crop(req, attachment._id, crop);
          }
        }
      }
    },

    async overrideDuplicates(req) {
      const importDraftsOnly = self.apos.launder.boolean(req.body.importDraftsOnly);
      const translate = self.apos.launder.boolean(req.body.translate);
      const overrideLocale = self.apos.launder.boolean(req.body.overrideLocale);
      const exportPath = await self.getExportPath(
        self.apos.launder.string(req.body.exportId)
      );
      const docIds = self.apos.launder.strings(req.body.docIds);
      const duplicatedDocs = req.body.duplicatedDocs?.map(duplicatedDoc => {
        return {
          aposDocId: self.apos.launder.string(duplicatedDoc.aposDocId),
          title: self.apos.launder.string(duplicatedDoc.title),
          type: self.apos.launder.string(duplicatedDoc.type),
          updatedAt: self.apos.launder.date(duplicatedDoc.updatedAt),
          replaceId: self.apos.launder.string(duplicatedDoc.replaceId)
        };
      }) ?? [];
      const jobId = self.apos.launder.string(req.body.jobId);
      const importedAttachments = self.apos.launder.strings(req.body.importedAttachments);
      const formatLabel = self.apos.launder.string(req.body.formatLabel);
      const failedIds = [];
      const failedLog = {};
      const replaceDocIdPairs = [];

      const jobManager = self.apos.modules['@apostrophecms/job'];
      const job = await jobManager.db.findOne({ _id: jobId });

      const format = Object
        .values(self.formats)
        .find(format => format.label === formatLabel);

      if (!format) {
        jobManager.failure(job);
        throw self.apos.error(`invalid format "${formatLabel}"`);
      }

      const exportId = await self.getExportId(exportPath);
      await storage.download(exportId);
      const {
        docs, attachmentsInfo = [], exportPath: artifactsPath
      } = await format.input(exportPath);
      await self.setExportArtifactsPath(exportId, artifactsPath);

      const filteredDocs = importDraftsOnly
        ? self.getPublishedDocsAsDraft(
          docs.filter(doc => docIds.includes(doc.aposDocId))
        )
        : docs.filter(doc => docIds.includes(doc.aposDocId));

      const differentDocsLocale = self.getFirstDifferentLocale(req, filteredDocs);
      const siteHasMultipleLocales = Object.keys(self.apos.i18n.locales).length > 1;

      // Re-write locale if `overrideLocale` param is passed-on from the import process
      // (i.e if the user chose "Yes")
      // or re-write locale automatically on a single-locale site
      if (differentDocsLocale && (!siteHasMultipleLocales || overrideLocale)) {
        self.rewriteDocsWithCurrentLocale(req, filteredDocs);
      }

      for (const doc of filteredDocs) {
        try {
          if (attachmentsInfo.length) {
            const attachmentsIds = self.getDocsAttachmentsIds(doc);
            for (const id of attachmentsIds) {
              if (importedAttachments.includes(id)) {
                continue;
              }
              const attachmentInfo = attachmentsInfo
                .find(({ attachment }) => attachment._id === id);

              try {
                await self.insertOrUpdateAttachment(req, { attachmentInfo });
                jobManager.success(job);
                importedAttachments.push(id);
              } catch (err) {
                jobManager.failure(job);
                failedLog[attachmentInfo.attachment._id] = {
                  _id: attachmentInfo.attachment._id,
                  aposDocId: attachmentInfo.attachment._id,
                  title: attachmentInfo.attachment.title,
                  type: '@apostrophecms/attachment',
                  aposLocale: null,
                  detail: err.message
                };
              }
            }
          }

          const existingAposDocId = (duplicatedDocs
            .find(({ aposDocId }) => aposDocId === doc.aposDocId))?.replaceId || null;

          await self.insertOrUpdateDoc(req, {
            doc,
            method: 'update',
            failedIds,
            failedLog,
            existingAposDocId,
            duplicatedDocs,
            importDraftsOnly,
            translate
          });

          if (existingAposDocId) {
            replaceDocIdPairs.push([
              doc._id,
              `${existingAposDocId}:${doc.aposLocale}`
            ]);
          }

          jobManager.success(job);
        } catch (err) {
          jobManager.failure(job);
          failedIds.push(doc.aposDocId);
          if (!failedLog[doc._id]) {
            failedLog[doc._id] = {
              _id: doc._id,
              aposDocId: doc.aposDocId,
              type: doc.type,
              title: doc.title,
              aposLocale: doc.aposLocale,
              detail: err.data?.detail || req.t(
                'aposImportExport:errorInsertingDocument',
                { message: err.message }
              )
            };
          }
          self.apos.util.error(err);
          continue;
        }
      }

      if (replaceDocIdPairs.length) {
        await self.apos.doc.changeDocIds(replaceDocIdPairs, { skipReplace: true });
      }

      const finalFailedLog = job?.results?.failedLog || {};
      Object.assign(finalFailedLog, failedLog);
      const logs = Object.values(finalFailedLog);
      await self.updateJobResults(jobId, {
        failedLog: logs
      });

      // One call to fix all bookkeeping re: docIds, archivedDocIds, etc.
      await self.apos.attachment.recomputeAllDocReferences();
    },

    async setExportId(filePath) {
      const id = self.apos.util.generateId();

      const exportPath = path.resolve(path.dirname(filePath), `${id}-${path.basename(filePath)}`);
      await fs.rename(filePath, exportPath);

      await self.apos.cache.set('exportPath', id, exportPath, 86400);
      await self.apos.cache.set('exportId', exportPath, id, 86400);

      return id;
    },

    async setExportArtifactsPath(id, artifactsPath) {
      await self.apos.cache.set('exportArtifactsPath', id, artifactsPath, 86400);
    },

    async getExportArtifactsPath(id) {
      return self.apos.cache.get('exportArtifactsPath', id);
    },

    async getExportPath(id) {
      return self.apos.cache.get('exportPath', id);
    },

    async getExportId(exportPath) {
      return self.apos.cache.get('exportId', exportPath);
    },

    async cleanExport(req) {
      console.info('[import] cleaning export...');
      const exportPath = await self.getExportPath(
        self.apos.launder.string(req.body.exportId)
      );
      if (!exportPath) {
        throw self.apos.error.invalid('no such export path');
      }
      const exportId = await self.getExportId(exportPath);

      const jobId = self.apos.launder.string(req.body.jobId);
      const notificationId = self.apos.launder.string(req.body.notificationId);

      if (jobId) {
        const jobManager = self.apos.modules['@apostrophecms/job'];
        try {
          const job = await jobManager.db.findOneAndUpdate({ _id: jobId }, {
            $set: {
              ended: true,
              status: 'completed'
            }
          });

          const failedLog = Object.values(job?.results?.failedLog || {});
          if (failedLog.length) {
            await self.apos.notify(req, 'aposImportExport:importFailedForSome', {
              interpolate: {
                count: failedLog.length
              },
              dismiss: true,
              icon: 'database-import-icon',
              type: 'danger',
              event: {
                name: 'import-export-import-ended',
                data: {
                  failedLog
                }
              }
            });
          }
        } catch (err) {
          self.apos.util.error(err);
        }
      }
      if (notificationId) {
        self.apos.notification
          .dismiss(req, notificationId, 2000)
          .catch(() => {
            // Do nothing because it's not an issue
          });
      }

      await storage.remove(exportId);
    },

    // This methods expects a singleton type and it doesn't
    // perform any related checks. It's up to the caller to
    // make sure the singleton exists.
    // Singletons are pieces having option `singleton: true`.
    async findSingletonAposDocId({ type, aposLocale }) {
      const singleton = await self.apos.doc.db.findOne({
        $and: [
          { type },
          {
            $or: [
              { aposLocale: { $exists: false } },
              { aposLocale }
            ]
          }
        ]
      }, {
        projection: { aposDocId: 1 }
      });

      if (singleton && singleton.aposDocId) {
        return singleton.aposDocId;
      }

      return null;
    },
    async findParkedAposDocId({
      parkedId, type, aposLocale
    }) {
      const parked = await self.apos.doc.db.findOne({
        $and: [
          {
            parkedId,
            type
          },
          {
            $or: [
              { aposLocale: { $exists: false } },
              { aposLocale }
            ]
          }
        ]
      }, {
        projection: { aposDocId: 1 }
      });

      if (parked && parked.aposDocId) {
        return parked.aposDocId;
      }

      return null;
    },

    // Replace ID fields of imported document with a new ID,
    // usually the ID of an existing document in the database.
    // This methods shouldn't be "perfect" as `apos.doc.changeDocIds`
    // will be called at the end of the import process to replace
    // all the IDs and update relationships.
    async replaceDocId(doc, replaceId) {
      if (!replaceId) {
        return doc;
      }
      doc._id = `${replaceId}:${doc.aposLocale}`;
      doc.aposDocId = replaceId;

      const manager = self.apos.doc.getManager(doc.type);
      if (!manager || !self.isPage(manager)) {
        return doc;
      }

      const existing = await self.apos.doc.db.findOne({
        _id: doc._id
      }, {
        projection: {
          path: 1,
          rank: 1,
          level: 1
        }
      });
      if (existing) {
        doc.path = existing.path;
        doc.rank = existing.rank;
        doc.level = existing.level;
      }

      return doc;
    },

    getIdsAndTypes(docs) {
      return docs.reduce((acc, doc) => {
        acc.ids.push(doc._id);

        const manager = self.apos.doc.getManager(doc.type);
        if (self.isPage(manager)) {
          acc.types.add('@apostrophecms/page');
        }
        acc.types.add(doc.type);

        return acc;
      }, {
        ids: [],
        types: new Set()
      });
    }
  };
};
