const { stripIndent } = require('common-tags');

module.exports = {
  // Make sure they are adequately distinguished by
  // hostname and prefix
  verifyLocales(locales, baseUrl) {
    const taken = {};
    let hostnamesCount = 0;
    for (const [ name, options ] of Object.entries(locales)) {
      const hostname = options.hostname || '__none';
      const prefix = options.prefix || '__none';
      const key = `${hostname}:${prefix}`;
      const direction = options.direction;
      const intlMapping = options.intlMapping;

      if (intlMapping && (typeof intlMapping !== 'string')) {
        throw new Error(stripIndent`
          The locale "${name}" has an invalid intlMapping option "${intlMapping}".
          The intlMapping option must be a string.
        `);
      }

      // Note that default `ltr` directions should have been set
      // already by the `getLocales` method in the i18n module.
      if ([ 'ltr', 'rtl' ].indexOf(direction) === -1) {
        throw new Error(stripIndent`
          The locale "${name}" has an invalid direction option "${direction || 'undefined'}".
          The direction option must be either "ltr" (left to right) or "rtl" (right to left).
        `);
      }

      hostnamesCount += options.hostname ? 1 : 0;

      if (taken[key]) {
        throw new Error(stripIndent`
          The locale "${name}" cannot be distinguished from earlier locales.
          Make sure it is uniquely distinguished by its hostname option,
          prefix option or a combination of the two.
          One locale per site may be a default with neither hostname nor prefix,
          and one locale per hostname may be a default for that hostname without a prefix.
        `);
      }
      taken[key] = true;
    }

    if (
      hostnamesCount > 0 &&
      hostnamesCount < Object.keys(locales).length &&
      !baseUrl
    ) {
      throw new Error(stripIndent`
        If some of your locales have hostnames, then they all must have
        hostnames, and your top-level baseUrl option must be set.

        In development, you can set baseUrl to http://localhost:3000
        for testing purposes. In production it should always be set
        to a real base URL for the site.
      `);
    }
  }
};
