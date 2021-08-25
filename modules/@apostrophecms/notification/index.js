// This module provides a framework for triggering notifications
// within the Apostrophe admin UI. Notifications may be triggered
// either on the browser or the server side, via `apos.notice`.
//
// ## Options
//
// ### `queryInterval`: interval in milliseconds between MongoDB
// queries while long polling for notifications. Defaults to 500
// (1/2 second). Set it longer if you prefer fewer queries, however
// these are indexed queries on a small amount of information and
// should not significantly impact your app.
//
// ### `longPollingTimeout`: maximum lifetime in milliseconds of a long
// polling HTTP request before a response with no notifications is sent.
// Defaults to 10000 (10 seconds) to avoid typical proxy server timeouts.
// Until it times out the request will keep making MongoDB queries to
// see if any new notifications are available (long polling).

const delay = require('bluebird').delay;

module.exports = {
  options: {
    alias: 'notification'
  },
  extend: '@apostrophecms/module',
  async init(self) {
    self.apos.notify = self.trigger;
    await self.ensureCollection();
    self.enableBrowserData();
  },
  restApiRoutes: (self) => ({
    // Poll for active notifications. Responds with:
    //
    // `{ notifications: [ ... ], dismissed: [ id1... ] }`
    //
    // Each notification has an `html` property containing
    // its rendered, localized markup, as well as `_id`, `createdAt`
    // and `id` (if one was provided when it was triggered).
    //
    // The client should provide `modifiedOnOrSince` and `seenIds` in the
    // query. `modifiedOnOrSince` is the timestamp of the most recent
    // notification modification time (updatedAt) the client has already seen,
    // and `seenIds` must contain the _ids of the notifications with that
    // exact notification time that the client has already seen, for
    // disambiguation.
    //
    // Waits up to 10 seconds for new notifications (long polling),
    // but then responds with an empty array to avoid proxy server timeouts.
    getAll: {
      before: 'middleware:@apostrophecms/global',
      async route(req) {
        let modifiedOnOrSince;
        if (!(req.user && req.user._id)) {
          throw self.apos.error('invalid');
        }
        const start = Date.now();
        try {
          modifiedOnOrSince = req.query.modifiedOnOrSince && new Date(req.query.modifiedOnOrSince);
        } catch (e) {
          throw self.apos.error('invalid');
        }
        const seenIds = req.query.seenIds && self.apos.launder.ids(req.query.seenIds);
        return await attempt();

        async function attempt() {
          if (Date.now() - start >= (self.options.longPollingTimeout || 10000)) {
            return {
              notifications: [],
              dismissed: []
            };
          }

          const { notifications, dismissed } = await self.find(req, {
            modifiedOnOrSince,
            seenIds
          });
          if (!notifications.length && !dismissed.length) {
            await delay(self.options.queryInterval || 1000);
            return attempt();
          }

          return {
            notifications,
            dismissed
          };
        }
      }
    },
    getOne(req, _id) {
      return self.find(req, { displayingIds: [ _id ] });
    },
    async post(req) {
      const type = self.apos.launder.select(req.body.type, [
        'danger',
        'warning',
        'success',
        'info'
      ], 'info');
      const icon = self.apos.launder.string(req.body.icon);
      const message = self.apos.launder.string(req.body.message);
      const interpolate = launderInterpolate(req.body.interpolate);
      const dismiss = self.apos.launder.integer(req.body.dismiss);
      let buttons = req.body.buttons;
      if (!Array.isArray(buttons)) {
        buttons = null;
      } else {
        buttons = buttons.filter(button => {
          return (button.type === 'event') &&
          ((typeof button.name) === 'string') &&
          ((typeof button.label) === 'string') &&
          ((button.data == null) || (((typeof button.data) === 'object') && (!Array.isArray(button.data))));
        }).map(button => ({
          name: button.name,
          data: button.data,
          label: button.label,
          type: button.type
        }));
      }
      return self.trigger(req, message, {
        interpolate,
        dismiss,
        icon,
        type,
        buttons
      });

      function launderInterpolate(input) {
        if ((input == null) || ((typeof input) !== 'object')) {
          return {};
        }
        const interpolate = {};
        for (const [ key, val ] of Object.entries(input)) {
          if (key === 'count') {
            // Has a special status in i18next
            interpolate[key] = self.apos.launder.integer(val);
          } else {
            interpolate[key] = self.apos.launder.string(val);
          }
        }
        return interpolate;
      }
    },
    put(req, _id) {
      throw self.apos.error('unimplemented');
    },
    patch(req, _id) {
      const dismissed = self.apos.launder.boolean(req.body.dismissed);
      if (dismissed) {
        return self.db.updateOne({ _id }, {
          $set: {
            dismissed
          },
          $currentDate: {
            updatedAt: true
          }
        });
      }
    },
    delete(req, _id) {
      return self.db.deleteMany({ _id });
    }
  }),
  methods(self) {
    return {
      getBrowserData(req) {
        return {
          action: self.action
        };
      },
      // Call with `req`, then a message key as found in the localization files,
      // followed by an `options` object if desired.
      //
      // If you do not have a `req` it is acceptable to pass a user `_id` string
      // in place of `req`. Someone must be the recipient.
      //
      // `message` should be a key that exists in a localization file. If it does not
      // it will be displayed directly as a fallback.
      //
      // `options.type` styles the notification and may be set to `error`,
      // `warning` or `success`. If not set, a "plain" default style is used.
      //
      // If `options.dismiss` is set to `true`, the message will auto-dismiss after 5 seconds.
      // If it is set to a number of seconds, it will dismiss after that number of seconds.
      // Otherwise it will not dismiss unless clicked.
      //
      // If `options.buttons` is present, it must be an array of objects
      // with `type` and `label` properties. If `type` is `'event'` then the object must have
      // `name` and `data` properties, and when clicked the button will trigger an
      // apos bus event of the given `name` with the provided `data` object. Currently
      // `'event'` is the only supported value for `type`.
      //
      // Throws an error if there is no `req.user`.
      //
      // `interpolate` may contain an object with properties to be
      // interpolated into the message via i18next. These can also
      // be passed via `options.interpolate`.
      //
      // This method is aliased as `apos.notify` for convenience.
      //
      // The method is async, and you may `await` to be certain the
      // notification has reached the database, but this is not mandatory.
      // It is a good idea when triggering a notification just before exiting
      // the application, as in a command line task.

      async trigger(req, message, options = {}, interpolate = {}) {
        if (typeof req === 'string') {
          // String was passed, assume it is a user _id
          req = { user: { _id: req } };
        }
        if (!req.user) {
          throw self.apos.error('forbidden');
        }
        if (!message) {
          throw self.apos.error('required');
        }

        const notification = {
          _id: self.apos.util.generateId(),
          createdAt: new Date(),
          userId: req.user._id,
          message,
          interpolate: interpolate || options.interpolate || {},
          // Defaults to true, otherwise launder as boolean
          localize: has(req.body, 'localize') ? self.apos.launder.boolean(req.body.localize) : true
        };

        if (options.dismiss === true) {
          options.dismiss = 5;
        }

        Object.assign(notification, options);

        // We await here rather than returning because we
        // expressly do not want to leak mongodb metadata to the browser
        await self.db.updateOne(
          notification,
          {
            $set: notification,
            $currentDate: {
              updatedAt: true
            }
          }, {
            upsert: true
          }
        );
      },

      // Resolves with an object with `notifications` and `dismissed`
      // properties.
      //
      // If `options.modifiedOnOrSince` is set, notifications
      // greater than the timestamp are sent,
      // minus any notifications whose IDs are in `options.seenIds`.

      async find(req, options) {
        try {
          const results = await self.db.find({
            userId: req.user._id,
            ...(options.modifiedOnOrSince && { updatedAt: { $gte: new Date(options.modifiedOnOrSince) } }),
            ...(options.seenIds && { _id: { $nin: options.seenIds } })
          }).sort({ createdAt: 1 }).toArray();

          const notifications = results.filter(result => !result.dismissed);
          const dismissed = results.filter(result => result.dismissed);
          dismissed.forEach(element => {
            // 5-minute delay before deleting
            setTimeout(() => self.restApiRoutes.delete(req, element._id), 300000);
          });

          return {
            notifications,
            dismissed
          };
        } catch (err) {
          if (self.apos.db.closed) {
            // The database connection was intentionally closed,
            // which often triggers a race condition with
            // long polling requests. Send an empty response
            return {
              notifications: [],
              dismissed: []
            };
          } else {
            throw err;
          }
        }
      },

      async ensureCollection() {
        self.db = self.apos.db.collection('aposNotifications');
        return self.db.createIndex({
          userId: 1,
          createdAt: 1
        });
      }
    };
  }
};

function has(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}
