let Promise = require('bluebird');
let _ = require('lodash');

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
      async function(apos, argv) {
        if (argv.remove) {
          return remove();
        } else {
          return generate();
        }
        async function generate() {
          const total = argv.total || 10;
          const req = self.apos.tasks.getReq();

          for (let i = 0; (i < total); i++) {
            const piece = self.generate(i);
            piece.aposSampleData = true;
            await self.insert(req, piece);
          }
        }
        async function remove() {
          return self.apos.docs.db.remove({
            type: self.name,
            aposSampleData: true
          });
        }
      }
    );
  };
};
