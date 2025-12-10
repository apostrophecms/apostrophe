export default () => {
  let once = false;

  apos.util.onReady(() => {
    if (once) {
      return;
    }
    once = true;

    apos.bus.$on('apos-localize-batch-results', reportResults);
  });

  async function reportResults({ log, ids }) {
    const skipCount = log.filter(isError).length;
    const count = log.filter(isSuccess).length;

    if (!skipCount) {
      if (count) {
        await apos.notify('apostrophe:localizingNotificationSuccess', {
          type: 'success',
          icon: 'translate-icon',
          interpolate: { count },
          dismiss: true
        });
      }
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
    const items = log.map((entry) => {
      const locale = locales
        .find(
          (locale) => locale.name === entry.locale
        ) ?? locales[0] ?? {
        name: 'en',
        label: 'English'
      };
      return {
        // Should be unique
        _id: entry._id + ':' + locale.name,
        type: logType(entry),
        detail: entry.detail,
        relationship: entry.relationship,
        locale,
        doc: {
          _id: entry._id,
          title: entry.title,
          aposDocId: entry.aposDocId,
          type: entry.type,
          typeLabel: typeLabel(entry.type)
        }
      };
    });
    await apos.report(
      {
        heading: 'apostrophe:localizingReportHeading',
        description: 'apostrophe:localizingReportDesc',
        footerMessageDanger: 'apostrophe:localizingReportHeading',
        items,
        headers: [
          {
            name: 'doc.aposDocId',
            label: '_id',
            format: 'last:5'
          },
          {
            name: 'doc.typeLabel',
            label: 'apostrophe:type',
            sortable: true
          },
          {
            name: 'locale.label',
            label: 'apostrophe:locale',
            sortable: true
          },
          {
            name: 'relationship',
            label: 'apostrophe:relationship',
            format: 'yesno',
            visibility: 'export',
            sortable: true
          },
          {
            name: 'doc.title',
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
        // For demonstration purposes only, this is the default.
        mode: 'error'
      }
    );

    // Show warning if some documents were skipped.
    // Show danger if all documents were skipped.
    const type = count ? 'warning' : 'danger';
    const messages = {
      warning: 'apostrophe:localizingNotificationWarning',
      danger: 'apostrophe:localizingNotificationDanger'
    };
    const interpolate = {
      warning: {
        count,
        skipCount
      },
      danger: { count: skipCount }
    };
    await apos.notify(messages[type], {
      type,
      icon: 'translate-icon',
      interpolate: interpolate[type],
      dismiss: true
    });

    // 409 (conflict) is an existing document we opted not to overwrite.
    // This is a localization internal detail that we need to handle. It
    // shouldn't happen in normal `report` operations.
    function isError(log) {
      return ![ false, 'conflict' ].includes(log.error);
    }
    function isSuccess(log) {
      return log.error === false;
    }

    // Convert log.error into a type for the report item.
    // Localization specific, same as above.
    function logType(log) {
      if (log.error === 'conflict') {
        return 'info';
      }
      if (log.error) {
        return 'error';
      }
      return 'success';
    }

    // Convert doc.type into a human readable label.
    function typeLabel(name) {
      const module = apos.modules[name] || {};
      if (module.action === '@apostrophecms/page') {
        return 'apostrophe:page';
      }
      return module.label || name;
    }
  }
};
