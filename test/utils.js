var assert = require('assert');
var _ = require('lodash');

describe('Utils', function(){

  this.timeout(5000);

  var apos;

  it('should exist on the apos object', function(done){
    apos = require('../index.js')({
      root: module,
      shortName: 'test',
      
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

    it('clonePermanent: should discard properties beginning with _ other than _id', function() {
      assert(_.isEqual(
        apos.utils.clonePermanent({
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true,
          _blee: {
            bloo: true
          }
        }),
        {
          tree: {
            branch: {
              leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          }
        }
      ));
    });

    it('clonePermanent with keepScalars: should discard properties beginning with _ other than _id unless they are scalars (non-objects)', function() {
      assert(_.isEqual(
        apos.utils.clonePermanent({
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true,
          _blee: {
            bloo: true
          }
        }, true),
        {
          tree: {
            branch: {
              leaf: true,
              _leaf: true
            },
            branches: [
              'one',
              'two',
              'three'
            ]
          },
          _tree: true
        }
      ));
    });

    it('clonePermanent should not behave bizarrely with a test case from the punkave site', function() {
      var input = {
        "attachment" : {
      		"_id" : "a205filea1media97",
      		"title" : "http-window-punkave-com-wp-content-uploads-2009-01-n56601994_30792414_5081-225x300-jpg",
      		"width" : 225,
      		"height" : 300,
      		"length" : 22014,
      		"md5" : 22014,
      		"extension" : "jpg",
      		"group" : "images",
      		"name" : "http-window-punkave-com-wp-content-uploads-2009-01-n56601994_30792414_5081-225x300-jpg",
      		"landscape" : false,
      		"portrait" : true,
      		"a15Export" : true,
      		"tags" : [
      			"p'window",
      			"2009"
      		],
      		"searchText" : "http window punkave com wp content uploads 2009 01 n56601994 30792414 5081 225x300 jpg http window punkave com wp content uploads 2009 01 n56601994 30792414 5081 225x300 jpg jpg",
      		"type" : "attachment"
      	}
      };
      var clone = apos.utils.clonePermanent(input);
      assert(clone.attachment._id === "a205filea1media97");
    });
  });
});
