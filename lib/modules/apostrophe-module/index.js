var _ = require('lodash');

module.exports = {
  construct: function(self, options) {
    self.options = options;
    self.apos = options.apos;

    // The URL for routes relating to this module is based on the
    // module name but is not distinct at the project level. Use the
    // metadata provided by moog to figure out the name
    self.action = '/modules/' + self.__meta.name;

    // mailer
    // route
    // etc

    self.pushAsset = function(type, name, options) {
    };
    //   // options = _.cloneDeep(options || {});
    //   // if (type === 'template') {
    //   //   // Render templates in our own nunjucks context
    //   //   self.apos.assets.push('template', self.renderer(name), options);
    //   // } else {
    //   //   options.chain = self.__meta.chain;
    //   //   self.apos.assets.push(type, name, options);
    //   //   // We're interested in ALL versions of main.js or main.less,
    //   //   // starting with the base one. CSS and JS are additive.
    //   //   var exists = false;
    //   //   _.each(self.__meta.chain, function(type) {
    //   //     options.fs = type.dirname;
    //   //     options.web = '/modules/' + type.name;
    //   //     if (self.apos.assets.push(type, name, options)) {
    //   //       exists = true;
    //   //     }
    //   //   });
    //   //   if (!exists) {
    //   //     console.error('WARNING: no versions of the ' + type + ' ' + name + ' exist, but you are pushing that asset in the ' + self.__meta.name + ' module.');
    //   //   }
    //   // }
    // };

    // Render a partial, looking for overrides in our preferred places.
    self.render = function(name, data, req) {
      return self.renderer(name, req)(data);
    };

    // Render a template in a string (not from a file), looking for includes, etc. in our
    // preferred places
    module.renderString = function(s, data) {
      return module.rendererString(s)(data);
    };

    // Return a function that will render a particular partial looking for overrides in our
    // preferred places. Also merge in any properties of self._rendererGlobals, which can
    // be set via the rendererGlobals option when the module is configured

    module.renderer = function(name, req) {
      return function(data, reqAnonymous) {
        req = reqAnonymous || req;
        if (!data) {
          data = {};
        }
        _.defaults(data, module._rendererGlobals);
        return self.partial(req, name, data, _.map(module._modules, function(module) { return module.dir + '/views'; }));
      };
    };

    // Return a function that will render a particular template in a string,
    // looking includes etc. preferred places. Also merge in any properties of
    // self._rendererGlobals, which can be set via the rendererGlobals option
    // when the module is configured

    module.rendererString = function(s) {
      return function(data) {
        if (!data) {
          data = {};
        }
        _.defaults(data, module._rendererGlobals);
        return self.partialString(s, data, _.map(module._modules, function(module) { return module.dir + '/views'; }));
      };
    };



    // Generate a complete HTML page for transmission to the browser.
    //
    // Renders the specified template in the context of the current module,
    // then decorates it with the outer layout. Pushes javascript calls and
    // javascript data to the browser and always passes the following to the
    // template:
    //
    // user (req.user)
    // query (req.query)
    // permissions (req.user.permissions)
    //
    // Under the following conditions, the outer layout is skipped and
    // the template's result is returned directly:
    //
    // req.xhr is true (always set on AJAX requests by jQuery)
    // req.query.xhr is set to simulate an AJAX request
    // req.decorate is false
    //
    // This is helpful when the same logic is used to power regular
    // pages, RSS views and partial refreshes like infinite scroll "pages".
    //
    // The ready event is always triggered on the body, whether
    // performing an AJAX update or a fully decorated page rendering.
    //
    // If template is a function it is passed a data object and also
    // the request object (ignored in most cases). Otherwise it is rendered
    // as a nunjucks template relative to this module's views folder.
    //
    // If `when` is set to 'user' or 'anon' it overrides the normal determination
    // of whether the page requires full CSS and JS for a logged-in user via
    // req.user.

    module.renderPage = function(req, template, data, when) {
      var workflow = self.options.workflow && {
        mode: req.session.workflowMode || 'public'
      };

      req.pushData({
        permissions: (req.user && req.user.permissions) || {},
        workflow: workflow
      });

      when = when || (req.user ? 'user' : 'anon');
      var calls = self.getGlobalCallsWhen('always');
      if (when === 'user') {
        calls = calls + self.getGlobalCallsWhen('user');
      }
      calls = calls + self.getCalls(req);
      // Always the last call; signifies we're done initializing the
      // page as far as the core is concerned; a lovely time for other
      // modules and project-level javascript to do their own
      // enhancements. The content area refresh mechanism also
      // triggers this event. Use afterYield to give other things
      // a chance to finish initializing
      calls += '\napos.afterYield(function() { apos.emit("ready"); });\n';

      // JavaScript may want to know who the user is. Prune away
      // big stuff like their profile areas
      if (req.user) {
        // This should be gone already but let's be doubly sure!
        delete req.user.password;
        req.traceIn('prune user');
        req.pushData({ user: self.prunePage(req.user) });
        req.traceOut();
      }

      var args = {
        // Make sure we pass the slug of the page, not the
        // complete URL. Frontend devs are expecting to be able
        // to use this slug to attach URLs to a page
        user: req.user,
        permissions: (req.user && req.user.permissions) || {},
        when: req.user ? 'user' : 'anon',
        calls: calls,
        data: self.getGlobalData() + self.getData(req),
        refreshing: !!req.query.apos_refresh,
        // Make the query available to templates for easy access to
        // filter settings etc.
        query: req.query,
        safeMode: (req.query.safe_mode !== undefined)
      };

      req.extras = req.extras || {};
      _.extend(req.extras, data);

      if (workflow && (workflow.mode === 'public')) {
        self.workflowPreventEditInPublicMode(req.extras);
      }
      _.extend(args, req.extras);

      var content;
      try {
        if (typeof(template) === 'string') {
          content = module.render(template, args, req);
        } else {
          content = template(args, req);
        }
      } catch (e) {
        // We're medium-screwed: the page template
        // threw an exception. Log where it
        // occurred for easier debugging
        return error(e, 'template');
      }
      if (req.xhr || req.query.xhr || (req.decorate === false)) {
        return content;
      } else {
        args.content = content;
        try {
          return self.decoratePageContent(args, req);
        } catch (e) {
          // We're extra-screwed: the outer layout
          // template threw an exception.
          // Log where it occurred for
          // easier debugging
          return error(e, 'outer layout');
        }
      }

      function error(e, type) {
        var now = Date.now();
        now = moment(now).format("YYYY-MM-DDTHH:mm:ssZZ");
        console.error(':: ' + now + ': ' + type + ' error at ' + req.url);
        console.error('Current user: ' + (req.user ? req.user.username : 'none'));
        console.error(e);
        req.statusCode = 500;
        return module.render('templateError', {}, req);
      }
    };

  }
};
