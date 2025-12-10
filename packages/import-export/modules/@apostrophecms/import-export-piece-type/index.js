module.exports = {
  improve: '@apostrophecms/piece-type',
  cascades: [ 'batchOperations' ],
  utilityOperations (self) {
    if (self.options.importExport?.import === false) {
      return {};
    }

    return {
      add: {
        'import-export-import': {
          label: 'aposImportExport:import',
          modalOptions: {
            modal: 'AposImportModal'
          },
          canCreate: true,
          canEdit: true
        }
      }
    };
  },
  batchOperations(self) {
    if (self.options.importExport?.export === false) {
      return;
    }

    return {
      add: {
        'import-export-export-batch': {
          label: 'aposImportExport:export',
          messages: {
            progress: 'aposImportExport:exporting',
            completed: 'aposImportExport:exported',
            completedWithFailures: 'aposImportExport:exportedWithFailures',
            failed: 'aposImportExport:exportedFailed',
            icon: 'database-export-icon',
            resultsEventName: 'import-export-export-download'
          },
          modal: 'AposExportModal'
        }
      },
      group: {
        more: {
          icon: 'dots-vertical-icon',
          operations: [ 'import-export-export-batch' ]
        }
      }
    };
  },
  apiRoutes(self) {
    return {
      post: {
        ...self.options.importExport?.import !== false && {
          importExportImport: [
            self.apos.http.bigUploadMiddleware(),
            async (req) => {
              return self.apos.modules['@apostrophecms/import-export']
                .import(req, self.__meta.name);
            }
          ]
        },

        ...self.options.importExport?.export !== false && {
          importExportExport(req) {
          // Add the piece type label to req.body for notifications.
            req.body.type = req.t(self.options.label);

            return self.apos.modules['@apostrophecms/import-export'].export(req, self);
          },
          // NOTE: this route is used in batch operations, and its method should be POST
          // in order to make the job work with the progress notification.
          // The other 'export' routes that are used by context operations on each doc
          // are also POST for consistency.
          importExportExportBatch(req) {
          // Add the piece type label to req.body for notifications.
          // Should be done before calling the job's `run` method.
            req.body.type = req.body._ids.length === 1
              ? req.t(self.options.label)
              : req.t(self.options.pluralLabel);

            return self.apos.modules['@apostrophecms/job'].run(
              req,
              (req, reporting) => self.apos.modules['@apostrophecms/import-export']
                .export(req, self, reporting),
              {
                action: 'export',
                ids: req.body._ids,
                docTypes: []
              }
            );
          }
        }
      }
    };
  }
};
