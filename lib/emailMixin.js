var extend = require('extend');
var _ = require('lodash');
var async = require('async');
var nodemailer = require('nodemailer');
var nunjucks = require('nunjucks');
var urls = require('url');

/**
 * emailMixin
 * @augments Augments the apos object with a mixin method for attaching
 * a simple self.email method to modules, so that they can delivewr email
 * conveniently using templates rendered in the context of that module.
 * @see static
 */

module.exports = function(self) {
  // This mixin adds a self.email method to the specified module object.
  //
  // Your module must also have mixinModuleAssets.
  //
  // IF YOU ARE WRITING A SUBCLASS OF AN OBJECT THAT ALREADY HAS THIS MIXIN
  //
  // When subclassing you do NOT need to invoke this mixin as the methods
  // are already present on the base class object.
  //
  // HOW TO USE THE MIXIN
  //
  // If you are creating a new module from scratch that does not subclass another,
  // invoke the mixin this way in your constructor:
  //
  // `self._apos.mixinModuleEmail(self);`
  //
  // Then you may send email like this throughout your module:
  //
  // return self.email(
  //   req,
  //   person,
  //   'Your request to reset your password on {{ host }}',
  //   'resetRequestEmail',
  //   {
  //     url: self._action + '/reset?reset=' + reset
  //   },
  //   function(err) { ... }
  // );
  //
  // REQUEST OBJECT
  //
  // "req" is the request object and must be present.
  //
  // SENDER ("FROM")
  //
  // "from" is the full name and email address of the sender. You may
  // pass a string formatted like this:
  //
  // "Bob Smith <bob@example.com>"
  //
  // OR an object with "email" and "fullName" properties. "title" is also
  // accepted if "fullName" is not present.
  //
  // Note that req.user (when logged in) and any "person" object from
  // apostrophe-people are both acceptable as "from" arguments.
  //
  // You may omit the "from" argument and set it via configuration in
  // app.js instead as described below.
  //
  // If you omit it AND don't configure it, you'll get a terrible "from" address!
  // You have been warned!
  //
  // RECIPIENT
  //
  // "to" works just like "from". However, it is required and there are no
  // options for it in app.js.
  //
  // SUBJECT LINE
  //
  // The fourth argument is the subject line. It is rendered by nunjucks and can see
  // the data you pass in the sixth argument and other variables as described below.
  //
  // It is easy to override the subject in app.js as described below.
  //
  // TEMPLATE NAME
  //
  // The fifth argument is the template name. If it is "resetRequestEmail", then
  // self.email will look for the templates resetRequestEmail.txt and resetRequestEmail.html
  // in your module's views folder, render both of them, and build an email with both
  // plaintext and HTML parts for maximum compatibility. You can override these templates
  // at project level in lib/modules/modulename exactly as you would for any other template.
  //
  // DATA
  //
  // All properties passed as part of the sixth argument are passed to the templates
  // as nunjucks data. They are also available in the subject line.
  //
  // In addition, the following variables are automatically supplied:
  //
  // "host" is the hostname of the site, as determined from req.
  //
  // "baseUrl" is the base URL of the site, like: http://sitename.com
  //
  // ABSOLUTE URLS
  //
  // URLs in emails must be absolute, but most of the time in your code you use
  // relative URLs starting with /. As a convenience, self.email() will automatically
  // transform properties beginning with "url" or ending in "Url" into
  // absolute URLs before passing your data on to the templates. This rule is
  // applied recursively to the data object, so an array of events will all have
  // their .url properties made absolute.
  //
  // SENDING EMAIL IN TASKS
  //
  // The req object used in tasks will generate the correct absolute URLs
  // only if you add a "baseUrl" property to it, which should look like:
  //
  // http://mysite.com
  //
  // Note there is no slash after the hostname.
  //
  // CALLBACK
  //
  // The final argument is a standard node callback function and will receive
  // an error if any takes place.
  //
  // CONFIGURATION: EASY OVERRIDES IN APP.JS VIA THE "EMAIL" OPTION
  //
  // NOTE: FOR THESE FEATURES TO WORK, your module must set self._options or
  // self.options to the options object it was configured with. This happens
  // automatically for everything derived from apostrophe-snippets.
  //
  // When you configure your module, pass an object as the "email" option, with
  // sub-properties as described below.
  //
  // OVERRIDING THE SUBJECT
  //
  // The subject can be overridden in app.js when configuring your module.
  // If the template name (fifth argument) is "resetRequestEmail", then the
  // option "resetRequestEmailSubject" overrides the subject.
  //
  // OVERRIDING THE "FROM" ADDRESS
  //
  // It is easy to override the "from" address. If the "from" option is
  // a string or is absent, and the template name is "resetRequestEmail", then the
  // "resetRequestEmailFrom" option determines who the email comes from if
  // present. If there is no such option then the "from" option
  // determines who the email comes from. If this option is not set either
  // and the "from" argument was omitted, then the email comes from:
  //
  // 'Do Not Reply <donotreply@example.com>'
  //
  // But this is terrible, so make sure you set the appropriate options.
  //
  // In app.js you may set the from address to a string in this format:
  // "Bob Smith <donotreply@example.com>"
  //
  // Or use an object with fullName and email properties.
  //
  // PLEASE NOTE: if you pass an object as the "from" argument, configuration options are
  // always ignored in favor of what you passed. However if you pass a string it is
  // assumed to be a hard-coded default and options are allowed to override it.

  self.mixinModuleEmail = function(module) {
    module.email = function(req, from, to, subject, template, data, callback) {
      var moduleOptions = module._options || module.options || {};
      var options = moduleOptions.email || {};
      if (!module._mailer) {
        if (moduleOptions.mailer) {
          // This will always work with apostrophe-site
          module._mailer = moduleOptions.mailer;
        } else {
          // An alternative for those not using apostrophe-site
          module._mailer = nodemailer.createTransport(options.transport, options.transportOptions);
        }
      }
      if (!callback) {
        // "from" may be omitted entirely, shift down one
        callback = data;
        data = template;
        template = subject;
        subject = to;
        to = from;
        from = undefined;
      }
      // Object passed for from always wins, string can be overridden
      if ((!from) || (typeof(from) === 'string')) {
        from = options[template + 'From'] || options['from'] || (moduleOptions.mailer.aposOptions && moduleOptions.mailer.aposOptions.from) || from || {
          fullName: 'Do Not Reply',
          email: 'donotreply@example.com'
        };
      }
      var finalData = {};

      // Allow middleware to supply baseUrl; if it's not there
      // use the sitewide option; if that's not there construct it
      // from what we do know about the request
      var baseUrl = req.baseUrl || self.options.baseUrl || (req.protocol + '://' + req.get('Host'));
      var parsed = urls.parse(baseUrl);
      var host = parsed.host;
      var protocol = parsed.protocol;

      // Easy subject override via app.js configuration
      subject = options[template + 'Subject'] || subject;

      // bc with a not-so-great templating syntax for subject lines that was
      // most likely only used once for %HOST%
      subject = subject.replace(/%HOST%/, '{{ host }}');
      _.extend(finalData, data, true);
      self._mailMixinAbsoluteUrls(finalData, baseUrl);
      finalData.host = host;
      finalData.baseUrl = baseUrl;
      _.defaults(options, {
        // transport and transportOptions are ignored if options.mailer
        // has been passed when constructing the module, as apostrophe-site will
        // always do
        transport: 'sendmail',
        transportOptions: {}
      });
      var message = {
        from: fixAddress(from),
        to: fixAddress(to),
        subject: module.renderString(subject, finalData, req),
        text: module.render(template + '.txt', finalData, req),
        html: module.render(template + '.html', finalData, req)
      };
      return module._mailer.sendMail(message, callback);
    };

    function fixAddress(to) {
      if (typeof(to) === 'string') {
        return to;
      }
      return (to.fullName || to.title).replace(/[<\>]/g, '') + ' <' + to.email + '>';
    }
  };

  self._mailMixinAbsoluteUrls = function(data, baseUrl) {
    _.each(data, function(val, key) {
      if (typeof(val) === 'object') {
        self._mailMixinAbsoluteUrls(val, baseUrl);
        return;
      }
      if ((typeof(key) === 'string') && ((key === 'url') || (key.match(/Url$/)))) {
        if ((val.charAt(0) === '/') && baseUrl) {
          val = baseUrl + val;
          data[key] = val;
        }
      }
    });
  };
};

