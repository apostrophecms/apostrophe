// Provides req.data.global, an Apostrophe doc
// for sitewide content such as a footer displayed on all pages. You
// can also create site-wide preferences by adding schema fields. Just
// configure this module with the `addFields` option as you normally would
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
// `addFields`: if the schema contains fields, the "Global Content" admin bar button will
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
let Promise = require('bluebird');

module.exports = {
  extend: 'apostrophe-pieces',
  options: {
    name: 'apostrophe-global',
    alias: 'global',
    label: 'Global',
    pluralLabel: 'Global',
    whileBusyDelay: 60,
    whileBusyRetryAfter: 5,
    whileBusyRequestDelay: 10,
    searchable: false
  },
  adjustOptions(self, options) {
    options.removeFields = [
      'title',
      'slug',
      'tags',
      'published',
      'trash'
    ].concat(options.removeFields || []);
  },
  init(self, options) {
    
    self.slug = options.slug || 'global';
    self.enableMiddleware();
  },
  handlers(self, options) {
    return {
      'apostrophe:modulesReady': {
        async initGlobal() {
          const req = self.apos.tasks.getReq();
          // Existence test must not load widgets etc. as this can lead
          // to chicken and egg problems if widgets join with page types
          // not yet registered
          const existing = await self.apos.docs.db.findOne({ slug: self.slug });
          if (!existing) {
            const _new = {
              slug: self.slug,
              published: true,
              type: self.name
            };
            await self.apos.docs.insert(req, _new);
          }
        }
      }
    };
  },
  methods(self, options) {
    return {
      
      // Fetch and return the `global` doc object.
      
      async findGlobal(req) {
        return self.find(req, { slug: self.slug }).permission(false).toObject();
      },
      
      // Add the `addGlobalToDataMiddleware`. And if requested,
      // the separate middleware for checking the global busy flag
      // when addGlobalToData has been overridden in a way that might
      // involve caching or otherwise not be up to date at all times.
      
      enableMiddleware() {
        self.expressMiddleware = (self.options.separateWhileBusyMiddleware ? [self.whileBusyMiddleware] : []).concat([self.addGlobalToDataMiddleware]);
      },
      
      // Used only when `separateWhileBusyMiddleware` is in effect
      async whileBusyMiddleware(req, res, next) {
        const global = await self.find(req, { slug: self.slug }).permission(false).areas(false).joins(false).toObject();
        
        try {
          await self.checkWhileBusy(req, global);
        } catch (err) {
          if (err === 'busy') {
            // Already handled, do not continue
            return;
          }
          throw err;
        }
        
        next();
      },
      
      // Check whether the site or locale is busy right now
      // (unable to respond to requests). If so, try to delay
      // and then continue as normal, or if too much time
      // passes, deliver a user-friendly busy response which
      // includes a refresh header. For API responses the
      // response does not include a refresh header.
      //
      // If the site is busy and the request has been
      // intercepted with a busy status code, this method throws the
      // string exception `'busy'` after responding, and
      // further processing of the request should not occur
      // in the calling code.
      
      async checkWhileBusy(req, _global) {
        let lockName = 'apostrophe-global-busy';
        let localeLockName;
        let propName = 'globalBusy';
        let localePropName;
        if (req.locale) {
          localeLockName = lockName + '-' + req.locale;
          localePropName = propName + req.locale;
        }
        
        await considerGlobal;
        await considerLocale;
        
        async function considerGlobal() {
          return considerLock(propName, lockName);
        }
        
        async function considerLocale() {
          if (!localePropName) {
            return;
          }
          return considerLock(localePropName, localeLockName);
        }
        
        async function considerLock(propName, lockName) {
          if (!_global[propName]) {
            return;
          }
          try {
            await self.apos.locks.lock(lockName, {
              wait: req.res && req.res.send ? self.options.whileBusyRequestDelay * 1000 : Number.MAX_VALUE,
              waitForSelf: true
            });
          } catch (err) {
            // An error occurred. If it is because the lock is still
            // present after waiting as long as we could for this req,
            // send a try-again response to the user. Then throw
            // a `busy` error so the calling code knows not to
            // continue
            if (err === 'locked' && req.res && req.res.send) {
              await self.busyTryAgainSoon(req);
              throw 'busy';
            } else {
              // All other errors propagate normally
              throw err;
            }
          }
          // We got in after a period of the system being busy,
          // or the process with the lock went away. Either way,
          // we should clear globalBusy and give up our lock,
          // then continue normal operation.
          await unmark;
          await unlock;
          await refind;
          
          async function unmark() {
            let $set = {};
            $set[propName] = false;
            await self.apos.docs.db.updateOne({ _id: _global._id }, { $set: $set });
          }
          async function unlock() {
            await self.apos.locks.unlock(lockName);
          }
          async function refind() {
            req.data.global = await self.findGlobal(req);
          }
        }
      },
      
      addGlobalToDataMiddleware(req, res, next) {
        return self.addGlobalToData(req).then(() => {
          // Don't break other middleware or routes that might not be defer-aware.
          // The regular page rendering route will reenable this on its own
          req.deferWidgetLoading = false;
          return next();
        }).catch(err => {
          if (err === 'busy') {
            // Suitable response already sent
            return;
          }
          self.apos.utils.error('ERROR loading global doc: ', err);
          // Here in middleware we can't tell if this would have been a page,
          // so we can't set `aposError` and wait. We have to force the issue
          res.status(500).send('error');
        });
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
        await self.checkWhileBusy(req, req.data.global);
        if (self.options.deferWidgetLoading) {
          await self.apos.areas.loadDeferredWidgets(req);
        }
      },
      
      async busyTryAgainSoon(req) {
        if (!_.includes([
            'GET',
            'HEAD'
          ], req.method)) {
          // Typically an API will receive this sad news
          return req.res.status(503).send({ status: 'busy' });
        }
        return req.res.status(503).set('Refresh', self.options.whileBusyRetryAfter).send(await self.render(req, 'busy.html'));
      },
      
      // Run the given function while the entire site is marked as busy.
      //
      // The given function will be awaited.
      //
      // While the site is busy new requests are delayed as much as possible,
      // then GET requests receive a simple "busy" page that retries
      // after an interval, etc. To address the issue of requests already
      // in progress, this method marks the site busy, then waits for
      // `options.whileBusyDelay` seconds before invoking `fn`.
      // That option defaults to 60 (one minute). Explicitly tracking
      // all requests in flight would have too much performance impact
      // on normal operation.
      //
      // This method should be used very rarely, for instance for a procedure
      // that deploys an entirely new set of content to the site. Use of
      // this method for anything more routine would have a crippling
      // performance impact.
      //
      // **Use with workflow**: if `options.locale` argument is present, only
      // the given locale name is marked busy. If `req` has any other
      // `req.locale` it proceeds normally. This option works only with
      // 'apostrophe-workflow' (the global docs must have `workflowLocale`
      // properties).
      
      async whileBusy(fn, options) {
        let locked = false;
        let marked = false;
        let lockName = 'apostrophe-global-busy';
        let propName = 'globalBusy';
        const locale = options && options.locale;
        if (locale) {
          lockName += '-' + locale;
          propName += self.apos.utils.capitalizeFirst(locale);
        }
        const criteria = { type: self.name };
        if (locale) {
          criteria.workflowLocale = locale;
        }
        try {
          await self.apos.locks.lock(lockName);
          locked = true;
          const args = { $set: { [propName]: true } };
          // so that if we really want to lock across all locales
          // (locale not passed and workflow present), we can
          await self.apos.docs.db.updateMany(criteria, args);
          marked = true;
          // Reasonable timeout for requests in progress
          await Promise.delay(self.options.whileBusyDelay * 1000);
          await fn();
        } finally {
          if (marked) {
            const args = { $set: { [propName]: false } };
            await self.apos.docs.db.updateMany(criteria, args);
          }
          if (locked) {
            await self.apos.locks.unlock(lockName);
          }
        }
      },
      
      // There is only one useful object of this type, so having access to the admin
      // bar button is not helpful unless you can edit that one, rather than
      // merely creating a new one (for which there is no UI). Thus we need
      // to set the permission requirement to admin-apostrophe-global.
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
        browserOptions._id = req.data.global && req.data.global._id || self._id;
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
