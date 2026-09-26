// This module provides a framework for triggering notifications
// within the Apostrophe admin UI. Notifications may be triggered
// either on the browser or the server side, via `apos.notify`.
//
// ## Options
//
// ### `longPolling`: by default, to provide a swift response, ApostropheCMS
// keeps a request for new notifications alive until the long polling
// timeout expires (see below). However, `longPolling: false` can be used
// to give an immediate response, in which case the front end will poll
// the old-fashioned way, respecting the `pollingInterval`.
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
//
// ### `pollingInterval`: when `longPolling` is set to `false`, this
// option determines how often the browser polls for new notifications.
// Not used when `longPolling` is `true` (the default).
// `pollingInterval` defaults to 5000 (5 seconds).
//
// ### `expireAfter`: seconds a notification document is kept before the
// database expires it. Dismissing a notification is browser-driven, so a
// notification nobody ever dismisses would otherwise live forever and be
// resent on every admin page load. Defaults to 86400 (one day); set it to
// 0 to keep notifications until they are dismissed. Individual
// notifications may override it via the `expireAfter` option of `trigger`.
//
// ### `channelExpireAfter`: seconds a channel message (see `trigger`) is
// kept. Channel messages are never dismissed, so this is how long a tab
// that fell behind can still catch up. Defaults to 120.
//
// ### `channelQueryInterval`: interval in milliseconds between database
// queries while long polling on behalf of a tab subscribed to channels. The
// database is the only place messages are found, whichever process
// triggered them, so this is how long a message may take to be picked up.
// Defaults to 150.
//
// ### `maxChannels`: the most channels a single poll may subscribe to.
// Defaults to 10.

const delay = require('bluebird').delay;

