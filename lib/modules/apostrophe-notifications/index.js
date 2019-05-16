// This module provides a framework for triggering notifications
// within the Apostrophe admin UI. Notifications may be triggered
// either on the browser or the server side, via `apos.notice`.
//
// ## Options
//
// ### `queryInterval`: interval in milliseconds between MongoDB
// queries while long polling for notifications. Defaults to 1000
// (1 second). Set it longer if you prefer fewer queries, however
// these are indexed queries on a small amount of information and
// should not significantly impact your app.
//
// ### `longPollingTimeout`: maximum lifetime in milliseconds of a long
// polling HTTP request before a response with no notifications is sent.
// Defaults to 10000 (10 seconds) to avoid typical proxy server timeouts.
// Until it times out the request will keep making MongoDB queries to
// see if any new notifications are available (long polling).

var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

module.exports = {
  extend: 'apostrophe-module',

  construct: function(self, options) {

    self.pushAssets = function() {
      self.pushAsset('script', 'user', { when: 'user' });
      self.pushAsset('stylesheet', 'user', { when: 'user' });
    };

    // Call with `req`, then a message, followed by any interpolated strings
    // which must correspond to %s placeholders in `message` (variable number
    // of arguments), followed by an `options` object if desired.
    //
    // If you do not have a `req` it is acceptable to pass a user `_id` string
    // in place of `req`. Someone must be the recipient.
    //
    // `options.type` styles the notification and may be set to `error`,
    // `warn` or `success`. If not set, a "plain" default style is used.
    //
    // If `options.dismiss` is set to `true`, the message will auto-dismiss after 5 seconds.
    // If it is set to a number of seconds, it will dismiss after that number of seconds.
    // Otherwise it will not dismiss unless clicked.
    //
    // The message is internationalized, which is why the use of
    // %s placeholders for any inserted titles, etc. is important.
    //
    // Throws an error if there is no `req.user`.
    //
    // This method is aliased as `apos.notify` for convenience.
    //
    // The method returns a promise, which you may await if you need
    // to be absolutely certain the notification has been committed
    // to the database, for instance before exiting a command line task.
    // You may also pass a callback as a final argument.

    self.trigger = function(req, message, options) {
      var callback = arguments[arguments.length - 1];
      if (typeof callback === 'function') {
        return self.trigger.apply(self, Array.prototype.slice.call(arguments, 0, arguments.length - 1)).then(function() {
          return callback(null);
        }).catch(function(err) {
          return callback(err);
        });
      }
      if ((typeof req) === 'string') {
        // String was passed, assume it is a user _id
        req = {
          user: {
            _id: req
          }
        };
      }
      if (!req.user) {
        throw 'forbidden';
      }
      var strings = [];
      var i = 2;
      var index = 0;
      while (true) {
        index = message.indexOf('%s', index);
        if (index === -1) {
          break;
        }
        // Don't match the same one over and over
        index += 2;
        if ((i >= arguments.length) || ((typeof (arguments[i]) === 'object'))) {
          throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
        }
        strings.push(arguments[i++]);
      }
      if ((i === (arguments.length - 1)) && (typeof (arguments[i]) === 'object')) {
        options = arguments[i++];
      } else {
        options = {};
      }

      if (i !== arguments.length) {
        throw new Error('Bad notification call: number of %s placeholders does not match number of string arguments after message');
      }

      var notification = {
        _id: self.apos.utils.generateId(),
        createdAt: new Date(),
        userId: req.user._id,
        message: message,
        strings: strings
      };

      if (options.dismiss === true) {
        options.dismiss = 5;
      }

      _.merge(notification, options);

      return self.db.insert(notification);
    };

    // Send a new notification for the user.
    self.apiRoute('post', 'trigger', function(req, res, next) {
      // Saving the session where we don't have to
      // increases the risk of race conditions
      self.apos.utils.readOnlySession(req);
      var type = self.apos.launder.select(req.body.type, [ 'error', 'warn', 'success', 'info' ], 'info');
      var message = self.apos.launder.string(req.body.message);
      var strings = self.apos.launder.strings(req.body.strings);
      var dismiss = self.apos.launder.integer(req.body.dismiss);
      var pulse = self.apos.launder.boolean(req.body.pulse);
      // TODO what is this one for?
      var id = self.apos.launder.id(req.body.id);
      try {
        self.trigger.apply(self, [ req, message ].concat(strings).concat([ {
          dismiss: dismiss,
          type: type,
          pulse: pulse,
          id: id
        } ]));
      } catch (err) {
        return next(err);
      }
      return next(null);
    });

    // Dismiss the notification indicated by `req.body._id`.
    self.apiRoute('post', 'dismiss', function(req, res, next) {
      // Saving the session where we don't have to
      // increases the risk of race conditions
      self.apos.utils.readOnlySession(req);
      var _id = self.apos.launder.id(req.body._id);
      return self.db.remove({
        _id: _id
      }, next);
    });

    // This middleware is essentially a POST route at
    // `/modules/apostrophe-global/poll-notifications`. It is implemented
    // as middleware to allow it to run before `req.data.global` is loaded,
    // which can be a very expensive operation on some sites and should
    // thus not be required before a high-frequency polling operation.
    //
    // Poll for active notifications. Responds with:
    //
    // `{ status: 'ok', notifications: [ ... ], dismissed: [ id1... ] }`
    //
    // Each notification has an `html` property containing
    // its rendered, localized markup, as well as `_id`, `createdAt`
    // and `id` (if one was provided when it was triggered).
    //
    // The client must provide `req.body.displayingIds`,
    // an array of notification `_id` properties it is already displaying.
    // Without this, all notifications that have not been dismissed via the
    // dismiss route are sent.
    //
    // If any of the ids in `displayingIds` have been recently dismissed,
    // the response will include them in its `dismissed` property.
    //
    // Waits up to 10 seconds for new notifications (long polling),
    // but then respond with an empty array to avoid proxy server timeouts.
    //
    // As usual POST is used to avoid unwanted caching of the response.

    self.expressMiddleware = function(req, res, next) {
      if (req.url !== (self.action + '/poll-notifications')) {
        return next();
      }
      // Saving the session where we don't have to
      // increases the risk of race conditions, especially
      // in this very frequent route, resulting in the loss
      // of workflow mode changes, workflow locale changes, etc.
      self.apos.utils.readOnlySession(req);
      if (!(req.user && req.user._id)) {
        return self.apiResponder(req, 'invalid');
      }
      var start = Date.now();
      var displayingIds = self.apos.launder.ids(req.body.displayingIds);
      return attempt();

      function attempt() {
        if (Date.now() - start >= (self.options.longPollingTimeout || 10000)) {
          return res.send({
            status: 'ok',
            notifications: [],
            dismissed: []
          });
        }
        return Promise.try(function() {
          return self.find(req, { displayingIds: displayingIds });
        }).then(function(result) {
          var notifications = result.notifications;
          var dismissed = result.dismissed;
          if ((!notifications.length) && (!dismissed.length)) {
            return Promise.delay(self.options.queryInterval || 1000).then(attempt);
          }
          _.each(notifications, function(notification) {
            var args = [ notification.message ].concat(notification.strings);
            var message = req.__.apply(req, args);
            var params = _.clone(notification);
            params.message = message;
            notification.html = self.render(
              req,
              'notification',
              params
            );
          });
          return self.apiResponder(req, null, {
            notifications: notifications,
            dismissed: dismissed
          });
        });
      }
    };

    // Resolves with an object with `notifications` and `dismissed`
    // properties.
    //
    // Returns a promise if no callback is passed.
    //
    // If `options.displayingIds` is set, notifications
    // whose `_id` properties appear in it are not returned.

    self.find = function(req, options, callback) {
      if (callback) {
        return self.find(req, options).then(function(result) {
          return callback(null, result);
        }).catch(callback);
      }
      return self.db.find({
        userId: req.user._id
      }).sort({ createdAt: 1 }).toArray().then(function(notifications) {
        return {
          notifications: _.filter(notifications,
            function(notification) {
              return !_.includes(options.displayingIds || [], notification._id);
            }
          ),
          dismissed: _.difference(options.displayingIds || [], _.pluck(notifications, '_id'))
        };
      }).catch(function(err) {
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
      });
    };

    self.ensureCollection = function(callback) {
      self.db = self.apos.db.collection('aposNotifications');
      return callback(null);
    };

    self.ensureIndexes = function(callback) {
      return self.db.ensureIndex({ userId: 1, createdAt: 1 }, callback);
    };

  },

  afterConstruct: function(self, callback) {
    self.pushAssets();
    self.pushCreateSingleton();
    self.apos.notify = self.trigger;
    return self.ensureCollection(function(err) {
      if (err) {
        return callback(err);
      }
      self.on('apostrophe:migrate', 'ensureIndexesPromisified', function() {
        return require('bluebird').promisify(self.ensureIndexes)();
      });
      return callback(null);
    });
  }
};
