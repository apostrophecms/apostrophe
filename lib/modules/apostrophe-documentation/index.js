var _ = require('lodash');
var fs = require('fs');

// Assists in generating documentation for A2. Normally disabled.

module.exports = {
  enabled: false,
  construct: function(self, options) {
    if (!options.enabled) {
      return;
    }
    self.route('get', 'scripts', function(req, res) {
      req.scene = 'user';
      return self.sendPage(req, 'scripts', {});
    });
    self.modulesReady = function() {
      console.log('Server side definitions');
      console.log(self.apos.synth.definitions);
      console.log('browser side definitions');
      self.apos.options.afterListen = function() {
        console.log('in afterListen');
        return require('child_process').exec('phantomjs ' + __dirname + '/phantomjs-print-definitions.js', function(err, stdout, stderr) {
          console.log('hi mom');
          if (err) {
            throw err;
          }
          console.log(stdout);
          // process.exit(0);
        });
      };
    };
  }
};
