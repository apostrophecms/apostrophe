var _ = require('lodash');

module.exports = {

  alias: 'tasks',

  afterConstruct: function(self) {
    self.apos.on('runTask', self.run);
  },

  construct: function(self, options) {

    self.tasks = {};

    // You may also call with just (group, name, callback)
    // if you don't need to provide a help message

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
    // should run with administrative rights

    self.getReq = function() {
      return {
        user: {
          _permissions: {
            admin: true
          }
        },
        baseUrl: self.apos.modules['apostrophe-express'].baseUrl,
        res: {
          __: function(s) {
            return s;
          }
        }
      };
    };
  }
};
