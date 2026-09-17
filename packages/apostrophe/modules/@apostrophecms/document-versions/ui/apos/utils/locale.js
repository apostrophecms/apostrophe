// The admin UI language, through its `intlMapping` when the locale of the
// same name has one
const getLocale = () => {
  const {
    adminLocale,
    locale = 'en',
    locales
  } = window.apos.i18n || {};
  const current = adminLocale || locale;

  return locales?.[current]?.intlMapping || current;
};

const getDateTimeFormatOptions = () => {
  const moduleOptions = window.apos.modules['@apostrophecms/document-versions'] || {};

  return moduleOptions.dateTimeFormatOptions || null;
};

// Returns a function formatting a version timestamp: the project's
// `dateTimeFormatOptions` when set, otherwise the day and the time joined
// by a middle dot, with the year when it is not the current one
const getDateFormatter = (
  locale = getLocale(),
  dateTimeFormatOptions = getDateTimeFormatOptions()
) => {
  if (dateTimeFormatOptions) {
    const format = new Intl.DateTimeFormat(locale, dateTimeFormatOptions);
    return date => format.format(new Date(date));
  }
  const dayFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric'
  });
  const dayWithYearFormat = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit'
  });

  return (value) => {
    const date = new Date(value);
    const sameYear = date.getFullYear() === new Date().getFullYear();
    const day = (sameYear ? dayFormat : dayWithYearFormat).format(date);
    return `${day} · ${timeFormat.format(date)}`;
  };
};

export default {
  getLocale,
  getDateFormatter
};
