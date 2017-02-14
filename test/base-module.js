var assert = require('assert');

describe('Base Module', function(){

  this.timeout(5000);

  var apos;

  it('should be subclassable', function(done){
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      modules: {
        // will push an asset for us to look for later
        'apostrophe-test-module-push': {}
      },
      afterInit: function(callback) {
        assert(apos.test && apos.test.color === 'red');
        return done();
      }
    });
  });

  it('should provide apos.assets with the right context for pushing assets', function(done){
    var found = false;
    for (var i = apos.assets.pushed.stylesheets.length - 1; i >= 0; i--) {
      if (apos.assets.pushed.stylesheets[i].file == __dirname + '/lib/modules/apostrophe-test-module-push/public/css/test.css') {
        found = true;
        break;
      }
    };
    assert(found);
    return done();
  });
});
