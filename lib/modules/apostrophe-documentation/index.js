var _ = require('lodash');
var fs = require('fs');

// Assists in generating documentation for A2

module.exports = {
  enabled: false,
  construct: function(self, options) {
    // Routes have to be added before tasks get executed, but we don't
    // want this route in place when we're not running the task
    if (self.apos.argv._[0] === 'apostrophe-documentation:extract-moog-types') {
      self.route('get', 'scripts', function(req, res) {
        req.scene = 'user';
        return self.sendPage(req, 'scripts', {});
      });
    }
    self.apos.tasks.add('apostrophe-documentation', 'extract-moog-types', function(callback) {
      console.log('Fetching server side definitions');
      fs.writeFileSync(self.apos.rootDir + '/data/server-types.json', JSON.stringify(self.apos.synth.definitions));
      console.log('Fetching browser side definitions');
      self.apos.options.afterListen = function() {
        console.log('in afterListen');
        return require('child_process').exec('phantomjs ' + __dirname + '/phantomjs-print-definitions.js', function(err, stdout, stderr) {
          if (err) {
            throw err;
          }
          fs.writeFileSync(self.apos.rootDir + '/data/browser-types.json', stdout);
          process.exit(0);
        });
      };
      self.apos.listen();
    });
  }
};
