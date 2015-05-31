var assert = require('assert');

describe('Db', function(){
  it('should exist on the apos object with a connection at port 27017', function(done){
    var apos = require('../index.js')({ 
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      afterInit: function(callback) {
        assert(apos.db);
        assert(apos.db.serverConfig.port === 27017)
        return done();
      }
    });
  });
});
