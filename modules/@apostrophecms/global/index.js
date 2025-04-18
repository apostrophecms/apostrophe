// Provides req.data.global, an Apostrophe doc
// for sitewide content such as a footer displayed on all pages. You
// can also create site-wide preferences by adding schema fields. Just
// configure this module with the `fields` section as you normally would
// for any widget or pieces module.
//
// ## options
//
// `deferWidgetLoading`: a performance option. if true, any widget loads that
// can be deferred will be until the end of the process of loading the global
// doc, reducing the number of queries for simple cases.
//
// Note that the `defer` option must also be set to `true` for all widget types
// you wish to defer loads for.
//
// To avoid causing problems for routes that depend on the middleware, loads are
// only deferred until the end of loading the global doc and anything it
// relationships with; they are not merged with deferred loads for the actual
// page. This option defaults to `false` because in many cases performance is
// not improved, as the global doc often contains no deferrable widgets, or
// loads them efficiently already.
//
// If the schema contains fields, the "Global Content" admin bar button will
// launch the editor modal for those, otherwise it will shortcut directly to
// the versions dialog box which is still relevant on almost all sites because
// of the use of global header and footer areas, etc.
//
// This module provides middleware so that `req.data.global` is always
// available, even in requests that are not for Apostrophe pages. In a command
// line task, you can use the provided `findGlobal` method.
//
// ## properties
//
// `_id`: the MongoDB ID of the global doc. Available after `modulesReady`.

module.exports = {
  extend: '@apostrophecms/piece-type',
  options: {
    name: '@apostrophecms/global',
    alias: 'global',
    label: 'apostrophe:globalDocLabel',
    // Intentionally the same
    pluralLabel: 'apostrophe:globalDocLabel',
    searchable: false,
    singletonAuto: {
      slug: 'global'
    },
    showPermissions: true,
    replicate: true
  },
  fields: {
    remove: [
      'title',
      'slug',
      'archived',
      'visibility'
    ]
  },
  commands(self) {
    return {
      add: {
        [`${self.__meta.name}:singleton-editor`]: {
          type: 'item',
          label: self.options.label,
          action: {
            type: 'admin-menu-click',
            payload: `${self.__meta.name}:singleton-editor`
          },
          permission: {
            action: 'edit',
            type: self.__meta.name
          },
          shortcut: 'T,G'
        }
      },
      modal: {
        default: {
          '@apostrophecms/command-menu:taskbar': {
            label: 'apostrophe:commandMenuTaskbar',
            commands: [
              `${self.__meta.name}:singleton-editor`
            ]
          }
        }
      }
    };
  },
  init(self) {
    self.slug = self.options.slug || 'global';
  },
  middleware(self) {
    return {
      async addGlobal(req, res, next) {
        try {
          await self.addGlobalToData(req);
          // Don't break other middleware or routes that might not be
          // defer-aware. The regular page rendering route will reenable this on
          // its own
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
  methods(self) {
    return {
      // Fetch and return the `global` doc object. You probably don't need to
      // call this, because middleware has already populated `req.data.global`
      // for you.
      async findGlobal(req) {
        return self.find(req, { type: self.name }).permission(false).toObject();
      },
      // Fetch the global doc and add it to `req.data` as `req.data.global`, if
      // it is not already present. If it is already present, skip the extra
      // query.
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
      // There is only one useful object of this type, so having access to the
      // admin bar button is not helpful unless you can edit that one, rather
      // than merely creating a new one (for which there is no UI). Thus we need
      // to set the permission requirement.
      addToAdminBar() {
        if (self.schema.length > 0) {
          self.apos.adminBar.add(
            '@apostrophecms/global:singleton-editor',
            self.label,
            {
              action: 'edit',
              type: self.name
            },
            {
              icon: 'cog-icon',
              contextUtility: true,
              toggle: true,
              tooltip: {
                activate: 'apostrophe:openGlobal',
                deactivate: 'apostrophe:closeGlobal'
              }
            }
          );
        }
      }
    };
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const browserOptions = _super(req);
        // _id of the piece, which is a singleton
        browserOptions._id = req.data.global && req.data.global._id;
        return browserOptions;
      }
    };
  }
};
