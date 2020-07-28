// Provides req.data.global, an Apostrophe doc
// for sitewide content such as a footer displayed on all pages. You
// can also create site-wide preferences by adding schema fields. Just
// configure this module with the `fields` section as you normally would
// for any widget or pieces module.
//
// ## options
//
// `deferWidgetLoading`: a performance option. if true, any widget loads that can be deferred
// will be until the end of the process of loading the global doc, reducing the number of queries
// for simple cases.
//
// Note that the `defer` option must also be set to `true` for all widget types
// you wish to defer loads for.
//
// To avoid causing problems for routes that depend on the middleware, loads are
// only deferred until the end of loading the global doc and anything it
// joins with; they are not merged with deferred loads for the actual page.
// This option defaults to `false` because in many cases performance is
// not improved, as the global doc often contains no deferrable widgets,
// or loads them efficiently already.
//
// If the schema contains fields, the "Global Content" admin bar button will
// launch the editor modal for those, otherwise it will shortcut directly to the versions dialog box
// which is still relevant on almost all sites because of the use of global header
// and footer areas, etc.
//
// This module provides middleware so that `req.data.global` is always available,
// even in requests that are not for Apostrophe pages. In a command line task, you can use
// the provided `findGlobal` method.
//
// ## properties
//
// `_id`: the MongoDB ID of the global doc. Available after `modulesReady`.

let _ = require('lodash');

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    name: '@apostrophecms/global',
    alias: 'global',
    label: 'Global',
    pluralLabel: 'Global',
    searchable: false
  },
  beforeSuperClass(self, options) {
    options.removeFields = [
      'title',
      'slug',
      'published',
      'trash'
    ].concat(options.removeFields || []);
  },
  init(self, options) {
    self.slug = options.slug || 'global';
  },
  handlers(self, options) {
    return {
      'apostrophe:modulesReady': {
        async initGlobal() {
          const req = self.apos.task.getReq();
          // Existence test must not load widgets etc. as this can lead
          // to chicken and egg problems if widgets join with page types
          // not yet registered
          const existing = await self.apos.doc.db.findOne({ slug: self.slug });
          if (!existing) {
            const _new = {
              slug: self.slug,
              published: true,
              type: self.name
            };
            await self.apos.doc.insert(req, _new);
          }
        }
      }
    };
  },
  middleware(self, options) {
    return {
      async addGlobal(req, res, next) {
        try {
          await self.addGlobalToData(req);
          // Don't break other middleware or routes that might not be defer-aware.
          // The regular page rendering route will reenable this on its own
          req.deferWidgetLoading = false;
          return next();
        } catch (e) {
          self.apos.util.error('ERROR loading global doc: ', e);
          // Here in middleware we can't tell if this would have been a page,
          // so we can't set `aposError` and wait. We have to force the issue
          res.status(500).send('error');
        }
      }
    };
  },
  methods(self, options) {
    return {
      // Fetch and return the `global` doc object. You probably don't need to call this,
      // because middleware has already populated `req.data.global` for you.
      async findGlobal(req) {
        return self.find(req, { slug: self.slug }).permission(false).toObject();
      },
      // Fetch the global doc and add it to `req.data` as `req.data.global`, if it
      // is not already present. If it is already present, skip the
      // extra query.
      async addGlobalToData(req) {
        if (req.data.global) {
          return;
        }
        if (self.options.deferWidgetLoading) {
          req.deferWidgetLoading = true;
        }
        req.data.global = await self.findGlobal(req);
        if (self.options.deferWidgetLoading) {
          await self.apos.area.loadDeferredWidgets(req);
        }
      },
      // There is only one useful object of this type, so having access to the admin
      // bar button is not helpful unless you can edit that one, rather than
      // merely creating a new one (for which there is no UI). Thus we need
      // to set the permission requirement to admin-@apostrophecms/global.
      // This is called for you.
      addToAdminBar() {
        self.apos.adminBar.add(self.__meta.name, self.pluralLabel, 'admin-' + self.name);
      }
    };
  },
  extendMethods(self, options) {
    return {
      getBrowserData(_super, req) {
        if (!req.user) {
          return;
        }
        const browserOptions = _super(req);
        // For compatibility with the workflow module try to get the _id
        // from the copy the middleware fetched for this specific request,
        // if not fall back to self._id
        browserOptions._id = req.data.global && (req.data.global._id || self._id);
        return browserOptions;
      },
      getEditControls(_super, req) {
        const controls = _super(req);
        const more = _.find(controls, { name: 'more' });
        if (more) {
          more.items = _.reject(more.items, function (item) {
            return _.includes([
              'trash',
              'copy'
            ], item.action);
          });
        }
        return controls;
      }
    };
  }
};
