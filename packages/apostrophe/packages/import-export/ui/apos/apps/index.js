export default () => {
  let ready = false;

  apos.util.onReady(() => {
    if (!ready) {
      ready = true;
      apos.bus.$on('import-export-export-download', openUrl);
      apos.bus.$on('import-export-import-started', addBeforeUnloadListener);
      apos.bus.$on('import-export-import-ended', removeBeforeUnloadListenerAndReport);
      apos.bus.$on('import-export-import-locale-differs', handleDifferentLocale);
      apos.bus.$on('import-export-import-duplicates', handleDuplicates);
    }
  });

  function openUrl(event) {
    if (event.url) {
      window.open(event.url, '_blank');
    }
  }

  function addBeforeUnloadListener() {
    window.addEventListener('beforeunload', warningImport);
  }

  function removeBeforeUnloadListenerAndReport(event) {
    window.removeEventListener('beforeunload', warningImport);
    showReportModal(event);
  }

  async function showReportModal(event) {
    if (!event?.failedLog?.length) {
      return;
    }

    const locales = Object.entries(window.apos.i18n.locales).map(
      ([ locale, options ]) => {
        return {
          name: locale,
          label: options.label || locale
        };
      }
    );

    const items = event.failedLog.map((log) => {
      const locale = locales
        .find(
          (locale) => locale.name === log.aposLocale?.split(':')[0]
        )?.label || (log.aposLocale ? 'n/a' : '-');
      const mode = log._id.split(':')[2];
      return {
        ...log,
        localeLabel: locale,
        title: log.title || '-',
        typeLabel: typeLabel(log.type),
        aposModeLabel: mode ?? '-'
      };
    });

    await apos.report(
      {
        heading: 'aposImportExport:importFailedForSome',
        footerMessageDanger: 'aposImportExport:importFailedForSome',
        items,
        headers: [
          {
            name: '_id',
            label: '_id',
            visibility: 'export'
          },
          {
            name: 'aposDocId',
            label: '_id',
            format: 'last:5',
            visibility: 'table'
          },
          {
            name: 'aposModeLabel',
            label: 'aposImportExport:mode',
            visibility: 'table'
          },
          {
            name: 'typeLabel',
            label: 'apostrophe:type',
            sortable: true,
            translate: true
          },
          {
            name: 'type',
            label: 'type',
            visibility: 'export'
          },
          {
            name: 'localeLabel',
            label: 'apostrophe:locale',
            sortable: true
          },
          {
            name: 'title',
            label: 'apostrophe:title',
            width: '20%',
            sortable: true
          },
          {
            name: 'detail',
            label: 'apostrophe:details',
            width: '20%'
          }
        ]
      },
      {
        // We don't need the `log.type` property for now (it's our doc.type).
        mode: 'all'
      }
    );
  }

  async function handleDifferentLocale(event) {
    // Do not ask for confirmation if the editor already
    // opted-in for translation.
    const continueImport = event.translate
      ? true
      : await apos.modal.execute('AposModalConfirm', event);

    if (continueImport) {
      try {
        const moduleAction = apos.modules[event.moduleName].action;

        await apos.http.post(`${moduleAction}/import-export-import`, {
          body: {
            importDraftsOnly: event.importDraftsOnly,
            translate: event.translate,
            overrideLocale: true,
            exportId: event.exportId,
            formatLabel: event.formatLabel
          }
        });
      } catch (error) {
        apos.notify('aposImportExport:importFailed', {
          type: 'danger',
          dismiss: true
        });
      }

      return;
    }

    // If not, we still need to clean the uploaded archive
    try {
      await apos.http.post('/api/v1/@apostrophecms/import-export/clean-export', {
        body: {
          exportId: event.exportId
        }
      });
    } catch (error) {
      apos.notify('aposImportExport:importCleanFailed', {
        type: 'warning'
      });
    }
  }

  async function handleDuplicates(event) {
    if (event.duplicatedDocs.length) {
      await apos.modal.execute('AposDuplicateImportModal', event);
    }
  }

  function warningImport(event) {
    event.preventDefault();
    event.returnValue = '';
  }

  // Convert doc.type into a human readable label.
  function typeLabel(name) {
    const module = apos.modules[name] || {};
    if (module.action === '@apostrophecms/page') {
      return 'apostrophe:page';
    }
    return module.label || name;
  }
};
