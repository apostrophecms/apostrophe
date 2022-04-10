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
const { SemanticAttributes } = require('@opentelemetry/semantic-conventions');

module.exports = {
  options: { alias: 'task' },
  handlers(self) {
    return {
      'apostrophe:run': {
        async runTask(isTask) {

          if (!isTask) {
            return;
          }

          const cmd = self.apos.argv._[0];
          const telemetry = self.apos.telemetry;
          const spanName = `task:${cmd}`;
          await telemetry.aposStartActiveSpan(spanName, async (span) => {
            span.setAttribute(SemanticAttributes.CODE_FUNCTION, 'runTask');
            span.setAttribute(SemanticAttributes.CODE_NAMESPACE, '@apostrophecms/task');
            span.setAttribute(telemetry.AposAttributes.ARGV, telemetry.stringify(self.apos.argv));

            let task;
            if (!cmd) {
              const msg = 'There is no command line argument to serve as a task name, should never happen';
              console.error(msg);
              await self.exit(1, span, msg);
            }

            if (cmd === 'help') {
              span.setAttribute(telemetry.AposAttributes.TARGET_FUNCTION, 'help');
              // list all tasks
              if (self.apos.argv._.length === 1) {
                await self.usage(span);
              }

              // help with specific task
              if (self.apos.argv._.length === 2) {
                span.setAttribute(telemetry.AposAttributes.TARGET_NAMESPACE, self.apos.argv._[1]);
                task = self.find(self.apos.argv._[1]);
                if (!task) {
                  console.error('There is no such task.');
                  await self.usage(span, 'There is no such task.');
                }
                if (task.usage) {
                  console.log(`\nTips for the ${task.fullName} task:\n`);
                  console.log(task.usage);
                } else {
                  console.log('That is a valid task, but it does not have a help message.');
                }
                await self.exit(0, span);
              }
            }

            task = self.find(cmd);

            if (!task) {
              console.error('\nThere is no such task.');
              await self.usage(span, `There is no such task ${cmd}`);
            }

            const [ moduleName, taskName ] = task.fullName.split(':');
            span.setAttribute(telemetry.AposAttributes.TARGET_NAMESPACE, moduleName);
            span.setAttribute(telemetry.AposAttributes.TARGET_FUNCTION, taskName);

            try {
              await task.task(self.apos.argv);
              await self.exit(0, span);
            } catch (e) {
              console.error(e);
              await self.exit(1, span, e);
            }
          });
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
        const telemetry = self.apos.telemetry;
        const spanName = `task:${self.__meta.name}:${name}`;
        await telemetry.aposStartActiveSpan(spanName, async (span) => {
          span.setAttribute(SemanticAttributes.CODE_FUNCTION, 'invoke');
          span.setAttribute(SemanticAttributes.CODE_NAMESPACE, '@apostrophecms/task');
          try {
            const aposArgv = self.apos.argv;
            if (Array.isArray(args)) {
              args.splice(0, 0, name);
            } else {
              options = args;
              args = [ name ];
            }
            const task = self.find(name);
            const [ moduleName, taskName ] = task.fullName.split(':');
            span.setAttribute(telemetry.AposAttributes.TARGET_NAMESPACE, moduleName);
            span.setAttribute(telemetry.AposAttributes.TARGET_FUNCTION, taskName);
            const argv = {
              _: args,
              ...options || {}
            };
            span.setAttribute(telemetry.AposAttributes.ARGV, telemetry.stringify(argv));
            self.apos.argv = argv;
            await task.task(argv);
            self.apos.argv = aposArgv;
            span.setStatus({ code: telemetry.SpanStatusCode.OK });
          } catch (err) {
            telemetry.aposHandleError(span, err);
            throw err;
          } finally {
            span.end();
          }
        });
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

      async usage(span, err) {
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
        await self.exit(1, span, err);
      },

      async exit(code, span, err) {
        if (!span) {
          await self.apos._exit(code);
          return;
        }

        if (err) {
          self.apos.telemetry.aposHandleError(span, err);
        } else if (code) {
          span.setStatus({ code: self.apos.telemetry.SpanStatusCode.ERROR });
        } else {
          span.setStatus({ code: self.apos.telemetry.SpanStatusCode.OK });
        }
        span.end();

        await self.apos._exit(code);
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
          res: {
            redirect(url) {
              req.res.redirectedTo = url;
            },
            header(key, value) {
              req.res.headers = {
                ...(req.res.headers || {}),
                [key]: value
              };
            }
          },
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
          },
          session: {}
        };
        addCloneMethod(req);
        req.res.__ = req.__;
        const { _role, ...properties } = options || {};
        Object.assign(req, properties);
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
