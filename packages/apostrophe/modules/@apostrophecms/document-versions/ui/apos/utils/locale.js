const getLocale = () => {
  const i18n = window.apos.i18n || {};
  const { locale = 'en' } = i18n;

  return i18n.locales?.[locale]?.intlMapping || locale;
};

const getDateTimeFormatOptions = () => {
  const moduleOptions = window.apos.modules['@apostrophecms/document-versions'] || {};
  const {
    dateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  } = moduleOptions;

  return dateTimeFormatOptions;
};

const getDateTimeFormat = (
  locale = getLocale(),
  dateTimeFormatOptions = getDateTimeFormatOptions()
) => {
  return new Intl.DateTimeFormat(locale, dateTimeFormatOptions);
};

export default {
  getLocale,
  getDateTimeFormatOptions,
  getDateTimeFormat
};
