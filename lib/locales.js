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
