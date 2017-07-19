var assert = require('assert');

describe('Db', function(){

  this.timeout(5000);

  it('should exist on the apos object with a connection at port 27017', function(done){
    var apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
      afterInit: function(callback) {
        assert(apos.db);
        assert(apos.db.serverConfig.port === 27017)
        return done();
      }
    });
  });
});
