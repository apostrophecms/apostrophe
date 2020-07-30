let nodemailer = require('nodemailer');
let htmlToText = require('html-to-text');
let _ = require('lodash');

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
  methods(self, options) {
    return {

      // Implements the `email` method available in all modules.
      //
      // See `@apostrophecms/module` for coverage of the `email` method that
      // every module has. You won't need to call `emailForModule` directly.

      async emailForModule(req, templateName, data, options, module) {
        const transport = self.getTransport();
        const html = await module.render(req, templateName, data);
        const text = htmlToText.fromString(html, {
          format: {
            heading: function (elem, fn, options) {
              let h = fn(elem.children, options);
              let split = h.split(/(\[.*?\])/);
              return split.map(function (s) {
                if (s.match(/^\[.*\]$/)) {
                  return s;
                } else {
                  return s.toUpperCase();
                }
              }).join('') + '\n';
            }
          }
        });
        const args = _.assign({
          html: html,
          text: text,
          from: module.options.email && (module.options.email.from || self.options.from)
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
