const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');
const _ = require('lodash');

// ## Options
//
// ### `from`
//
// Default "from" address, with full name. Example:
//
// `'"Jane Doe" <jane@doe.com>'`
//
// `nodemailer`: **required.** Options object to be passed to nodemailer's
// `createTransport` method. See the [nodemailer](https://nodemailer.com)
// documentation.

module.exports = {
  methods(self) {
    return {

      // Implements the `email` method available in all modules.
      //
      // See `@apostrophecms/module` for coverage of the `email` method that
      // every module has. You won't need to call `emailForModule` directly.

      async emailForModule(req, templateName, data, options, module) {
        const transport = self.getTransport();
        const html = await module.render(req, templateName, data);
        const text = htmlToText(html, {
          selectors: [
            {
              selector: 'a',
              options: { hideLinkHrefIfSameAsText: true }
            },
            {
              selector: 'h1',
              format: 'customHeading'
            },
            {
              selector: 'h2',
              format: 'customHeading'
            },
            {
              selector: 'h3',
              format: 'customHeading'
            },
            {
              selector: 'h4',
              format: 'customHeading'
            },
            {
              selector: 'h5',
              format: 'customHeading'
            },
            {
              selector: 'h6',
              format: 'customHeading'
            }
          ],
          formatters: {
            // Custom heading formatter, based on the core heading but
            // no uppercase inside "[ ]" blocks.
            customHeading: function (elem, walk, builder, formatOptions) {
              builder.openBlock(
                { leadingLineBreaks: formatOptions.leadingLineBreaks || 2 }
              );
              if (formatOptions.uppercase !== false) {
                // Keep track of [ and ] (no nested support)
                let ignoreUpper = false;
                builder.pushWordTransform(str => {
                  if (str.trim().startsWith('[')) {
                    ignoreUpper = true;
                  }
                  const word = ignoreUpper ? str : str.toUpperCase();
                  if (str.trim().endsWith(']')) {
                    ignoreUpper = false;
                  }
                  return word;
                });
                walk(elem.children, builder);
                builder.popWordTransform();
              } else {
                walk(elem.children, builder);
              }
              builder.closeBlock(
                { trailingLineBreaks: formatOptions.trailingLineBreaks || 2 }
              );
            }
          }
        });
        const args = _.assign({
          html,
          text,
          from: (module.options.email && module.options.email.from) || self.options.from
        }, options);
        if (process.env.APOS_LOG_EMAIL) {
          self.apos.util.debug(args);
        }
        return transport.sendMail(args);
      },

      // Fetch the nodemailer-compatible transport object. The default
      // implementation creates a transport via `nodemailer.createTransport`
      // on the first call, passing it the value of the `nodemailer` option
      // configured for the `@apostrophecms/email` module. If there is none,
      // a fatal error is thrown.

      getTransport() {
        if (!self.transport) {
          if (!self.options.nodemailer) {
            throw new Error('The nodemailer option must be configured for the @apostrophecms/email module before any module can call its email() method. The option accepts an object to be passed to nodemailer.createTransport, per the nodemailer documentation.');
          }
          self.transport = nodemailer.createTransport(self.options.nodemailer);
        }
        return self.transport;
      }
    };
  }
};