module.exports = {
  options: {
    alias: 'notification',
    longPolling: true,
    longPollingTimeout: 10000,
    queryInterval: 1000,
    // Used only when longPolling is false
    pollingInterval: 5000,
    expireAfter: 86400,
    channelExpireAfter: 120,
    channelQueryInterval: 150,
    maxChannels: 10
  },
  extend: '@apostrophecms/module',
  async init(self) {
    self.apos.notify = self.trigger;
    self.channelTypes = {};
    await self.ensureCollection();
    self.addMigrations();
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
    //
    // The client may also subscribe to channels (see `trigger`) by passing
    // `channels`, a JSON object mapping each channel name to the `seq` of
    // the last message already received on it, or to `null` to start from
    // now. The response then also has:
    //
    // `channelMessages`: an array of `{ channel, seq, event, originTabId }`
    // with `seq` greater than the one given, sorted by channel and `seq`.
    // For a message whose `originTabId` matches the `tabId` query parameter,
    // `event` is omitted: the sender already has it.
    //
    // `channelCursors`: the current `seq` of each channel passed as `null`.
    //
    // `refusedChannels`: channels the user may not subscribe to.
    getAll: {
      before: 'middleware:@apostrophecms/global',
      async route(req) {
        let modifiedOnOrSince;
        if (!(req.user && req.user._id)) {
          throw self.apos.error('invalid');
        }
        const start = Date.now();
        try {
          modifiedOnOrSince = req.query.modifiedOnOrSince &&
            new Date(req.query.modifiedOnOrSince);
        } catch (e) {
          throw self.apos.error('invalid');
        }
        const seenIds = req.query.seenIds && self.apos.launder.ids(req.query.seenIds);
        const tabId = self.apos.launder.string(req.query.tabId) || null;
        const {
          channels,
          channelCursors,
          refusedChannels
        } = await self.subscribe(req, req.query.channels);
        const subscribed = Object.keys(channels);
        const queryInterval = self.options.queryInterval || 1000;
        const interval = subscribed.length
          ? Math.min(queryInterval, self.options.channelQueryInterval)
          : queryInterval;
        return await attempt();

        async function attempt() {
          const remaining = self.options.longPollingTimeout - (Date.now() - start);
          if (self.options.longPolling && (remaining <= 0)) {
            return respond({
              notifications: [],
              dismissed: [],
              channelMessages: []
            });
          }

          const found = await self.find(req, {
            modifiedOnOrSince,
            seenIds,
            channels,
            tabId
          });
          if (
            self.options.longPolling &&
            !found.notifications.length &&
            !found.dismissed.length &&
            !found.channelMessages.length &&
            // A new subscriber learns its starting point right away
            !Object.keys(channelCursors).length
          ) {
            await delay(Math.min(interval, remaining));
            return attempt();
          }
          return respond(found);
        }

        function respond(found) {
          return {
            ...found,
            channelCursors,
            refusedChannels
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
        'error',
        'warning',
        'success',
        'info',
        'progress'
      ], 'info');
      const icon = self.apos.launder.string(req.body.icon);
      const message = self.apos.launder.string(req.body.message);
      const classes = self.apos.launder.strings(req.body.classes);
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
        classes,
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
    async patch(req, _id) {
      const dismissed = self.apos.launder.boolean(req.body.dismissed);
      if (dismissed) {
        await self.emit('beforeSave', req, {
          _id,
          dismissed
        });

        await self.db.updateOne({ _id }, {
          $set: {
            dismissed
          },
          $currentDate: {
            updatedAt: true
          }
        });
      }
    },
    async delete(req, _id) {
      await self.db.deleteMany({ _id });
    }
  }),
  apiRoutes(self) {
    return {
      post: {
        // Clear a registered event on a notification to prevent it from
        // emitting twice. Returns `true` if the event was found and cleared.
        // Returns `false` if not found (because it was already cleared).
        ':_id/clear-event': async function (req) {
          const lockId = `clear-event-${req.params._id}`;

          let response;
          try {
            await self.apos.lock.lock(lockId);

            response = await self.db.updateOne({
              _id: req.params._id,
              event: {
                $ne: null
              }
            }, {
              $set: {
                event: null
              }
            });
          } catch (error) {
            throw self.apos.error('notfound');
          } finally {
            await self.apos.lock.unlock(lockId);
          }

          return response.result.nModified > 0;
        }
      }
    };
  },
  methods(self) {
    return {
      getBrowserData(req) {
        return {
          action: self.action,
          longPolling: self.options.longPolling,
          pollingInterval: self.options.pollingInterval
        };
      },
      // When used server-side, call with `req` as the first argument,
      // or if you do not have a `req` it is acceptable to pass a user `_id`
      // string in place of `req`. Someone must be the recipient.
      //
      // When called client-side, there is no req argument because the
      // recipient is always the current user.
      //
      // The `message` argument should be a key that exists in a localization
      // file. If it does not, it will be displayed directly as a fallback.
      //
      // The `options.type` styles the notification and may be set to `error`,
      // `danger`, `warning`, `info` or `success`. If not set, a "plain" default
      // style is used.
      //
      // If `options.dismiss` is set to `true`, the message will auto-dismiss
      // after 5 seconds. If it is set to a number of seconds, it will dismiss
      // after that number of seconds. Otherwise it will not dismiss unless
      // clicked.
      //
      // If `options.buttons` is present, it must be an array of objects
      // with `type` and `label` properties. If `type` is `'event'` then the
      // object must have `name` and `data` properties, and when clicked the
      // button will trigger an apos bus event of the given `name` with the
      // provided `data` object. Currently `'event'` is the only supported value
      // for `type`.
      //
      // `options.return` will return the notification object. This is not
      // done otherwise to minimize risk of leaking MongoDB metadata to the
      // browser.
      //
      // `options.icon`, set to an active Vue Materials Icons icon name, will
      // set an icon on the notification.
      //
      // `options.expireAfter` overrides the module option of the same name
      // for this notification: a number of seconds after which the database
      // expires the document, or 0 to keep it until it is dismissed.
      //
      // `options.job` can be set to an object with properties related to an
      // Apostrophe Job (from the @apostrophecms/job module) for the
      // notification to track the job's progress. These can include the job
      // `_id` and, for the 'completed' stage, the job `action`,
      // e.g., 'archive'.
      //
      // `options.event`, an object with `name` and optional `data`
      // properties, is emitted on the browser bus (`apos.bus`) in exactly
      // one tab when the notification arrives.
      //
      // If `options.bus` is set to `true`, the notification is a pure
      // message-bus carrier: it is never rendered — the browser emits its
      // `event` and dismisses it. `event` is then required, the `message`
      // argument becomes optional, and the options object may be passed in
      // its place: `apos.notify(req, { bus: true, event })`.
      //
      // If `options.channel` is also set, the message goes to a channel
      // rather than to the user: every tab subscribed to that channel emits
      // `event` once, in the order messages were triggered on the channel,
      // and nothing is dismissed. The channel name is `type:id`, where
      // `type` was registered with `addChannelType`. `options.originTabId`
      // may name the sending browser tab, which is spared the event.
      // `options.expireAfter` defaults to the `channelExpireAfter` option.
      // Resolves to `{ channel, seq }`, where `seq` is the message's position
      // on the channel.
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
        if (message && (typeof message === 'object') && !Array.isArray(message)) {
          // The options object may be passed in place of the message
          options = message;
          message = null;
        }
        if (options.bus && !options.event?.name) {
          throw self.apos.error('invalid', 'a bus notification requires an event');
        }
        if (!message && !options.bus) {
          throw self.apos.error('required');
        }
        if (options.channel) {
          if (!options.bus) {
            throw self.apos.error('invalid', 'a channel notification must be a bus notification');
          }
          return self.triggerChannel(req, options);
        }

        req.body = req.body || {};

        const notification = {
          _id: self.apos.util.generateId(),
          createdAt: new Date(),
          userId: req.user._id,
          message: message || null,
          icon: options.icon,
          interpolate: interpolate || options.interpolate || {},
          // Defaults to true, otherwise launder as boolean
          localize: has(req.body, 'localize')
            ? self.apos.launder.boolean(req.body.localize)
            : true,
          job: options.job || null,
          event: options.event,
          classes: options.classes || null
        };

        if (options.dismiss === true) {
          options.dismiss = 5;
        }

        Object.assign(notification, options);

        const expireAfter = (options.expireAfter != null)
          ? options.expireAfter
          : self.options.expireAfter;
        delete notification.expireAfter;
        if (expireAfter) {
          notification.expireAt = new Date(Date.now() + expireAfter * 1000);
        }

        await self.emit('beforeSave', req, notification);

        // We await here rather than returning because we expressly do not
        // want to leak mongodb metadata to the browser
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

        return {
          noteId: notification._id
        };
      },

      // Implements `trigger` for a channel message. Messages on a channel
      // are numbered from 1 with no gaps. Each is inserted at one past the
      // highest `seq` found; the unique index refuses a `seq` another
      // process took first, and we try again. A message is thus stored
      // before any later one can be, which is what lets `find` hand
      // messages out by `seq` without skipping any.
      //
      // Sorting and range queries use `seqKey`, the zero-padded string
      // form of `seq`, because not every database adapter orders numbers
      // stored in documents numerically.
      async triggerChannel(req, options) {
        const channel = self.launderChannel(options.channel);
        if (!channel) {
          throw self.apos.error('invalid', 'unknown channel type');
        }
        const expireAfter = (options.expireAfter != null)
          ? options.expireAfter
          : self.options.channelExpireAfter;
        const message = {
          channel,
          event: options.event,
          originTabId: options.originTabId || null,
          senderId: req.user._id,
          createdAt: new Date(),
          ...(expireAfter && {
            expireAt: new Date(Date.now() + expireAfter * 1000)
          })
        };
        await self.emit('beforeSave', req, message);
        for (let attempt = 0; attempt < 100; attempt++) {
          const seq = (await self.getChannelSeq(channel)) + 1;
          try {
            await self.channelDb.insertOne({
              _id: self.apos.util.generateId(),
              ...message,
              seq,
              seqKey: self.getSeqKey(seq)
            });
            return {
              channel,
              seq
            };
          } catch (e) {
            if (e.code !== 11000) {
              throw e;
            }
          }
        }
        throw self.apos.error('error', `could not store a message on channel ${channel}`);
      },

      // Registers a type of channel. `canSubscribe(req, id)` must resolve to
      // true if `req` may receive messages on the channel `name:id`.
      addChannelType(name, { canSubscribe }) {
        if (name.includes(':')) {
          throw new Error(`A channel type name may not contain ":" (${name})`);
        }
        self.channelTypes[name] = { canSubscribe };
      },

      // Returns `{ type, id }` for a `type:id` channel name, or null if it
      // is not a string or its type is not registered. The id may itself
      // contain colons.
      parseChannel(channel) {
        if ((typeof channel) !== 'string') {
          return null;
        }
        const at = channel.indexOf(':');
        if (at === -1) {
          return null;
        }
        const type = channel.substring(0, at);
        const id = channel.substring(at + 1);
        if (!self.channelTypes[type] || !id.length) {
          return null;
        }
        return {
          type,
          id
        };
      },

      getSeqKey(seq) {
        return String(seq).padStart(15, '0');
      },

      launderChannel(channel) {
        return self.parseChannel(channel) ? channel : null;
      },

      // Resolves to the `seq` of the latest message stored on the channel,
      // or 0 if there is none.
      async getChannelSeq(channel) {
        const [ latest ] = await self.channelDb.find({ channel })
          .sort({ seqKey: -1 })
          .limit(1)
          .project({ seq: 1 })
          .toArray();
        return latest ? latest.seq : 0;
      },

      // Validates the `channels` query parameter of a poll: a JSON object
      // mapping channel names to the last `seq` seen, or null for "from
      // now". Resolves to `{ channels, channelCursors, refusedChannels }`,
      // where `channels` maps each permitted channel to the `seq` to deliver
      // after and `channelCursors` holds the starting `seq` of each channel
      // that was given as null.
      async subscribe(req, param) {
        const result = {
          channels: {},
          channelCursors: {},
          refusedChannels: []
        };
        if (!param) {
          return result;
        }
        let requested;
        try {
          requested = JSON.parse(param);
        } catch (e) {
          throw self.apos.error('invalid');
        }
        if (!requested || ((typeof requested) !== 'object') || Array.isArray(requested)) {
          throw self.apos.error('invalid');
        }
        const entries = Object.entries(requested);
        if (entries.length > self.options.maxChannels) {
          throw self.apos.error('invalid', 'too many channels');
        }
        for (const [ channel, since ] of entries) {
          const parsed = self.parseChannel(channel);
          let permitted = false;
          if (parsed) {
            try {
              permitted = await self.channelTypes[parsed.type]
                .canSubscribe(req, parsed.id);
            } catch (e) {
              self.apos.util.error(e);
            }
          }
          if (!permitted) {
            result.refusedChannels.push(channel);
            continue;
          }
          if (since == null) {
            const seq = await self.getChannelSeq(channel);
            result.channels[channel] = seq;
            result.channelCursors[channel] = seq;
          } else {
            result.channels[channel] = Math.max(0, self.apos.launder.integer(since));
          }
        }
        return result;
      },

      // The dismiss method accepts the following arguments:
      // - req: A valid req.
      // - noteId: The _id of an active notification.
      // - delay: An optional integer of milliseconds to pause before the
      //   notification actually dismisses.
      async dismiss (req, noteId, delay) {
        if (!req.user) {
          throw self.apos.error('forbidden');
        }

        await pause(delay);

        try {
          await self.emit('beforeSave', req, {
            _id: noteId,
            dismissed: true
          });

          await self.db.updateOne(
            {
              _id: noteId
            },
            {
              $set: {
                dismissed: true
              },
              $currentDate: {
                updatedAt: true
              }
            }
          );
        } catch (error) {
          // Most likely the ID did not belong to an actual notification.
          throw self.apos.error('invalid');
        }

        async function pause (delay) {
          if (!delay) {
            return;
          }

          return new Promise((resolve) => setTimeout(resolve, delay));
        }
      },
      // Resolves with an object with `notifications` and `dismissed`
      // properties.
      //
      // If `options.modifiedOnOrSince` is set, notifications
      // greater than the timestamp are sent,
      // minus any notifications whose IDs are in `options.seenIds`.
      //
      // If `options.channels` is set, mapping channel names to a `seq`, the
      // result also has a `channelMessages` array holding the messages
      // after that `seq` on each channel (see `getAll`). `options.tabId`
      // strips the event from messages that tab sent.

      async find(req, options) {
        try {
          const results = await self.db.find({
            userId: req.user._id,
            // The database sweeps expired notifications periodically rather
            // than instantly, and not every supported database honors expiry
            // yet, so never send one that is still stored past its time
            $or: [
              { expireAt: null },
              { expireAt: { $gt: new Date() } }
            ],
            ...(options.modifiedOnOrSince && {
              updatedAt: {
                $gt: new Date(options.modifiedOnOrSince)
              }
            }),
            ...(options.seenIds && {
              _id: {
                $nin: options.seenIds
              }
            })
          }).sort({ createdAt: 1 }).toArray();

          const notifications = results.filter(result => !result.dismissed);
          const dismissed = results.filter(result => result.dismissed);
          dismissed.forEach(element => {
            // 5-minute delay before deleting
            setTimeout(() => self.restApiRoutes.delete(req, element._id), 300000);
          });

          return {
            notifications,
            dismissed,
            channelMessages: await self.findChannelMessages(options)
          };
        } catch (err) {
          if (self.apos.db.closed) {
            // The database connection was intentionally closed,
            // which often triggers a race condition with
            // long polling requests. Send an empty response
            return {
              notifications: [],
              dismissed: [],
              channelMessages: []
            };
          } else {
            throw err;
          }
        }
      },

      async ensureCollection() {
        self.db = self.apos.db.collection('aposNotifications');
        await self.db.createIndex({
          userId: 1,
          createdAt: 1
        });
        // Per-document expiry: `expireAfterSeconds: 0` expires each document
        // at the exact time stored in its `expireAt` field. `sparse` keeps
        // notifications that opted out of expiry off the index entirely
        await self.db.createIndex({ expireAt: 1 }, {
          expireAfterSeconds: 0,
          sparse: true
        });
        // Channel messages live apart from notifications: they have no
        // recipient, are never dismissed and are ordered by `seq`, which
        // the unique index keeps free of duplicates
        self.channelDb = self.apos.db.collection('aposNotificationChannels');
        await self.channelDb.createIndex({
          channel: 1,
          seqKey: 1
        }, {
          unique: true
        });
        await self.channelDb.createIndex({ expireAt: 1 }, {
          expireAfterSeconds: 0,
          sparse: true
        });
      },

      // See `find`
      async findChannelMessages({ channels, tabId }) {
        const entries = Object.entries(channels || {});
        if (!entries.length) {
          return [];
        }
        const messages = await self.channelDb.find({
          $and: [
            {
              $or: entries.map(([ channel, since ]) => ({
                channel,
                seqKey: { $gt: self.getSeqKey(since) }
              }))
            },
            {
              $or: [
                { expireAt: null },
                { expireAt: { $gt: new Date() } }
              ]
            }
          ]
        }).sort({
          channel: 1,
          seqKey: 1
        }).limit(1000).toArray();
        return messages.map(({
          channel, seq, event, originTabId, senderId
        }) => ({
          channel,
          seq,
          originTabId,
          senderId,
          ...((!tabId || (originTabId !== tabId)) && { event })
        }));
      },

      addMigrations() {
        if (!self.options.expireAfter) {
          return;
        }
        // Notifications predating `expireAt` never expire, so they pile up
        // for the lifetime of the project. Discard those already past the
        // expiry they would have been given, stamp the rest
        self.apos.migration.add('notification-expire', async () => {
          const ms = self.options.expireAfter * 1000;
          const expireAt = new Date(Date.now() + ms);
          await self.db.deleteMany({
            expireAt: { $exists: false },
            createdAt: { $lt: new Date(Date.now() - ms) }
          });
          await self.db.updateMany(
            { expireAt: { $exists: false } },
            { $set: { expireAt } }
          );
        });
      }
    };
  }
};

function has(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}
