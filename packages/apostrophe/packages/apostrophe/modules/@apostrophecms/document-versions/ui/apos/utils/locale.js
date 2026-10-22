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

// The units a relative time is told in, largest first, in seconds
const relativeUnits = [
  [ 'year', 365 * 24 * 60 * 60 ],
  [ 'month', 30 * 24 * 60 * 60 ],
  [ 'day', 24 * 60 * 60 ],
  [ 'hour', 60 * 60 ],
  [ 'minute', 60 ],
  [ 'second', 1 ]
];

// Returns a function telling how long before `now` a timestamp was, in the
// largest whole unit: "14 days ago", "yesterday", "now"
const getRelativeTimeFormatter = (locale = getLocale()) => {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  return (value, now = Date.now()) => {
    const seconds = (new Date(value).getTime() - now) / 1000;
    const [ unit, size ] = relativeUnits
      .find(([ , size ]) => Math.abs(seconds) >= size) || relativeUnits.at(-1);
    return format.format(Math.round(seconds / size), unit);
  };
};

// Returns a function joining names as a list: "Ann, Bob and Cy"
const getListFormatter = (locale = getLocale()) => {
  const format = new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction'
  });

  return names => format.format(names);
};

export default {
  getDateFormatter,
  getRelativeTimeFormatter,
  getListFormatter
};
