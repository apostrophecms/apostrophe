var nunjucks = require('nunjucks');
var moment = require('moment');
var qs = require('qs');
var he = require('he');

/**
 * templates
 * @augments Augments the apos object with facilities for rendering Nunjucks templates
 * with access to appropriate data.
 * @see  aposLocals
 */

var _ = require('lodash');
var async = require('async');

module.exports = function(self) {
  // Render the specified `template` and send the result via the specified `res` object. The properties of the
  // `info` object are made available to Nunjucks template code. A wrapper for `apos.partial`.

  self.render = function(req, res, template, info) {
    return res.send(self.partial(req, template, info));
  };

  // Load and render a Nunjucks template by the specified name and give it the
  // specified data. All of the Apostrophe helpers are available as
  // aposArea, etc. from the template. You can also render another partial
  // from within your template by calling `{{ partial('name') }}`. You can pass a
  // full path for 'name' otherwise it is assumed to be relative to the first
  // directory on the `dirs` list that contains a matching file. When you call
  // `partial` from another partial, the dirs list is always the same list given
  // to the original `partial` call.
  //
  // The `views` folder of the Apostrophe module is always implicitly included in
  // the `dirs` list as the last entry. Earlier entries beat later ones, allowing
  // for easy overrides.
  //
  // The .html extension is assumed if no extension is present.

  self.partial = function(req, name, data, dirs) {
    if(typeof req === 'string'){
      // in case we didn't get any req object
      dirs = data;
      data = name;
      name = req;
      req = null;
    } else if(typeof req === 'object'){
      self.initI18nLocal(req);
    }

    if (!data) {
      data = {};
    }

    data.partial = function(name, data) {
      return self.partial(req, name, data, dirs);
    };

    // Make sure the apos-specific locals are visible to partials too.
    // If we import ALL the locals we'll point at the wrong views directory
    // and generally require the developer to worry about not breaking
    // our partials, which ought to be a black box they can ignore.

    _.defaults(data, self._aposLocals);

    var finalName = name;
    if (!finalName.match(/\.\w+$/)) {
      finalName += '.html';
    }

    return self.getNunjucksEnv(dirs).getTemplate(finalName).render(data);
  };

  // Render the Nunjucks template in the provided string and give it the
  // specified data. All of the Apostrophe helpers are available as
  // aposArea, etc. from the template. You can also render another partial
  // from within your template by calling `{{ partial('name') }}`. The
  // `views` folder of the Apostrophe module is always implicitly included in
  // the `dirs` list as the last entry. Earlier entries beat later ones, allowing
  // for easy overrides.
  //
  // This is mostly used by the mailMixin to render subject lines.

  self.partialString = function(s, data, dirs) {
    if (!data) {
      data = {};
    }

    if (typeof(data.partial) === 'undefined') {
      data.partial = self.partial;
    }

    // Make sure the apos-specific locals are visible to partials too.
    // If we import ALL the locals we'll point at the wrong views directory
    // and generally require the developer to worry about not breaking
    // our partials, which ought to be a black box they can ignore.

    _.defaults(data, self._aposLocals);

    return self.getNunjucksEnv(dirs).renderString(s, data);
  };

  var nunjucksEnvs = {};

  /**
   * Get a nunjucks environment in which "include," "extends," etc. search the
   * specified directories. You may specify a single directory or skip the
   * parameter. The views folder of the Apostrophe module is always the
   * last directory searched and you do not need to add it explicitly.
   * USUALLY YOU SHOULD USE `apos.partial` which invokes this method automatically.
   * Note you can specify search directories when calling `apos.partial`.
   * @param  {Array} dirs
   * @return {Object} a nunjucks environment
   */
  self.getNunjucksEnv = function(dirs) {
    if (!dirs) {
      dirs = [];
    }

    if (!Array.isArray(dirs)) {
      dirs = [ dirs ];
    }

    dirs = dirs.concat(self.options.partialPaths || []);

    // The apostrophe module's views directory is always the last
    // thing tried, so that you can extend the widgetEditor template, etc.
    dirs = dirs.concat([ __dirname + '/../views' ]);

    var dirsKey = dirs.join(':');
    if (!nunjucksEnvs[dirsKey]) {
      nunjucksEnvs[dirsKey] = self.newNunjucksEnv(dirs);
    }
    return nunjucksEnvs[dirsKey];
  };

  // Stringify the data as JSON, then escape any sequences that would
  // cause a <script> tag to end prematurely if the JSON is embedded in it.
  self.jsonForHtml = function(data) {
    data = JSON.stringify(data); // , null, '  ');
    data = data.replace(/<\!\-\-/g, '<\\!--');
    data = data.replace(/<\/script\>/gi, '<\\/script>');
    // unicode line separator and paragraph separator break JavaScript parsing
    data = data.replace(/\u2028/g, "\\u2028");
    data = data.replace(/\u2029/g, "\\u2029");
    return data;
  };

  /**
   * Create a new nunjucks environment in which the specified directories are
   * searched for includes, etc. USUALLY YOU SHOULD USE getNunjucksEnv INSTEAD to avoid
   * creating environments over and over for the same search path, which is inefficient.
   * @param  {Array} dirs
   * @return {Object} A nunjucks environment
   */
  self.newNunjucksEnv = function(dirs) {

    var NunjucksLoader = require('./nunjucksLoader.js');
    var loader = new NunjucksLoader(dirs, undefined, self);
    var nunjucksEnv = new nunjucks.Environment(loader);

    nunjucksEnv.addFilter('date', function(date, format) {
      // Nunjucks is generally highly tolerant of bad
      // or missing data. Continue this tradition by not
      // crashing if date is null. -Tom
      if (!date) {
        return '';
      }
      if(self._site && self._site.options.i18n && self._site.options.i18n.defaultLocale)
        moment.lang(self._site.options.i18n.defaultLocale);
      var s = moment(date).format(format);
      return s;
    });

    nunjucksEnv.addFilter('query', function(data) {
      return qs.stringify(data);
    });

    nunjucksEnv.addFilter('json', function(data) {
      return self.jsonForHtml(data);
    });

    nunjucksEnv.addFilter('qs', function(data) {
      return qs.stringify(data);
    });

    // See apos.build

    nunjucksEnv.addFilter('build', self.build);

    nunjucksEnv.addFilter('stripTags', function(data) {
      return data.replace(/(<([^>]+)>)/ig,"");
    });

    nunjucksEnv.addFilter('nlbr', function(data) {
      if ((data === null) || (data === undefined)) {
        // don't crash, nunjucks tolerates nulls
        return '';
      }
      data = self.globalReplace(data.toString(), "\n", "<br />\n");
      return data;
    });

    // Newlines to paragraphs, produces better spacing and semantics
    nunjucksEnv.addFilter('nlp', function(data) {
      if ((data === null) || (data === undefined)) {
        // don't crash, nunjucks tolerates nulls
        return '';
      }
      var parts = data.toString().split(/\n/);
      var output = _.map(parts, function(part) {
        return '<p>' + part + '</p>\n';
      }).join('');
      return output;
    });

    nunjucksEnv.addFilter('css', function(data) {
      return self.cssName(data);
    });

    nunjucksEnv.addFilter('truncate', function(data, limit) {
      return self.truncatePlaintext(data, limit);
    });

    // Output "data" as JSON, escaped to be safe in an
    // HTML attribute. By default it is escaped to be
    // included in an attribute quoted with double-quotes,
    // so all double-quotes in the output must be escaped.
    // If you quote your attribute with single-quotes
    // and pass { single: true } to this filter,
    // single-quotes in the output are escaped instead,
    // which uses dramatically less space and produces
    // more readable attributes.
    //
    // EXCEPTION: if the data is not an object or array,
    // it is output literally as a string. This takes
    // advantage of jQuery .data()'s ability to treat
    // data attributes that "smell like" objects and arrays
    // as such and take the rest literally.

    nunjucksEnv.addFilter('jsonAttribute', function(data, options) {
      if (typeof(data) === 'object') {
        return self.escapeHtml(JSON.stringify(data), options);
      } else {
        // Make it a string for sure
        data += '';
        return self.escapeHtml(data, options);
      }
    });

    nunjucksEnv.addFilter('prune', function(data) {
      // Remove everything that is the result of a join or
      // other dynamic load, leaving only what is part of
      // the essential database representation
      return self.clonePermanent(data);
    });

    if (self.options.configureNunjucks) {
      self.options.configureNunjucks(nunjucksEnv);
    }

    return nunjucksEnv;
  };

  // YOU DON'T WANT TO CALL THIS DIRECTLY. Use the assets mixin and call
  // renderDecorated on your own module. If you call this directly you likely won't
  // have the right javascript and assets in your page, except in certain special
  // cases like rendering a login page that is guaranteed not to need them.
  //
  // Decorate the contents of args.content as a complete webpage. If args.refreshing is
  // true, return just that content, as we're performing an AJAX refresh of the main
  // content area. If args.refreshing is not true, return it as a completely
  // new page (CSS, JS, head, body...) wrapped in the outerLayout template. This is
  // made available to allow developers to render other content the same way
  // Apostrophe pages are rendered. For instance, it's useful for a local
  // login page template, a site reorganization screen or anything else that
  // is a poor fit for a page template or a javascript modal.
  //
  // This may go away when nunjucks gets conditional extends.
  //
  // As a workaround for the lack of conditional extends in nunjucks the following
  // special strings are pulled out of args.content and passed to the outer layout:
  //
  // <!-- APOS-BODY-CLASS class names here -->
  // <!-- APOS-TITLE title here -->
  // <!-- APOS-EXTRA-HEAD extra head element material here -->
  // <!-- APOS-SEO-DESCRIPTION meta description here -->
  //
  // This is a silly hack.
  //
  // If safe mode is not set via args.safeMode, raw HTML widget content
  // is decoded and inserted directly, otherwise it remains in escaped form
  // with certain marker comments.
  //
  // This is a silly hack too, but it might be the only one.

  self.decoratePageContent = function(args, req) {
    // On an AJAX refresh of the main content area only, just send the
    // main content area. The rest of the time, render the outerLayout and
    // pass the main content to it
    if (args.refreshing) {
      return args.content;
    } else {
      // This is a bit of a nasty workaround: we need to communicate a few things
      // to the outer layout, and since it must run as a separate invocation of
      // nunjucks there's no great way to get them there.

      // [\s\S] is like . but matches newlines too. Great workaround for the lack
      // of a /s modifier in JavaScript
      // http://stackoverflow.com/questions/1068280/javascript-regex-multiline-flag-doesnt-work

      var match = args.content.match(/<\!\-\- APOS\-BODY\-CLASS ([\s\S]*?) \-\-\>/);
      if (match) {
        args.bodyClass = match[1];
      }
      match = args.content.match(/<\!\-\- APOS\-TITLE ([\s\S]*?) \-\-\>/);
      if (match) {
        args.title = match[1];
      }
      match = args.content.match(/<\!\-\- APOS\-EXTRA\-HEAD([\s\S]*?)\-\-\>/);
      if (match) {
        args.extraHead = match[1];
      }
      match = args.content.match(/<\!\-\- APOS\-SEO\-DESCRIPTION ([\s\S]*?) \-\-\>/);
      if (match) {
        args.seoDescription = match[1];
      }
      match = args.content.match(/<\!\-\- APOS\-FAVICON ([\s\S]*?) \-\-\>/);
      if (match) {
        args.favicon = match[1];
      }

      // Allow raw HTML slots on a true page update, without the risk
      // of document.write blowing up a page during a partial update.
      // This is pretty nasty too, keep thinking about alternatives.
      if (!args.safeMode) {
        args.content = args.content.replace(/<\!\-\- APOS\-RAW\-HTML\-BEFORE \-\-\>[\s\S]*?<\!\-\- APOS\-RAW\-HTML\-START \-\-\>([\s\S]*?)<\!\-\- APOS\-RAW\-HTML\-END \-\-\>[\s\S]*?<\!\-\- APOS\-RAW\-HTML\-AFTER \-\-\>/g, function(all, code) {
        return he.decode(code);
        });
      }

      if (typeof(self.options.outerLayout) === 'function') {
        return self.options.outerLayout(args);
      } else {
        return self.partial(req, self.options.outerLayout || 'outerLayout', args);
      }
    }
  };

};
