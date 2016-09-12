/**
 * tasks
 * @augments Augments the apos object with facilities for command line tasks that run
 * with access to the same resources that would otherwise be available to web requests.
 * TODO: this is a good candidate for an independent npm module.
 */

var _ = require('lodash');
var argv = require('optimist').argv;
var async = require('async');

module.exports = function(self) {
  var taskActive = 0;

  // If a task event listener needs to return and keep working it should
  // invoke this callback to signify that. Apostrophe will not exit until
  // all busy tasks are marked done.
  self.taskBusy = function() {
    taskActive++;
  };

  // Call when no longer busy
  self.taskDone = function() {
    taskActive--;
  };

  // Return a `req` object suitable for use with putPage, getPage, etc.
  // that has full admin permissions. For use in command line tasks
  self.getTaskReq = function() {
    return {
      user: {
        permissions: {
          admin: true
        }
      },
      baseUrl: self.options.baseUrl,
      res: {
        __: function(s) {
          return s;
        }
      },
      // TODO: this will be hard to sustain
      // as we add more methods to the request
      // prototype.
      traceIn: function() {},
      traceOut: function() {}
    };
  };

  var taskFailed = false;

  // Call if the final exit status should not be 0 (something didn't work, and you want
  // shell scripts invoking this command line task to be able to tell)
  self.taskFailed = function() {
    taskFailed = true;
  };

  self.isTask = function() {
    return !!argv._.length;
  };

  // Call this method just before invoking listen(). If it returns true, do not invoke
  // listen(). Just let the Apostrophe command line task that has been invoked
  // come to a graceful end on its own. This method only takes over if the
  // first argument begins with apostrophe:, so you can easily implement your own
  // command line processing without conflicts.
  //
  // "Why not have standalone task apps?" Because all the configuration and
  // initialization you do for a server is typically needed for command line tasks
  // to succeed as well (for instance, the right database connection).
  //
  // Typically this method is called for you by `apostrophe-site`.

  self.startTask = function(taskGroups) {

    if (!argv._.length) {
      return false;
    }
    if (!taskGroups) {
      taskGroups = {};
    }
    if (!taskGroups.apostrophe) {
      taskGroups.apostrophe = {};
    }

    // apostrophe:tasks reports JSON information about tasks
    self.tasks.tasks = function(callback) {
      // Joel: right now this prints user-readable stuff.
      // It's up to you to output it in a format you
      // consider more machine-readable. This is just a
      // copy and paste of the usage() function. -Tom
      var groups = _.keys(taskGroups);
      groups.sort();
      _.each(groups, function(group) {
        var cmds = _.keys(taskGroups[group]);
        cmds.sort();
        _.each(cmds, function(cmd) {
          console.error(self.cssName(group) + ':' + self.cssName(cmd));
        });
        // Separate groups with a blank line
        console.error('');
      });
      return callback(null);
    };

    _.defaults(taskGroups.apostrophe, self.tasks);

    // A chance for other modules to register tasks by modifying taskGroups
    self.emit('tasks:register', taskGroups);

    // Accept . as well as : to please javascriptizens and symfonians
    var matches = argv._[0].match(/^(.*?)[\:|\.](.*)$/);
    if (!matches) {
      return false;
    }
    var group = matches[1];
    var cmd = matches[2];
    var camelGroup = self.camelName(group);
    if (!taskGroups[camelGroup]) {
      console.error('There are no tasks in the ' + group + ' group.');
      return usage();
    }
    group = taskGroups[camelGroup];

    function wait(callback) {
      var interval = setInterval(function() {
        if (!taskActive) {
          clearInterval(interval);
          return callback(null);
        }
      }, 10);
    }

    var camelCmd = self.camelName(cmd);
    if (_.has(group, camelCmd)) {
      // Think about switching to an event emitter that can wait.

      async.series({
        before: function(callback) {
          self.emit('task:' + argv._[0] + ':before');
          return wait(callback);
        },
        run: function(callback) {

          // Tasks can accept site, apos, argv and a callback;
          // OR apos, argv, and a callback;
          // OR just a callback;
          // OR no arguments at all.
          //
          // If they accept no arguments at all, they must
          // utilize apos.taskBusy() and apos.taskDone(), and
          // call apos.taskFailed() in the event of an error.

          var task = group[camelCmd];
          if (task.length === 4) {
            return task(self._site, self, argv, callback);
          } else if (task.length === 3) {
            return task(self, argv, callback);
          } else if (task.length === 1) {
            return task(callback);
          } else {
            task();
            return wait(callback);
          }
        },
        after: function(callback) {
          self.emit('task:' + argv._[0] + ':after');
          return wait(callback);
        }
      }, function(err) {
        if (err) {
          console.error('Task failed:');
          console.error(err);
          process.exit(1);
        }
        process.exit(taskFailed ? 1 : 0);
      });

      return true;

    } else {
      console.error('There is no such task.');
      return usage();
    }

    function usage() {
      console.error('\nAvailable tasks:\n');
      var groups = _.keys(taskGroups);
      groups.sort();
      _.each(groups, function(group) {
        var cmds = _.keys(taskGroups[group]);
        cmds.sort();
        _.each(cmds, function(cmd) {
          console.error(self.cssName(group) + ':' + self.cssName(cmd));
        });
        // Separate groups with a blank line
        console.error('');
      });
      console.error('\nYou may also use periods (.) as separators and camelCaseForNames.\n');
      process.exit(1);
    }
  };

  // Register our standard tasks

  self.tasks.migrate = function(site, apos, argv, callback) {
    return self.migrate(argv, callback);
  };

  self.tasks.reset = function(callback) {
    return require('./tasks/reset.js')(self, callback);
  };

  self.tasks.index = function(callback) {
    return require('./tasks/index.js')(self, callback);
  };

  self.tasks.rescale = function(site, apos, argv, callback) {
    return require('./tasks/rescale.js')(self, argv, callback);
  };

  self.tasks.emptyTrash = function(site, apos, argv, callback) {
    return require('./tasks/emptyTrash.js')(self, argv, callback);
  };

  self.tasks.hideTrash = function(callback) {
    require('./tasks/hideTrash.js')(self, callback);
  };

  // This is not a migration because it is not mandatory to have search on your site
  self.tasks.search = function(callback) {
    return require('./tasks/search.js')(self, callback);
  };

  self.tasks.dropTestData = function(callback) {
    require('./tasks/dropTestData.js')(self, callback);
  };

  // "What about apostrophe:generation?" That task
  // is implemented directly by apostrophe-site because
  // it must do things *before* Apostrophe is fully awake. -Tom
};

