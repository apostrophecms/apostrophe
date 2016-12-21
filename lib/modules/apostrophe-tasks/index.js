// This module allows other modules to create command line tasks.
//
// A command line task is invoked like this:
//
// node app apostrophe-migrations:migrate
//
// Apostrophe is fully initialized before your task is run, except that it does
// not listen for connections. So you may access all of its features in your task.

var _ = require('lodash');

module.exports = {

  alias: 'tasks',

  afterConstruct: function(self) {
    self.apos.on('runTask', self.run);
  },

  construct: function(self, options) {

    self.tasks = {};

    // Add a command line task to Apostrophe.
    //
    // The group name, by convention, should be the name of your module.
    //
    // The name may be any short, memorable identifier, hyphenated if necessary.
    //
    // You may omit the `usage` parameter complete if you don't want to supply
    // a help message, but we recommend that you do so.
    //
    // Your callback function receives `(apos, argv, callback)`. Your
    // function should perform the necessary task, referring to
    // `argv._` for positional command line arguments (`[0]` is the task name)
    // and to `argv.foo` for an option specified as `--foo=bar`.
    //
    // On completing the task your function should invoke the callback.
    // If the callback is invoked with `null`, Apostrophe will exit quietly
    // with status 0 (success), otherwise it will display the error given
    // and exit with status 1 (failure).
    //
    // Your code will usually need to invoke methods that require a `req` argument.
    // Call `self.apos.tasks.getReq()` to get a `req` object with
    // unlimited admin permissions.

    self.add = function(groupName, name, usage, callback) {
      if (arguments.length === 3) {
        callback = usage;
        usage = undefined;
      }
      if (!_.has(self.tasks, groupName)) {
        self.tasks[groupName] = {};
      }
      self.tasks[groupName][name] = {
        callback: callback,
        usage: usage
      };
    };

    self.run = function() {

      var cmd = self.apos.argv._[0];
      if (!cmd) {
        return setImmediate(callback);
      }

      if (cmd === 'help') {

        // list all tasks
        if (self.apos.argv._.length === 1) {
          self.usage();
        }

        // help with specific task
        if (self.apos.argv._.length === 2) {
          var task = self.find(self.apos.argv._[1]);
          if (!task) {
            console.error('There is no such task.');
            self.usage();
          }
          if (task.usage) {
            console.log('\nTips for the ' + task.fullName + ' task:\n');
            console.log(task.usage);
          } else {
            console.log('That is a valid task, but it does not have a help message.');
          }
          process.exit(0);
        }
      }

      var task = self.find(cmd);

      if (!task) {
        console.error('\nThere is no such task.');
        self.usage();
      }

      return task.callback(self.apos, self.apos.argv, afterTask);

      function afterTask(err) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        process.exit(0);
      }
    };

    self.find = function(fullName) {
      var matches = fullName.match(/^(.*?)\:(.*)$/);
      if (!matches) {
        return false;
      } else {
        var groupName = matches[1];
        var name = matches[2];
        if (!_.has(self.tasks, groupName)) {
          return false;
        }
        if (!_.has(self.tasks[groupName], name)) {
          return false;
        }
      }
      var task = self.tasks[groupName][name];
      task.fullName = groupName + ':' + name;
      return task;
    };

    self.usage = function() {
      console.error('\nThe following tasks are available:\n');
      _.each(self.tasks, function(group, groupName) {
        _.each(group, function(task, name) {
          console.error(groupName + ':' + name);
        });
      });
      console.error('\nType:\n');
      console.error('node app help groupname:taskname\n');
      console.error('To get help with a specific task.\n');
      console.error('To launch the site, run with no arguments.');
      process.exit(1);
    };

    // Return a req object with permission to do anything.
    // Useful since most APIs require one and most tasks
    // should run with administrative rights.
    //
    // Optionally a `properties` object can be passed. If it is
    // passed its properties are added to the req object before
    // any initialization tasks such as computing `req.absoluteUrl`.
    // This allows testing of that mechanism by setting `req.url`.

    self.getReq = function(properties) {
      var req = {
        user: {
          _permissions: {
            admin: true
          }
        },
        res: {
          __: function(s) {
            return s;
          }
        },
        protocol: 'http',
        get: function(propName) {
          return {
            Host: 'you-need-to-set-baseUrl-in-app-js.com'
          }[propName];
        }
      };
      _.extend(req, properties || {});
      self.apos.modules['apostrophe-express'].addAbsoluteUrlsToReq(req);
      return req;
    };
  }
};
