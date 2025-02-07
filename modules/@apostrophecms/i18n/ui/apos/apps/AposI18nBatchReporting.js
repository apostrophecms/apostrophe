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
    // Find all error logs that are not 409 (conflict). The latter are
    // existing documents we opted not to overwrite.
    const errors = log.filter(
      (entry) => ![ false, 'conflict' ].includes(entry.error)
    );

    if (!errors.length) {
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
    const notifications = errors.map((entry) => {
      return {
        type: 'error',
        locale: locales
          .find(
            (locale) => locale.name === entry.locale
          ) ?? locales[0] ?? {
          name: 'en',
          label: 'English'
        },
        doc: {
          title: entry.title,
          type: entry.type,
          _id: entry._id,
          aposDocId: entry.aposDocId
        },
        detail: entry.detail
      };
    });
    await apos.alert(
      {
        icon: false,
        heading: 'apostrophe:localizingBusy',
        description: 'apostrophe:thereWasAnIssueLocalizing',
        body: {
          component: 'AposI18nLocalizeErrors',
          props: {
            notifications
          }
        },
        affirmativeLabel: 'apostrophe:close'
      }
    );
  }
};
