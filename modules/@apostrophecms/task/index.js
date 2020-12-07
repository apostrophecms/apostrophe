// This module allows other modules to create command line tasks.
//
// A command line task is invoked like this:
//
// node app @apostrophecms/migration:migrate
//
// Apostrophe is fully initialized before your task is run, except that it does
// not listen for connections. So you may access all of its features in your task.

// Direct use of `console` makes sense here because
// we're implementing an interaction at the CLI.
// -Tom

/* eslint-disable no-console */

const _ = require('lodash');

module.exports = {
  options: { alias: 'task' },
  init(self, options) {
    self.tasks = {};
  },
  handlers(self, options) {
    return {
      'apostrophe:run': {
        async runTask(isTask) {

          if (!isTask) {
            return;
          }

          let task;
          const cmd = self.apos.argv._[0];
          if (!cmd) {
            throw new Error('There is no command line argument to serve as a task name, should never happen');
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

          try {
            await task.fn(self.apos, self.apos.argv);
          } catch (e) {
            console.error(e);
            process.exit(1);
          }
          process.exit(0);
        }
      }
    };
  },
  methods(self, options) {
    return {

      // For use when you wish to execute an Apostrophe command line task from your code and continue,
      // without using the command line or using the `child_process` module.
      //
      // Except for `name`, all arguments may be omitted.
      //
      // This is an async function and should be awaited.
      //
      // Examples (assume `products` extends `@apostrophecms/piece-type`):
      //
      // `await self.apos.task.invoke('@apostrophecms/user:add', [ 'admin', 'admin' ])`
      //
      // `await self.apos.task.invoke('products:generate', { total: 20 })`
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

      async invoke(name, args, options) {
        const aposArgv = self.apos.argv;
        if (Array.isArray(args)) {
          args.splice(0, 0, name);
        } else {
          options = args;
          args = [ name ];
        }
        const task = self.find(name);
        const argv = {
          _: args,
          ...options || {}
        };
        self.apos.argv = argv;
        await task.fn(self.apos, argv);
        self.apos.argv = aposArgv;
      },

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
      // Your function receives `(apos, argv)`. It should be an async function
      // and will be awaited.
      //
      // Your function should perform the necessary task, referring to
      // `argv._` for positional command line arguments (`[0]` is the task name)
      // and to `argv.foo` for an option specified as `--foo=bar`.
      //
      // If the function throws a string as an exception, Apostrophe will display
      // it, without a stack trace, and exit with a status of 1 (failure). This is useful
      // for error messages.
      //
      // If the function throws another type of exception, Apostrophe will log it fully
      // for developer use and also exit with a status of 1 (failure).
      //
      // Your code will typically need to invoke methods that require a `req` argument.
      // Call `self.apos.task.getReq()` to get a `req` object with
      // unlimited admin permissions. Use `self.apos.task.getAnonReq()` to get
      // a `req` object without permissions.

      add(groupName, name, usage, fn) {
        if (arguments.length === 3) {
          fn = usage;
          usage = 'No help available';
        }
        if (!_.has(self.tasks, groupName)) {
          self.tasks[groupName] = {};
        }
        self.tasks[groupName][name] = {
          fn: fn,
          usage: usage
        };
      },

      // Identifies the task corresponding to the given command line argument.
      // This allows for Rails-style hyphenated syntax with a `:` separator,
      // which is the documented syntax, and also allows camel-cased syntax with a `.`
      // separator for those who prefer a more JavaScript-y syntax.

      find(fullName) {
        const matches = fullName.match(/^(.*?):(.*)$/);
        if (!matches) {
          return false;
        }
        const groupName = matches[1];
        const name = matches[2];
        if (!_.has(self.tasks, groupName)) {
          return false;
        }
        if (!_.has(self.tasks[groupName], name)) {
          return false;
        }
        const task = self.tasks[groupName][name];
        task.fullName = groupName + ':' + name;
        return task;
      },

      // Displays a usage message, including a list of available tasks,
      // and exits the entire program with a nonzero status code.

      usage() {
        // Direct use of console makes sense in tasks. -Tom
        console.error('\nThe following tasks are available:\n');
        _.each(self.tasks, function (group, groupName) {
          _.each(group, function (task, name) {
            console.error(groupName + ':' + name);
          });
        });
        console.error('\nType:\n');
        console.error('node app help groupname:taskname\n');
        console.error('To get help with a specific task.\n');
        console.error('To launch the site, run with no arguments.');
        process.exit(1);
      },

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

      getReq(properties) {
        const req = {
          user: {
            title: 'System Task'
          },
          res: {
            __: function (s) {
              return s;
            }
          },
          __: function (s) {
            return s;
          },
          data: {},
          protocol: 'http',
          get: function (propName) {
            return { Host: 'you-need-to-set-baseUrl-in-app-js.com' }[propName];
          },
          query: {},
          url: '/',
          locale: `${(self.apos.modules['@apostrophecms/i18n'].options.defaultLocale || 'default')}:published`
        };
        if (properties.mode) {
          req.locale = req.locale.replace(':published', ':draft');
        }
        _.extend(req, properties || {});
        self.apos.modules['@apostrophecms/express'].addAbsoluteUrlsToReq(req);
        return req;
      },

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

      getAnonReq(properties) {
        const req = self.getReq();
        delete req.user;
        _.extend(req, properties || {});
        return req;
      }
    };
  }
};
