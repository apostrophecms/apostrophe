var Promise = require('bluebird');
var _ = require('@sailshq/lodash');

module.exports = function(self, options) {
  self.addTasks = function() {
    self.addGenerateTask();
  };
  self.addGenerateTask = function() {
    if (self.isAdminOnly()) {
      // Generating users and groups is not a good idea
      return;
    }
    self.apos.tasks.add(self.__meta.name, 'generate',
      'Invoke this task to generate sample docs of this type. Use\n' +
      'the --total option to control how many are added to the database.\n' +
      'You can remove them all later with the --remove option.',
      function(apos, argv, callback) {
        if (argv.remove) {
          return remove();
        } else {
          return generate();
        }
        function generate() {
          var total = argv.total || 10;
          var req = self.apos.tasks.getReq();
          return Promise.each(_.range(0, total), function(i) {
            var piece = self.generate(i);
            piece.aposSampleData = true;
            return self.insert(req, piece);
          })
            .asCallback(callback);
        }
        function remove() {
          return self.apos.docs.db.remove({
            type: self.name,
            aposSampleData: true
          }, callback);
        }
      }
    );
  };
};
