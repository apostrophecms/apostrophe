// This module allows other modules to create command line tasks.
//
// A command line task is invoked like this:
//
// node app apostrophe-migrations:migrate
//
// Apostrophe is fully initialized before your task is run, except that it does
// not listen for connections. So you may access all of its features in your task.

// Direct use of `console` makes sense here because
// we're implementing an interaction at the CLI.
// -Tom

/* eslint-disable no-console */

var _ = require('@sailshq/lodash');
var Promise = require('bluebird');

module.exports = {

  alias: 'tasks',

  singletonWarningIfNot: 'apostrophe-tasks',

  afterConstruct: function(self) {
    self.apos.on('runTask', self.run);
  },

  construct: function(self, options) {

    self.tasks = {};

    // For use when you wish to execute an Apostrophe command line task from your code and continue,
    // without using the command line or using the `child_process` module.
    //
    // Except for `name`, all arguments may be omitted.
    //
    // If you do not pass a callback, a promise is returned.
    //
    // Examples (assume `products` extends `apostrophe-pieces`):
    //
    // `self.apos.tasks.invoke('apostrophe-users:add', [ 'admin', 'admin' ]).then(function() { ... })`
    //
    // `self.apos.tasks.invoke('products:generate', { total: 20 }).then(function() { ... })`
    //
    // The `args` and `options` arguments may be completely omitted.
    //
    // If present, `args` contains an array of positional arguments to
    // the task, **not including** the task name.
    //
    // If present, `options` contains the optional parameters that would normally
    // be hyphenated, i.e. at the command line you might write `--total=20`.
    //
    // **Gotchas**
    //
    // If you can invoke a method directly rather than invoking a task, do that. This
    // method is for cases where that option is not readily available.
    //
    // During the execution of the task, `self.apos.argv` will have a new,
    // temporary value to accommodate tasks that inspect this property directly
    // rather than examining their `argv` argument. `self.apos.argv` will be
    // restored at the end of task execution.
    //
    // Some tasks may not be written to be "good neighbors." For instance, a
    // task developer might assume they can exit the process directly.

    self.invoke = function(name, args, options, callback) {
      const aposArgv = self.apos.argv;
      if (Array.isArray(args)) {
        args.splice(0, 0, name);
      } else {
        callback = options;
        options = args;
        args = [ name ];
      }
      if (!((typeof options) === 'object')) {
        callback = options;
        options = {};
      }
      if (!callback) {
        return Promise.promisify(body)();
      } else {
        return body(callback);
      }
      function body(callback) {
        const task = self.find(name);
        const argv = {
          _: args
        };
        Object.assign(argv, options || {});
        self.apos.argv = argv;
        var promise = task.callback(self.apos, argv, after);
        if (promise && promise.then) {
          return promise.then(function() {
            return after(null);
          }).catch(after);
        }
        function after(err) {
          self.apos.argv = aposArgv;
          return callback(err);
        }
      }
    };

    // Add a command line task to Apostrophe. It is easiest to invoke this
    // via the `addTask` method of your own module. You may also call it
    // directly.
    //
    // If you do call directly, the group name should be the name of your module.
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
    // **Your task may return a promise** instead of invoking the callback.
    // You **must not** do both.
    //
    // Your code will usually need to invoke methods that require a `req` argument.
    // Call `self.apos.tasks.getReq()` to get a `req` object with
    // unlimited admin permissions. Use `self.apos.tasks.getAnonReq()` to get
    // a `req` object without permissions.

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

    // You should not need to call this method directly. You probably
    // want `apos.tasks.invoke` (see above).
    //
    // This method is invoked by Apostrophe to execute the task specified
    // by the first command line argument. On completion the process exits.
    // If the task experiences an error it is printed to `console.error`
    // and the process exits with a nonzero status code.
    //
    // This method also implements the `help` task directly.

    self.run = function() {

      var task;
      var cmd = self.apos.argv._[0];
      if (!cmd) {
        throw new Error('apos.tasks.run invoked but there is no command line argument to serve as a task name, should never happen');
      }

      if (cmd === 'help') {

        // list all tasks
        if (self.apos.argv._.length === 1) {
          self.usage();
        }

        // help with specific task
        if (self.apos.argv._.length === 2) {
          task = self.find(self.apos.argv._[1]);
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

      task = self.find(cmd);

      if (!task) {
        console.error('\nThere is no such task.');
        self.usage();
      }

      var promise = task.callback(self.apos, self.apos.argv, afterTask);
      if (promise && promise.then) {
        return promise.then(function() {
          return afterTask(null);
        }).catch(afterTask);
      }

      function afterTask(err) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        process.exit(0);
      }
    };

    // Identifies the task corresponding to the given command line argument.
    // This allows for Rails-style hyphenated syntax with a `:` separator,
    // which is the documented syntax, and also allows camel-cased syntax with a `.`
    // separator for those who prefer a more JavaScript-y syntax.

    self.find = function(fullName) {
      var matches = fullName.match(/^(.*?):(.*)$/);
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

    // Displays a usage message, including a list of available tasks,
    // and exits the entire program with a nonzero status code.

    self.usage = function() {
      // Direct use of console makes sense in tasks. -Tom
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

    // Return a `req` object with permission to do anything.
    // Useful since most APIs require one and most tasks
    // should run with administrative rights.
    //
    // The `req` object returned is a mockup of a true Express `req` object
    // with sufficient functionality to implement Apostrophe's
    // unit tests, so it is suitable for command line
    // task code that requires a `req` as well.
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
          __ns: function(namespace, s) {
            return s;
          },
          __ns_n: function(namespace, s) {
            return s;
          },
          __ns_mf: function(namespace, s) {
            return s;
          },
          __ns_l: function(namespace, s) {
            return s;
          },
          __ns_h: function(namespace, s) {
            return s;
          },
          __: function(s) {
            return s;
          },
          __n: function(s) {
            return s;
          },
          __mf: function(s) {
            return s;
          },
          __l: function(s) {
            return s;
          },
          __h: function(s) {
            return s;
          }
        },
        __ns: function(namespace, s) {
          return s;
        },
        __ns_n: function(namespace, s) {
          return s;
        },
        __ns_mf: function(namespace, s) {
          return s;
        },
        __ns_l: function(namespace, s) {
          return s;
        },
        __ns_h: function(namespace, s) {
          return s;
        },
        __: function(s) {
          return s;
        },
        __n: function(s) {
          return s;
        },
        __mf: function(s) {
          return s;
        },
        __l: function(s) {
          return s;
        },
        __h: function(s) {
          return s;
        },
        data: {},
        protocol: 'http',
        get: function(propName) {
          return {
            Host: 'you-need-to-set-baseUrl-in-app-js.com'
          }[propName];
        },
        browserCall: self.apos.app && self.apos.app.request.browserCall,
        getBrowserCalls: self.apos.app && self.apos.app.request.getBrowserCalls,
        query: {},
        url: '/',
        session: {}
      };
      req.res.req = req;
      _.extend(req, properties || {});
      self.apos.modules['apostrophe-express'].addAbsoluteUrlsToReq(req);
      return req;
    };

    // Return a `req` object with privileges equivalent
    // to an anonymous user visiting the website. Most
    // often used for unit testing but sometimes useful
    // in tasks as well.
    //
    // The `req` object returned is a mockup of a true Express `req` object
    // with sufficient functionality to implement Apostrophe's
    // unit tests, so it is suitable for command line
    // task code that requires a `req` as well.
    //
    // Optionally a `properties` object can be passed. If it is
    // passed its properties are added to the req object before
    // any initialization tasks such as computing `req.absoluteUrl`.
    // This allows testing of that mechanism by setting `req.url`.

    self.getAnonReq = function(properties) {
      var req = self.getReq();
      delete req.user;
      _.extend(req, properties || {});
      return req;
    };
  }
};
