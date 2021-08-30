// This module allows other modules to create command line tasks.
//
// A command line task is invoked like this:
//
// node app @apostrophecms/migration:migrate
//
// Apostrophe is fully initialized before your task is run, except that it does
// not listen for connections. So you may access all of its features in your
// task.

// Direct use of `console` makes sense here because we're implementing an
// interaction at the CLI.

/* eslint-disable no-console */

const _ = require('lodash');
const { stripIndent } = require('common-tags');

module.exports = {
  options: { alias: 'task' },
  handlers(self) {
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
                console.log(`\nTips for the ${task.fullName} task:\n`);
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
            await task.task(self.apos.argv);
          } catch (e) {
            console.error(e);
            process.exit(1);
          }
          process.exit(0);
        }
      }
    };
  },
  methods(self) {
    return {

      // For use when you wish to execute an Apostrophe command line task from
      // your code and continue, without using the command line or using the
      // `child_process` module.
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
      // If present, `options` contains the optional parameters that would
      // normally be hyphenated, i.e. at the command line you might write
      // `--total=20`.
      //
      // **Gotchas**
      //
      // If you can invoke a method directly rather than invoking a task, do
      // that. This method is for cases where that option is not readily
      // available.
      //
      // During the execution of the task, `self.apos.argv` will have a new,
      // temporary value to accommodate tasks that inspect this property
      // directly rather than examining their `argv` argument. `self.apos.argv`
      // will be restored at the end of task execution.
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
        await task.task(argv);
        self.apos.argv = aposArgv;
      },

      // Identifies the task corresponding to the given command line argument.

      find(fullName) {
        const matches = fullName.match(/^(.*?):(.*)$/);
        if (!matches) {
          return false;
        }
        const moduleName = matches[1];
        const name = matches[2];
        if (!(self.apos.modules[moduleName] && _.has(self.apos.modules[moduleName].tasks, name))) {
          return false;
        }
        const task = self.apos.modules[moduleName].tasks[name];
        task.fullName = `${moduleName}:${name}`;
        return task;
      },

      // Displays a usage message, including a list of available tasks,
      // and exits the entire program with a nonzero status code.

      usage() {
        // Direct use of console makes sense in tasks. -Tom
        console.error('\nThe following tasks are available:\n');
        for (const [ moduleName, module ] of Object.entries(self.apos.modules)) {
          for (const name of Object.keys(module.tasks)) {
            console.error(`${moduleName}:${name}`);
          }
        }
        console.error('\nType:\n');
        console.error('node app help groupname:taskname\n');
        console.error('To get help with a specific task.\n');
        console.error('To launch the site, run with no arguments.');
        process.exit(1);
      },

      // Return a `req` object suitable for command line tasks
      // and unit tests. The `req` object returned is a mockup of a true Express
      // `req` object.
      //
      // An `options` object may be passed. If `options.role` is set,
      // it may be `anon` (no role and no req.user), `guest`, `contributor`,
      // `editor`, or `admin`. For bc reasons, it defaults to `admin`.
      //
      // Other properties of `options` are assigned as properties of the
      // returned `req` object before any initialization tasks such as computing
      // `req.absoluteUrl`. This facilitates unit testing.

      getReq(options) {
        options = options || {};
        options.role = options.role || 'admin';
        const req = {
          ...(options.role === 'anon' ? {} : {
            user: {
              title: 'System Task',
              role: options.role
            }
          }),
          res: {},
          t(key, options = {}) {
            return self.apos.i18n.i18next.t(key, {
              ...options,
              lng: req.locale
            });
          },
          data: {},
          protocol: 'http',
          get: function (propName) {
            return { Host: 'you-need-to-set-baseUrl-in-app-js.com' }[propName];
          },
          query: {},
          url: '/',
          locale: self.apos.argv.locale || self.apos.modules['@apostrophecms/i18n'].defaultLocale,
          mode: 'published',
          aposNeverLoad: {},
          aposStack: [],
          __(key) {
            self.apos.util.warnDevOnce('old-i18n-req-helper', stripIndent`
              The req.__() and res.__() functions are deprecated and do not localize in A3.
              Use req.t instead.
            `);
            return key;
          }
        };
        addCloneMethod(req);
        req.res.__ = req.__;
        const { role, ..._properties } = options || {};
        Object.assign(req, _properties);
        self.apos.i18n.setPrefixUrls(req);
        return req;

        function addCloneMethod(req) {
          req.clone = (properties = {}) => {
            const _req = {
              ...req,
              ...properties
            };
            self.apos.i18n.setPrefixUrls(_req);
            addCloneMethod(_req);
            return _req;
          };
        }
      },

      // Convenience wrapper for `getReq`. Returns a request
      // object simulating an anonymous site visitor, with no role
      // and no `req.user`.
      getAnonReq(options) {
        return self.getReq({
          role: 'anon',
          ...options
        });
      },

      // Convenience wrapper for `getReq`. Returns a request
      // object simulating a user with the guest role.
      getGuestReq(options) {
        return self.getReq({
          role: 'guest',
          ...options
        });
      },

      // Convenience wrapper for `getReq`. Returns a request
      // object simulating a user with the contributor role.
      getContributorReq(options) {
        return self.getReq({
          role: 'contributor',
          ...options
        });
      },

      // Convenience wrapper for `getReq`. Returns a request
      // object simulating a user with the editor role.
      getEditorReq(options) {
        return self.getReq({
          role: 'editor',
          ...options
        });
      },

      // Convenience wrapper for `getReq`. Returns a request
      // object simulating a user with the admin role.
      getAdminReq(options) {
        // For bc reasons this is the default behavior of getReq
        return self.getReq(options);
      }

    };
  }
};
