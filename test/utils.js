var assert = require('assert');

describe('Utils', function(){
  var apos;

  it('should exist on the apos object', function(done){
    apos = require('../index.js')({ 
      root: module,
      shortName: 'test',
      hostName: 'test.com',
      afterInit: function(callback) {
        assert(apos.utils);
        return done();
      }
    });
  });

  // UTIL METHODS ------------------------------------------------------- //

  describe('methods', function(){

    it('generateId: should return a string of an number', function(done){
      var id = apos.utils.generateId();

      assert(typeof(id) === 'string');
      assert(typeof(parseInt(id)) === 'number');
      return done();
    });
    
    it('globalReplace: should replace multiple instances of a string', function(done){
      var s = apos.utils.globalReplace('apostrophe is for cool kids. therefore apostrophe is cool.', 'apostrophe', 'comma');

      assert(s.indexOf('apostrophe') < 0);
      assert(s.split('comma').length == 3);
      return done();
    });
    
    it('truncatePlaintext: should tuncate a message without cutting off a word', function(done){
      var s = apos.utils.truncatePlaintext('I want to be cut off here. This is an extra sentance.', 25);

      assert(s.indexOf('here') > 0);
      return done();
    });

    it('escapeHtml: should replace html tags with html string entites', function(done){
      var s = apos.utils.escapeHtml('<div>hello</div>');
      
      assert(s.indexOf('<') < 0 && s.indexOf('&lt;') >= 0);
      return done();
    });

    it('htmlToPlaintext: should strip all html notation', function(done){
      var s = apos.utils.htmlToPlaintext('<div>hello</div>');

      assert(s.indexOf('<') < 0 && s.indexOf('hello') >= 0);
      return done();
    });

    it('capitalizeFirst: should capitalize the first letter', function(done){
      var s = apos.utils.capitalizeFirst('hello');
      
      assert(s.indexOf('hello') < 0 && s.indexOf('H' == 0));
      return done();
    });

    it('cssName: should covert camelCase or underscore name formats to hyphenated css-style', function(done){
      var s = apos.utils.cssName('camelCase and under_score');

      assert(s.indexOf('C') < 0 && s.indexOf('_') < 0);
      assert(s.indexOf('camel-case') >= 0);
      return done();
    });

    it('camelName: should convert non digits or ASII characters to a capitalized version of the next character', function(done){
      var s = apos.utils.camelName('hello apostrophe');

      assert(s.indexOf(' ') < 0 && s.indexOf('A') == 5);
      return done();
    });

    it('addSlashIfNeeded: should add a slash "/" to the end of a path if necessary', function(done){
      var s = apos.utils.addSlashIfNeeded('/my/path');
      
      assert(s === '/my/path/');
      return done();
    }); 
  });
});